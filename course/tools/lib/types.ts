export type LessonState = "BACKLOG" | "PLANNED" | "DRAFT" | "READY_TO_RECORD";

export type StageId = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";

export interface LessonStatus {
  lessonId: string;
  state: LessonState;
  updatedAt: string;
  validatedAt: string | null;
  stageResults?: Record<StageId, "PASS" | "FAIL" | "SKIP">;
  notes?: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface Lexeme {
  thai: string;
  translit: string;
  english: string;
  notes?: string;
  vocabId?: string;
}

export interface ReviewBucket {
  bucket: "last" | "minus3" | "minus6" | "minus8";
  offset: 1 | 3 | 6 | 8;
  lessonId: string | null;
  vocabIds: string[];
  sample: Lexeme[];
}

export interface LessonContext {
  schemaVersion: 1;
  lessonId: string;
  priorLessons: string[];
  knownVocabulary: Lexeme[];
  knownGrammar: string[];
  reviewBuckets: ReviewBucket[];
}

export interface ScriptMaster {
  schemaVersion: 1;
  lessonId: string;
  title: string;
  objective: string;
  context: LessonContext;
  sections: Array<{
    id: string;
    heading: string;
    purpose: string;
    spokenNarration: string[];
    onScreenBullets: string[];
    drills: string[];
    languageFocus: Lexeme[];
  }>;
  roleplay: {
    scenario: string;
    lines: Array<{ speaker: string; thai: string; translit: string; english: string }>;
  };
  recap: string[];
  qaChecks: Array<{ id: string; description: string; pass: boolean; evidence: string }>;
  policies: {
    transliteration: "PTM_ADAPTED_INLINE_TONES";
    imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT";
  };
}

export interface RemotionPlan {
  schemaVersion: 1;
  lessonId: string;
  sourceScript: string;
  scenes: Array<{
    id: string;
    seconds: number;
    voiceover: string[];
    overlays: string[];
    thaiFocus: Array<{ thai: string; translit: string; english: string }>;
    assets: Array<{
      assetId: string;
      kind: "image" | "icon" | "video";
      query: string;
      sourcePolicy: "internet-first";
      sourceUrl: string;
      license: string;
    }>;
  }>;
}

export interface AssetProvenance {
  schemaVersion: 1;
  lessonId: string;
  generatedAt: string;
  assets: Array<{
    assetId: string;
    kind: "image" | "icon" | "video";
    sourceUrl: string;
    license: string;
    usage: string;
  }>;
}

export interface PdfSource {
  schemaVersion: 1;
  lessonId: string;
  title: string;
  sections: Array<{ heading: string; body: string[] }>;
  drills: string[];
  answerKey: string[];
}

export interface FlashcardsDeck {
  schemaVersion: 1;
  lessonId: string;
  cards: Array<{
    id: string;
    vocabId: string;
    front: string;
    back: string;
    translit: string;
    tags: string[];
  }>;
}

export interface VocabIndex {
  schemaVersion: 1;
  generatedAt: string;
  entries: Array<{
    id: string;
    thai: string;
    translit: string;
    english: string;
    key: string;
    firstSeenLesson: string;
    lessons: string[];
  }>;
}

export interface VocabExport {
  schemaVersion: 1;
  generatedAt: string;
  source: "pipeline-cli";
  lessons: string[];
  cards: Array<{
    id: string;
    vocabId: string;
    thai: string;
    translit: string;
    english: string;
    lessonId: string;
    tags: string[];
  }>;
}

export type QuizItemType = "thai_to_english" | "english_to_thai" | "fill_translit" | "context_mcq";
export type QuizDisplayMode = "triplet" | "thai_only" | "english_only";

export interface QuizItem {
  id: string;
  vocabId: string;
  type: QuizItemType;
  displayMode: QuizDisplayMode;
  prompt: {
    text: string;
    thai?: string;
    translit?: string;
    english?: string;
  };
  options?: string[];
  answer: string;
  rationale: string;
}

export interface QuizItemBank {
  schemaVersion: 1;
  lessonId: string;
  generatedAt: string;
  sourceScript: string;
  items: QuizItem[];
  coverage: {
    minimumItemsPerNewVocab: number;
    perVocab: Array<{ vocabId: string; thai: string; itemCount: number }>;
    pass: boolean;
  };
}

export interface QuizSet {
  schemaVersion: 1;
  lessonId: string;
  passScore: number;
  generatedAt: string;
  itemBankPath: string;
  questions: Array<QuizItem & { bankItemId: string }>;
  coverage: {
    minimumQuizItemsPerNewVocab: number;
    perVocab: Array<{ vocabId: string; thai: string; quizItemCount: number }>;
    pass: boolean;
  };
}
