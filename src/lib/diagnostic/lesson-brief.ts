import type { AssessmentScoreSummary, PlacementBand } from "@/types/assessment";
import type { DiagnosticLessonBrief, DiagnosticLessonPlanBlock } from "@/types/diagnostic";
import { derivePlacementBand } from "@/lib/quiz/scoring";

const topicLabels: Record<string, string> = {
  greetings: "Greetings",
  politeness: "Politeness particles",
  self_intro: "Self-introduction",
  basics: "Basic vocabulary",
  numbers: "Numbers",
  shopping: "Shopping",
  time: "Time expressions",
  days: "Days of the week",
  scheduling: "Scheduling",
  directions: "Directions",
  transport: "Transport",
  food: "Food vocabulary",
  ordering: "Ordering food/drinks",
  question_words: "Question words",
  particles: "Sentence particles",
  grammar: "Grammar patterns",
  verbs: "Verbs",
  adjectives: "Adjectives",
  family: "Family terms",
  daily_life: "Daily life vocabulary",
  tones: "Tones (listening)",
  reader_tones: "Tones (script)",
};

function labelTopic(topic: string): string {
  return topicLabels[topic] ?? topic;
}

const bandDescriptions: Record<PlacementBand, string> = {
  "A1.0":
    "True beginner. Likely zero prior exposure. Needs foundational pronunciation and survival phrases from scratch.",
  "A1.1":
    "Emerging beginner. Recognises a handful of high-frequency phrases but has large vocabulary gaps. Core greetings and numbers are the priority.",
  "A1.2":
    "Solid beginner. Can handle basic greetings and numbers but struggles with question words, time expressions, and connecting ideas.",
  "A2.0":
    "Elementary. Comfortable with survival topics but needs explicit work on question construction, simple directions, and time/scheduling language.",
  "A2.1":
    "Pre-intermediate. Can communicate basic needs; gaps appear in grammar patterns, adjective ordering, and complex sentences.",
  "B1-ish":
    "Intermediate. Strong baseline across core topics; refinement work on fluency, tones, and advanced vocabulary will have the highest impact.",
};

const coreTopics = new Set([
  "greetings",
  "politeness",
  "self_intro",
  "basics",
  "numbers",
  "question_words",
  "verbs",
  "adjectives",
]);

const advancedTopics = new Set([
  "scheduling",
  "directions",
  "transport",
  "ordering",
  "grammar",
  "particles",
]);

function teachFirstForBandAndGaps(
  band: PlacementBand,
  gapTopics: string[]
): string[] {
  const recs: string[] = [];

  if (band === "A1.0") {
    recs.push("Start with M01 (First Contact and Courtesy). Begin with Thai phonology: 5 vowel clusters and 3 tone tiers before any vocabulary.");
    recs.push("Teach 'สวัสดี' greeting + polite particle (ครับ/ค่ะ) as the first production target.");
    recs.push("Introduce numbers 1 to 10 with visual anchors before any transactional language.");
    recs.push("Use audio-first drills; written Thai script can wait until M02 (Sounds) establishes basic listening accuracy.");
  } else if (band === "A1.1" || band === "A1.2") {
    recs.push(`Start with ${band === "A1.1" ? "M02 (Sounds)" : "M03 (Building Simple Sentences)"}. Consolidate greetings cluster fully before moving to new topics. Ensure automatic recall, not recognition.`);
    if (gapTopics.includes("question_words")) {
      recs.push("Prioritise question words (อะไร, ที่ไหน, ใคร, เมื่อไร). These unlock productive communication immediately (covered in M06 Questions).");
    }
    if (gapTopics.includes("numbers")) {
      recs.push("Drill numbers 1 to 100 with price-pointing exercises (M04 Numbers provides structured progression).");
    }
    if (gapTopics.includes("time") || gapTopics.includes("days")) {
      recs.push("Teach time + days together as a paired unit; schedule-building tasks make retention stick (see M10 Time).");
    }
    recs.push("Use call-and-response patterns over translation drills. This learner needs audio feedback loops.");
  } else if (band === "A2.0" || band === "A2.1") {
    recs.push(`Start with ${band === "A2.0" ? "M07 (Reading Fluency and Pronunciation Control)" : "M08 (Food)"}.`);
    if (gapTopics.includes("grammar")) {
      recs.push("Tackle mid-sentence particle placement first (ก็, แต่, เพราะ). This is the highest-leverage grammar gap.");
    }
    if (gapTopics.includes("scheduling") || gapTopics.includes("directions")) {
      recs.push("Introduce directions + transport language together using a real Bangkok route as practice context (M09 Travel).");
    }
    if (gapTopics.includes("ordering")) {
      recs.push("Role-play a restaurant scenario using authentic menu items. Ordering language has immediate real-world payoff (M08 Food).");
    }
    recs.push("Introduce concept of rising-falling tone contrast explicitly with minimal pairs.");
    recs.push("Build from sentence templates rather than word lists. Learner is ready for productive pattern drilling.");
  } else {
    recs.push("Start with M11 (Friends). Focus on fluency acceleration: connected speech patterns and tone reduction in fast speech.");
    recs.push("Target remaining vocabulary gaps with spaced-repetition flashcard drills.");
    recs.push("Introduce formal vs. informal register differentiation (polite vs. casual Thai, see M15 Formal Requests).");
    if (gapTopics.includes("grammar") || gapTopics.includes("particles")) {
      recs.push("Deep-dive into sentence-final particles (นะ, สิ, ล่ะ) for naturalness.");
    }
  }

  return recs;
}

