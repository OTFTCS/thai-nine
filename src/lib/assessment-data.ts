// ---------------------------------------------------------------------------
// Assessment Quiz Data — Placement, Tone, Reader-Tones
// All transliteration follows PTM policy: inline tone marks, Thai script shown
// ---------------------------------------------------------------------------

import type { AssessmentQuiz } from "@/types/assessment";

// ── PLACEMENT QUIZ ──────────────────────────────────────────────────────────

export const placementQuiz: AssessmentQuiz = {
  id: "placement-v1",
  kind: "placement",
  version: "2026-03-02",
  title: "Placement Quiz",
  instructions:
    "Choose the best answer for each question. This short quiz helps us find the right starting point for you.",
  sections: [
    {
      id: "listening-basics",
      title: "Listening Basics",
      weight: 0.35,
      questionIds: ["P01", "P02", "P03"],
    },
    {
      id: "core-recognition",
      title: "Core Recognition",
      weight: 0.4,
      questionIds: ["P04", "P05", "P06", "P07"],
    },
    {
      id: "study-readiness",
      title: "Study Readiness",
      weight: 0.25,
      questionIds: ["P08", "P09"],
    },
  ],
  placementBands: [
    {
      label: "Beginner Start",
      scoreMin: 0,
      scoreMax: 39,
      deepLink: "/lessons/M01-L001",
      startLessonId: "M01-L001",
      description:
        "Start from the very beginning. We'll build your Thai foundations step by step.",
    },
    {
      label: "Fast Beginner",
      scoreMin: 40,
      scoreMax: 69,
      deepLink: "/lessons/M01-L003",
      startLessonId: "M01-L003",
      description:
        "You know some basics! Skip ahead to conversational phrases.",
    },
    {
      label: "Bridge Level",
      scoreMin: 70,
      scoreMax: 100,
      deepLink: "/lessons/M01-L006",
      startLessonId: "M01-L006",
      description:
        "Strong foundation detected. Jump to tones and deeper skills.",
    },
  ],
  branchRules: [
    {
      afterQuestionId: "P03",
      ifSectionScoreBelow: 34,
      skipToQuestionId: "P08",
    },
  ],
  questions: [
    // ── Listening Basics (35%) ──
    {
      id: "P01",
      type: "audio_meaning_match",
      sectionId: "listening-basics",
      displayMode: "triplet",
      prompt: {
        text: "Listen and choose the meaning:",
        triplet: {
          thai: "สวัสดีครับ",
          translit: "sà-wàt-dii khráp",
          english: "Hello (male polite)",
        },
      },
      options: [
        { id: "a", text: "Good morning" },
        { id: "b", text: "Hello (male polite)" },
        { id: "c", text: "Thank you" },
        { id: "d", text: "Excuse me" },
      ],
      correctOptionId: "b",
      explanation:
        "สวัสดีครับ (sà-wàt-dii khráp) is the standard male polite greeting.",
      tags: ["greetings", "listening", "polite-particles"],
      audioSrc: "/audio/assessment/placement-v1/P01.mp3",
      audioRequired: true,
      difficulty: 0,
      sortOrder: 1,
    },
    {
      id: "P02",
      type: "audio_meaning_match",
      sectionId: "listening-basics",
      displayMode: "triplet",
      prompt: {
        text: "Listen and choose the meaning:",
        triplet: {
          thai: "ขอบคุณค่ะ",
          translit: "khàwp-khun khâ",
          english: "Thank you (female polite)",
        },
      },
      options: [
        { id: "a", text: "Hello" },
        { id: "b", text: "Sorry" },
        { id: "c", text: "Thank you (female polite)" },
        { id: "d", text: "How much?" },
      ],
      correctOptionId: "c",
      explanation:
        "ขอบคุณค่ะ (khàwp-khun khâ) means 'Thank you' with the female polite particle.",
      tags: ["greetings", "listening", "polite-particles"],
      audioSrc: "/audio/assessment/placement-v1/P02.mp3",
      audioRequired: true,
      difficulty: 0,
      sortOrder: 2,
    },
    {
      id: "P03",
      type: "audio_meaning_match",
      sectionId: "listening-basics",
      displayMode: "triplet",
      prompt: {
        text: "Listen and choose the meaning:",
        triplet: {
          thai: "สบายดีไหม",
          translit: "sà-baai dii mǎi",
          english: "How are you?",
        },
      },
      options: [
        { id: "a", text: "Where are you going?" },
        { id: "b", text: "How are you?" },
        { id: "c", text: "What is your name?" },
        { id: "d", text: "Are you hungry?" },
      ],
      correctOptionId: "b",
      explanation:
        "สบายดีไหม (sà-baai dii mǎi) is the standard 'How are you?' greeting.",
      tags: ["greetings", "listening"],
      audioSrc: "/audio/assessment/placement-v1/P03.mp3",
      audioRequired: true,
      difficulty: 0,
      sortOrder: 3,
    },
    // ── Core Recognition (40%) ──
    {
      id: "P04",
      type: "thai_to_english",
      sectionId: "core-recognition",
      displayMode: "triplet",
      prompt: {
        text: "What does this word mean?",
        triplet: { thai: "ใกล้", translit: "glâi", english: "near" },
      },
      options: [
        { id: "a", text: "far" },
        { id: "b", text: "near" },
        { id: "c", text: "left" },
        { id: "d", text: "right" },
      ],
      correctOptionId: "b",
      explanation:
        "ใกล้ (glâi) means 'near'. Note: ไกล (glai) without the falling tone means 'far' — tones matter!",
      tags: ["directions", "tone-minimal-pairs"],
      difficulty: 1,
      sortOrder: 4,
    },
    {
      id: "P05",
      type: "thai_to_english",
      sectionId: "core-recognition",
      displayMode: "triplet",
      prompt: {
        text: "What does this word mean?",
        triplet: { thai: "ไกล", translit: "glai", english: "far" },
      },
      options: [
        { id: "a", text: "near" },
        { id: "b", text: "fast" },
        { id: "c", text: "far" },
        { id: "d", text: "slow" },
      ],
      correctOptionId: "c",
      explanation:
        "ไกล (glai) means 'far'. Compare with ใกล้ (glâi) = 'near'.",
      tags: ["directions", "tone-minimal-pairs"],
      difficulty: 1,
      sortOrder: 5,
    },
    {
      id: "P06",
      type: "real_world_response",
      sectionId: "core-recognition",
      displayMode: "english_only",
      prompt: {
        text: "Thai has how many tones?",
      },
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "4" },
        { id: "c", text: "5" },
        { id: "d", text: "6" },
      ],
      correctOptionId: "c",
      explanation:
        "Thai has 5 tones: mid (สามัญ, sǎa-man), low (เอก, èek), falling (โท, thoo), high (ตรี, dtrii), and rising (จัตวา, jàt-dta-waa).",
      tags: ["tones"],
      difficulty: 1,
      sortOrder: 6,
    },
    {
      id: "P07",
      type: "thai_to_english",
      sectionId: "core-recognition",
      displayMode: "triplet",
      prompt: {
        text: "What does this phrase mean?",
        triplet: {
          thai: "เท่าไหร่",
          translit: "thâo-rài",
          english: "How much?",
        },
      },
      options: [
        { id: "a", text: "How much?" },
        { id: "b", text: "Where?" },
        { id: "c", text: "When?" },
        { id: "d", text: "Who?" },
      ],
      correctOptionId: "a",
      explanation:
        "เท่าไหร่ (thâo-rài) means 'How much?' — essential for shopping and restaurants.",
      tags: ["shopping", "numbers"],
      difficulty: 1,
      sortOrder: 7,
    },
    // ── Study Readiness (25%) ──
    {
      id: "P08",
      type: "real_world_response",
      sectionId: "study-readiness",
      displayMode: "english_only",
      prompt: {
        text: "What weekly pace works best for this course?",
      },
      options: [
        { id: "a", text: "1 lesson per week" },
        { id: "b", text: "2 lessons per week" },
        { id: "c", text: "3–4 lessons per week" },
        { id: "d", text: "Only on weekends" },
      ],
      correctOptionId: "c",
      explanation:
        "3–4 lessons per week provides the ideal balance of practice and retention for most learners.",
      tags: [],
      difficulty: 0,
      sortOrder: 8,
    },
    {
      id: "P09",
      type: "word_order",
      sectionId: "study-readiness",
      displayMode: "english_only",
      prompt: {
        text: "Which learning loop gives the best results?",
      },
      options: [
        { id: "a", text: "Watch → Practice → Quiz → Review" },
        { id: "b", text: "Quiz → Watch → Review → Practice" },
        { id: "c", text: "Practice → Quiz → Watch → Review" },
        { id: "d", text: "Review only" },
      ],
      correctOptionId: "a",
      explanation:
        "Watch → Practice → Quiz → Review follows the active recall cycle that optimizes long-term retention.",
      tags: [],
      difficulty: 0,
      sortOrder: 9,
    },
  ],
};

