# Thai with Nine — Script Writing Handover

If you're about to write, review, or generate a Thai with Nine YouTube episode script, **read this file first**. It explains what the source of truth is, what the rules are, what each file does, and where every piece of content has to come from.

---

## 1. Big picture

Two parallel pipelines, one source of truth.

- **Course pipeline** produces 180 self-paced lessons (Skool classroom). Source of truth: `course/exports/full-thai-course-blueprint.csv`. Each lesson is a single row with vocab, grammar focus, outcomes, prerequisites.
- **YouTube pipeline** produces longform episodes that mirror the course content for a wider audience. Source of truth for any given episode: the row in the blueprint that the episode is mapped to via the script's `lessonRef` field (e.g. `YT-S01-E02` references lesson `M01-L005`).

YouTube episodes do not invent their own vocab or grammar progression. They teach what the blueprint says they teach, in the order the blueprint says, using the words the blueprint says.

---

## 2. The blueprint is the source of truth

### Where it lives

`course/exports/full-thai-course-blueprint.csv` — 180 rows × 18 columns. Joined at read-time with sidecars:

- `course/exports/modules.csv` (18 module rows)
- `course/exports/tracks.json` (4 curated learning paths)
- `course/exports/stages.json` (4 stages: Foundations, Survival, Everyday, Functional Fluency)
- `course/exports/skool-metadata.csv` (topic tags, scenario tags, SEO titles)
- `course/exports/community-prompts.csv` (one prompt per lesson)
- `course/exports/blueprint.meta.json` (schema version metadata)

### What each blueprint row contains

| Column | Meaning |
|---|---|
| `lesson_id` | e.g. `M01-L005`. Globally unique. |
| `module_id` | e.g. `M01`. Joins to `modules.csv`. |
| `stage_id` | `S1`-`S4`. CEFR-aligned spine. |
| `cefr_band` | `A0`/`A1`/`A2`/`B1`/`B2`. |
| `lesson_title` | The teaching title. |
| `lesson_primary_outcome` | What the learner can DO after this lesson. |
| `lesson_secondary_outcome` | Secondary skill picked up. |
| `grammar_function_primary` | Main grammar move taught. |
| `grammar_function_secondary` | Secondary grammar move. |
| **`new_vocab_core`** | Thai tokens introduced in THIS lesson. **Authoritative.** |
| **`new_chunks_core`** | Multi-word chunks introduced. **Authoritative.** |
| **`review_vocab_required`** | Earlier-lesson vocab that must be exercised here. **Authoritative.** |
| `targets` | Pipe-delimited skill targets (script\|listening\|speaking\|writing). |
| `lesson_quiz_focus` | What the per-lesson quiz tests. |
| `prereq_lessons` | Lessons that must be completed first. |
| `notes` | Editorial annotations. May contain `sense-shift:` or `spaced-review:` dedup tags. |
| `status` | `draft` / `ready-to-record` / `recorded` / `published`. |

### Why the blueprint is authoritative

- Three review passes (curriculum, vocab, Skool structure) shaped it. The current state (post-W1 to W10 migration) reflects deliberate decisions about progression, dedup, and stage placement.
- `vocab-index.json` (`course/vocab/vocab-index.json`) is keyed off the blueprint. Flashcard parity, quiz coverage, and PDF docs all read from the blueprint.
- Validators (`course/tools/lib/validators.ts::validateNoNewVocabReintroduction`) enforce that no Thai token appears in two different lessons' `new_vocab_core` columns. Move it to `review_vocab_required` instead, or annotate the duplicate with `notes: sense-shift:<thai>` if it's a genuine homograph.

### What this means in practice

If you're writing a YouTube episode for `M01-L005`:
1. Read that row of the blueprint.
2. The 8 vocab items in your `vocab[]` array MUST come from the row's `new_vocab_core` column.
3. Any Thai token you reference in example sentences, breakdowns, or drills should be either (a) in `new_vocab_core` for this lesson, (b) in `review_vocab_required` for this lesson, or (c) a known function word that learners have already met (counted via vocab-index).
4. **You do not invent new vocab.** If the blueprint says 8 words, you teach 8 words. If you feel a 9th is needed, that's a blueprint problem; raise it as a vocab-gap finding rather than smuggling it into the script.

