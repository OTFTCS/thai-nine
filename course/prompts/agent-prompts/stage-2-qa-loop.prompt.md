# Stage 2 — Deterministic Linguistic + Pedagogy QA

Stage 2 is a **code-driven** validation gate implemented in `course/tools/pipeline-cli.ts` (the `stage --stage 2` command). It does not use an LLM prompt — the checks are deterministic.

## What it validates

1. **Schema compliance** — `script-master.json` validates against `course/schemas/script-master.schema.json`
2. **Transliteration compliance** — no IPA glyphs, no superscript tones, PTM-adapted inline only
3. **Triplet completeness** — every `languageFocus` item has Thai, translit, English, and vocabId
4. **Visual plan completeness** — non-legacy lessons require `visualPlan` with `onScreenGoal`, teaching visuals, teacher cues, and image support rationale
5. **Teaching frame** — non-legacy lessons require `teachingFrame` with valid runtime bounds, hook, scenario, takeaway
6. **Pronunciation focus** — lessons after M01-L001 require `pronunciationFocus`
7. **Roleplay triplets** — all roleplay lines have complete Thai/translit/English
8. **Policy fields** — `transliteration` and `imageSourcing` policies present and correct

## Pass / fail

- If **any** check fails → output `Result: FAIL` in `qa-report.md` with the list of issues
- The pipeline then invokes the **stage-2-qa-repair** prompt to fix the script
- Max 3 repair attempts before hard stop

## Hard gate

Do not continue to Stage 3 (deck generation) until Stage 2 passes.
