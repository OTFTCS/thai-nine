# Course Changelog

## 2026-02-26
- Pipeline hard-gate upgrade implemented in `course/tools/pipeline-cli.ts` and validator stack.
- Lesson artifacts for M01-L001 and M01-L002 are regenerated in-place (not deleted) with new canonical files:
  - `context.json` (spaced repetition buckets)
  - `asset-provenance.json`
  - `pdf-source.json`
  - `vocab-export.json`
  - `quiz-item-bank.json`
- Global canonical outputs added/updated:
  - `course/vocab/vocab-index.json`
  - `course/exports/flashcards-global.json`
- JSON Schema set added under `course/schemas/*.schema.json` with CLI-integrated schema validation.
- Migrated legacy READY lesson `M01-L003` to strict stage-gated artifact schema.
  - Preserved legacy snapshot at `course/modules/M01/L003/legacy-v1/` (old `script-spoken.md`, `script-visual.md`, `quiz.json`, `status.json`, plus companion files) before regeneration.
  - Regenerated canonical lesson artifact pack in lesson root, including `script-master.json`, `remotion.json`, `asset-provenance.json`, `pdf.md`/`pdf.pdf`, `vocab-export.json`, `quiz-item-bank.json`, `quiz.json`, `qa-report.md`, and strict `status.json`.
  - Lesson-level and repo-wide validation/schema checks pass after migration.
- Updated fallback lesson seed in `pipeline-cli.ts` to include >=5 lexemes so strict flashcards schema gates pass for migrated fallback-generated lessons.
