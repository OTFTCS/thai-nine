import type {
  LessonRecommendationLink,
  PlacementBand,
} from "@/types/assessment";

export interface ModuleRecommendation {
  moduleId: string;
  moduleTitle: string;
  lessonLinks: LessonRecommendationLink[];
}

export type PlacementRecommendationMap = Record<
  PlacementBand,
  ModuleRecommendation
>;

export function getRecommendationForBand(
  band: PlacementBand,
  recommendationMap: PlacementRecommendationMap
): ModuleRecommendation {
  return recommendationMap[band];
}
