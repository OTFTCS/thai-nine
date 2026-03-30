export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  transcript?: string;
  pdfUrl?: string;
  isFree: boolean;
  sortOrder: number;
  isPublished: boolean;
  durationMinutes?: number;
}

export interface UserLessonProgress {
  lessonId: string;
  status: "not_started" | "in_progress" | "completed";
  videoProgressSeconds: number;
  completedAt?: string;
}
