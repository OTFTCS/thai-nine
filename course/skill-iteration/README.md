# Skill Iteration Lab

This folder is the easy-access workspace for improving the `thai-lesson-production` skill until it can one-shot lessons end to end most of the time.

The canonical lesson files still live in `course/modules/Mxx/Lyyy/`.
This folder is for regression tracking, baseline comparison, run notes, and skill deltas.

## Current regression pair

- `M01-L002`
- `M01-L003`

We use both lessons together so each skill change must help more than one lesson shape before we trust it.

## One-shot bar

For this phase, a one-shot lesson means:

- script quality is usable with only tiny cosmetic nudges
- editorial, visual, assessment, validation, and transliteration gates pass cleanly
- the PPTX deck is recording-ready
- the Canva pack imports cleanly with only tiny cosmetic nudges

Every manual fix must be logged as a skill defect, not treated as a one-off lesson rescue.

## Explanation research rule

Default teaching style:

- concrete beginner content stays translation-first and usage-first
- conceptual anchors are opt-in, not automatic
- external explanation research is allowed only for selected high-risk concepts

When external explanation research is used:

1. start with repo-local pedagogy docs and approved lesson exemplars
2. use the approved external source ladder in `source-ladder.md`
3. write `explanation-research.md` in the lesson folder
4. distill the result into shorter house-style wording before it reaches the script
5. keep citations in research notes only

Do not copy source wording into learner-facing files.

## Working loop

1. Freeze the current lesson pack as the baseline reference.
2. Generate a fresh candidate lesson pack with the current skill.
3. Score both lessons on the shared regression matrix.
4. Convert recurring fixes into skill, prompt, checklist, QA, or layout-contract changes.
5. Rerun both lessons.
6. Stop only when both lessons reach the one-shot bar together.

## Folder map

- `regression-matrix.md` — shared scorecard for `L002` and `L003`
- `source-ladder.md` — approved explanation research sources
- `lessons/` — lesson-specific notes and baseline links
- `runs/` — iteration-by-iteration summaries, scorecards, and skill deltas
