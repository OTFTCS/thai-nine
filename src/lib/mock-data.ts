import { Lesson } from "@/types/lesson";
import { Flashcard, FlashcardDeck } from "@/types/flashcard";
import { Quiz, QuizQuestion } from "@/types/quiz";

export const mockLessons: Lesson[] = [
  {
    id: "lesson-1",
    courseId: "course-1",
    title: "Thai Greetings & Introductions",
    description:
      "Learn essential Thai greetings, how to introduce yourself, and basic polite expressions.",
    isFree: true,
    sortOrder: 1,
    isPublished: true,
    durationMinutes: 12,
    transcript: `สวัสดีค่ะ (sà-wàt-dii khâ) — Hello (female speaker)
สวัสดีครับ (sà-wàt-dii khráp) — Hello (male speaker)

In this lesson, we'll learn the most important Thai greetings and how to introduce yourself naturally.

ผม/ดิฉัน ชื่อ... (phǒm/dì-chǎn chûue...) — My name is... (male/female)

ยินดีที่ได้รู้จัก (yin-dii thîi dâi rúu-jàk) — Nice to meet you

สบายดีไหม (sà-baai dii mǎi) — How are you?
สบายดี (sà-baai dii) — I'm fine

ขอบคุณ (khàwp-khun) — Thank you
ไม่เป็นไร (mâi bpen rai) — You're welcome / No problem`,
  },
  {
    id: "lesson-2",
    courseId: "course-1",
    title: "Numbers & Counting",
    description:
      "Master Thai numbers 1-100, learn to count, and use numbers in everyday situations.",
    isFree: true,
    sortOrder: 2,
    isPublished: true,
    durationMinutes: 15,
    transcript: `หนึ่ง (nùeng) — 1
สอง (sǎwng) — 2
สาม (sǎam) — 3
สี่ (sìi) — 4
ห้า (hâa) — 5

Thai numbers are straightforward once you learn the basics. Let's practice counting and using numbers in context.

สิบ (sìp) — 10
ยี่สิบ (yîi-sìp) — 20
ร้อย (ráwy) — 100

เท่าไหร่ (thâo-rài) — How much?
...บาท (...bàat) — ...baht (Thai currency)`,
  },
  {
    id: "lesson-3",
    courseId: "course-1",
    title: "At the Restaurant",
    description:
      "Order food like a local! Learn essential restaurant vocabulary and phrases.",
    isFree: false,
    sortOrder: 3,
    isPublished: true,
    durationMinutes: 18,
    transcript: `ร้านอาหาร (ráan aa-hǎan) — Restaurant
เมนู (meh-nuu) — Menu

ขอ...หนึ่งที่ (khǎw...nùeng thîi) — I'd like one... please
อร่อย (à-ràwy) — Delicious!

เผ็ดไหม (phèt mǎi) — Is it spicy?
ไม่เผ็ด (mâi phèt) — Not spicy
เผ็ดนิดหน่อย (phèt nít nàwy) — A little spicy

เช็คบิล (chék bin) — Check please`,
  },
  {
    id: "lesson-4",
    courseId: "course-1",
    title: "Getting Around & Directions",
    description:
      "Navigate Thai cities with confidence. Learn transportation and direction vocabulary.",
    isFree: false,
    sortOrder: 4,
    isPublished: true,
    durationMinutes: 14,
    transcript: `ไปไหน (bpai nǎi) — Where are you going?
...อยู่ที่ไหน (...yùu thîi nǎi) — Where is...?

ซ้าย (sáai) — Left
ขวา (khwǎa) — Right
ตรงไป (dtrong bpai) — Go straight

แท็กซี่ (tháek-sîi) — Taxi
รถไฟฟ้า (rót-fai-fáa) — BTS/Skytrain
รถเมล์ (rót-meh) — Bus`,
  },
  {
    id: "lesson-5",
    courseId: "course-1",
    title: "Shopping & Bargaining",
    description:
      "Learn to shop at Thai markets, ask prices, and negotiate like a pro.",
    isFree: false,
    sortOrder: 5,
    isPublished: true,
    durationMinutes: 16,
    transcript: `ราคาเท่าไหร่ (raa-khaa thâo-rài) — How much is this?
แพงไป (phaeng bpai) — Too expensive
ลดได้ไหม (lót dâi mǎi) — Can you lower the price?

ซื้อ (súue) — To buy
ขาย (khǎai) — To sell
ถูก (thùuk) — Cheap
แพง (phaeng) — Expensive`,
  },
  {
    id: "lesson-6",
    courseId: "course-1",
    title: "Thai Tones & Pronunciation",
    description:
      "Master the 5 Thai tones that make all the difference in being understood.",
    isFree: false,
    sortOrder: 6,
    isPublished: true,
    durationMinutes: 20,
    transcript: `Thai has 5 tones:
1. สามัญ (sǎa-man) — Mid tone
2. เอก (èek) — Low tone
3. โท (thoo) — Falling tone
4. ตรี (dtrii) — High tone
5. จัตวา (jàt-dta-waa) — Rising tone

Example with "mai":
ไม่ (mâi) — Not (falling tone)
ไหม (mǎi) — Question particle (rising tone)
ใหม่ (mài) — New (low tone)
ไม้ (máai) — Wood (high tone)`,
  },
];

