export type LessonAvailabilityState = "coming_soon";

export interface Lesson {
  id: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
  moduleExitOutcome: string;
  moduleQuizLink: string;
  trackId: string;
  trackTitle: string;
  cefrBand: string;
  primaryOutcome: string;
  secondaryOutcome: string;
  quizFocus: string;
  flashcardTags: string[];
  notes: string;
  availabilityState: LessonAvailabilityState;
  sortOrder: number;
  moduleOrder: number;
  lessonOrder: number;
}

export interface CurriculumModule {
  id: string;
  title: string;
  trackId: string;
  trackTitle: string;
  cefrBand: string;
  exitOutcome: string;
  order: number;
  lessons: Lesson[];
}

export interface CurriculumTrack {
  id: string;
  title: string;
  cefrBand: string;
  order: number;
  modules: CurriculumModule[];
}

export interface CurriculumBlueprint {
  tracks: CurriculumTrack[];
  modules: CurriculumModule[];
  lessons: Lesson[];
  lessonById: Record<string, Lesson>;
  moduleById: Record<string, CurriculumModule>;
}

export interface UserLessonProgress {
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  videoProgressSeconds: number;
  completedAt?: string;
}
