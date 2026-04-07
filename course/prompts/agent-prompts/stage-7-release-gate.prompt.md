# Stage 7 — Release Gate

Check all required artifacts exist and are valid.

## Pipeline mode detection

Check which pipeline mode is active:
- **Canva-native:** `canva-action-plan.json` exists in the lesson directory
- **Legacy PPTX:** `deck.pptx` exists but `canva-action-plan.json` does not

## Required files (both modes)
- script-master.json
- script-spoken.md
- script-visual.md
- deck-source.json
- asset-provenance.json
- canva-content.json
- pdf-source.json
- pdf.md
- pdf.pdf
- flashcards.json
- vocab-export.json
- quiz-item-bank.json
- quiz.json
- status.json

## Additional required files — Canva-native mode
- canva-action-plan.json
- canva-outline.json
- canva-design.json (must contain a valid `designId` and `canvaUrl`)

## Additional required files — Legacy PPTX mode
- deck.pptx
- canva-deck.pptx

## Required QA reports (all must say `Result: PASS`)
- editorial-qa-report.md
- qa-report.md
- visual-qa-report.md
- assessment-qa-report.md

## Gate rule
Mark `READY_TO_RECORD` only if:
1. All required files for the active pipeline mode exist
2. All QA reports say `Result: PASS` and are fresh against their source files
3. `pipeline validate --lesson {ID}` passes with zero issues
4. In Canva-native mode: `canva-design.json` contains a `designId` that starts with "D" and a non-empty `canvaUrl`