// ── TONE QUIZ ───────────────────────────────────────────────────────────────

export const toneQuiz: AssessmentQuiz = {
  id: "tone-v1",
  kind: "tone",
  version: "2026-03-02",
  title: "Tone Check",
  instructions:
    "Test your ear for Thai tones. Score 70% or higher to unlock tone-focused lessons.",
  ctaThresholdPercent: 70,
  sections: [
    {
      id: "tone-identify",
      title: "Tone Identification",
      weight: 0.5,
      questionIds: ["T01", "T02", "T03", "T04"],
    },
    {
      id: "tone-pairs",
      title: "Minimal Pairs",
      weight: 0.5,
      questionIds: ["T05", "T06", "T07", "T08"],
    },
  ],
  branchRules: [],
  questions: [
    // ── Tone Identification (50%) ──
    {
      id: "T01",
      type: "tone_identification",
      sectionId: "tone-identify",
      displayMode: "triplet",
      prompt: {
        text: "Which tone is used in this word?",
        triplet: { thai: "ไม่", translit: "mâi", english: "not" },
      },
      options: [
        { id: "a", text: "Mid tone" },
        { id: "b", text: "Low tone" },
        { id: "c", text: "Falling tone" },
        { id: "d", text: "Rising tone" },
      ],
      correctOptionId: "c",
      explanation:
        "ไม่ (mâi) uses a falling tone (circumflex accent: â). The falling tone starts high and drops.",
      tags: ["tones", "tone-minimal-pairs"],
      audioSrc: "/audio/assessment/tone-v1/T01.mp3",
      difficulty: 1,
      sortOrder: 1,
    },
    {
      id: "T02",
      type: "tone_identification",
      sectionId: "tone-identify",
      displayMode: "triplet",
      prompt: {
        text: "Which tone is used in this word?",
        triplet: { thai: "ใหม่", translit: "mài", english: "new" },
      },
      options: [
        { id: "a", text: "Mid tone" },
        { id: "b", text: "Low tone" },
        { id: "c", text: "Falling tone" },
        { id: "d", text: "High tone" },
      ],
      correctOptionId: "b",
      explanation:
        "ใหม่ (mài) uses a low tone (grave accent: à). The low tone stays level but lower than mid.",
      tags: ["tones", "tone-minimal-pairs"],
      audioSrc: "/audio/assessment/tone-v1/T02.mp3",
      difficulty: 1,
      sortOrder: 2,
    },
    {
      id: "T03",
      type: "tone_identification",
      sectionId: "tone-identify",
      displayMode: "triplet",
      prompt: {
        text: "Which tone is used in this word?",
        triplet: { thai: "ไหม", translit: "mǎi", english: "question particle" },
      },
      options: [
        { id: "a", text: "Rising tone" },
        { id: "b", text: "Low tone" },
        { id: "c", text: "High tone" },
        { id: "d", text: "Mid tone" },
      ],
      correctOptionId: "a",
      explanation:
        "ไหม (mǎi) uses a rising tone (caron accent: ǎ). The rising tone dips then rises.",
      tags: ["tones", "tone-minimal-pairs"],
      audioSrc: "/audio/assessment/tone-v1/T03.mp3",
      difficulty: 1,
      sortOrder: 3,
    },
    {
      id: "T04",
      type: "tone_identification",
      sectionId: "tone-identify",
      displayMode: "triplet",
      prompt: {
        text: "Which tone is used in this word?",
        triplet: { thai: "ไม้", translit: "máai", english: "wood / stick" },
      },
      options: [
        { id: "a", text: "Falling tone" },
        { id: "b", text: "Rising tone" },
        { id: "c", text: "High tone" },
        { id: "d", text: "Low tone" },
      ],
      correctOptionId: "c",
      explanation:
        "ไม้ (máai) uses a high tone (acute accent: á). The high tone stays level but higher than mid.",
      tags: ["tones"],
      audioSrc: "/audio/assessment/tone-v1/T04.mp3",
      difficulty: 1,
      sortOrder: 4,
    },
    // ── Minimal Pairs (50%) ──
    {
      id: "T05",
      type: "tone_minimal_pair",
      sectionId: "tone-pairs",
      displayMode: "triplet",
      prompt: {
        text: "Which word means 'near'?",
      },
      options: [
        {
          id: "a",
          text: "ไกล (glai) — mid tone",
          triplet: { thai: "ไกล", translit: "glai", english: "far" },
        },
        {
          id: "b",
          text: "ใกล้ (glâi) — falling tone",
          triplet: { thai: "ใกล้", translit: "glâi", english: "near" },
        },
      ],
      correctOptionId: "b",
      explanation:
        "ใกล้ (glâi, falling tone) = near. ไกล (glai, mid tone) = far. The tone changes the entire meaning!",
      tags: ["tones", "tone-minimal-pairs", "directions"],
      audioSrc: "/audio/assessment/tone-v1/T05.mp3",
      difficulty: 1,
      sortOrder: 5,
    },
    {
      id: "T06",
      type: "tone_minimal_pair",
      sectionId: "tone-pairs",
      displayMode: "triplet",
      prompt: {
        text: "Which word means 'rice (cooked)'?",
      },
      options: [
        {
          id: "a",
          text: "เข้า (khâo) — falling tone",
          triplet: { thai: "เข้า", translit: "khâo", english: "to enter" },
        },
        {
          id: "b",
          text: "ข้าว (khâao) — falling tone",
          triplet: { thai: "ข้าว", translit: "khâao", english: "rice" },
        },
        {
          id: "c",
          text: "เขา (khǎo) — rising tone",
          triplet: { thai: "เขา", translit: "khǎo", english: "he/she/mountain" },
        },
      ],
      correctOptionId: "b",
      explanation:
        "ข้าว (khâao) means 'rice (cooked)'. เข้า (khâo) means 'to enter'. เขา (khǎo) means 'he/she' or 'mountain'.",
      tags: ["tones", "tone-minimal-pairs", "food"],
      audioSrc: "/audio/assessment/tone-v1/T06.mp3",
      difficulty: 2,
      sortOrder: 6,
    },
    {
      id: "T07",
      type: "tone_minimal_pair",
      sectionId: "tone-pairs",
      displayMode: "triplet",
      prompt: {
        text: "Which word means 'beautiful'?",
      },
      options: [
        {
          id: "a",
          text: "สวย (sǔay) — rising tone",
          triplet: { thai: "สวย", translit: "sǔay", english: "beautiful" },
        },
        {
          id: "b",
          text: "ซวย (suay) — mid tone",
          triplet: { thai: "ซวย", translit: "suay", english: "unlucky" },
        },
      ],
      correctOptionId: "a",
      explanation:
        "สวย (sǔay, rising tone) = beautiful. ซวย (suay, mid tone) = unlucky. Be careful with tones here!",
      tags: ["tones", "tone-minimal-pairs"],
      audioSrc: "/audio/assessment/tone-v1/T07.mp3",
      difficulty: 2,
      sortOrder: 7,
    },
    {
      id: "T08",
      type: "tone_minimal_pair",
      sectionId: "tone-pairs",
      displayMode: "triplet",
      prompt: {
        text: "Which phrase means 'not spicy'?",
      },
      options: [
        {
          id: "a",
          text: "ไม่เผ็ด (mâi phèt)",
          triplet: {
            thai: "ไม่เผ็ด",
            translit: "mâi phèt",
            english: "not spicy",
          },
        },
        {
          id: "b",
          text: "ไหมเผ็ด (mǎi phèt)",
          triplet: {
            thai: "ไหมเผ็ด",
            translit: "mǎi phèt",
            english: "(question) spicy?",
          },
        },
      ],
      correctOptionId: "a",
      explanation:
        "ไม่ (mâi, falling tone) = 'not'. ไหม (mǎi, rising tone) = question particle. So ไม่เผ็ด = 'not spicy'.",
      tags: ["tones", "tone-minimal-pairs", "food"],
      audioSrc: "/audio/assessment/tone-v1/T08.mp3",
      difficulty: 1,
      sortOrder: 8,
    },
  ],
};