---

## 3. The vocab-gap rule

A "vocabulary gap" is when an episode introduces or relies on a Thai word that has not been (a) introduced in an earlier lesson, (b) introduced in this lesson, or (c) flagged as `review_vocab_required`. Gaps mean the learner sees a word with no scaffolding.

### How to check for gaps

1. The course validator: `npm run course:validate` runs `validateNoNewVocabReintroduction` plus `validateFlashcardParity`. Both surface vocab issues.
2. Manual check: open the blueprint row for the lesson, list its vocab. Open the script JSON, list every Thai token (including embedded phrases in `explanation` fields, example sentences, breakdown lines). Diff. Anything in the script that isn't in the lesson's known-vocab pool is a candidate gap.
3. The flashcard parity validator (`validateFlashcardParity`): if a Thai token in `new_vocab_core` is missing from `vocab-index.json`, it fails. This catches the inverse problem (vocab declared in the blueprint but never indexed).

### What to do when you find a gap

Three honest options, in order of preference:

1. **Move the word to the blueprint** — add it to `new_vocab_core` for the lesson it actually belongs in, or to `review_vocab_required` if it's a callback. Update `vocab-index.json`.
2. **Rewrite the script to avoid the word** — usually a smaller-scope fix. Pick a synonym or rephrase the example.
3. **Flag the gap and stop** — leave a `[blueprint-gap]` note in `template-decisions.md` and refuse to ship the script until the blueprint is reconciled. This is the right call when the gap reveals a real progression problem.

What you do NOT do: silently teach a new word in an episode and assume the learner will pick it up.

---

## 4. Files involved in writing a script

Sorted by what they own. Read-only files marked **R**, write-target files marked **W**.

### YouTube longform pipeline

