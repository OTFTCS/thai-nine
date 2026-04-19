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
  type?: "word" | "chunk";
}

export interface MinimalPairEntry {
  thai: string;
  translit: string;
  english: string;
}

export interface MinimalPair {
  a: MinimalPairEntry;
  b: MinimalPairEntry;
}

export interface PronunciationFocus {
  targetSounds: string[];
  minimalPairs: MinimalPair[];
  mouthMapAnchor: string;
  tonePattern?: string;
}

export type VisualLayout =
  | "focus-card"
  | "contrast-board"
  | "dialogue-ladder"
  | "drill-stack"
  | "image-anchored";

export type DeckSlideRole =
  | "opener"
  | "objectives"
  | "teaching"
  | "roleplay"
  | "recap"
  | "closing";

export type DeckLayout =
  | VisualLayout
  | "lesson-opener"
  | "objectives-list"
  | "roleplay-dialogue"
  | "recap-checklist"
  | "lesson-closing";

export interface CanvaTextSegment {
  text: string;
  fontName?: string;
  fontSizePt?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface CanvaSlideElement {
  id: string;
  kind: "text" | "image";
  x: number;
  y: number;
  w: number;
  h: number;
  fontName?: string;
  fontSizePt?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  value?: string;
  localPath?: string;
  segments?: CanvaTextSegment[];
}

export interface CanvaSlide {
  id: string;
  title: string;
  layoutFamily: string;
  backgroundPath: string;
  elements: CanvaSlideElement[];
}

export interface CanvaContent {
  schemaVersion: 1;
  lessonId: string;
  sourceDeck: string;
  layoutContract: string;
  theme: {
    thaiFont: string;
    latinFont: string;
    backgroundColor: string;
    rightZoneTint: string;
    accentColors: string[];
  };
  slides: CanvaSlide[];
}

export interface SectionVisualPlan {
  leftPanelLayout: VisualLayout;
  onScreenGoal: string;
  teachingVisuals: string[];
  teacherCues: string[];
  imageSupport: {
    helpful: boolean;
    priority: "essential" | "supporting" | "avoid";
    rationale: string;
    searchQueries: string[];
    sourceHints: string[];
    aiFallbackPrompt?: string;
  };
}

export interface TeachingFrame {
  openingHook: string;
  scenario: string;
  learnerTakeaway: string;
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
  teachingFrame?: TeachingFrame;
  context: LessonContext;
  sections: Array<{
    id: string;
    heading: string;
    purpose: string;
    spokenNarration: string[];
    onScreenBullets: string[];
    drills: string[];
    languageFocus: Lexeme[];
    visualPlan?: SectionVisualPlan;
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
  pronunciationFocus?: PronunciationFocus;
}


export interface AssetProvenance {
  schemaVersion: 1;
  lessonId: string;
  generatedAt: string;
  assets: Array<{
    assetId: string;
    kind: "image" | "icon" | "video";
    status?: "resolved" | "fallback-text-only" | "not-needed";
    slideId?: string;
    sourceProvider?: "openverse" | "wikimedia" | "none";
    sourceUrl?: string;
    license?: string;
    usage: string;
    query?: string;
    sourcePolicy?: "internet-first";
    localPath?: string;
    fallbackReason?: string;
    rationale?: string;
    sourceHints?: string[];
    aiFallbackPrompt?: string;
  }>;
}

export interface DeckTextBlock {
  id: string;
  kind:
    | "eyebrow"
    | "bullet-list"
    | "triplet-list"
    | "dialogue"
    | "recap-list"
    | "closing-list"
    | "note";
  heading?: string;
  lines: string[];
}

export interface DeckVisualStrategy {
  onScreenGoal: string;
  teachingVisuals: string[];
  teacherCues: string[];
  imageUsage: "real-image" | "icon" | "text-only";
  rationale: string;
}

export interface DeckAsset {
  assetId: string;
  kind: "image";
  query: string;
  sourcePolicy: "internet-first";
  status: "resolved" | "fallback-text-only" | "not-needed";
  sourceProvider: "openverse" | "wikimedia" | "none";
  sourceUrl?: string;
  license?: string;
  localPath?: string;
  usageNotes?: string;
  fallbackReason?: string;
}

export interface DeckSlide {
  id: string;
  role: DeckSlideRole;
  title: string;
  estimatedSeconds: number;
  layout: DeckLayout;
  speakerNotes: string[];
  textBlocks: DeckTextBlock[];
  thaiFocus: Array<{ thai: string; translit: string; english: string }>;
  visualStrategy: DeckVisualStrategy;
  assets: DeckAsset[];
}

export interface DeckSource {
  schemaVersion: 1;
  lessonId: string;
  sourceScript: string;
  canvas: {
    width: number;
    height: number;
    leftTeachingFraction: number;
    rightCameraFraction: number;
    safeZoneLabel: string;
  };
  theme: {
    id: string;
    name: string;
    thaiFont: string;
    latinFont: string;
    backgroundColor: string;
    rightZoneTint: string;
    accentColors: string[];
  };
  slides: DeckSlide[];
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