// ── READER-TONES QUIZ ───────────────────────────────────────────────────────

export const readerTonesQuiz: AssessmentQuiz = {
  id: "reader-tones-v1",
  kind: "reader-tones",
  version: "2026-03-02",
  title: "Read & Identify Tones",
  instructions:
    "Read the Thai script and identify the correct tone or transliteration. This tests your ability to decode tone marks from written Thai.",
  passingScorePercent: 60,
  sections: [
    {
      id: "read-tone-marks",
      title: "Read Tone Marks",
      weight: 0.5,
      questionIds: ["RT01", "RT02", "RT03"],
    },
    {
      id: "script-to-translit",
      title: "Script to Transliteration",
      weight: 0.5,
      questionIds: ["RT04", "RT05", "RT06"],
    },
  ],
  branchRules: [],
  questions: [
    // ── Read Tone Marks (50%) ──
    {
      id: "RT01",
      type: "read_and_identify_tone",
      sectionId: "read-tone-marks",
      displayMode: "thai_only",
      prompt: {
        text: "What tone does the Thai tone mark ไม้เอก ( ่ ) indicate?",
      },
      options: [
        { id: "a", text: "Low tone (เสียงเอก, sǐang èek)" },
        { id: "b", text: "Falling tone (เสียงโท, sǐang thoo)" },
        { id: "c", text: "High tone (เสียงตรี, sǐang dtrii)" },
        { id: "d", text: "Rising tone (เสียงจัตวา, sǐang jàt-dta-waa)" },
      ],
      correctOptionId: "a",
      explanation:
        "ไม้เอก ( ่ ) is the first tone mark. On mid-class consonants it indicates a low tone.",
      tags: ["tones", "reading"],
      difficulty: 1,
      sortOrder: 1,
    },
    {
      id: "RT02",
      type: "read_and_identify_tone",
      sectionId: "read-tone-marks",
      displayMode: "thai_only",
      prompt: {
        text: "What tone does the Thai tone mark ไม้โท ( ้ ) indicate on a mid-class consonant?",
      },
      options: [
        { id: "a", text: "Low tone" },
        { id: "b", text: "Falling tone (เสียงโท, sǐang thoo)" },
        { id: "c", text: "High tone" },
        { id: "d", text: "Mid tone" },
      ],
      correctOptionId: "b",
      explanation:
        "ไม้โท ( ้ ) is the second tone mark. On mid-class consonants it indicates a falling tone.",
      tags: ["tones", "reading"],
      difficulty: 1,
      sortOrder: 2,
    },
    {
      id: "RT03",
      type: "read_and_identify_tone",
      sectionId: "read-tone-marks",
      displayMode: "triplet",
      prompt: {
        text: "Which consonant class does กอ ไก่ (ก) belong to?",
        triplet: { thai: "ก", translit: "gaw gài", english: "chicken (letter name)" },
      },
      options: [
        { id: "a", text: "Mid class (อักษรกลาง, àk-sǎwn glaang)" },
        { id: "b", text: "High class (อักษรสูง, àk-sǎwn sǔung)" },
        { id: "c", text: "Low class (อักษรต่ำ, àk-sǎwn dtàm)" },
      ],
      correctOptionId: "a",
      explanation:
        "ก (gaw) is a mid-class consonant. The 9 mid-class consonants are: ก จ ฎ ฏ ด ต บ ป อ.",
      tags: ["reading", "tones"],
      difficulty: 2,
      sortOrder: 3,
    },
    // ── Script to Transliteration (50%) ──
    {
      id: "RT04",
      type: "thai_to_english",
      sectionId: "script-to-translit",
      displayMode: "thai_only",
      prompt: {
        text: "Choose the correct transliteration:",
        triplet: { thai: "น้ำ", translit: "náam", english: "water" },
      },
      options: [
        { id: "a", text: "naam (mid tone)" },
        { id: "b", text: "náam (high tone)" },
        { id: "c", text: "nâam (falling tone)" },
        { id: "d", text: "nàam (low tone)" },
      ],
      correctOptionId: "b",
      explanation:
        "น้ำ (náam) uses ไม้โท on a low-class consonant, producing a high tone. It means 'water'.",
      tags: ["reading", "tones"],
      difficulty: 2,
      sortOrder: 4,
    },
    {
      id: "RT05",
      type: "thai_to_english",
      sectionId: "script-to-translit",
      displayMode: "thai_only",
      prompt: {
        text: "Choose the correct transliteration:",
        triplet: { thai: "ร้อน", translit: "ráwn", english: "hot" },
      },
      options: [
        { id: "a", text: "rawn (mid tone)" },
        { id: "b", text: "ràwn (low tone)" },
        { id: "c", text: "ráwn (high tone)" },
        { id: "d", text: "râwn (falling tone)" },
      ],
      correctOptionId: "c",
      explanation:
        "ร้อน (ráwn) = 'hot'. The ไม้โท on low-class ร produces a high tone.",
      tags: ["reading", "tones"],
      difficulty: 2,
      sortOrder: 5,
    },
    {
      id: "RT06",
      type: "thai_to_english",
      sectionId: "script-to-translit",
      displayMode: "thai_only",
      prompt: {
        text: "Choose the correct transliteration:",
        triplet: { thai: "กิน", translit: "gin", english: "to eat" },
      },
      options: [
        { id: "a", text: "gin (mid tone)" },
        { id: "b", text: "gìn (low tone)" },
        { id: "c", text: "gín (high tone)" },
        { id: "d", text: "gîn (falling tone)" },
      ],
      correctOptionId: "a",
      explanation:
        "กิน (gin) = 'to eat'. ก is mid-class with no tone mark, so it's mid tone (unmarked).",
      tags: ["reading", "tones", "food"],
      difficulty: 1,
      sortOrder: 6,
    },
  ],
};

/** All assessment quizzes indexed by ID. */
export const assessmentQuizzes: Record<string, AssessmentQuiz> = {
  "placement-v1": placementQuiz,
  "tone-v1": toneQuiz,
  "reader-tones-v1": readerTonesQuiz,
};
