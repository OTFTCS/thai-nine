---
name: produce-lesson
description: Produce a complete Thai with Nine lesson from blueprint to READY_TO_RECORD — writes all scripts, runs all QA gates, generates PPTX deck, and validates end-to-end
user-invocable: true
---

# /produce-lesson

Produce a complete lesson for Immersion Thai with Nine. Runs the full pipeline from blueprint row to READY_TO_RECORD without human intervention.

## Arguments
The user provides either:
- A lesson ID: `M01-L004`
- Or `--next` to auto-select the next PLANNED lesson from the manifest

Parse the argument from the user's message. The lesson ID format is `M\d{2}-L\d{3}`.

## Full workflow

Execute these steps in order. Do not skip any step. If a QA gate fails, fix and retry (max 3 attempts per gate). If still failing after 3 attempts, stop and report the failure.

### Step 1: Setup

1. Parse the lesson ID from the argument.
2. Set lesson directory: `course/modules/{module}/{lesson}/` (e.g., `course/modules/M01/L004/`).
3. Read the blueprint row:
```bash
python3 -c "
import csv
with open('course/exports/full-thai-course-blueprint.csv') as f:
    for row in csv.DictReader(f):
        if row['lesson_id'] == '{ID}':
            for k,v in row.items():
                print(f'{k}: {v}')
"
```
4. Reset status if needed:
```bash
node --experimental-strip-types course/tools/pipeline-cli.ts set-status --lesson {ID} --state DRAFT
```
5. Run Stage 0 to generate context:
```bash
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 0
```
6. Read the generated `context.json` from the lesson directory.
7. Read these reference files:
   - `course/prompts/agent-prompts/stage-1-script-generation.prompt.md`
   - `course/schemas/script-master.schema.json`
   - `course/transliteration-policy.md`
   - `course/style-guide.md`
   - Exemplar: `course/modules/M01/L001/M01-L001-script-master.json`

### Step 2: Research

If these files don't already exist in the lesson directory, write them:
- `scope-research.md` — what concepts/vocabulary are in and out of scope for this lesson
- `usage-research.md` — how the target Thai forms are used in real spoken contexts
- `visual-research.md` — what visual aids would genuinely help learning (not decorative)

Keep each under 500 words. These inform script writing.

### Step 3: Author Stage 1 files

Following the rules in `stage-1-script-generation.prompt.md`, write these 4 files to the lesson directory:

1. **`brief.md`** — production brief with lesson ID, objectives, vocabulary, constraints
2. **`{ID}-script-master.json`** — the canonical lesson script (must validate against `script-master.schema.json`)
3. **`{ID}-script-spoken.md`** — readable spoken narration for Nine
4. **`{ID}-script-visual.md`** — visual plan for PPTX slides

**Critical rules for script-master.json:**
- `schemaVersion: 1`
- Include `teachingFrame` with runtime, hook, scenario, takeaway
- Include the `context` object from Step 1 unchanged
- At least 4 sections, each with spokenNarration (3+ lines), onScreenBullets, drills (1+), languageFocus, visualPlan
- Include `pronunciationFocus` with targetSounds, minimalPairs, mouthMapAnchor
- Roleplay: 6+ lines, use "You" as speaker (not "Learner"), at least 2 production turns
- Recap: 5+ retrieval-first items
- Set all `vocabId` to `v-0000000000` (fixed in Step 4)
- Mark multi-word chunks with `"type": "chunk"`
- `policies.transliteration: "PTM_ADAPTED_INLINE_TONES"`
- `policies.imageSourcing: "INTERNET_FIRST_NO_GENERATIVE_DEFAULT"`

**Pedagogy requirements:**
- Teach ALL vocabulary from the blueprint's `new_vocab_core` and `new_chunks_core` — never skip items. Scaffold by splitting across sections (max 5-6 per section)
- **Every new word MUST be explicitly introduced individually** (shown alone on screen with Thai + translit + English, spoken by Nine, explained) BEFORE it appears in any chunk, sentence, drill, or roleplay. This is a HARD FAIL if violated.
- Section structure: introduce 2-3 new words individually first → then combine into a chunk/pattern → then drill. Max 3 new standalone words per section + 1 chunk.
- If a chunk contains words not yet individually taught, those words MUST be taught in an earlier section first.
- 40%+ production drills (substitution, response-building, pause-and-produce)
- Each new item in 3+ contexts across the lesson (input flood)
- At least 1 drill format used twice with different content (task repetition)
- Pronunciation beat section with tone echo and minimal pair drills
- All 7 teaching devices present and distributed

