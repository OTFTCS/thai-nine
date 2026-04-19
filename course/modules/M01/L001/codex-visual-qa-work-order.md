# Codex Visual QA Work Order — M01-L001

Review the visual teaching plan after deterministic stage 3.

## Required output
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/M01-L001-visual-qa-report.md`

## Allowed edits
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/M01-L001-script-master.json`
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/M01-L001-script-visual.md`

## Review focus
- left two-thirds teaching readability
- right-third camera-safe compliance
- overlay density and pacing
- whether scene layout and asset choice support the spoken teaching
- whether text-only/icon/image decisions make instructional sense
- whether conceptual anchors stay spoken-first unless a simple visual reduces load

## Decision rule
- Fix script visual-plan issues directly in the allowed files when needed.
- Write `/Users/Shared/work/thai-nine/course/modules/M01/L001/M01-L001-visual-qa-report.md` with `Result: PASS` only if the visual plan is recordable.
- Use `Result: FAIL` only if unresolved layout or teaching-visual issues remain.

## Input packet
- `/Users/Shared/work/thai-nine/course/modules/M01/L001/codex-visual-qa-input.json`

After writing the report, rerun the same `produce-lesson` command.
