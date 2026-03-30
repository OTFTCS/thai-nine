import type { AssessmentQuestion } from "@/types/assessment";

function hashString(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandomGenerator(seedInput: string) {
  let state = hashString(seedInput) || 1;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function shuffleWithSeed<T>(items: T[], seedInput: string): T[] {
  const random = seededRandomGenerator(seedInput);
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temp = clone[index];
    clone[index] = clone[swapIndex];
    clone[swapIndex] = temp;
  }

  return clone;
}

export function buildChoiceOrderForQuestion(
  attemptId: string,
  question: AssessmentQuestion
) {
  return shuffleWithSeed(
    question.choices.map((choice) => choice.id),
    `${attemptId}:${question.id}:choice-order`
  );
}
