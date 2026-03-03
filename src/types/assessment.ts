export type AssessmentQuizKind = "placement" | "tones" | "reader_tones";

export type LearnerTrack = "reader" | "non_reader";

export type QuestionTrack = "both" | LearnerTrack;

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type AssessmentTopic =
  | "greetings"
  | "politeness"
  | "self_intro"
  | "basics"
  | "numbers"
  | "shopping"
  | "time"
  | "days"
  | "scheduling"
  | "directions"
  | "transport"
  | "food"
  | "ordering"
  | "question_words"
  | "particles"
  | "grammar"
  | "verbs"
  | "adjectives"
  | "family"
  | "daily_life"
  | "tones"
  | "reader_tones";

export interface AssessmentChoice {
  id: string;
  english?: string;
  thai?: string;
  translit?: string;
}

export interface AssessmentQuestion {
  id: string;
  quizKind: AssessmentQuizKind;
  track: QuestionTrack;
  topic: AssessmentTopic;
  difficulty: Difficulty;
  prompt: string;
  thai: string;
  translit: string;
  choices: AssessmentChoice[];
  correctChoiceId: string;
  audioSrc: string;
}

export type AnswerType = "choice" | "idk";

export interface AssessmentAnswer {
  questionId: string;
  answerType: AnswerType;
  selectedChoiceId: string | null;
  isCorrect: boolean;
  timeToAnswerMs: number;
  replayCount: number;
  answeredAt: string;
}

export interface AssessmentAttempt {
  schemaVersion: 2;
  attemptId: string;
  quizKind: AssessmentQuizKind;
  track?: LearnerTrack;
  questionIds: string[];
  choiceOrderByQuestion: Record<string, string[]>;
  currentIndex: number;
  answers: Record<string, AssessmentAnswer>;
  replayCounts: Record<string, number>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  advisory: boolean;
}

export interface TopicSubscore {
  topic: AssessmentTopic;
  answered: number;
  correct: number;
  wrong: number;
  idk: number;
  weightedCorrect: number;
  weightedAttempted: number;
  score: number;
}

export type ConfidenceBand = "low" | "medium" | "high";

export interface AssessmentScoreSummary {
  score: number;
  answeredCount: number;
  totalCount: number;
  completionPercent: number;
  confidence: ConfidenceBand;
  totalCorrect: number;
  totalWrong: number;
  totalIdk: number;
  idkRate: number;
  topicSubscores: TopicSubscore[];
  missedQuestionIds: string[];
}

export type PlacementBand = "A1.0" | "A1.1" | "A1.2" | "A2.0" | "A2.1" | "B1-ish";

export interface LessonRecommendationLink {
  title: string;
  href?: string;
  placeholder?: boolean;
}

export interface PlacementRecommendation {
  band: PlacementBand;
  moduleNumber: number;
  moduleTitle: string;
  confidence: ConfidenceBand;
  strengths: TopicSubscore[];
  gaps: TopicSubscore[];
  lessonLinks: LessonRecommendationLink[];
}

export interface AssessmentHistoryRecord {
  attempt: AssessmentAttempt;
}

export interface NineModeReviewState {
  attemptId: string;
  notes: string;
  manualBandOverride?: PlacementBand;
  assignedLessonIds: string[];
  updatedAt: string;
}

export const IDK_CHOICE_ID = "__idk__";
