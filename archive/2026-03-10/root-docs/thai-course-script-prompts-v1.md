# Thai Course — Script Generation Prompts v1

Reusable AI prompts for generating lesson scripts in the production pipeline.
Each prompt produces one of two script types: **Spoken** (Nine's delivery) or **Visual** (on-screen companion).

---

## How to Use

1. Fill in the **Lesson Brief Variables** for the target lesson.
2. Paste the appropriate prompt (Spoken or Visual) into your AI tool.
3. Run editorial pass on output — check Thai naturalness, pacing, and cultural fit.
4. Save outputs per pipeline convention: `script-spoken-v1.md` / `script-visual-v1.md`.

---

## Lesson Brief Variables

Fill these before running any prompt:

```
LESSON_NUMBER: [e.g., 04]
LESSON_TITLE: [e.g., Consonant Classes — Mid Class]
MODULE: [e.g., Module 1 — Thai Script Fundamentals]
LEVEL: [e.g., A0–A1]
PRIMARY_OBJECTIVE: [One sentence: what the learner can do after this lesson]
SECONDARY_OBJECTIVE: [Optional — one supporting skill]
KEY_VOCAB: [Comma-separated Thai words with romanization + English]
SCENARIO: [Real-world context, if applicable — e.g., "ordering at a street stall"]
PRIOR_KNOWLEDGE: [What the learner already knows from previous lessons]
```

---

## Prompt 1: Spoken Script (Nine's Delivery)

```
You are a script writer for a Thai language course taught by a native Thai teacher named Nine. The course targets English-speaking beginners.

Write a spoken script for Nine to read on camera. Follow this structure exactly:

### HOOK (30–60 seconds)
- Open with energy. Tell the learner what they'll be able to do by the end.
- Use a relatable scenario or question to create immediate interest.

### CORE INPUT (5–8 minutes)
- Teach the main concept using clear, simple English explanations.
- Introduce each Thai word/phrase with: Thai script → romanization → English meaning → example in context.
- Nine should say each Thai example naturally, then repeat slowly.
- Use 2–3 real-life mini-examples per key point.
- Build from easiest to slightly harder.

### PATTERN BREAKDOWN (3–5 minutes)
- Explain the rule or pattern behind what was just taught.
- Use "notice how…" and "the pattern is…" framing.
- Compare/contrast where helpful (e.g., "unlike English, Thai does X").
- Keep it beginner-friendly — no linguistics jargon.

### GUIDED PRACTICE (3–5 minutes)
- Give 3–5 prompts where Nine says "Now you try…" or "How would you say…?"
- Pause 3–4 seconds after each prompt for learner to respond.
- Nine then gives the correct answer with brief explanation.
- Progress from recognition → recall → light production.

### MICRO-QUIZ (2–3 minutes)
- 3 quick-fire questions mixing types (meaning match, fill gap, choose correct).
- Nine asks, pauses, then reveals answer.

### RECAP + CTA (30–60 seconds)
- Summarize the 2–3 most important takeaways.
- Tell the learner what to review and what comes next.
- End with encouragement + reminder to complete the lesson quiz.

---

RULES:
- Total script length: 12–18 minutes when spoken at natural pace.
- Language: Nine speaks mostly English with Thai examples. Thai examples are always accompanied by meaning.
- Tone: Warm, encouraging, slightly playful. Never condescending.
- Avoid: Linguistics jargon, walls of grammar, more than 1 primary objective.
- Format: Use [THAI: ___] markers for Thai phrases Nine should say in Thai.
- Mark pauses with [PAUSE 3s] or [PAUSE 5s].
- Mark on-screen cues with [SCREEN: description].

LESSON BRIEF:
- Lesson: {LESSON_NUMBER} — {LESSON_TITLE}
- Module: {MODULE}
- Level: {LEVEL}
- Primary objective: {PRIMARY_OBJECTIVE}
- Secondary objective: {SECONDARY_OBJECTIVE}
- Key vocab: {KEY_VOCAB}
- Scenario: {SCENARIO}
- Prior knowledge: {PRIOR_KNOWLEDGE}
```

---

## Prompt 2: Visual Companion Script (On-Screen Text/Cards)

```
You are a visual content designer for a Thai language course video. The video uses a split-screen layout: the teacher (Nine) on one side, dynamic visual content on the other.

Generate a visual companion script that syncs with the spoken script for the lesson below. Output a sequence of screen cards in order.

For each card, specify:
- CARD_ID: sequential number
- SECTION: which lesson section it appears in (Hook / Core / Pattern / Practice / Quiz / Recap)
- TIMING_CUE: what Nine is saying when this card appears
- CARD_TYPE: one of [title, vocab, example_sentence, dialogue, pattern_rule, practice_prompt, quiz_question, quiz_answer, recap_summary]
- CONTENT: the exact text to display, structured as:
  - Thai script (large, clear)
  - Romanization (smaller, below)
  - English meaning (below romanization)
  - Any highlighting, arrows, or emphasis notes

---

RULES:
- Mobile-first: text must be legible on phone screens. Max 3 lines of Thai per card.
- Use consistent color coding: Thai = white on dark; English = muted; Romanization = accent color.
- Vocab cards: one word/phrase per card. No clutter.
- Example sentences: highlight the target word/pattern in the sentence.
- Pattern cards: use simple diagrams or formulas (e.g., "Subject + ไม่ + Verb = negation").
- Practice prompt cards: show the prompt in English, leave Thai answer hidden until reveal.
- Quiz cards: question first, then separate answer card.
- Total cards per lesson: 25–40 (roughly 2 per minute of content).

LESSON BRIEF:
- Lesson: {LESSON_NUMBER} — {LESSON_TITLE}
- Module: {MODULE}
- Level: {LEVEL}
- Primary objective: {PRIMARY_OBJECTIVE}
- Key vocab: {KEY_VOCAB}
- Scenario: {SCENARIO}
```

---

## Prompt 3: Quiz Draft Generation

```
You are a quiz designer for a beginner Thai language course. Generate a lesson quiz based on the brief below.

OUTPUT FORMAT (JSON):
{
  "lesson": {LESSON_NUMBER},
  "title": "{LESSON_TITLE}",
  "questions": [
    {
      "id": 1,
      "type": "audio_meaning_match | thai_to_english | english_to_thai | word_order | real_world_response",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": "B",
      "explanation": "Brief explanation of why this is correct.",
      "audio_required": true/false
    }
  ]
}

RULES:
- 5–8 questions per lesson quiz.
- Mix at least 3 different question types.
- Progress from recognition (easier) to production (harder).
- At least 1 question should reference a real-world scenario.
- Every Thai word/phrase must have appeared in the lesson — no unseen vocabulary.
- Distractors should be plausible (common confusions, similar-sounding words, near-meanings).
- Keep explanations to 1 sentence.

LESSON BRIEF:
- Lesson: {LESSON_NUMBER} — {LESSON_TITLE}
- Primary objective: {PRIMARY_OBJECTIVE}
- Key vocab: {KEY_VOCAB}
- Scenario: {SCENARIO}
```

---

## Prompt 4: Lesson Brief Generation

```
You are a curriculum designer for a beginner Thai course. Generate a one-page lesson brief.

OUTPUT FORMAT (Markdown):
# Lesson {LESSON_NUMBER}: {LESSON_TITLE}
- **Module:** {MODULE}
- **Level:** {LEVEL}
- **Primary objective:** [1 sentence — what the learner can do after]
- **Secondary objective:** [1 sentence — supporting skill, optional]
- **Key vocabulary:** [6–10 items: Thai | romanization | English]
- **Scenario/context:** [1–2 sentences describing the real-world context]
- **Prior knowledge required:** [What learner should already know]
- **Common mistakes to address:** [2–3 pitfalls to preempt]
- **Cultural note:** [Optional — 1 sentence if relevant]

RULES:
- One primary objective only. If it feels like two, split into two lessons.
- Vocabulary limited to what can realistically be taught and practiced in 15 minutes.
- Scenario should be grounded in real Thailand experiences for foreigners.

INPUT:
- Module: {MODULE}
- Lesson number: {LESSON_NUMBER}
- Topic: {TOPIC}
- Target level: {LEVEL}
```

---

## Quick Reference: Variable Fill for Lessons 01–20

| Lesson | Title | Module | Key Scenario |
|--------|-------|--------|-------------|
| 01 | How Thai Works | 0 | First exposure to Thai |
| 02 | The Thai Sound System | 0 | Hearing tones for the first time |
| 03 | How to Use This Course | 0 | Study planning |
| 04 | Mid-Class Consonants | 1 | Reading first Thai letters |
| 05 | High & Low Class Consonants | 1 | Sorting consonant classes |
| 06 | Core Vowels — Short & Long | 1 | Reading vowel forms |
| 07 | Tone Rules Basics | 1 | Predicting tone from script |
| 08 | Final Consonants + Live/Dead | 1 | Syllable structure |
| 09 | Reading Drills | 1 | Reading real words |
| 10 | Greetings & Politeness | 2 | Meeting someone new |
| 11 | Numbers 0–100 | 2 | Market / shopping |
| 12 | Time, Days & Dates | 2 | Making plans |
| 13 | Asking Questions | 2 | Getting information |
| 14 | Ordering Food | 2 | Street stall / restaurant |
| 15 | Paying & Prices | 2 | Market transaction |
| 16 | Directions & Transport | 2 | Getting around Bangkok |
| 17 | Word Order Basics | 3 | Building first sentences |
| 18 | Pronouns & Dropping Them | 3 | Casual conversation |
| 19 | Verbs & Time Markers | 3 | Talking about past/present/future |
| 20 | Negation & Questions Review | 3 | Saying no / confirming |