function avoidForNowForBandAndGaps(
  band: PlacementBand,
  gapTopics: string[]
): string[] {
  const avoids: string[] = [];

  if (band === "A1.0" || band === "A1.1") {
    avoids.push("Avoid Thai script instruction. Focus on audio comprehension and romanised output first.");
    avoids.push("Skip complex grammar patterns (conditionals, passive, reported speech) entirely for now.");
    avoids.push("Avoid multi-clause sentences; keep all models to Subject + Verb + Object only.");
    if (!gapTopics.includes("tones")) {
      avoids.push("Don't drill tones in isolation. Embed tone contrast naturally in vocabulary learning.");
    }
  } else if (band === "A1.2" || band === "A2.0") {
    avoids.push("Avoid formal writing instruction. Spoken fluency is the priority at this stage.");
    avoids.push("Skip abstract vocabulary categories (politics, philosophy, academic Thai).");
    if (gapTopics.length > 3) {
      avoids.push("Don't try to cover more than two new topic areas in a single session. Prioritise depth over breadth.");
    }
  } else {
    avoids.push("Avoid over-correcting tonal errors in productive speech. Prioritise communicative confidence first.");
    avoids.push("Skip rote memorisation drills. Learner benefits more from contextual pattern exposure.");
  }

  const coveredAdvanced = [...advancedTopics].filter(
    (topic) => !gapTopics.includes(topic)
  );
  if (band === "A1.0" || band === "A1.1") {
    coveredAdvanced.forEach((topic) => {
      avoids.push(`Hold off on extending ${labelTopic(topic)}. Foundation must be solid first.`);
    });
  }

  return avoids;
}

