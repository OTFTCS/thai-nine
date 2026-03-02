"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssessmentQuiz,
  AssessmentResult,
  AssessmentSession,
  QuestionAnswer,
} from "@/types/assessment";
import {
  clearSession,
  generateSessionId,
  loadSession,
  saveResult,
  saveSession,
} from "@/lib/assessment-persistence";
import {
  computeAssessmentResult,
  getRunningSectionScore,
} from "@/lib/assessment-scoring";

export interface UseAssessmentReturn {
  /** Current session state */
  session: AssessmentSession | null;
  /** The current question to display (null when done) */
  currentQuestion: AssessmentQuiz["questions"][number] | null;
  /** Current question's 0-based index within the presented path */
  currentIndex: number;
  /** Total questions in the current path (may change due to branching) */
  totalQuestions: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Whether the quiz is complete */
  isComplete: boolean;
  /** The final result (only available after completion) */
  result: AssessmentResult | null;
  /** Start the quiz (or resume an in-progress session) */
  start: () => void;
  /** Answer the current question and advance */
  answer: (optionId: string) => void;
  /** Go back to the previous question (if allowed) */
  goBack: () => void;
  /** Whether going back is possible */
  canGoBack: boolean;
  /** Abandon the current session */
  abandon: () => void;
  /** Retake the quiz from scratch */
  retake: () => void;
  /** Whether a resumable session exists */
  hasResumableSession: boolean;
}

