# OPERATIONS.md — Thai Nine

Single source of truth for running the lesson pipeline, generating PPTX decks, and preparing recording-ready lessons.

For a compact one-lesson checklist, use `course/LESSON_PRODUCTION_SOP.md`.
For the retired Remotion-first workflow snapshot, use `archive/2026-03-18/course/remotion-first-plan/`.

## 1) Daily workflow

1. Pick the target lesson from the blueprint and current status.
2. Run `course:produce`.
3. Complete any required research, stage-1 writing, or QA handoff.
4. Let the deterministic pipeline regenerate stage outputs.
5. Review the PPTX deck and lesson PDF.
6. Generate or refresh the Canva export pack and open the Canva master template.
7. Record Nine using the PPTX deck or the Canva-polished deck in presenter mode.
8. Add captions after recording.
9. Mark the lesson ready and log any notable changes.

## 2) Source of truth

- Lesson order and naming: `course/exports/full-thai-course-blueprint.csv`
- Runtime lesson state: `course/modules/<module>/<lesson>/status.json`
- Workflow resume state: `course/modules/<module>/<lesson>/produce-lesson-state.json`
- Pipeline CLI: `course/tools/pipeline-cli.ts`
- Transliteration rules: `course/transliteration-policy.md`
- Mission Control: `http://localhost:3000/mission-control`

`course/manifest.yaml` is convenience metadata, not the production state source.

## 3) Core commands

Run from repo root:

```bash
npm run course:validate
npm run course:lint
npm run course:produce -- --next
npm run course:produce -- --lesson M01-L004
node --experimental-strip-types course/tools/pipeline-cli.ts fixup-vocabids --lesson M01-L004
node --experimental-strip-types course/tools/pipeline-cli.ts validate --lesson M01-L001
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit --lesson M01-L001
node --experimental-strip-types course/tools/pipeline-cli.ts set-status --lesson M01-L001 --state DRAFT
node --experimental-strip-types course/tools/pipeline-cli.ts touch-runlog --message "Updated M01-L001"
```

Supported runtime states:
- `DRAFT`
- `READY_TO_RECORD`
- `PLANNED`
- `BACKLOG`

## 4) Pipeline summary

1. Stage 0 builds `context.json`.
2. Research notes are written or updated:
   - `scope-research.md`
   - `usage-research.md`
   - `visual-research.md`
3. Stage 1 writes:
   - `brief.md`
   - `script-master.json`
   - `script-spoken.md`
   - `script-spoken.html`
   - `script-visual.md`
4. Editorial QA must pass.
5. Stage 2 deterministic QA must pass.
6. Stage 3 generates the official recording visuals:
   - `deck-source.json`
   - `asset-provenance.json`
   - `deck.pptx`
   - `canva-content.json`
   - `canva-deck.pptx`
   - `canva-import-guide.md`
   - `canva-backgrounds/slide-XX.png`
7. Visual QA must pass.
8. Stage 4 generates:
   - `pdf-source.json`
   - `pdf.md`
   - `pdf.pdf`
9. Stage 5 generates:
   - `flashcards.json`
   - `vocab-export.json`
10. Stage 6 generates:
   - `quiz-item-bank.json`
   - `quiz.json`
11. Assessment QA must pass.
12. Stage 7 validates the pack and marks the lesson `READY_TO_RECORD`.

## 5) PPTX deck workflow

Stage 3 is PPTX-first.

The official visual pack is:
- `deck-source.json` for review and QA
- `deck.pptx` for recording
- `asset-provenance.json` for source tracking
- `canva-content.json` for placeholder-driven Canva filling
- `canva-deck.pptx` for low-risk Canva import
- `canva-import-guide.md` for the one-shot template workflow
- `canva-backgrounds/slide-XX.png` for locked slide geometry

Deck rules:
- 16:9 canvas
- fixed right-third camera-safe zone
- teaching content left-weighted
- images embedded locally when they materially help learning
- text-only or card-based layouts when imagery is unnecessary
- Canva imports should use locked backgrounds plus editable text and image swaps only

Canva workflow rules:
- Upload `Sarabun` to Canva Brand Kit for learner-facing deck text.
- Keep `Sarabun` as the standard deck font for Thai, transliteration, and English when lines are mixed.
- Keep learner-facing Thai visible as `Thai (PTM transliteration)` on beginner decks.
- Treat Canva as the finishing surface, not the source of truth.
- If a Canva edit improves spacing, copy that fix back into the repo layout contract.
- Do not use Canva AI slide generation as the production layout path.

Use the produced `deck.pptx` in PowerPoint or Keynote while recording.
Use the Canva pack to fill the master template without nudging layout by hand.

## 6) Asset sourcing policy

Default rule: use internet-sourced reusable images first.

Source order:
1. Openverse
2. Wikimedia Commons
3. Local themed shapes/cards only when imagery is not genuinely helpful

Do not default to generated imagery.
If no acceptable real image is found, stage 3 should fall back to a non-image slide layout and record the fallback in `deck-source.json` and `asset-provenance.json`.

## 7) Caption workflow

Captions are produced after recording, not inside lesson-authoring visuals.

1. Record Nine using the PPTX deck.
2. Transcribe the recorded audio/video.
3. Clean timestamps and wording.
4. Burn captions as a separate final layer.

This keeps the PPTX teaching deck reusable across multiple takes.
