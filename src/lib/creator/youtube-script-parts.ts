// Pure splitter that classifies a YouTube episode's blocks into the 4-part
// editor structure (Sketch, Context, Teaching, Practice). No I/O.

export type PartKey = "p1" | "p2" | "p3" | "p4";

export interface Block {
  id: string;
  mode: string;
  lines: unknown[];
  speakerNote?: string;
  imageRef?: string;
  vocabRefs?: string[];
  transition?: string;
  // Allow additional unknown fields without complaint.
  [key: string]: unknown;
}

export interface PartRange {
  start: string | null;
  end: string | null;
  count: number;
}

export interface SplitResult {
  p1: Block[];
  p2: Block[];
  p3: Block[];
  p4: Block[];
  partRanges: Record<PartKey, PartRange>;
  partOf: Record<string, PartKey>;
}

export const PART_LABELS: Record<PartKey, string> = {
  p1: "Sketch",
  p2: "Context",
  p3: "Teaching",
  p4: "Practice",
};

const P1_MODES = new Set(["hook"]);
const P3_MODES = new Set([
  "vocab-card",
  "vocab-explain",
  "natural-listen",
  "breakdown",
]);
const P4_MODES = new Set([
  "shadowing",
  "drill-prompt",
  "drill-answer",
  "recap",
  "teaser",
]);

function literalPart(mode: string): PartKey | null {
  if (P1_MODES.has(mode)) return "p1";
  if (P3_MODES.has(mode)) return "p3";
  if (P4_MODES.has(mode)) return "p4";
  return null;
}

export function splitBlocksToParts(blocks: Block[]): SplitResult {
  const partOf: Record<string, PartKey> = {};

  // Pass 1: literal classification.
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const lit = literalPart(b.mode);
    if (lit !== null) {
      partOf[b.id] = lit;
    }
  }

  // Pass 2: section-intro forward peek (with backward fallback).
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.mode !== "section-intro") continue;

    let resolved: PartKey | null = null;

    // Walk forward looking for a literal anchor (P3 or P4 modes).
    for (let j = i + 1; j < blocks.length; j++) {
      const candidate = blocks[j].mode;
      if (P3_MODES.has(candidate) || P4_MODES.has(candidate)) {
        resolved = literalPart(candidate);
        break;
      }
    }

    // Defensive backward fallback if no forward anchor was found.
    if (resolved === null) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = blocks[j].mode;
        if (P3_MODES.has(candidate) || P4_MODES.has(candidate)) {
          resolved = literalPart(candidate);
          break;
        }
      }
    }

    if (resolved === null) {
      throw new Error(
        `section-intro at id=${b.id} has no neighboring anchor`,
      );
    }

    partOf[b.id] = resolved;
  }

  // Pass 3: explain blocks.
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.mode !== "explain") continue;

    // Preamble check: every block before i has mode in {hook, explain}.
    let isPreamble = true;
    for (let j = 0; j < i; j++) {
      const m = blocks[j].mode;
      if (m !== "hook" && m !== "explain") {
        isPreamble = false;
        break;
      }
    }

    if (isPreamble) {
      partOf[b.id] = "p2";
      continue;
    }

    // Otherwise walk backward to find the most recent non-explain block
    // (a literal anchor or a section-intro that pass 2 already classified).
    let resolved: PartKey | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const prev = blocks[j];
      if (prev.mode === "explain") continue;
      const found = partOf[prev.id];
      if (found) {
        resolved = found;
        break;
      }
    }

    if (resolved === null) {
      throw new Error(
        `explain at id=${b.id} could not be classified (no prior non-explain anchor)`,
      );
    }

    partOf[b.id] = resolved;
  }

  // Verify every block was classified.
  for (const b of blocks) {
    if (!partOf[b.id]) {
      throw new Error(
        `block id=${b.id} (mode=${b.mode}) was not classified into any part`,
      );
    }
  }

  // Build ordered arrays per part.
  const p1: Block[] = [];
  const p2: Block[] = [];
  const p3: Block[] = [];
  const p4: Block[] = [];

  for (const b of blocks) {
    const k = partOf[b.id];
    if (k === "p1") p1.push(b);
    else if (k === "p2") p2.push(b);
    else if (k === "p3") p3.push(b);
    else if (k === "p4") p4.push(b);
  }

  function rangeOf(arr: Block[]): PartRange {
    if (arr.length === 0) return { start: null, end: null, count: 0 };
    return {
      start: arr[0].id,
      end: arr[arr.length - 1].id,
      count: arr.length,
    };
  }

  const partRanges: Record<PartKey, PartRange> = {
    p1: rangeOf(p1),
    p2: rangeOf(p2),
    p3: rangeOf(p3),
    p4: rangeOf(p4),
  };

  return { p1, p2, p3, p4, partRanges, partOf };
}
