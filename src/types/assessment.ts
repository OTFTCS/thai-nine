// ---------------------------------------------------------------------------
// Pre-Course Assessment System — Typed Schema
// Covers: Placement Quiz, Tone Quiz, Reader-Tones Quiz, Teacher Override
// ---------------------------------------------------------------------------

// ── Transliteration triplet (always shown together per repo policy) ─────────

/** Every learner-facing Thai item MUST include all three representations. */
export interface ThaiTriplet {
  /** Thai script, e.g. "สวัสดี" */
  thai: string;
  /** PTM transliteration with inline tone marks, e.g. "sà-wàt-dii" */
  translit: string;
  /** English gloss, e.g. "hello" */
  english: string;
}

// ── Question types ──────────────────────────────────────────────────────────

export type AssessmentQuestionType =
  | "audio_meaning_match"
  | "thai_to_english"
  | "english_to_thai"
  | "real_world_response"
  | "word_order"
  | "tone_identification"
  | "tone_minimal_pair"
  | "tone_audio_match"
  | "read_and_identify_tone";

export type DisplayMode = "triplet" | "thai_only" | "english_only" | "translit_only";

export interface AssessmentOption {
  id: string;
  text: string;
  /** Optional triplet for options that show Thai */
  triplet?: ThaiTriplet;
}

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  /** Section this question belongs to (for weighted scoring) */
  sectionId: string;
  /** Display mode controls which parts of the triplet are visible */
  displayMode: DisplayMode;
  /** The prompt shown to the learner */
  prompt: {
    text: string;
    /** Optional triplet embedded in the prompt */
    triplet?: ThaiTriplet;
  };
  options: AssessmentOption[];
  /** ID of the correct option */
  correctOptionId: string;
  /** Shown after answering (review mode) */
  explanation?: string;
  /** Tags for gap analysis, e.g. ["tones", "greetings", "listening"] */
  tags: string[];
  /**
   * Audio asset path (placeholder until recorded).
   * Convention: /audio/assessment/{quizId}/{questionId}.mp3
   */
  audioSrc?: string;
  /** If true, question requires audio to be meaningful */
  audioRequired?: boolean;
  /** Difficulty tier for branching (0 = easiest, 2 = hardest) */
  difficulty: 0 | 1 | 2;
  /** Sort order within section */
  sortOrder: number;
}

// ── Sections & Weighted Scoring ─────────────────────────────────────────────

export interface AssessmentSection {
  id: string;
  title: string;
  /** Fraction of total score, all sections must sum to 1.0 */
  weight: number;
  /** Ordered question IDs in this section */
  questionIds: string[];
}

// ── Branching ───────────────────────────────────────────────────────────────

export interface BranchRule {
  /** After answering this question... */
  afterQuestionId: string;
  /** ...if the running section score is below this threshold... */
  ifSectionScoreBelow?: number;
  /** ...or above this threshold... */
  ifSectionScoreAbove?: number;
  /** ...skip to this question (or "end" to finish early) */
  skipToQuestionId: string | "end";
}

// ── Placement Bands ─────────────────────────────────────────────────────────

export interface PlacementBand {
  /** Human-readable label, e.g. "Beginner start" */
  label: string;
  /** Minimum weighted score (0-100 inclusive) */
  scoreMin: number;
  /** Maximum weighted score (0-100 inclusive) */
  scoreMax: number;
  /** Deep link target, e.g. "/lessons/M01-L001" */
  deepLink: string;
  /** Module-Lesson ID for programmatic use */
  startLessonId: string;
  /** Brief description of what this placement means */
  description: string;
}

// ── Confidence ──────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** Human explanation, e.g. "3/7 answers were guesses" */
  reason: string;
}

// ── Quiz Definition ─────────────────────────────────────────────────────────

export type AssessmentQuizKind = "placement" | "tone" | "reader-tones";

export interface AssessmentQuiz {
  id: string;
  kind: AssessmentQuizKind;
  version: string;
  title: string;
  instructions: string;
  /** CTA threshold — learner must score >= this to see the CTA */
  ctaThresholdPercent?: number;
  sections: AssessmentSection[];
  questions: AssessmentQuestion[];
  branchRules: BranchRule[];
  placementBands?: PlacementBand[];
  /** Passing score for non-placement quizzes */
  passingScorePercent?: number;
}

// ── Learner Answers & Session ───────────────────────────────────────────────

