# Template Decisions Log

**What this is:** A reverse-chronological log of changes to the Thai with Nine YouTube episode template (prompt, validator, format doc) and to the catalogue's governance.
**What it isn't:** Per-episode notes, idea backlog, or a discussion thread.
**When to write an entry:** Whenever the template's logical structure changes, the catalogue's governance changes, or a related governance doc is created/retired. Writing a new episode that follows the existing template does NOT trigger an entry.

## How to use the prompt-feedback loop

1. Nine annotates eval-run scripts at `/admin/creator/eval/youtube/<run>/<episode>` (per-block rating + comment + an overall).
2. Run `python3 scripts/aggregate_prompt_feedback.py --type youtube` to roll up new annotations into `youtube/notes/prompt-feedback-notes.md`.
3. Read the new section(s) at the top of that file; pay attention to recurring `rework` reasons across episodes.
4. Edit `youtube/prompts/script-writing.prompt.md` by hand to address the recurring issues. Don't rewrite parts nobody complained about.
5. Re-generate the affected episodes against the new prompt; compare new outputs to the rework comments. Use the existing 8-dimension judge (`/judge-variants`) for structured comparison if available.
6. If the prompt change improved things, commit the prompt edit and add a new entry below. If it didn't, `git checkout` the prompt and document the dead end as a one-liner here so we don't repeat it.

The aggregation script fails closed on prompt-SHA drift: if you've already edited the prompt before rolling up annotations made against the previous version, it refuses to run without `--force`.

---

## 2026-04-25 — PART 1 becomes a 2-person cold-open sketch (Rev 6, intermediate)

**Change:** PART 1 is no longer a single Thai phrase + English promise. It's now a 25-50 second 2-person sketch (~8-14 lines, all Thai at natural speed, with English subtitles for burned-in display) that demonstrates 3-5 of the target vocab items in natural use BEFORE the lesson starts. Nine plays both characters, distinguished in production by a wardrobe/lighting/voice cue. The sketch is designed for social-media clipping (TikTok, Reels, Shorts) and must land on a punchline / relatable beat / surprising moment. The "By the end of this video..." promise line moved to PART 2, which now opens by briefly decoding the sketch ("That sketch? She was asking..."), then delivers cultural context, then the promise + roadmap.
**Schema:** Added optional `speaker` field to lines, enum `"A" | "B" | "narrator"`. Lines outside PART 1 typically omit it. PART 1 hook block must contain at least 2 distinct speakers from {A, B} (validator now warns otherwise).
**Validator:** `validate_script.py` now warns if the first hook block does not contain at least 2 of {A, B} as line speakers.
**Rationale:** Tom's call: opening every lesson with a 2-person sketch (a) gives the viewer felt language exposure before any teaching, (b) is naturally clippable for social media (no extra editing or repackaging needed), (c) carries cultural texture that a single-phrase hook can't, (d) makes PART 2's "decode what just happened" beat work as a teaching move. Replaces the V-B variant axis ("problem/pain hook") since sketch-as-default subsumes that variant.
**Affects:** `youtube/prompts/script-writing.prompt.md` PART 1 + PART 2 sections rewritten. `youtube/schemas/yt-script.schema.json` line definition extended with optional `speaker` field. `youtube/tools/validate_script.py` `validate_episode_structure` updated. Existing canonical scripts (E01-E18) and the YT-S01-E02 round-1 variants will be regenerated against the new template (ongoing).
**Decided by:** Tom, 2026-04-25.

---

## 2026-04-25 — PART 2 opener menu expanded; Bangkok bias removed

**Change:** In `youtube/prompts/script-writing.prompt.md` PART 2 ("Cultural Context + Topic Intro"), replaced the 3-item "Good openers" list with an 8-item menu covering: real Thailand statistic, cultural fact, counterintuitive observation, common-mistake reframe, linguistic puzzle, English-to-Thai contrast, sensory/scene hook, stake-anchored cold-open. Removed the Bangkok-anchored example ("Bangkok has over 100,000 taxis...") and replaced with a Thailand-general example. Added explicit guidance: don't default to Bangkok every episode; name specific cities only when the cultural fact is genuinely city-specific. The PART 2 `speakerNote` requirement now also asks for at least 2 different opener shapes across the 3 alternatives Nine picks from.
**Rationale:** Two problems converged. First, every existing canonical script (E01-E18) and every freshly generated variant clusters around Bangkok references because the prompt's lone illustrative opener anchored on Bangkok and the model imitated it. Second, the 3-option menu (statistic / cultural fact / did-you-know) was too narrow — every PART 2 felt structurally similar across episodes. Both fixes land in one prompt edit.
**Affects:** Lines ~73-87 of `youtube/prompts/script-writing.prompt.md`. No schema changes, no validator changes. Existing scripts and the in-flight YT-S01-E02 round-1 variants are unchanged; the next regeneration round picks up the new menu.
**Decided by:** Tom, 2026-04-25.

---

## 2026-04-22 — Adopted standalone catalogue model

**Change:** Established `youtube/episode-catalogue.md` as the single source of truth for what episodes get made. Episodes are standalone with loose progression. Title-style buckets pre-assigned per topic. Retired `youtube-series-strategy.md` to `youtube/archive/`.
**Rationale:** The series-based model created conflicting governance (two source-of-truth docs) and forced every episode to set up a "next." Standalone with loose progression maximises discoverability and removes the burden.
**Affects:** Created `youtube/episode-catalogue.md` and this log. Moved `youtube-series-strategy.md` to `youtube/archive/` with SUPERSEDED banner. Updated `CLAUDE.md`.
**Decided by:** Tom, 2026-04-22.
