import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import type {
  DiagnosticInvite,
  DiagnosticInviteWithSubmission,
  DiagnosticSubmission,
} from "@/types/diagnostic";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "diagnostics.json");

interface DiagnosticStore {
  invites: DiagnosticInvite[];
  submissions: DiagnosticSubmission[];
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): DiagnosticStore {
  ensureDataDir();
  if (!existsSync(STORE_PATH)) {
    return { invites: [], submissions: [] };
  }
  try {
    const raw = readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "invites" in parsed &&
      "submissions" in parsed
    ) {
      return parsed as DiagnosticStore;
    }
    return { invites: [], submissions: [] };
  } catch {
    return { invites: [], submissions: [] };
  }
}

function writeStore(store: DiagnosticStore) {
  ensureDataDir();
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function createInvite(
  data: Pick<DiagnosticInvite, "learnerName" | "email" | "note">
): DiagnosticInvite {
  const store = readStore();
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const invite: DiagnosticInvite = {
    token,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...(data.learnerName ? { learnerName: data.learnerName } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(data.note ? { note: data.note } : {}),
  };

  store.invites.unshift(invite);
  writeStore(store);
  return invite;
}

export function getInviteByToken(token: string): DiagnosticInvite | null {
  const store = readStore();
  return store.invites.find((invite) => invite.token === token) ?? null;
}

export function listInvitesWithSubmissions(): DiagnosticInviteWithSubmission[] {
  const store = readStore();
  const subMap = new Map(
    store.submissions.map((submission) => [submission.token, submission])
  );
  return store.invites.map((invite) => ({
    ...invite,
    submission: subMap.get(invite.token),
  }));
}

export function getSubmissionByToken(
  token: string
): DiagnosticSubmission | null {
  const store = readStore();
  return store.submissions.find((sub) => sub.token === token) ?? null;
}

export function saveSubmission(submission: DiagnosticSubmission): void {
  const store = readStore();

  store.submissions = store.submissions.filter(
    (sub) => sub.token !== submission.token
  );
  store.submissions.unshift(submission);

  const invite = store.invites.find(
    (invite) => invite.token === submission.token
  );
  if (invite) {
    invite.status = "completed";
    invite.completedAt = submission.submittedAt;
  }

  writeStore(store);
}