export interface QuestionAnswer {
  questionId: string;
  selectedOptionId: string;
  /** Time in ms the learner spent on this question */
  timeSpentMs: number;
  /** Was the answer correct? (computed, not user-input) */
  correct: boolean;
}

export type AssessmentSessionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "abandoned";

export interface AssessmentSession {
  /** Unique session ID (uuid) */
  sessionId: string;
  quizId: string;
  kind: AssessmentQuizKind;
  status: AssessmentSessionStatus;
  /** Ordered answers so far */
  answers: QuestionAnswer[];
  /** Index of the current question (for resume) */
  currentQuestionIndex: number;
  /** Questions actually presented (may differ from full list due to branching) */
  questionPath: string[];
  /** ISO timestamp when session started */
  startedAt: string;
  /** ISO timestamp when session completed (if applicable) */
  completedAt?: string;
  /** Last updated (for resume staleness check) */
  updatedAt: string;
}

// ── Scoring Result ──────────────────────────────────────────────────────────

export interface SectionScore {
  sectionId: string;
  correct: number;
  total: number;
  /** Raw percentage for this section (0-100) */
  rawPercent: number;
  /** Weighted contribution to the overall score */
  weightedScore: number;
}

export interface TopicGap {
  tag: string;
  /** How many questions with this tag were missed */
  missedCount: number;
  /** Total questions with this tag */
  totalCount: number;
  /** Recommended lesson IDs to address the gap */
  recommendedLessonIds: string[];
}

export interface AssessmentResult {
  sessionId: string;
  quizId: string;
  kind: AssessmentQuizKind;
  /** Overall weighted score (0-100) */
  overallScore: number;
  /** Per-section breakdown */
  sectionScores: SectionScore[];
  /** Placement band (placement quiz only) */
  placementBand?: PlacementBand;
  /** Confidence assessment */
  confidence: ConfidenceResult;
  /** Topic-level gap analysis with recommendations */
  topicGaps: TopicGap[];
  /** Passed the CTA threshold? (tone quiz) */
  passedCtaThreshold?: boolean;
  /** Deep link to recommended starting point */
  recommendedDeepLink: string;
  /** Completed timestamp */
  completedAt: string;
}

// ── Nine Teacher Mode ───────────────────────────────────────────────────────

export interface TeacherNote {
  /** Which question or section this note is about */
  targetId: string;
  targetType: "question" | "section" | "overall";
  /** Free-text note from Nine */
  note: string;
  createdAt: string;
}

export interface TeacherOverride {
  /** Override the computed placement band */
  overrideBandLabel?: string;
  /** Override the deep link */
  overrideDeepLink?: string;
  /** Override the starting lesson */
  overrideStartLessonId?: string;
  /** Reason for override (required) */
  reason: string;
  /** Who made the override */
  teacherId: string;
  createdAt: string;
}

export interface TeacherAssignment {
  /** Session this assignment is based on */
  sessionId: string;
  /** Notes Nine has left */
  notes: TeacherNote[];
  /** Manual override of placement (if any) */
  override?: TeacherOverride;
  /** Final assigned start lesson (after override logic) */
  assignedStartLessonId: string;
  assignedDeepLink: string;
  assignedAt: string;
}

// ── Tag-to-Lesson Recommendation Map ────────────────────────────────────────

export interface TagLessonMapping {
  tag: string;
  lessonIds: string[];
  description: string;
}

export const TAG_LESSON_MAP: TagLessonMapping[] = [
  { tag: "greetings", lessonIds: ["M01-L001"], description: "Basic Thai greetings and introductions" },
  { tag: "numbers", lessonIds: ["M01-L002"], description: "Thai numbers and counting" },
  { tag: "food", lessonIds: ["M01-L003"], description: "Restaurant and food vocabulary" },
  { tag: "directions", lessonIds: ["M01-L004"], description: "Getting around and directions" },
  { tag: "shopping", lessonIds: ["M01-L005"], description: "Shopping and bargaining" },
  { tag: "tones", lessonIds: ["M01-L006"], description: "Thai tones and pronunciation" },
  { tag: "listening", lessonIds: ["M01-L001", "M01-L002"], description: "Listening comprehension basics" },
  { tag: "reading", lessonIds: ["M01-L006", "M01-L007"], description: "Thai script reading" },
  { tag: "polite-particles", lessonIds: ["M01-L001"], description: "ครับ/ค่ะ polite particles" },
  { tag: "tone-minimal-pairs", lessonIds: ["M01-L006"], description: "Tone minimal pair drills" },
];
