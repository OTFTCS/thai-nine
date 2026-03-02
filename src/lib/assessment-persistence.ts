// ---------------------------------------------------------------------------
// Assessment Persistence — localStorage-based with resume support
// ---------------------------------------------------------------------------

import type {
  AssessmentResult,
  AssessmentSession,
  TeacherAssignment,
} from "@/types/assessment";

const STORAGE_PREFIX = "immersion-thai:assessment";

function getKey(kind: string, suffix: string): string {
  return `${STORAGE_PREFIX}:${kind}:${suffix}`;
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Session persistence ─────────────────────────────────────────────────────

/** Generate a simple uuid-like session ID. */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Save (or update) an in-progress session. */
export function saveSession(session: AssessmentSession): void {
  const key = getKey(session.kind, `session:${session.quizId}`);
  safeSet(key, { ...session, updatedAt: new Date().toISOString() });
}

/** Load an in-progress session for a specific quiz. Returns null if none. */
export function loadSession(
  kind: string,
  quizId: string,
): AssessmentSession | null {
  const key = getKey(kind, `session:${quizId}`);
  const session = safeGet<AssessmentSession>(key);

  if (!session) return null;

  // Abandon sessions older than 24 hours
  const updatedAt = new Date(session.updatedAt).getTime();
  const staleThreshold = 24 * 60 * 60 * 1000;
  if (Date.now() - updatedAt > staleThreshold) {
    safeRemove(key);
    return null;
  }

  return session.status === "in_progress" ? session : null;
}

/** Clear a session (on completion or explicit abandon). */
export function clearSession(kind: string, quizId: string): void {
  const key = getKey(kind, `session:${quizId}`);
  safeRemove(key);
}

// ── Result persistence ──────────────────────────────────────────────────────

/** Save a completed assessment result. */
export function saveResult(result: AssessmentResult): void {
  const key = getKey(result.kind, `result:${result.quizId}`);
  safeSet(key, result);

  // Also keep a history array (last 5 attempts)
  const historyKey = getKey(result.kind, `history:${result.quizId}`);
  const history = safeGet<AssessmentResult[]>(historyKey) ?? [];
  history.push(result);
  if (history.length > 5) history.shift();
  safeSet(historyKey, history);
}

/** Load the most recent result for a quiz. */
export function loadResult(
  kind: string,
  quizId: string,
): AssessmentResult | null {
  const key = getKey(kind, `result:${quizId}`);
  return safeGet<AssessmentResult>(key);
}

/** Load attempt history for a quiz. */
export function loadHistory(
  kind: string,
  quizId: string,
): AssessmentResult[] {
  const key = getKey(kind, `history:${quizId}`);
  return safeGet<AssessmentResult[]>(key) ?? [];
}

// ── Teacher assignment persistence ──────────────────────────────────────────

/** Save a teacher assignment. */
export function saveTeacherAssignment(assignment: TeacherAssignment): void {
  const key = getKey("teacher", `assignment:${assignment.sessionId}`);
  safeSet(key, assignment);
}

/** Load a teacher assignment for a session. */
export function loadTeacherAssignment(
  sessionId: string,
): TeacherAssignment | null {
  const key = getKey("teacher", `assignment:${sessionId}`);
  return safeGet<TeacherAssignment>(key);
}
