import type { AssessmentTopic, Difficulty, LearnerTrack } from "@/types/assessment";
import { placementQuestionBank } from "@/lib/quiz/question-banks";
import { shuffleWithSeed } from "@/lib/quiz/choice-order";

interface PlacementAssemblyOptions {
  track: LearnerTrack;
  targetCount?: number;
  seed?: string;
}

interface Phase2AssemblyOptions {
  track: LearnerTrack;
  phase1Score: number;
  alreadyUsedIds: Set<string>;
  seed: string;
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

export function getPlacementMidpoint() {
  return 13;
}

function assembleFromPool(
  eligible: typeof placementQuestionBank,
  targetCount: number,
  seed: string
): string[] {
  const grouped = new Map<AssessmentTopic, string[]>();

  eligible.forEach((question) => {
    const bucket = grouped.get(question.topic) || [];
    bucket.push(question.id);
    grouped.set(question.topic, bucket);
  });

  const topicBuckets = placementTopicPriority
    .map((topic) => {
      const ids = grouped.get(topic) || [];
      return { topic, ids: shuffleWithSeed(ids, `${seed}:${topic}`) };
    })
    .filter((bucket) => bucket.ids.length > 0);

  const selectedIds: string[] = [];
  const selectedSet = new Set<string>();
  const selectedPerTopic = new Map<AssessmentTopic, number>();

  // Pass 1: one per topic for breadth
  topicBuckets.forEach((bucket) => {
    if (selectedIds.length >= targetCount) return;
    const firstId = bucket.ids[0];
    if (!firstId) return;
    selectedIds.push(firstId);
    selectedSet.add(firstId);
    selectedPerTopic.set(bucket.topic, 1);
    bucket.ids = bucket.ids.slice(1);
  });

  // Pass 2: fill proportionally from least-represented topics
  while (selectedIds.length < targetCount) {
    const available = topicBuckets.filter((bucket) => bucket.ids.length > 0);
    if (available.length === 0) break;

    available.sort((left, right) => {
      const leftCount = selectedPerTopic.get(left.topic) || 0;
      const rightCount = selectedPerTopic.get(right.topic) || 0;
      if (leftCount === rightCount) return left.topic.localeCompare(right.topic);
      return leftCount - rightCount;
    });

    const candidateBucket = available[0];
    const nextId = candidateBucket.ids.shift();
    if (!nextId || selectedSet.has(nextId)) continue;

    selectedIds.push(nextId);
    selectedSet.add(nextId);
    selectedPerTopic.set(
      candidateBucket.topic,
      (selectedPerTopic.get(candidateBucket.topic) || 0) + 1
    );
  }

  return selectedIds.slice(0, targetCount);
}

export function assemblePlacementPhase1Ids(
  track: LearnerTrack,
  seed: string = `${track}:${Date.now()}`
): string[] {
  const eligible = getPlacementEligibleQuestions(track).filter(
    (q) => q.difficulty <= 3
  );
  return assembleFromPool(eligible, getPlacementMidpoint(), seed);
}

function getDifficultyRange(
  phase1Score: number
): [minDifficulty: Difficulty, maxDifficulty: Difficulty] {
  if (phase1Score < 50) return [1, 2];
  if (phase1Score < 80) return [2, 4];
  return [3, 5];
}

export function assemblePlacementPhase2Ids({
  track,
  phase1Score,
  alreadyUsedIds,
  seed,
}: Phase2AssemblyOptions): string[] {
  const [minDiff, maxDiff] = getDifficultyRange(phase1Score);
  const targetCount = getPlacementTargetCount() - getPlacementMidpoint();

  let eligible = getPlacementEligibleQuestions(track).filter(
    (q) =>
      !alreadyUsedIds.has(q.id) &&
      q.difficulty >= minDiff &&
      q.difficulty <= maxDiff
  );

  // Safety fallback: widen range if not enough questions
  if (eligible.length < targetCount) {
    const widenMin = Math.max(1, minDiff - 1) as Difficulty;
    const widenMax = Math.min(5, maxDiff + 1) as Difficulty;
    eligible = getPlacementEligibleQuestions(track).filter(
      (q) =>
        !alreadyUsedIds.has(q.id) &&
        q.difficulty >= widenMin &&
        q.difficulty <= widenMax
    );
  }

  return assembleFromPool(eligible, targetCount, seed);
}
