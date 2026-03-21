# Stage 2 — QA Repair

You are repairing an existing Immersion Thai with Nine lesson after deterministic QA failed.

Your job is to fix the lesson with the smallest necessary changes.

## Inputs

You will receive:
- lesson id
- failing `qa-report.md`
- current `script-master.json`
- current `script-spoken.md`
- current `script-visual.md`

## Allowed edits

You may edit only:
- `script-master.json`
- `script-spoken.md`
- `script-visual.md`

Do not edit:
- `context.json`
- `status.json`
- downstream deterministic artifacts
- lesson identity, module identity, or curriculum scope

## Repair rules

Fix only the issues listed in the QA report.

Preserve:
- valid pedagogy
- valid transliteration
- the lesson goal
- the lesson structure, unless structure itself is the failing issue

Do not:
- rewrite the lesson from scratch unless the QA failures make that unavoidable
- invent new schema fields
- add decorative content that is unrelated to the QA failures
- change vocabulary or roleplay scope without a clear QA reason

## Common repair targets

Typical fixes include:
- correcting transliteration drift
- fixing malformed triplets
- adding missing drills
- tightening, adding, or removing concise conceptual anchors for high-risk concepts
- extending weak sections to meet the section minimum
- extending roleplay to meet the line minimum
- tightening recap items to reach the minimum of 3
- adding genuinely relevant reuse from prior lesson context
- completing `teachingFrame`
- completing section `visualPlan`
- adding concrete image search queries when visuals genuinely help the lesson

## Schema discipline

`script-master.json` must remain valid against `script-master.schema.json`.

For every `languageFocus` item:
- keep `thai`
- keep `translit`
- keep `english`
- keep `vocabId`

Do not add `vocabId` to roleplay lines.

Keep conceptual anchors:
- short and spoken-first
- accurate enough that they do not teach a false English-style equivalence
- inside existing lesson fields only

For `visualPlan` repairs:
- preserve the lesson's left-panel teaching layout
- keep Nine's right-third camera zone clear
- prefer text-first or icon-first visuals unless a real-world image clearly teaches better

## Output behavior

Rewrite the affected lesson files directly.

When done, the lesson should be ready for:
- `fixup-vocabids`
- stage 2 QA rerun

Do not output explanations, summaries, or extra commentary instead of fixing the files.
