"use client";

import { useState } from "react";
import { QuizQuestion as QuizQuestionType } from "@/types/quiz";
import { QuizQuestion } from "./quiz-question";
import { QuizResults } from "./quiz-results";
import { Button } from "@/components/ui/button";

interface QuizContainerProps {
  questions: QuizQuestionType[];
  passingScore: number;
  lessonId: string;
}

export function QuizContainer({
  questions,
  passingScore,
  lessonId,
}: QuizContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleSelect = (optionId: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: optionId });
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setSubmitted(true);
      setShowResults(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setAnswers({});
    setShowResults(false);
    setSubmitted(false);
  };

  if (submitted && showResults) {
    const score = questions.filter(
      (q) => answers[q.id] === q.correctOptionId
    ).length;

    return (
      <div>
        <QuizResults
          score={score}
          total={questions.length}
          passingScore={passingScore}
          onRetake={handleRetake}
          lessonId={lessonId}
        />

        {/* Show all questions with correct answers */}
        <div className="mt-8 space-y-6 border-t border-border pt-8">
          <h3 className="text-lg font-semibold text-foreground">Review Your Answers</h3>
          {questions.map((question) => (
            <QuizQuestion
              key={question.id}
              question={question}
              selectedOptionId={answers[question.id]}
              onSelect={() => {}}
              showResult
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </p>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full ${
                i === currentIndex
                  ? "bg-primary"
                  : answers[questions[i].id]
                  ? "bg-primary/40"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <QuizQuestion
        question={currentQuestion}
        selectedOptionId={answers[currentQuestion.id]}
        onSelect={handleSelect}
      />

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={!answers[currentQuestion.id]}
        >
          {isLastQuestion ? "Submit Quiz" : "Next"}
        </Button>
      </div>
    </div>
  );
}
