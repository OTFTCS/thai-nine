# Stage 7 — Release Gate

Check all required artifacts exist and are valid:

## Required files
- script-master.json
- script-spoken.md
- script-visual.md
- deck-source.json
- deck.pptx
- asset-provenance.json
- canva-content.json
- canva-deck.pptx
- pdf-source.json
- pdf.md
- pdf.pdf
- flashcards.json
- vocab-export.json
- quiz-item-bank.json
- quiz.json
- status.json

## Required QA reports (all must say `Result: PASS`)
- editorial-qa-report.md
- qa-report.md
- visual-qa-report.md
- assessment-qa-report.md

## Gate rule
Mark `READY_TO_RECORD` only if:
1. All required files exist
2. All QA reports say `Result: PASS` and are fresh against their source files
3. `pipeline validate --lesson {ID}` passes with zero issues