function buildLessonPlan(
  band: PlacementBand,
  strengthTopics: string[],
  gapTopics: string[]
): DiagnosticLessonPlanBlock[] {
  const topGap = gapTopics[0];
  const secondGap = gapTopics[1];
  const topStrength = strengthTopics[0];

  if (band === "A1.0") {
    return [
      {
        timeMinutes: 10,
        activity: "Phonology orientation",
        focus: "Thai sound inventory: 5 short vowels, 3 tone classes (mid/low/high initial consonants). Audio-only, no text.",
        quickCheck: "Can learner distinguish ข vs ค vs ก with ear alone?",
      },
      {
        timeMinutes: 15,
        activity: "Core greeting cluster",
        focus: "สวัสดีครับ / ค่ะ, ชื่ออะไร, ยินดีที่รู้จัก. Production target through repetition + shadowing.",
        quickCheck: "Learner produces greeting unprompted after audio model.",
      },
      {
        timeMinutes: 15,
        activity: "Numbers 1 to 10 + simple counting",
        focus: "Anchor numbers to finger-pointing. Count objects in the room. Introduce price context (baht).",
        quickCheck: "Learner counts to 10 forward and backward without support.",
      },
      {
        timeMinutes: 15,
        activity: "Listening discrimination",
        focus: "5 to 7 minimal pairs targeting tone contrast (ขา/ค่า/ก้า). Forced-choice listening only, no production yet.",
        quickCheck: "Accuracy >60% on 6-item tone discrimination exercise.",
      },
      {
        timeMinutes: 5,
        activity: "Wrap-up + assign",
        focus: "Review greeting cluster. Assign: listen to greeting audio 3x daily before next session.",
      },
    ];
  }

  if (band === "A1.1" || band === "A1.2") {
    const gapLabel = topGap ? labelTopic(topGap) : "vocabulary gaps";
    const strengthLabel = topStrength ? labelTopic(topStrength) : "known vocabulary";
    return [
      {
        timeMinutes: 10,
        activity: "Warm-up: strength activation",
        focus: `Quick drill on ${strengthLabel}. Use known vocabulary to build confidence and set tone for the session.`,
        quickCheck: "Learner produces 5 target items with appropriate tone within 30 seconds.",
      },
      {
        timeMinutes: 15,
        activity: "Priority gap: targeted vocabulary",
        focus: `${gapLabel}. 8 to 10 new items presented audio-first. Pair with visual/gesture anchor. No script yet.`,
        quickCheck: "Comprehension check: teacher says item, learner points to image/object.",
      },
      {
        timeMinutes: 15,
        activity: "Pattern drilling",
        focus: secondGap
          ? `${labelTopic(secondGap)} introduced through sentence frames: 'ฉัน [verb] [noun]' + question form.`
          : "Question-word sentence frames using ไป, ทำ, อยู่. Build 3 to 5 complete sentences from prompts.",
        quickCheck: "Learner constructs 2 sentences unprompted using the target pattern.",
      },
      {
        timeMinutes: 15,
        activity: "Communicative task",
        focus: "Mini role-play: learner introduces themselves, asks partner's name, counts items in a shopping bag context.",
        quickCheck: "Production is communicatively successful even if form is imperfect.",
      },
      {
        timeMinutes: 5,
        activity: "Review + spaced recall",
        focus: "Flashcard review of all new items. Assign: 5-minute audio replay before next session.",
      },
    ];
  }

  if (band === "A2.0" || band === "A2.1") {
    const gapLabel = topGap ? labelTopic(topGap) : "target grammar";
    return [
      {
        timeMinutes: 10,
        activity: "Production warm-up",
        focus: "Learner narrates a simple event from their week in Thai. 3 to 5 sentences. Teacher notes errors for later focus.",
        quickCheck: "Can learner produce a complete Subject + Verb + Object sentence spontaneously?",
      },
      {
        timeMinutes: 15,
        activity: "Grammar focus: sentence structure",
        focus: `${gapLabel}. Explicit pattern presentation, 6 model sentences, then gap-fill production exercise.`,
        quickCheck: "Learner correctly places target particle/structure in 4/5 new sentences.",
      },
      {
        timeMinutes: 15,
        activity: "Vocabulary extension",
        focus: "10 new collocations around the gap topic. Teach in thematic clusters (e.g. all transport verbs together).",
        quickCheck: "Learner recalls 7/10 items on immediate flashcard test.",
      },
      {
        timeMinutes: 12,
        activity: "Connected speech + tone work",
        focus: "Shadowing 3 short authentic utterances (~10 words each). Focus on linking sounds and tone sandhi patterns.",
        quickCheck: "Listener comprehension check: can teacher understand learner's shadowed output?",
      },
      {
        timeMinutes: 8,
        activity: "Extended task",
        focus: "Role-play a transactional scenario (cafe, taxi, market) using the session's vocabulary and grammar target.",
      },
    ];
  }

  return [
    {
      timeMinutes: 10,
      activity: "Fluency warm-up",
      focus: "Describe a recent experience in Thai for 90 seconds. No correction. Focus is on fluency and comfort.",
      quickCheck: "Learner maintains output for full 90 seconds with < 5 second pauses.",
    },
    {
      timeMinutes: 15,
      activity: "Targeted gap work",
      focus: topGap
        ? `Deep dive into ${labelTopic(topGap)}. Functional gap that will most raise communicative range.`
        : "Review of most-missed items from diagnostic. Spaced-recall drill.",
      quickCheck: "Learner uses target item correctly in 2 spontaneous sentences.",
    },
    {
      timeMinutes: 15,
      activity: "Register and naturalness",
      focus: "Contrast formal ผม/ดิฉัน vs casual เรา/หนู register. Introduce 3 common filler expressions (อ่า, ก็ได้, ไง).",
      quickCheck: "Learner switches register appropriately in a prompted context swap.",
    },
    {
      timeMinutes: 12,
      activity: "Tone refinement",
      focus: "Minimal pair listening + production targeting the 2 tones with highest miss rate from diagnostic.",
      quickCheck: "Native-speaker rating of tone accuracy on 5 target items.",
    },
    {
      timeMinutes: 8,
      activity: "Extended production",
      focus: "Learner explains how to do something (give directions, describe their routine). 2+ minutes.",
    },
  ];
}