| File | Purpose | R/W |
|---|---|---|
| `youtube/prompts/script-writing.prompt.md` | The 547-line system prompt that tells Claude how to write an episode. Defines all 8 PARTs (cold-open sketch, cultural+promise, vocab cards, natural-listen, breakdown, drills, shadowing, recap+teaser). Updated via `template-decisions.md` log. | **R** when generating; **W** only at template lock |
| `youtube/schemas/yt-script.schema.json` | JSON Schema (Draft 2020-12) the output JSON must conform to. 11 block modes, line schema with optional `speaker` field for sketch dialogue. | **R** when generating; **W** only at schema-version bumps |
| `youtube/tools/validate_script.py` | Deterministic validator. 9 passes: schema validation, ID uniqueness, cross-refs, mode requirements, episode structure (must start with hook, end with recap/teaser, have drills, have natural-listen), lang/translit consistency, PTM tone-mark policy, short-form clip ranges. | **R** (you run it; you don't edit it unless rules change) |
| `youtube/tools/draft_variants.py` | The variant generator. Calls `claude -p --tools "" --effort low --model sonnet --system-prompt-file <path>` for each of 4 axis-perturbed prompts. | **R** during generation |
| `youtube/tools/judge_variant.py` | LLM judge. Scores a variant 1-5 across 8 dimensions per `youtube/prompts/judge.prompt.md`. | **R** |
| `youtube/tools/synthesize_round.py` | Aggregates round-N annotations + judge scores. Builds a feedback digest. Triggers round N+1. | **R** |
| `youtube/tools/generate_docs.py` | Renders teleprompter MD + on-screen MD from a script JSON. Used post-validation. | **R** |
| `youtube/episode-catalogue.md` | The list of all 40+ episodes that will be produced. Source of truth for what gets made next, with topic + level + angle per slot. | **R** for "what should I write?"; **W** when adding new episodes |
| `youtube/template-decisions.md` | Reverse-chronological change log for the template, schema, validator, and catalogue governance. **Every template change gets an entry here.** | **W** when changing the template |
| `youtube/examples/YT-S01-E*.json` | Canonical APPROVED scripts. The 5 existing entries (E01-E04, E18) are the reference shapes. Do not modify these casually. New episodes land here only after recording. | **R** for shape reference |
| `youtube/scripts/{episodeId}/r{N}/*.json` | Variant scripts under refinement. **Write target during variant generation.** Promoted to `youtube/examples/` only at lock. | **W** |
| `youtube/scripts/{episodeId}/manifest.json` | Round state per episode (current round, axes, validation pass/fail, chosen variant). | **W** |
| `youtube/scripts/{episodeId}/r{N}/r{N}-X-review.md` | Human-readable rendered script + inline annotation zones for variant X. Generated, not authored directly. | **W** by the review-doc tool; annotated by Nine |
| `youtube/scripts/{episodeId}/r{N}/r{N}-compare.md` | At-a-glance side-by-side comparison of all 4 variants for a round. | **W** by the review-doc tool |
| `youtube/scripts/{episodeId}/feedback-r{N}.md` | Synthesizer-built feedback digest (consensus signals, friction tags, voice rewrites, regen instructions). | **W** by the synthesizer |

### Course pipeline (the source of truth)

| File | Purpose |
|---|---|
| `course/exports/full-thai-course-blueprint.csv` | THE source of truth. 180 lessons. 18 columns. |
| `course/exports/modules.csv`, `tracks.json`, `stages.json`, `skool-metadata.csv`, `community-prompts.csv`, `blueprint.meta.json` | Sidecars joined at read-time. |
| `course/vocab/vocab-index.json` | Master vocabulary index. Every Thai token taught somewhere in the course. Source of truth for flashcard generation. |
| `course/schemas/blueprint-row.schema.json`, `vocab-index.schema.json`, `flashcards.schema.json`, `quiz.schema.json`, `module-quiz.schema.json` | JSON schemas for every artifact type. |
| `course/prompts/agent-prompts/stage-1-script-generation.prompt.md` | The course-side analogue of `script-writing.prompt.md`. Generates `script-master.json` per lesson. |
| `course/prompts/agent-prompts/stage-1-editorial-qa.prompt.md` | The 8-dimension editorial rubric. Originator of the YouTube rubric. |
| `course/tools/lib/validators.ts` | All validators in one file. `validateNoNewVocabReintroduction`, `validateFlashcardParity`, `validateQuizCoverage`, `validateLessonDocsExist`. |
| `course/tools/produce-lesson.ts` | Pipeline orchestrator for a single lesson. |

---

## 5. What each script-writing file outputs

| Tool | Input | Output |
|---|---|---|
| `draft_variants.py` | `--episode <id>`, `--round <N>` | 4 variant JSONs in `youtube/scripts/{id}/r{N}/`, 4 annotation scaffolds, updated `manifest.json` |
| `validate_script.py` | `--script <path>` | stdout report (errors + warnings + info), exit code 0/1 |
| `judge_variant.py` | `--variant <path>` or `--batch <dir>` | `{variantId}-judge.json` next to each variant: 8 dim scores, average, pass/lock flags, rationale per dim |
| `synthesize_round.py` | `--episode <id>`, `--round <N>` | `feedback-r{N}.md` digest + (unless `--no-generate`) round N+1 variants |
| `generate_docs.py` | `--script <path>` | Teleprompter MD + on-screen MD next to the script |
| Review-doc helper (one-shot) | round dir | `r{N}-X-review.md` per variant (readable script + inline annotation zones) + `r{N}-compare.md` (side-by-side cheat sheet) |

---

## 6. The script-variant refinement loop

We are currently in the pre-recording refinement phase. Goal: nail the script template by generating 4 variants per episode, annotating, regenerating, until the template is locked.

### Variant axes (Rev 6 intermediate)

PART 1 is now a 2-person cold-open sketch (Nine plays both characters via split-frame). The "problem/pain hook" axis is retired since sketch IS the cold-open by default.

Current axes:
- **V-A**: gentle everyday sketch + standard drills + simple examples (baseline)
- **V-B**: alternate sketch tone (sharper / comedic / different beat)
- **V-C**: same gentle sketch + substitution drills (replaces anticipation-pause in PART 7)
- **V-D**: same gentle sketch + rich idiomatic example sentences (replaces simple examples in PART 3)

### Convergence threshold

Lock the template when a variant scores avg >=4.0 on the rubric with no dimension <3, AND Nine confirms voice fit. Expect 4-6 rounds.

### Rules

- The blueprint vocab list is FIXED in every variant. Only example sentences, drill format, hook style, and explain-section content vary between variants.
- New block types or schema changes go through `template-decisions.md` first, never silently.
- Bangkok references should be sparse; default to "Thailand" unless the cultural fact is genuinely city-specific.
- The cold-open sketch must demonstrate at least 3 of the target vocab items in natural use, must have at least 2 distinct speakers (A and B), must land on a beat (not a generic "OK"), and must be self-contained for social-media clipping.

---

## 7. Workflow: writing a fresh script

If you are starting from scratch on a new episode (e.g. `YT-S01-E0X` for catalogue slot N):

1. Look up the catalogue slot in `youtube/episode-catalogue.md`. Confirm topic, level, angle.
2. Find the blueprint row that matches. The episode's `lessonRef` is that lesson_id.
3. Read the blueprint row's `new_vocab_core`, `new_chunks_core`, `review_vocab_required`, `lesson_primary_outcome`, `grammar_function_primary`. These are your hard constraints.
4. Confirm `vocab-index.json` has every token in `new_vocab_core`. If not, that's a blueprint-vocab-index gap and must be fixed first.
5. Run `python3 youtube/tools/draft_variants.py --episode <id> --new --level <X> --topic <slug> --round 1`. (For now, the subprocess pipeline is unreliable for round-1 generation; it's faster to author the variants directly in a Claude session and write the JSONs to `youtube/scripts/{id}/r1/` manually. This is the explicit retrospective lesson from 2026-04-25.)
6. Validate every variant: `python3 youtube/tools/validate_script.py --script <path>`. Zero errors. Warnings acceptable on a per-variant basis (substitution drills generate one).
7. Generate review markdowns: regenerates per-variant `r1-X-review.md` + `r1-compare.md`.
8. Hand to Nine for annotation.
9. After annotation: `python3 youtube/tools/judge_variant.py --batch <round-dir>` then `python3 youtube/tools/synthesize_round.py --episode <id> --round 1`.
10. Round 2+: repeat from step 5 with `--round 2` and `--mutate-parts <list>` from the synthesizer's output.
11. After convergence: `/lock-template` skill applies the winning variant's axis settings to `script-writing.prompt.md` and adds a Rev 7 entry to `template-decisions.md`.

---

## 8. Things you don't want to do

- Invent new vocab inside an episode. The blueprint owns the vocab list.
- Edit `youtube/examples/*.json` casually. Those are canonical approved scripts. New episodes land there at recording time, not before.
- Edit `youtube/prompts/script-writing.prompt.md` outside a `template-decisions.md` entry. The prompt is versioned, every change has a why and a date.
- Default to Bangkok in cultural facts. Use "Thailand". Mention specific cities only when the fact is genuinely city-specific.
- Treat LLM judge scores as creative direction. The judge is a convergence monitor. Nine's annotations win when they conflict.
- Skip validation. Every variant runs through `validate_script.py` before annotation. The validator catches schema errors that won't surface until recording is half done otherwise.
- Run `claude -p` from a Python tool without `--tools "" --disable-slash-commands --effort low --model sonnet --system-prompt-file <path>`. See `~/.claude/CLAUDE.md` and `docs/retrospectives/2026-04-25-script-variant-loop.md` for why.

---

## 9. The minimum-viable file map

If you're holding only one fact, hold this: **the blueprint is the source of truth, the script obeys the blueprint, the validator enforces the schema, and every Thai token in any script must trace back to either `new_vocab_core` or `review_vocab_required` for that episode's referenced lesson, or be a previously-introduced function word in `vocab-index.json`. No vocab gaps, no Bangkok defaults, no silent template changes.**
