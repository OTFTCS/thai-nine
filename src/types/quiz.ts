export interface Quiz {
  id: string;
  lessonId: string;
  title: string;
  passingScore: number;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: "multiple_choice";
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation?: string;
  sortOrder: number;
}

export interface UserQuizResult {
  quizId: string;
  score: number;
  answers: Record<string, string>;
  passed: boolean;
  completedAt: string;
}
