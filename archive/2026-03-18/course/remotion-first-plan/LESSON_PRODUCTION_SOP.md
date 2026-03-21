# Lesson Production SOP

Use this checklist to take one lesson from blueprint selection to `READY_TO_RECORD`.

## Source Of Truth

- Lesson order and identity: `course/exports/full-thai-course-blueprint.csv`
- Runtime lesson state: `course/modules/<module>/<lesson>/status.json`
- Workflow resume state: `course/modules/<module>/<lesson>/produce-lesson-state.json`
- Operations runbook: `course/OPERATIONS.md`

## Quick Start

Run the orchestrator for the next lesson:

```bash
npm run course:produce -- --next
```

Run the orchestrator for a specific lesson:

```bash
npm run course:produce -- --lesson M01-L005
```

Keep rerunning the same command after each human-authored or QA step.

## Production Flow

1. Preflight
- Confirm the lesson id from the blueprint.
- Confirm the current runtime state in `status.json`.
- Confirm the current resume phase in `produce-lesson-state.json`.
- Check the lesson folder before writing anything new.

2. Stage 0 context
- The orchestrator builds `context.json`.
- Use this for prior-lesson review reuse and scope control.

3. Research before writing
- Write `scope-research.md`.
- Write `usage-research.md`.
- Write `visual-research.md`.
- `scope-research.md` must include `## Conceptual anchors` for new lessons.
- `usage-research.md` must include `## Conceptual anchors` for new lessons.
- Limit conceptual anchors to up to 3 genuinely high-risk concepts.

4. Stage-1 lesson authoring
- Write `brief.md`.
- Write `script-master.json`.
- Write `script-spoken.md`.
- Write `script-visual.md`.
- Include `teachingFrame` in `script-master.json`.
- Include `visualPlan` in every section.
- Keep conceptual anchors short, spoken-first, and stored only in existing lesson fields.

5. Editorial QA gate
- Produce `editorial-qa-report.md`.
- It must say `Result: PASS`.
- It must include `Conceptual clarity: PASS/FAIL — short reason`.
- If it fails, repair the stage-1 source files and rerun the same `course:produce` command.

6. Deterministic QA gate
- The orchestrator runs `fixup-vocabids`.
- Then it runs stage 2 and writes `qa-report.md`.
- Stage 2 must pass before anything downstream can proceed.

7. Stage 3 visuals and visual QA
- Stage 3 generates `remotion.json`.
- Stage 3 generates `asset-provenance.json`.
- Produce `visual-qa-report.md`.
- It must say `Result: PASS`.
- If visual source files change, rerun stage 3 by rerunning `course:produce`.

8. Stages 4, 5, and 6 lesson pack
- Stage 4 generates `pdf-source.json`, `pdf.md`, and `pdf.pdf`.
- Stage 5 generates `flashcards.json` and `vocab-export.json`.
- Stage 6 generates `quiz-item-bank.json` and `quiz.json`.

9. Assessment QA gate
- Produce `assessment-qa-report.md`.
- It must say `Result: PASS`.
- Transliteration consistency must pass across script, PDF, flashcards, and quiz outputs.

10. Stage 7 release gate
- The orchestrator runs the final lesson validation gate.
- On success it sets `status.json` to `READY_TO_RECORD`.

## Release Checklist

- `status.json` is `READY_TO_RECORD`.
- `editorial-qa-report.md` is PASS and fresh against stage-1 source files.
- `visual-qa-report.md` is PASS and fresh against visual source files.
- `assessment-qa-report.md` is PASS and fresh against assessment source files.
- `node --experimental-strip-types course/tools/pipeline-cli.ts validate --lesson M01-L005` passes.
- `node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit --lesson M01-L005` passes.
- `python3 ~/.codex/skills/thai-lesson-production/scripts/lesson_quality_audit.py --repo-root /Users/olivertopping/src/thai-nine --lesson M01-L005 --run-pipeline --require-ready` passes.

## After Release

- Render a Remotion preview if needed.
- Record Nine.
- Add captions after recording, not during lesson authoring.
