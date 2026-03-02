# Pre-Course Assessment System

## Overview

The assessment system places learners at the right starting point in the Immersion Thai curriculum. It consists of three quizzes, a scoring engine with gap analysis, and Nine's teacher override panel.

## Routes

| Route | Purpose |
|-------|---------|
| `/assessment` | Hub page linking all three quizzes |
| `/assessment/placement` | Placement quiz (9 questions, weighted, branching) |
| `/assessment/tone` | Tone check (8 questions, 70% CTA threshold) |
| `/assessment/reader-tones` | Read & identify tones (6 questions, script skills) |
| `/assessment/teacher` | Nine's teacher dashboard (review, notes, override) |

## Architecture

```
src/
├── types/assessment.ts          # All TypeScript interfaces
├── lib/
│   ├── assessment-data.ts       # Quiz definitions (questions, sections, bands)
│   ├── assessment-scoring.ts    # Scoring engine (weighted, confidence, gaps)
│   └── assessment-persistence.ts # localStorage session/result/teacher storage
├── hooks/
│   └── use-assessment.ts        # Core quiz flow hook (branching, timing, resume)
├── components/assessment/
│   ├── index.ts                 # Barrel export
│   ├── assessment-container.tsx # Main quiz flow container
│   ├── assessment-question.tsx  # Single question renderer
│   ├── assessment-results.tsx   # Results with confidence, gaps, deep links
│   ├── thai-triplet.tsx         # Thai/translit/English display component
│   ├── audio-placeholder.tsx    # Audio player (placeholder until recorded)
│   └── teacher-panel.tsx        # Nine's teacher mode panel
└── app/(dashboard)/assessment/
    ├── page.tsx                 # Hub
    ├── placement/page.tsx       # Placement quiz page
    ├── tone/page.tsx            # Tone quiz page
    ├── reader-tones/page.tsx    # Reader-tones quiz page
    └── teacher/page.tsx         # Teacher dashboard page
```

## Quizzes

### Placement Quiz (`placement-v1`)

- **9 questions** across 3 weighted sections
- **Sections:**
  - Listening Basics (35%): Audio meaning match
  - Core Recognition (40%): Thai-to-English, tone facts
  - Study Readiness (25%): Learning pace, method
- **Branching:** If listening section score < 34% after Q3, skip to study readiness
- **Placement bands:**
  - 0–39%: Beginner Start → M01-L001
  - 40–69%: Fast Beginner → M01-L003
  - 70–100%: Bridge Level → M01-L006

### Tone Quiz (`tone-v1`)

- **8 questions** across 2 sections (50/50 weight)
- **Sections:**
  - Tone Identification: Identify tone from word
  - Minimal Pairs: Distinguish meaning by tone
- **CTA threshold:** 70% unlocks tone-focused lessons
- No branching

### Reader-Tones Quiz (`reader-tones-v1`)

- **6 questions** across 2 sections (50/50 weight)
- **Sections:**
  - Read Tone Marks: Thai writing system tone marks
  - Script to Transliteration: Match Thai to correct PTM translit
- **Passing score:** 60%
- No branching

## Scoring System

### Weighted Scoring

Each section has a weight (all sum to 1.0). The overall score is:

```
overallScore = Σ (sectionRawPercent × sectionWeight)
```

### Confidence Assessment

Confidence is computed from:
- **Answer completion ratio** (skipped questions lower confidence)
- **Guess detection** (wrong answers < 3 seconds are flagged as guesses)
- **Levels:** high, medium, low — with human-readable reason

### Topic Gap Analysis

Questions are tagged (e.g. `tones`, `greetings`, `directions`). If ≥ 50% of questions with a tag are missed, that tag becomes a "topic gap" with lesson recommendations from `TAG_LESSON_MAP`.

## Persistence & Resume

- **Storage:** localStorage with key prefix `immersion-thai:assessment:`
- **Session auto-save:** After every answer
- **Resume:** If a session exists and is < 24 hours old
- **History:** Last 5 results per quiz
- **Teacher assignments:** Persisted separately

## Nine's Teacher Mode

- View all completed assessments
- Add notes per question or overall
- Override placement (lesson ID + reason required)
- Save teacher assignment (persisted to localStorage)
- Final assignment = override > computed placement

## Transliteration Compliance

All quiz content follows the repo's PTM transliteration policy:

- **Thai script** always shown (via `ThaiTriplet`)
- **Inline tone marks:** à (low), â (falling), á (high), ǎ (rising)
- **Mid tone** is unmarked
- **No IPA symbols** (ʉ, ə, ŋ, etc.)
- **No superscript/legacy tones** (ᴴ, ^H, wordH)

Test `assessment-scoring.test.ts` includes a compliance check that validates all quiz data.

## Audio Naming Convention

```
/audio/assessment/{quizId}/{questionId}.mp3

Examples:
/audio/assessment/placement-v1/P01.mp3
/audio/assessment/tone-v1/T01.mp3
/audio/assessment/reader-tones-v1/RT01.mp3
```

Audio files are not yet recorded. The `AudioPlaceholder` component shows a "coming soon" notice and instructs learners to use the Thai script and transliteration.

## Running Tests

```bash
npx tsx --test src/lib/__tests__/assessment-scoring.test.ts
```

## Running the App

```bash
npm run dev
# Then visit:
# http://localhost:3000/assessment          — Hub
# http://localhost:3000/assessment/placement — Placement Quiz
# http://localhost:3000/assessment/tone      — Tone Check
# http://localhost:3000/assessment/reader-tones — Reader Tones
# http://localhost:3000/assessment/teacher   — Teacher Dashboard
```

## Mobile UX

- All quiz components use responsive Tailwind classes
- Touch-friendly option buttons with generous padding (p-4)
- Progress dots wrap on narrow screens
- Results use stacked layout on mobile (flex-col)
- Minimum touch target 44px (WCAG 2.5.5)

## Accessibility

- ARIA roles: `radiogroup`, `radio`, `aria-checked`, `aria-label`
- `lang="th"` on Thai text elements
- Semantic headings and landmarks
- Color is never the sole indicator (icons + text accompany color)
- Keyboard navigable (native button focus)
