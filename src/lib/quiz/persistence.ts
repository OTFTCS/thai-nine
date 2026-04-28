import type {
  AssessmentAttempt,
  AssessmentAnswer,
  AssessmentHistoryRecord,
  AssessmentQuizKind,
  LearnerTrack,
  NineModeReviewState,
} from "@/types/assessment";
import { IDK_CHOICE_ID } from "@/types/assessment";
import { buildChoiceOrderForQuestion } from "@/lib/quiz/choice-order";
import { getQuestionById } from "@/lib/quiz/question-banks";
import type { AssessmentQuestion } from "@/types/assessment";

const ATTEMPT_KEY_PREFIX = "immersion-thai.assessment.attempt.v2";
const LEGACY_ATTEMPT_KEY_PREFIX = "immersion-thai.assessment.attempt.v1";
const HISTORY_KEY = "immersion-thai.assessment.history.v2";
const LEGACY_HISTORY_KEY = "immersion-thai.assessment.history.v1";
const NINE_MODE_KEY = "immersion-thai.assessment.nine-mode.v1";

interface AttemptLoadResult {
  attempt: AssessmentAttempt | null;
  notice?: string;
}

interface LegacyAnswer {
  selectedChoiceId?: string;
  isCorrect?: boolean;
  timeToAnswerMs?: number;
  replayCount?: number;
  answeredAt?: string;
  answerType?: "choice" | "idk";
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function buildAttemptKey(quizKind: AssessmentQuizKind) {
  return `${ATTEMPT_KEY_PREFIX}.${quizKind}`;
}

function buildLegacyAttemptKey(quizKind: AssessmentQuizKind) {
  return `${LEGACY_ATTEMPT_KEY_PREFIX}.${quizKind}`;
}

function buildAttemptId(quizKind: AssessmentQuizKind) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${quizKind}-${crypto.randomUUID()}`;
  }

  return `${quizKind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createChoiceOrderByQuestion(
  attemptId: string,
  questions: AssessmentQuestion[]
) {
  return Object.fromEntries(
    questions.map((question) => [question.id, buildChoiceOrderForQuestion(attemptId, question)])
  );
}

function sanitizeAnswer(
  rawAnswer: LegacyAnswer,
  question: AssessmentQuestion
): AssessmentAnswer | null {
  const validChoiceIds = new Set(question.choices.map((choice) => choice.id));

  const answerType = rawAnswer.answerType ||
    (rawAnswer.selectedChoiceId === IDK_CHOICE_ID ? "idk" : "choice");

  if (answerType === "idk") {
    return {
      questionId: question.id,
      answerType: "idk",
      selectedChoiceId: null,
      isCorrect: false,
      timeToAnswerMs: rawAnswer.timeToAnswerMs || 0,
      replayCount: rawAnswer.replayCount || 0,
      answeredAt: rawAnswer.answeredAt || new Date().toISOString(),
    };
  }

  if (!rawAnswer.selectedChoiceId || !validChoiceIds.has(rawAnswer.selectedChoiceId)) {
    return null;
  }

  return {
    questionId: question.id,
    answerType: "choice",
    selectedChoiceId: rawAnswer.selectedChoiceId,
    isCorrect: rawAnswer.selectedChoiceId === question.correctChoiceId,
    timeToAnswerMs: rawAnswer.timeToAnswerMs || 0,
    replayCount: rawAnswer.replayCount || 0,
    answeredAt: rawAnswer.answeredAt || new Date().toISOString(),
  };
}

function normalizeAttempt(
  rawAttempt: Record<string, unknown>,
  quizKind: AssessmentQuizKind,
  isLegacy: boolean
): AttemptLoadResult {
  const rawQuestionIds = Array.isArray(rawAttempt.questionIds)
    ? rawAttempt.questionIds.filter((value): value is string => typeof value === "string")
    : [];

  if (rawQuestionIds.length === 0) {
    return {
      attempt: null,
      notice: "Saved quiz progress was incompatible and has been reset. Start a new attempt.",
    };
  }

  const questions = rawQuestionIds
    .map((questionId) => getQuestionById(quizKind, questionId))
    .filter((question): question is AssessmentQuestion => Boolean(question));

  if (questions.length !== rawQuestionIds.length) {
    return {
      attempt: null,
      notice:
        "Saved quiz progress referenced outdated questions and has been reset. Start a new attempt.",
    };
  }

  const attemptId =
    typeof rawAttempt.attemptId === "string" && rawAttempt.attemptId.length > 0
      ? rawAttempt.attemptId
      : buildAttemptId(quizKind);

  const rawChoiceOrder =
    typeof rawAttempt.choiceOrderByQuestion === "object" && rawAttempt.choiceOrderByQuestion
      ? (rawAttempt.choiceOrderByQuestion as Record<string, string[]>)
      : {};

  const choiceOrderByQuestion = createChoiceOrderByQuestion(attemptId, questions);

  questions.forEach((question) => {
    const candidateOrder = rawChoiceOrder[question.id];
    if (!Array.isArray(candidateOrder)) {
      return;
    }

    const unique = [...new Set(candidateOrder)];
    const questionChoiceIds = new Set(question.choices.map((choice) => choice.id));

    if (
      unique.length === question.choices.length &&
      unique.every((choiceId) => questionChoiceIds.has(choiceId))
    ) {
      choiceOrderByQuestion[question.id] = unique;
    }
  });

  const rawAnswers =
    typeof rawAttempt.answers === "object" && rawAttempt.answers
      ? (rawAttempt.answers as Record<string, LegacyAnswer>)
      : {};

  const answers: Record<string, AssessmentAnswer> = {};

  questions.forEach((question) => {
    const normalized = sanitizeAnswer(rawAnswers[question.id] || {}, question);
    if (normalized) {
      answers[question.id] = normalized;
    }
  });

  const rawReplayCounts =
    typeof rawAttempt.replayCounts === "object" && rawAttempt.replayCounts
      ? (rawAttempt.replayCounts as Record<string, number>)
      : {};

  const replayCounts: Record<string, number> = {};
  questions.forEach((question) => {
    replayCounts[question.id] = Number(rawReplayCounts[question.id] || 0);
  });

  const nowIso = new Date().toISOString();
  const attempt: AssessmentAttempt = {
    schemaVersion: 2,
    attemptId,
    quizKind,
    track:
      rawAttempt.track === "reader" || rawAttempt.track === "non_reader"
        ? rawAttempt.track
        : undefined,
    questionIds: rawQuestionIds,
    choiceOrderByQuestion,
    currentIndex:
      typeof rawAttempt.currentIndex === "number" && rawAttempt.currentIndex >= 0
        ? Math.min(rawAttempt.currentIndex, Math.max(rawQuestionIds.length - 1, 0))
        : 0,
    answers,
    replayCounts,
    startedAt:
      typeof rawAttempt.startedAt === "string" ? rawAttempt.startedAt : nowIso,
    updatedAt:
      typeof rawAttempt.updatedAt === "string" ? rawAttempt.updatedAt : nowIso,
    completedAt:
      typeof rawAttempt.completedAt === "string" ? rawAttempt.completedAt : undefined,
    advisory: Boolean(rawAttempt.advisory),
  };

  return {
    attempt,
    notice: isLegacy
      ? "Saved quiz progress was upgraded to the latest format."
      : undefined,
  };
}

export function createAttempt(
  quizKind: AssessmentQuizKind,
  questions: AssessmentQuestion[],
  track?: LearnerTrack
): AssessmentAttempt {
  const now = new Date().toISOString();
  const attemptId = buildAttemptId(quizKind);

  return {
    schemaVersion: 2,
    attemptId,
    quizKind,
    track,
    questionIds: questions.map((question) => question.id),
    choiceOrderByQuestion: createChoiceOrderByQuestion(attemptId, questions),
    currentIndex: 0,
    answers: {},
    replayCounts: {},
    startedAt: now,
    updatedAt: now,
    advisory: false,
  };
}

export function loadAttemptState(quizKind: AssessmentQuizKind): AttemptLoadResult {
  if (!hasStorage()) {
    return { attempt: null };
  }

  const currentRaw = safeParse<Record<string, unknown> | null>(
    window.localStorage.getItem(buildAttemptKey(quizKind)),
    null
  );

  if (currentRaw) {
    const result = normalizeAttempt(currentRaw, quizKind, false);
    if (!result.attempt) {
      window.localStorage.removeItem(buildAttemptKey(quizKind));
    }
    return result;
  }

  const legacyRaw = safeParse<Record<string, unknown> | null>(
    window.localStorage.getItem(buildLegacyAttemptKey(quizKind)),
    null
  );

  if (!legacyRaw) {
    return { attempt: null };
  }

  const upgraded = normalizeAttempt(legacyRaw, quizKind, true);

  window.localStorage.removeItem(buildLegacyAttemptKey(quizKind));
  if (upgraded.attempt) {
    saveAttempt(upgraded.attempt);
  }

  return upgraded;
}

export function loadAttempt(quizKind: AssessmentQuizKind): AssessmentAttempt | null {
  return loadAttemptState(quizKind).attempt;
}

export function saveAttempt(attempt: AssessmentAttempt) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(
    buildAttemptKey(attempt.quizKind),
    JSON.stringify({ ...attempt, updatedAt: new Date().toISOString() })
  );
}

export function clearAttempt(quizKind: AssessmentQuizKind) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(buildAttemptKey(quizKind));
  window.localStorage.removeItem(buildLegacyAttemptKey(quizKind));
}

