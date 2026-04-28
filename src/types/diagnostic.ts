export type DiagnosticInviteStatus = "pending" | "completed" | "expired";

export interface DiagnosticInvite {
  token: string;
  status: DiagnosticInviteStatus;
  learnerName?: string;
  email?: string;
  note?: string;
  createdAt: string;
  completedAt?: string;
}

export interface DiagnosticLessonPlanBlock {
  timeMinutes: number;
  activity: string;
  focus: string;
  quickCheck?: string;
}

export interface DiagnosticLessonBrief {
  estimatedBand: string;
  confidence: string;
  strengths: string[];
  priorityGaps: string[];
  teachFirst: string[];
  avoidForNow: string[];
  lessonPlan: DiagnosticLessonPlanBlock[];
  quickChecks: string[];
  generatedAt: string;
}

export interface DiagnosticTopicResult {
  topic: string;
  score: number;
  answered: number;
  correct: number;
  idk: number;
  wrong: number;
}

export interface DiagnosticSubmission {
  token: string;
  submittedAt: string;
  track?: string;
  score: number;
  completionPercent: number;
  totalCorrect: number;
  totalWrong: number;
  totalIdk: number;
  band: string;
  confidence: string;
  topicResults: DiagnosticTopicResult[];
  missedQuestionIds: string[];
  lessonBrief: DiagnosticLessonBrief;
}

export interface DiagnosticInviteWithSubmission extends DiagnosticInvite {
  submission?: DiagnosticSubmission;
}
