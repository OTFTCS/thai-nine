import { toneQuiz } from "@/lib/assessment-data";
import { AssessmentContainer } from "@/components/assessment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tone Check — Immersion Thai",
  description:
    "Test your ear for Thai tones. Score 70%+ to unlock tone-focused lessons.",
};

export default function ToneQuizPage() {
  return (
    <div className="py-6">
      <AssessmentContainer quiz={toneQuiz} />
    </div>
  );
}
