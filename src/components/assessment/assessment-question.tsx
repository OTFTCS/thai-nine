"use client";

import { cn } from "@/lib/utils";
import type { AssessmentQuestion as AssessmentQuestionType } from "@/types/assessment";
import { ThaiTripletDisplay } from "./thai-triplet";
import { AudioPlaceholder } from "./audio-placeholder";

interface AssessmentQuestionProps {
  question: AssessmentQuestionType;
  selectedOptionId?: string;
  onSelect: (optionId: string) => void;
  /** Show correct/incorrect feedback */
  showResult?: boolean;
}

export function AssessmentQuestion({
  question,
  selectedOptionId,
  onSelect,
  showResult,
}: AssessmentQuestionProps) {
  const showThai =
    question.displayMode === "triplet" || question.displayMode === "thai_only";
  const showTranslit =
    question.displayMode === "triplet" ||
    question.displayMode === "translit_only";
  const showEnglish =
    question.displayMode === "triplet" ||
    question.displayMode === "english_only";

  return (
    <div className="space-y-4" role="group" aria-label={`Question: ${question.prompt.text}`}>
      {/* Audio placeholder (if applicable) */}
      {(question.audioSrc || question.audioRequired) && (
        <AudioPlaceholder
          src={question.audioSrc}
          required={question.audioRequired}
        />
      )}

      {/* Prompt */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          {question.prompt.text}
        </h3>
        {question.prompt.triplet && (
          <ThaiTripletDisplay
            triplet={question.prompt.triplet}
            showThai={showThai}
            showTranslit={showTranslit}
            showEnglish={showEnglish}
            size="lg"
            className="py-3"
          />
        )}
      </div>

      {/* Options */}
      <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = option.id === question.correctOptionId;

          let style =
            "border-border hover:border-primary/50 hover:bg-muted/50";
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
              role="radio"
              aria-checked={isSelected}
              aria-label={option.text}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                style,
                !showResult && "cursor-pointer",
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
                          : "border-border text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {showResult && isCorrect
                    ? "✓"
                    : showResult && isSelected && !isCorrect
                      ? "✗"
                      : option.id.toUpperCase()}
                </span>
                <div className="flex-1">
                  <span className="text-sm text-foreground">{option.text}</span>
                  {option.triplet && (
                    <ThaiTripletDisplay
                      triplet={option.triplet}
                      showThai={showThai}
                      showTranslit={showTranslit}
                      showEnglish={false}
                      size="sm"
                      className="mt-1 items-start"
                    />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation (review mode) */}
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
