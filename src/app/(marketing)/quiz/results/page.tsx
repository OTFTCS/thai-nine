import { getBlueprintPlacementRecommendations } from "@/lib/curriculum/blueprint-loader";
import { QuizResultsClient } from "./client";

export default async function QuizResultsPage() {
  const recommendationMap = await getBlueprintPlacementRecommendations();
  return <QuizResultsClient recommendationMap={recommendationMap} />;
}
