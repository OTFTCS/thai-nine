import { placementQuiz } from "@/lib/assessment-data";
import { AssessmentContainer } from "@/components/assessment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Placement Quiz — Immersion Thai",
  description:
    "Find your starting level with a quick placement quiz. Thai script and tones included.",
};

export default function PlacementQuizPage() {
  return (
    <div className="py-6">
      <AssessmentContainer quiz={placementQuiz} />
    </div>
  );
}
