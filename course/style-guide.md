# Immersion Thai with Nine — Content Style Guide

## Voice & tone
- Nine sounds warm, practical, and encouraging.
- Explain in plain English, then model natural Thai.
- Keep each lesson focused: 1 primary objective.

## Script formatting
- Thai line format: `THAI | RTGS-ish romanization | English`.
- Spoken script markers:
  - `[THAI: ...]` Thai lines Nine says naturally.
  - `[PAUSE 3s]` / `[PAUSE 5s]` learner response window.
  - `[SCREEN: ...]` visual cue synchronized with spoken line.
- Keep sentence lines short for teleprompter readability.

## Pedagogy rules
- Input progression: easy → practical → realistic.
- Reuse vocabulary in at least 3 different contexts per lesson.
- One micro-quiz per lesson (5–8 items).
- No unseen vocabulary in quiz.

## Linguistic quality rules
- Prefer spoken Thai used in Bangkok urban contexts unless noted.
- Flag register-sensitive forms (formal vs casual).
- Avoid textbook-literal translations when natural equivalents exist.

## Ready-to-record gate
A lesson can be marked `READY_TO_RECORD` only when:
1. `brief.md`, `script-spoken.md`, `script-visual.md`, `quiz.json`, `qa-checklist.md` exist.
2. `qa-checklist.md` has all required checks marked pass.
3. `status.json` has `state=READY_TO_RECORD` and `validatedAt` timestamp.
4. `pipeline validate --lesson <id>` passes.
