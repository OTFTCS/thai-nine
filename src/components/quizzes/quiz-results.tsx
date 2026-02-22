import { Button } from "@/components/ui/button";
import Link from "next/link";

interface QuizResultsProps {
  score: number;
  total: number;
  passingScore: number;
  onRetake: () => void;
  lessonId: string;
}

export function QuizResults({
  score,
  total,
  passingScore,
  onRetake,
  lessonId,
}: QuizResultsProps) {
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= passingScore;

  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-4">{passed ? "🎉" : "💪"}</div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {passed ? "Great job!" : "Keep practicing!"}
      </h2>
      <p className="text-muted-foreground mb-6">
        You scored {score} out of {total} ({percentage}%)
      </p>

      <div className="w-32 h-32 rounded-full border-4 mx-auto flex items-center justify-center mb-6"
        style={{
          borderColor: passed ? "var(--success)" : "var(--accent)",
        }}
      >
        <span className="text-3xl font-bold text-foreground">{percentage}%</span>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        {passed
          ? "You passed! You can move on to the next lesson."
          : `You need ${passingScore}% to pass. Review the lesson and try again.`}
      </p>

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onRetake}>
          Retake Quiz
        </Button>
        <Link href={`/lessons/${lessonId}`}>
          <Button>Back to Lesson</Button>
        </Link>
      </div>
    </div>
  );
}
