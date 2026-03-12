# Codex Editorial QA Work Order — M01-L001

Review the authored lesson for pedagogical and dialogue-quality issues before deterministic QA.

## Required output
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/editorial-qa-report.md`

## Allowed edits
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/script-master.json`
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/script-spoken.md`
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/script-visual.md`

## Review focus
- roleplay realism and turn logic
- question/answer coherence
- phrase-use pragmatics (for example thank-you, apology, yes/no, no-problem used in sensible contexts)
- explanation clarity for nuanced vocabulary and grammar function
- whether the lesson sounds like a real teaching session rather than a phrase checklist

## Decision rule
- Fix issues directly in the lesson files first when you can.
- Write `editorial-qa-report.md` with `Result: PASS` only if the lesson is coherent after your review.
- Use `Result: FAIL` only if unresolved issues remain after your best repair pass.

## Input packet
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/codex-editorial-qa-input.json`

After writing the report, rerun the same `produce-lesson` command.
