# Thai with Nine — Project Context

## What this is
A Thai language course (Immersion Thai with Nine) with 180 lessons across 18 modules, A0 to B2. Each lesson is a pre-recorded video tutorial with PPTX slides, also used for live 1:1 teaching with Nine.

## Key directories
- `course/exports/full-thai-course-blueprint.csv` — source of truth for all 180 lessons
- `course/modules/M01-M18/L001-L010/` — lesson artifacts
- `course/tools/` — pipeline scripts (TypeScript + Python)
- `course/prompts/agent-prompts/` — 12 agent prompt files for each pipeline stage
- `course/schemas/` — JSON schemas for all artifacts

## Sub-projects
- `thai_with_nine_tiktok/` — TikTok shortform series. Python + Manim pipeline for scripting, rendering, and QA. Active series: Thai Classifiers (8 episodes).
- `Thai images/` — Vocabulary image carousels for Instagram/TikTok. Managed by `/produce-carousel`.
- `src/` — Next.js web app (quiz system, course viewer).

## Reference docs
- `thai-transliteration-standard.md` — full PTM transliteration rules (the authority)
- `course/style-guide.md` — slide layout, font, colour, and formatting rules
- `course/transliteration-policy.md` — transliteration policy for pipeline

## Pipeline commands
```bash
npm run course:produce -- --lesson M01-L004   # Full pipeline
npm run course:validate                        # Validate all
npm run course:validate:lesson -- M01-L001     # Validate one
npm run course:translit-audit                  # Transliteration check
```

## Style rules
- **Transliteration:** PTM-adapted inline tone marks only (no superscript). Mid tone = unmarked.
- **Person:** Use "You" not "Learner" in all user-facing text. 2nd person for 1:1 feel.
- **Font:** Sarabun for Thai, transliteration, and English on slides.
- **Layout:** 16:9 slides with top-right PiP camera placeholder (4.2" × 3.15"). Content beside PiP uses constrained width (~7.7"). Content below PiP uses full width.
- **Dual purpose:** Every lesson works for self-paced online course AND live 1:1 teaching with Nine.

## Pedagogy rules
- 40%+ production drills (substitution, response-building, pause-and-produce)
- Input flood: each new item in 3+ contexts across the lesson
- Pronunciation beat in every lesson (M01-L002+) with minimal pairs
- 7 required teaching devices per lesson
- Chunks taught as whole units first (type: "chunk")
- Scored editorial QA rubric: 8 dimensions, avg 3.0+, no dimension below 2

## Skills
- `/produce-lesson M01-L004` — full 12-stage lesson pipeline from blueprint to READY_TO_RECORD
- `/produce-carousel "Topic"` — vocabulary image carousel from topic to finished PNGs

## Publishing safety
- NEVER post, publish, or upload to any platform (TikTok, YouTube, Instagram, or any other) without explicit per-action user confirmation — even if the user says "publish everything" or similar.
- NEVER assume a piece of content is live/published unless the platform API confirms it. Derive published status from API responses only, never from filename patterns or xlsx text-matching.
- When API credentials are missing or the API call fails, fall back to UNKNOWN status — never assume published=true.
- Scheduling a post (queuing) is allowed. Actually firing the publish API call requires a separate explicit approval.
- Required env vars for status checks: `TIKTOK_ACCESS_TOKEN` (+ optional `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` for future refresh), `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` (+ optional `YOUTUBE_OAUTH_TOKEN` for private/unlisted reads). Store in `.env` only, never in source.