export const mockFlashcardDecks: FlashcardDeck[] = [
  {
    id: "deck-1",
    lessonId: "lesson-1",
    title: "Greetings & Introductions Vocabulary",
    description: "Key words and phrases from Lesson 1",
  },
  {
    id: "deck-2",
    lessonId: "lesson-2",
    title: "Numbers & Counting",
    description: "Thai numbers 1-100",
  },
  {
    id: "deck-3",
    lessonId: "lesson-3",
    title: "Restaurant Vocabulary",
    description: "Food and dining phrases",
  },
];

export const mockFlashcards: Record<string, Flashcard[]> = {
  "lesson-1": [
    {
      id: "fc-1",
      deckId: "deck-1",
      frontText: "สวัสดี",
      backText: "Hello",
      backNotes: "sà-wàt-dii — Add ค่ะ (khâ) for female, ครับ (khráp) for male",
      sortOrder: 1,
    },
    {
      id: "fc-2",
      deckId: "deck-1",
      frontText: "ขอบคุณ",
      backText: "Thank you",
      backNotes: "khàwp-khun",
      sortOrder: 2,
    },
    {
      id: "fc-3",
      deckId: "deck-1",
      frontText: "สบายดีไหม",
      backText: "How are you?",
      backNotes: "sà-baai dii mǎi",
      sortOrder: 3,
    },
    {
      id: "fc-4",
      deckId: "deck-1",
      frontText: "ยินดีที่ได้รู้จัก",
      backText: "Nice to meet you",
      backNotes: "yin-dii thîi dâi rúu-jàk",
      sortOrder: 4,
    },
    {
      id: "fc-5",
      deckId: "deck-1",
      frontText: "ไม่เป็นไร",
      backText: "No problem / You're welcome",
      backNotes: "mâi bpen rai",
      sortOrder: 5,
    },
    {
      id: "fc-6",
      deckId: "deck-1",
      frontText: "ชื่อ",
      backText: "Name",
      backNotes: "chûue — used in ผมชื่อ... (My name is...)",
      sortOrder: 6,
    },
  ],
  "lesson-2": [
    {
      id: "fc-7",
      deckId: "deck-2",
      frontText: "หนึ่ง",
      backText: "One (1)",
      backNotes: "nùeng",
      sortOrder: 1,
    },
    {
      id: "fc-8",
      deckId: "deck-2",
      frontText: "สอง",
      backText: "Two (2)",
      backNotes: "sǎwng",
      sortOrder: 2,
    },
    {
      id: "fc-9",
      deckId: "deck-2",
      frontText: "สาม",
      backText: "Three (3)",
      backNotes: "sǎam",
      sortOrder: 3,
    },
    {
      id: "fc-10",
      deckId: "deck-2",
      frontText: "เท่าไหร่",
      backText: "How much?",
      backNotes: "thâo-rài",
      sortOrder: 4,
    },
  ],
  "lesson-3": [
    {
      id: "fc-11",
      deckId: "deck-3",
      frontText: "อร่อย",
      backText: "Delicious",
      backNotes: "à-ràwy",
      sortOrder: 1,
    },
    {
      id: "fc-12",
      deckId: "deck-3",
      frontText: "เผ็ด",
      backText: "Spicy",
      backNotes: "phèt",
      sortOrder: 2,
    },
    {
      id: "fc-13",
      deckId: "deck-3",
      frontText: "เช็คบิล",
      backText: "Check please",
      backNotes: "chék bin",
      sortOrder: 3,
    },
  ],
};

