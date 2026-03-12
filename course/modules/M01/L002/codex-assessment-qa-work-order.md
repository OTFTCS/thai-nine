# Codex Assessment QA Work Order — M01-L002

Review flashcards and quiz quality after deterministic stages 5 and 6.

## Required output
- `/Users/Shared/work/thai-nine/course/modules/M01/L002/assessment-qa-report.md`

## Allowed edits
- None in v1. This review is read-only.

## Review focus
- flashcards should be study-worthy, not noisy extraction
- quiz questions should match lesson goals
- distractors should be plausible
- prompts should be unambiguous
- assessment should not be technically valid but pedagogically weak

## Decision rule
- If the source lesson content is the problem, report it clearly instead of patching around it here.
- Write `assessment-qa-report.md` with `Result: PASS` only if the assessment pack is good enough to release.
- Use `Result: FAIL` if the lesson still needs source fixes before assessment can be trusted.

## Input packet
- `/Users/Shared/work/thai-nine/course/modules/M01/L002/codex-assessment-qa-input.json`

After writing the report, rerun the same `produce-lesson` command.