export function loadAssessmentHistory(): AssessmentHistoryRecord[] {
  if (!hasStorage()) {
    return [];
  }

  const current = safeParse<AssessmentHistoryRecord[] | null>(
    window.localStorage.getItem(HISTORY_KEY),
    null
  );

  if (current) {
    return current;
  }

  const legacy = safeParse<AssessmentHistoryRecord[] | null>(
    window.localStorage.getItem(LEGACY_HISTORY_KEY),
    null
  );

  if (!legacy) {
    return [];
  }

  const upgraded = legacy
    .map((record) => {
      const normalized = normalizeAttempt(
        record.attempt as unknown as Record<string, unknown>,
        record.attempt.quizKind,
        true
      );

      if (!normalized.attempt) {
        return null;
      }

      return { attempt: normalized.attempt };
    })
    .filter((record): record is AssessmentHistoryRecord => Boolean(record));

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(upgraded));
  window.localStorage.removeItem(LEGACY_HISTORY_KEY);

  return upgraded;
}

export function saveHistoryRecord(record: AssessmentHistoryRecord) {
  if (!hasStorage()) {
    return;
  }

  const existing = loadAssessmentHistory().filter(
    (historyRecord) => historyRecord.attempt.attemptId !== record.attempt.attemptId
  );

  const next = [record, ...existing]
    .sort((a, b) => {
      const aDate = a.attempt.completedAt || a.attempt.updatedAt;
      const bDate = b.attempt.completedAt || b.attempt.updatedAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .slice(0, 100);

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function loadHistoryForQuiz(
  quizKind: AssessmentQuizKind
): AssessmentHistoryRecord[] {
  return loadAssessmentHistory().filter(
    (record) => record.attempt.quizKind === quizKind
  );
}

export function loadLatestHistoryForQuiz(
  quizKind: AssessmentQuizKind
): AssessmentHistoryRecord | null {
  return loadHistoryForQuiz(quizKind)[0] || null;
}

function loadNineModeMap(): Record<string, NineModeReviewState> {
  if (!hasStorage()) {
    return {};
  }

  return safeParse<Record<string, NineModeReviewState>>(
    window.localStorage.getItem(NINE_MODE_KEY),
    {}
  );
}

function saveNineModeMap(map: Record<string, NineModeReviewState>) {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(NINE_MODE_KEY, JSON.stringify(map));
}

export function loadNineModeReview(attemptId: string): NineModeReviewState | null {
  const map = loadNineModeMap();
  return map[attemptId] || null;
}

export function saveNineModeReview(
  state: Omit<NineModeReviewState, "updatedAt">
): NineModeReviewState {
  const map = loadNineModeMap();
  const next: NineModeReviewState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  map[state.attemptId] = next;
  saveNineModeMap(map);

  return next;
}

const DIAGNOSTIC_ATTEMPT_KEY_PREFIX = "immersion-thai.diagnostic.attempt.v1";

function buildDiagnosticAttemptKey(token: string) {
  return `${DIAGNOSTIC_ATTEMPT_KEY_PREFIX}.${token}`;
}

export function loadDiagnosticAttempt(token: string): AssessmentAttempt | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(buildDiagnosticAttemptKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentAttempt;
  } catch {
    return null;
  }
}

export function saveDiagnosticAttempt(token: string, attempt: AssessmentAttempt) {
  if (!hasStorage()) return;
  window.localStorage.setItem(
    buildDiagnosticAttemptKey(token),
    JSON.stringify({ ...attempt, updatedAt: new Date().toISOString() })
  );
}

export function clearDiagnosticAttempt(token: string) {
  if (!hasStorage()) return;
  window.localStorage.removeItem(buildDiagnosticAttemptKey(token));
}

const DIAGNOSTIC_CONSENT_KEY_PREFIX = "immersion-thai.diagnostic.consent.v1";

function buildDiagnosticConsentKey(token: string) {
  return `${DIAGNOSTIC_CONSENT_KEY_PREFIX}.${token}`;
}

export function loadDiagnosticConsent(token: string): boolean {
  if (!hasStorage()) return false;
  return window.localStorage.getItem(buildDiagnosticConsentKey(token)) === "true";
}

export function saveDiagnosticConsent(token: string, consent: boolean) {
  if (!hasStorage()) return;
  if (consent) {
    window.localStorage.setItem(buildDiagnosticConsentKey(token), "true");
  } else {
    window.localStorage.removeItem(buildDiagnosticConsentKey(token));
  }
}

export function clearDiagnosticConsent(token: string) {
  if (!hasStorage()) return;
  window.localStorage.removeItem(buildDiagnosticConsentKey(token));
}
