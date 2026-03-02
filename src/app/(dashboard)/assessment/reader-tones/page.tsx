import { readerTonesQuiz } from "@/lib/assessment-data";
import { AssessmentContainer } from "@/components/assessment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Read & Identify Tones — Immersion Thai",
  description:
    "Can you read Thai tone marks? Test your script-reading skills.",
};

export default function ReaderTonesQuizPage() {
  return (
    <div className="py-6">
      <AssessmentContainer quiz={readerTonesQuiz} />
    </div>
  );
}