**Teaching quality — CRITICAL:**
- Every section's languageFocus must contain NEW items from the blueprint — do NOT create filler sections with only review vocab
- Each section must TEACH the content (listen → repeat → use in scenario), not ANALYZE it
- Do NOT write sections about pronunciation theory, sound shapes, or linguistic observations — that goes in the pronunciation beat ONLY
- Every section should end with the learner USING the new words in a mini-scenario
- Recap must be SHORT retrieval prompts (max 15 words each, max 5 items) — NOT reference cards that dump everything with full transliteration

**Language rules:**
- Use "You" not "Learner" everywhere in user-facing text
- PTM transliteration with inline tone marks (mid tone = unmarked, that's correct)
- On-screen bullets format: `Thai | translit | English`

### Step 4: Fix vocab IDs

```bash
node --experimental-strip-types course/tools/pipeline-cli.ts fixup-vocabids --lesson {ID}
```

### Step 5: Editorial QA

Read `course/prompts/agent-prompts/stage-1-editorial-qa.prompt.md`.

Review the script-master.json you just wrote. Write `{ID}-editorial-qa-report.md` with:
- The scored 8-dimension rubric (Comprehensibility, Production demand, Input recycling, Drill quality, Roleplay realism, Teaching device coverage, Pacing, Pronunciation teaching)
- Each dimension scored 1-5
- PASS/FAIL for each of the 11 checks
- Minimum pass: average 3.0+, no dimension below 2

If FAIL: edit the source files to fix the issues, then re-score. Max 3 attempts.

**Be honest in self-QA.** Do not rubber-stamp PASS. Actually check:
- Count new vocab items (must be ≤ 7)
- Count production drills as % of total drills (must be ≥ 40%)
- Count occurrences of each new item across sections (must be ≥ 3 each)
- Verify pronunciation section exists with minimal pairs
- Verify roleplay makes conversational sense

### Step 6: Run Stage 2 (deterministic QA)

```bash
touch {lesson_dir}/{ID}-editorial-qa-report.md && sleep 1
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 2
```

Read the generated `{ID}-qa-report.md`. If `Result: FAIL`:
- Read `course/prompts/agent-prompts/stage-2-qa-repair.prompt.md`
- Fix the issues in script-master.json
- Touch the editorial QA report and rerun Stage 2
- Max 3 attempts

### Step 7: Run Stage 3 (PPTX deck generation)

```bash
touch {lesson_dir}/{ID}-editorial-qa-report.md {lesson_dir}/{ID}-visual-qa-report.md && sleep 1
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 3
```

Check stderr for `LAYOUT VALIDATION ISSUES`. If any are reported, the layout validation caught text overlaps — fix the script-master sections that cause them and rerun.

### Step 8: Visual QA

Read `course/prompts/agent-prompts/stage-3-visual-qa.prompt.md`.
Read the generated `{ID}-deck-source.json`.

Write `{ID}-visual-qa-report.md` with Result: PASS or FAIL.

Check:
- Slide count is reasonable (8-12 slides)
- No slides have zero thaiFocus items (except opener/closing)
- Teaching content doesn't overlap PiP zone for elements beside it
- Roleplay slide title is just "Roleplay" not the full scenario
- Speaker labels are "You" and a role name, not "Learner"

If FAIL: fix source files, rerun Stage 3, re-QA.

### Step 9: Run Stages 4-6

```bash
touch {lesson_dir}/{ID}-visual-qa-report.md && sleep 1
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 4
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 5
node --experimental-strip-types course/tools/pipeline-cli.ts stage --lesson {ID} --stage 6
```

### Step 10: Assessment QA

Read `course/prompts/agent-prompts/stage-6-assessment-qa.prompt.md`.
Read `{ID}-quiz.json`, `{ID}-flashcards.json`, `{ID}-vocab-export.json`.

Write `{ID}-assessment-qa-report.md` with Result: PASS or FAIL.

Check:
- Quiz covers all new vocab items
- Flashcards match languageFocus items
- Transliteration is consistent across all artifacts
- No unseen vocabulary in quiz

If FAIL: report specific blockers. If the issue is in the script-master (source), fix it and rerun from Step 4.

### Step 11: Release gate

```bash
touch {lesson_dir}/{ID}-assessment-qa-report.md && sleep 1
node --experimental-strip-types course/tools/pipeline-cli.ts set-status --lesson {ID} --state READY_TO_RECORD
```

### Step 12: Final verification

```bash
npm run course:validate:lesson -- {ID}
```

Report the result. If "Validation passed." — the lesson is complete and ready to record.

List all produced artifacts and their sizes.

## Error handling
- If any gate fails 3 times: STOP. Report what failed and why. Do not force READY_TO_RECORD.
- If a bash command fails: read the error, diagnose, fix, retry once.
- If schema validation fails: read the error path, fix the JSON, retry.
- Never skip a QA gate. Never mark PASS when checks actually fail.
