"use client";

import { cn } from "@/lib/utils";
import { QuizQuestion as QuizQuestionType } from "@/types/quiz";

interface QuizQuestionProps {
  question: QuizQuestionType;
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  showResult?: boolean;
}

export function QuizQuestion({
  question,
  selectedOptionId,
  onSelect,
  showResult,
}: QuizQuestionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">
        {question.questionText}
      </h3>
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = option.id === question.correctOptionId;

          let style = "border-border hover:border-primary/50 hover:bg-muted/50";
          if (showResult) {
            if (isCorrect) {
              style = "border-success bg-green-50 dark:bg-green-900/20";
            } else if (isSelected && !isCorrect) {
              style = "border-destructive bg-red-50 dark:bg-red-900/20";
            } else {
              style = "border-border opacity-50";
            }
          } else if (isSelected) {
            style = "border-primary bg-primary/5";
          }

          return (
            <button
              key={option.id}
              onClick={() => !showResult && onSelect(option.id)}
              disabled={showResult}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                style,
                !showResult && "cursor-pointer"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                    showResult && isCorrect
                      ? "border-success text-success"
                      : showResult && isSelected && !isCorrect
                      ? "border-destructive text-destructive"
                      : isSelected
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {showResult && isCorrect
                    ? "✓"
                    : showResult && isSelected && !isCorrect
                    ? "✗"
                    : option.id.toUpperCase()}
                </span>
                <span className="text-sm text-foreground">{option.text}</span>
              </div>
            </button>
          );
        })}
      </div>
      {showResult && question.explanation && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Explanation: </span>
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