export function useAssessment(quiz: AssessmentQuiz): UseAssessmentReturn {
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [hasResumableSession, setHasResumableSession] = useState(false);
  const questionStartTime = useRef<number>(Date.now());

  // Build the initial question path (all question IDs in section order)
  const buildQuestionPath = useCallback((): string[] => {
    const path: string[] = [];
    for (const section of quiz.sections) {
      for (const qId of section.questionIds) {
        path.push(qId);
      }
    }
    return path;
  }, [quiz]);

  // Check for resumable session on mount
  useEffect(() => {
    const existing = loadSession(quiz.kind, quiz.id);
    setHasResumableSession(!!existing);
  }, [quiz.id, quiz.kind]);

  // Start or resume
  const start = useCallback(() => {
    const existing = loadSession(quiz.kind, quiz.id);
    if (existing) {
      setSession(existing);
      questionStartTime.current = Date.now();
      return;
    }

    const newSession: AssessmentSession = {
      sessionId: generateSessionId(),
      quizId: quiz.id,
      kind: quiz.kind,
      status: "in_progress",
      answers: [],
      currentQuestionIndex: 0,
      questionPath: buildQuestionPath(),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSession(newSession);
    saveSession(newSession);
    questionStartTime.current = Date.now();
  }, [quiz, buildQuestionPath]);

  // Apply branching rules after an answer
  const applyBranching = useCallback(
    (
      currentPath: string[],
      answers: QuestionAnswer[],
      justAnsweredId: string,
    ): string[] => {
      const applicableRules = quiz.branchRules.filter(
        (r) => r.afterQuestionId === justAnsweredId,
      );

      for (const rule of applicableRules) {
        // Find which section the answered question belongs to
        const question = quiz.questions.find((q) => q.id === justAnsweredId);
        if (!question) continue;

        const sectionScore = getRunningSectionScore(
          quiz,
          answers,
          question.sectionId,
        );

        const shouldBranch =
          (rule.ifSectionScoreBelow !== undefined &&
            sectionScore < rule.ifSectionScoreBelow) ||
          (rule.ifSectionScoreAbove !== undefined &&
            sectionScore > rule.ifSectionScoreAbove);

        if (shouldBranch) {
          if (rule.skipToQuestionId === "end") {
            // Truncate path to just the answered questions
            const answeredIds = new Set(answers.map((a) => a.questionId));
            return currentPath.filter((id) => answeredIds.has(id));
          }

          // Find the skip target and remove questions between current and target
          const currentIdx = currentPath.indexOf(justAnsweredId);
          const targetIdx = currentPath.indexOf(rule.skipToQuestionId);

          if (currentIdx >= 0 && targetIdx > currentIdx) {
            // Remove questions between current+1 and target
            return [
              ...currentPath.slice(0, currentIdx + 1),
              ...currentPath.slice(targetIdx),
            ];
          }
        }
      }

      return currentPath;
    },
    [quiz],
  );

  // Answer current question
  const answer = useCallback(
    (optionId: string) => {
      if (!session) return;

      const questionId = session.questionPath[session.currentQuestionIndex];
      if (!questionId) return;

      const question = quiz.questions.find((q) => q.id === questionId);
      if (!question) return;

      const timeSpentMs = Date.now() - questionStartTime.current;
      const correct = optionId === question.correctOptionId;

      const newAnswer: QuestionAnswer = {
        questionId,
        selectedOptionId: optionId,
        timeSpentMs,
        correct,
      };

      // Replace answer if question was already answered (going back then forward)
      const updatedAnswers = [
        ...session.answers.filter((a) => a.questionId !== questionId),
        newAnswer,
      ];

      // Apply branching
      const updatedPath = applyBranching(
        session.questionPath,
        updatedAnswers,
        questionId,
      );

      const nextIndex = session.currentQuestionIndex + 1;
      const isLastQuestion = nextIndex >= updatedPath.length;

      if (isLastQuestion) {
        // Complete the session
        const completedSession: AssessmentSession = {
          ...session,
          answers: updatedAnswers,
          questionPath: updatedPath,
          currentQuestionIndex: nextIndex,
          status: "completed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setSession(completedSession);
        clearSession(quiz.kind, quiz.id);

        const assessmentResult = computeAssessmentResult(
          quiz,
          completedSession,
        );
        setResult(assessmentResult);
        saveResult(assessmentResult);
      } else {
        const updatedSession: AssessmentSession = {
          ...session,
          answers: updatedAnswers,
          questionPath: updatedPath,
          currentQuestionIndex: nextIndex,
          updatedAt: new Date().toISOString(),
        };

        setSession(updatedSession);
        saveSession(updatedSession);
        questionStartTime.current = Date.now();
      }
    },
    [session, quiz, applyBranching],
  );

  // Go back
  const goBack = useCallback(() => {
    if (!session || session.currentQuestionIndex <= 0) return;

    const updatedSession: AssessmentSession = {
      ...session,
      currentQuestionIndex: session.currentQuestionIndex - 1,
      updatedAt: new Date().toISOString(),
    };

    setSession(updatedSession);
    saveSession(updatedSession);
    questionStartTime.current = Date.now();
  }, [session]);

  // Abandon
  const abandon = useCallback(() => {
    if (!session) return;
    clearSession(quiz.kind, quiz.id);
    setSession(null);
    setResult(null);
    setHasResumableSession(false);
  }, [session, quiz]);

  // Retake
  const retake = useCallback(() => {
    clearSession(quiz.kind, quiz.id);
    setSession(null);
    setResult(null);
    setHasResumableSession(false);

    // Auto-start a new session
    const newSession: AssessmentSession = {
      sessionId: generateSessionId(),
      quizId: quiz.id,
      kind: quiz.kind,
      status: "in_progress",
      answers: [],
      currentQuestionIndex: 0,
      questionPath: buildQuestionPath(),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSession(newSession);
    saveSession(newSession);
    questionStartTime.current = Date.now();
  }, [quiz, buildQuestionPath]);

  // Derived values
  const currentQuestion = session
    ? quiz.questions.find(
        (q) => q.id === session.questionPath[session.currentQuestionIndex],
      ) ?? null
    : null;

  const currentIndex = session?.currentQuestionIndex ?? 0;
  const totalQuestions = session?.questionPath.length ?? 0;
  const progressPercent =
    totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0;
  const isComplete = session?.status === "completed";
  const canGoBack = (session?.currentQuestionIndex ?? 0) > 0 && !isComplete;

  return {
    session,
    currentQuestion,
    currentIndex,
    totalQuestions,
    progressPercent,
    isComplete,
    result,
    start,
    answer,
    goBack,
    canGoBack,
    abandon,
    retake,
    hasResumableSession,
  };
}