function buildQuickChecks(band: PlacementBand, gapTopics: string[]): string[] {
  const checks: string[] = [
    "Ask learner to produce the top-gap vocabulary item without prompting at the start of the next session.",
    "Use comprehension check questions in Thai only. Avoid English translation as a crutch after the first 10 minutes.",
    "At session midpoint, ask learner to repeat 3 items from session start. Tests short-term retention.",
    "End of session: learner produces a 2 to 3 sentence summary of what they practised (in Thai).",
  ];

  if (band === "A1.0" || band === "A1.1") {
    checks.push("Finger-counting spot check: hold up fingers, learner says the Thai number without pause.");
    checks.push("Greeting production: teacher walks in and waits. Learner must initiate greeting unprompted.");
  }

  if (gapTopics.includes("question_words")) {
    checks.push("Show an unfamiliar object. Learner must ask 'อันนี้เรียกว่าอะไร?' naturally.");
  }

  if (gapTopics.includes("directions")) {
    checks.push("Show a simple map. Learner gives directions from point A to B using ซ้าย/ขวา/ตรงไป.");
  }

  if (gapTopics.includes("ordering") || gapTopics.includes("food")) {
    checks.push("Hand learner a menu in Thai. They order one item and ask the price.");
  }

  if (band === "A2.1" || band === "B1-ish") {
    checks.push("Error correction self-check: learner reviews their own 2-minute recording and identifies 2 errors.");
  }

  return checks;
}

export function generateLessonBrief(
  summary: AssessmentScoreSummary
): DiagnosticLessonBrief {
  const band = derivePlacementBand(summary);

  const sortedByScore = [...summary.topicSubscores].sort(
    (a, b) => b.score - a.score
  );

  const strengthTopics = sortedByScore
    .filter((sub) => sub.score >= 60)
    .slice(0, 4)
    .map((sub) => sub.topic);

  const gapTopics = [...summary.topicSubscores]
    .sort((a, b) => {
      if (a.score === b.score) {
        return b.idk + b.wrong - (a.idk + a.wrong);
      }
      return a.score - b.score;
    })
    .filter((sub) => sub.score < 70 || sub.idk > 0)
    .slice(0, 5)
    .map((sub) => sub.topic);

  const sortedGaps = [
    ...gapTopics.filter((t) => coreTopics.has(t)),
    ...gapTopics.filter((t) => !coreTopics.has(t) && !advancedTopics.has(t)),
    ...gapTopics.filter((t) => advancedTopics.has(t)),
  ];

  const strengthLabels = strengthTopics.map(labelTopic);
  const gapLabels = sortedGaps.map(labelTopic);

  return {
    estimatedBand: band,
    confidence: summary.confidence,
    strengths: strengthLabels.length > 0
      ? strengthLabels
      : ["No high-scoring topics yet. This is a true beginner baseline."],
    priorityGaps: gapLabels.length > 0
      ? gapLabels
      : ["No clear gaps identified. Consider a longer diagnostic if results seem off."],
    teachFirst: teachFirstForBandAndGaps(band, sortedGaps),
    avoidForNow: avoidForNowForBandAndGaps(band, sortedGaps),
    lessonPlan: buildLessonPlan(band, strengthTopics, sortedGaps),
    quickChecks: buildQuickChecks(band, sortedGaps),
    generatedAt: new Date().toISOString(),
  };
}