export const mockQuizzes: Record<string, Quiz> = {
  "lesson-1": {
    id: "quiz-1",
    lessonId: "lesson-1",
    title: "Greetings & Introductions Quiz",
    passingScore: 70,
  },
  "lesson-2": {
    id: "quiz-2",
    lessonId: "lesson-2",
    title: "Numbers & Counting Quiz",
    passingScore: 70,
  },
};

export const mockQuizQuestions: Record<string, QuizQuestion[]> = {
  "lesson-1": [
    {
      id: "q-1",
      quizId: "quiz-1",
      questionText: "How do you say 'Hello' in Thai?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "ขอบคุณ (khàwp-khun)" },
        { id: "b", text: "สวัสดี (sà-wàt-dii)" },
        { id: "c", text: "สบายดี (sà-baai dii)" },
        { id: "d", text: "ไม่เป็นไร (mâi bpen rai)" },
      ],
      correctOptionId: "b",
      explanation:
        "สวัสดี (sà-wàt-dii) means 'Hello'. Add ค่ะ for female speakers or ครับ for male speakers.",
      sortOrder: 1,
    },
    {
      id: "q-2",
      quizId: "quiz-1",
      questionText: "What does 'ขอบคุณ' mean?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "Goodbye" },
        { id: "b", text: "How are you?" },
        { id: "c", text: "Thank you" },
        { id: "d", text: "Nice to meet you" },
      ],
      correctOptionId: "c",
      explanation:
        "ขอบคุณ (khàwp-khun) means 'Thank you'. It's one of the most essential phrases in Thai.",
      sortOrder: 2,
    },
    {
      id: "q-3",
      quizId: "quiz-1",
      questionText: "How do you ask 'How are you?' in Thai?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "ยินดีที่ได้รู้จัก" },
        { id: "b", text: "ไม่เป็นไร" },
        { id: "c", text: "ชื่ออะไร" },
        { id: "d", text: "สบายดีไหม" },
      ],
      correctOptionId: "d",
      explanation:
        "สบายดีไหม (sà-baai dii mǎi) is the standard way to ask 'How are you?' in Thai.",
      sortOrder: 3,
    },
    {
      id: "q-4",
      quizId: "quiz-1",
      questionText:
        "Which particle should a male speaker add to the end of สวัสดี?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "ค่ะ (khâ)" },
        { id: "b", text: "ครับ (khráp)" },
        { id: "c", text: "จ้า (jâa)" },
        { id: "d", text: "นะ (ná)" },
      ],
      correctOptionId: "b",
      explanation:
        "Male speakers use ครับ (khráp) as a polite particle. Female speakers use ค่ะ (khâ).",
      sortOrder: 4,
    },
  ],
  "lesson-2": [
    {
      id: "q-5",
      quizId: "quiz-2",
      questionText: "What is the Thai word for the number 3?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "สอง (sǎwng)" },
        { id: "b", text: "สี่ (sìi)" },
        { id: "c", text: "สาม (sǎam)" },
        { id: "d", text: "ห้า (hâa)" },
      ],
      correctOptionId: "c",
      explanation: "สาม (sǎam) is the Thai word for 3.",
      sortOrder: 1,
    },
    {
      id: "q-6",
      quizId: "quiz-2",
      questionText: "How do you say 'How much?' in Thai?",
      questionType: "multiple_choice",
      options: [
        { id: "a", text: "เท่าไหร่ (thâo-rài)" },
        { id: "b", text: "สิบ (sìp)" },
        { id: "c", text: "บาท (bàat)" },
        { id: "d", text: "ร้อย (ráwy)" },
      ],
      correctOptionId: "a",
      explanation:
        "เท่าไหร่ (thâo-rài) means 'How much?' — very useful when shopping!",
      sortOrder: 2,
    },
  ],
};
