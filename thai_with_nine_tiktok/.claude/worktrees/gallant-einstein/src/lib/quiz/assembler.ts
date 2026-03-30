import type { AssessmentTopic, LearnerTrack } from "@/types/assessment";
import { placementQuestionBank } from "@/lib/quiz/question-banks";
import { shuffleWithSeed } from "@/lib/quiz/choice-order";

interface PlacementAssemblyOptions {
  track: LearnerTrack;
  targetCount?: number;
  seed?: string;
}

const placementTopicPriority: AssessmentTopic[] = [
  "greetings",
  "politeness",
  "self_intro",
  "basics",
  "verbs",
  "adjectives",
  "numbers",
  "shopping",
  "time",
  "days",
  "scheduling",
  "directions",
  "transport",
  "food",
  "ordering",
  "question_words",
  "particles",
  "grammar",
  "family",
  "daily_life",
];

export function getPlacementTargetCount() {
  return 26;
}

export function getPlacementEligibleQuestions(track: LearnerTrack) {
  return placementQuestionBank.filter(
    (question) => question.track === "both" || question.track === track
  );
}

export function assemblePlacementQuestionIds({
  track,
  targetCount = getPlacementTargetCount(),
  seed = `${track}:${Date.now()}`,
}: PlacementAssemblyOptions) {
  const eligible = getPlacementEligibleQuestions(track);
  const grouped = new Map<AssessmentTopic, string[]>();

  eligible.forEach((question) => {
    const topicBucket = grouped.get(question.topic) || [];
    topicBucket.push(question.id);
    grouped.set(question.topic, topicBucket);
  });

  const topicBuckets = placementTopicPriority
    .map((topic) => {
      const ids = grouped.get(topic) || [];
      return {
        topic,
        ids: shuffleWithSeed(ids, `${seed}:${topic}`),
      };
    })
    .filter((bucket) => bucket.ids.length > 0);

  const selectedIds: string[] = [];
  const selectedSet = new Set<string>();
  const selectedPerTopic = new Map<AssessmentTopic, number>();

  // Pass 1: guarantee broad topic coverage.
  topicBuckets.forEach((bucket) => {
    const firstId = bucket.ids[0];
    if (!firstId) {
      return;
    }

    selectedIds.push(firstId);
    selectedSet.add(firstId);
    selectedPerTopic.set(bucket.topic, 1);
    bucket.ids = bucket.ids.slice(1);
  });

  while (selectedIds.length < targetCount) {
    const available = topicBuckets.filter((bucket) => bucket.ids.length > 0);

    if (available.length === 0) {
      break;
    }

    available.sort((left, right) => {
      const leftCount = selectedPerTopic.get(left.topic) || 0;
      const rightCount = selectedPerTopic.get(right.topic) || 0;

      if (leftCount === rightCount) {
        return left.topic.localeCompare(right.topic);
      }

      return leftCount - rightCount;
    });

    const candidateBucket = available[0];
    const nextId = candidateBucket.ids.shift();

    if (!nextId || selectedSet.has(nextId)) {
      continue;
    }

    selectedIds.push(nextId);
    selectedSet.add(nextId);
    selectedPerTopic.set(
      candidateBucket.topic,
      (selectedPerTopic.get(candidateBucket.topic) || 0) + 1
    );
  }

  return selectedIds.slice(0, targetCount);
}
