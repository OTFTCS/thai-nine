import { NextRequest, NextResponse } from "next/server";
import { getInviteByToken, saveSubmission } from "@/lib/diagnostic/store";
import { generateLessonBrief } from "@/lib/diagnostic/lesson-brief";
import { scoreAssessment, derivePlacementBand } from "@/lib/quiz/scoring";
import { getQuestionsByIds } from "@/lib/quiz/question-banks";
import {
  assemblePlacementQuestionIds,
  getPlacementTargetCount,
} from "@/lib/quiz/assembler";
import type { AssessmentAttempt, LearnerTrack } from "@/types/assessment";
import type { DiagnosticSubmission } from "@/types/diagnostic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token: string;
      attempt: AssessmentAttempt;
      consentGiven?: unknown;
    };

    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid token" },
        { status: 400 }
      );
    }

    if (body.consentGiven !== true) {
      return NextResponse.json(
        { error: "Consent is required to submit the diagnostic" },
        { status: 400 }
      );
    }

    if (!body.attempt || typeof body.attempt !== "object") {
      return NextResponse.json(
        { error: "Missing attempt data" },
        { status: 400 }
      );
    }

    const invite = await getInviteByToken(body.token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status === "completed") {
      return NextResponse.json(
        { error: "Diagnostic already submitted for this invite" },
        { status: 409 }
      );
    }

    const attempt = body.attempt;

    if (
      !Array.isArray(attempt.questionIds) ||
      attempt.questionIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid attempt: no questions" },
        { status: 400 }
      );
    }

    const track = attempt.track as LearnerTrack | undefined;
    const expectedQuestionIds = track
      ? assemblePlacementQuestionIds({
          track,
          targetCount: getPlacementTargetCount(),
          seed: `diagnostic:${body.token}:${track}`,
        })
      : null;

    const submittedSet = new Set(attempt.questionIds);
    const expectedSet = expectedQuestionIds ? new Set(expectedQuestionIds) : null;
    const setsMatch =
      expectedSet !== null &&
      expectedSet.size === submittedSet.size &&
      [...expectedSet].every((id) => submittedSet.has(id));

    if (expectedQuestionIds && !setsMatch) {
      console.warn(
        "[diagnostic/submissions] question set mismatch; using server-derived list",
        { token: body.token, track }
      );
    }

    const questionIdsForScoring = expectedQuestionIds ?? attempt.questionIds;
    const questions = getQuestionsByIds("placement", questionIdsForScoring);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Could not load questions for attempt" },
        { status: 400 }
      );
    }

    const summary = scoreAssessment(questions, attempt.answers);
    const band = derivePlacementBand(summary);
    const lessonBrief = generateLessonBrief(summary);

    const submission: DiagnosticSubmission = {
      token: body.token,
      submittedAt: new Date().toISOString(),
      track: attempt.track,
      score: summary.score,
      completionPercent: summary.completionPercent,
      totalCorrect: summary.totalCorrect,
      totalWrong: summary.totalWrong,
      totalIdk: summary.totalIdk,
      band,
      confidence: summary.confidence,
      topicResults: summary.topicSubscores.map((sub) => ({
        topic: sub.topic,
        score: sub.score,
        answered: sub.answered,
        correct: sub.correct,
        idk: sub.idk,
        wrong: sub.wrong,
      })),
      missedQuestionIds: summary.missedQuestionIds,
      lessonBrief,
    };

    await saveSubmission(submission, true);

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("[diagnostic/submissions POST]", error);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 }
    );
  }
}
