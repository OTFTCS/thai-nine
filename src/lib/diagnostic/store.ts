import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  DiagnosticInvite,
  DiagnosticInviteWithSubmission,
  DiagnosticSubmission,
} from "@/types/diagnostic";

type DbInviteRow = {
  token: string;
  learner_name: string | null;
  learner_email: string | null;
  note: string | null;
  status: string;
  consent_given_at: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
};

type DbSubmissionRow = {
  id: number;
  token: string;
  submitted_at: string;
  track: string | null;
  score: number | null;
  completion_percent: number | null;
  total_correct: number | null;
  total_wrong: number | null;
  total_idk: number | null;
  band: string | null;
  confidence: string | null;
  topic_results: unknown;
  missed_question_ids: unknown;
  lesson_brief: unknown;
  attempt: unknown;
  generated_at: string;
};

function rowToInvite(row: DbInviteRow): DiagnosticInvite {
  return {
    token: row.token,
    status: row.status as DiagnosticInvite["status"],
    ...(row.learner_name != null ? { learnerName: row.learner_name } : {}),
    ...(row.learner_email != null ? { email: row.learner_email } : {}),
    ...(row.note != null ? { note: row.note } : {}),
    createdAt: row.created_at,
    ...(row.completed_at != null ? { completedAt: row.completed_at } : {}),
  };
}

function rowToSubmission(row: DbSubmissionRow): DiagnosticSubmission {
  return {
    token: row.token,
    submittedAt: row.submitted_at,
    ...(row.track != null ? { track: row.track } : {}),
    score: row.score ?? 0,
    completionPercent: row.completion_percent ?? 0,
    totalCorrect: row.total_correct ?? 0,
    totalWrong: row.total_wrong ?? 0,
    totalIdk: row.total_idk ?? 0,
    band: row.band ?? "",
    confidence: row.confidence ?? "",
    topicResults: (row.topic_results as DiagnosticSubmission["topicResults"]) ?? [],
    missedQuestionIds: (row.missed_question_ids as string[]) ?? [],
    lessonBrief: row.lesson_brief as DiagnosticSubmission["lessonBrief"],
  };
}

export async function createInvite(
  data: Pick<DiagnosticInvite, "learnerName" | "email" | "note">
): Promise<DiagnosticInvite> {
  const supabase = createAdminSupabaseClient();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: row, error } = await supabase
    .from("diagnostic_invites")
    .insert({
      token,
      learner_name: data.learnerName ?? null,
      learner_email: data.email ?? null,
      note: data.note ?? null,
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single<DbInviteRow>();

  if (error || !row) {
    throw new Error(error?.message ?? "Failed to create invite");
  }

  return rowToInvite(row);
}

export async function getInviteByToken(token: string): Promise<DiagnosticInvite | null> {
  const supabase = createAdminSupabaseClient();

  const { data: row, error } = await supabase
    .from("diagnostic_invites")
    .select("*")
    .eq("token", token)
    .single<DbInviteRow>();

  if (error || !row) {
    return null;
  }

  if (new Date(row.expires_at) < new Date() && row.status !== "completed") {
    await supabase
      .from("diagnostic_invites")
      .update({ status: "expired" })
      .eq("token", token);
    return null;
  }

  return rowToInvite(row);
}

export async function listInvitesWithSubmissions(): Promise<DiagnosticInviteWithSubmission[]> {
  const supabase = createAdminSupabaseClient();

  const { data: inviteRows, error: inviteError } = await supabase
    .from("diagnostic_invites")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DbInviteRow[]>();

  if (inviteError || !inviteRows) {
    throw new Error(inviteError?.message ?? "Failed to list invites");
  }

  if (inviteRows.length === 0) {
    return [];
  }

  const tokens = inviteRows.map((r) => r.token);

  const { data: subRows } = await supabase
    .from("diagnostic_submissions")
    .select("*")
    .in("token", tokens)
    .returns<DbSubmissionRow[]>();

  const subMap = new Map<string, DiagnosticSubmission>();
  (subRows ?? []).forEach((row) => {
    subMap.set(row.token, rowToSubmission(row));
  });

  return inviteRows.map((row) => ({
    ...rowToInvite(row),
    submission: subMap.get(row.token),
  }));
}

export async function getSubmissionByToken(
  token: string
): Promise<DiagnosticSubmission | null> {
  const supabase = createAdminSupabaseClient();

  const { data: row, error } = await supabase
    .from("diagnostic_submissions")
    .select("*")
    .eq("token", token)
    .single<DbSubmissionRow>();

  if (error || !row) {
    return null;
  }

  return rowToSubmission(row);
}

export async function saveSubmission(
  submission: DiagnosticSubmission,
  consentGiven: boolean
): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const payload = {
    token: submission.token,
    submitted_at: submission.submittedAt,
    track: submission.track ?? null,
    score: submission.score,
    completion_percent: submission.completionPercent,
    total_correct: submission.totalCorrect,
    total_wrong: submission.totalWrong,
    total_idk: submission.totalIdk,
    band: submission.band,
    confidence: submission.confidence,
    topic_results: submission.topicResults,
    missed_question_ids: submission.missedQuestionIds,
    lesson_brief: submission.lessonBrief,
    generated_at: new Date().toISOString(),
  };

  const { error: subError } = await supabase
    .from("diagnostic_submissions")
    .upsert(payload, { onConflict: "token" });

  if (subError) {
    throw new Error(subError.message);
  }

  const inviteUpdate: Record<string, string> = {
    status: "completed",
    completed_at: submission.submittedAt,
  };
  if (consentGiven) {
    inviteUpdate.consent_given_at = new Date().toISOString();
  }

  const { error: inviteError } = await supabase
    .from("diagnostic_invites")
    .update(inviteUpdate)
    .eq("token", submission.token);

  if (inviteError) {
    throw new Error(inviteError.message);
  }
}
