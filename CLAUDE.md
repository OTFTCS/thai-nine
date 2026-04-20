# Thai with Nine — Project Context

## What this is
A Thai language course (Immersion Thai with Nine) with 180 lessons across 18 modules, A0 to B2. Each lesson is a pre-recorded video tutorial with PPTX slides, also used for live 1:1 teaching with Nine.

## Key directories
- `course/exports/full-thai-course-blueprint.csv` — source of truth for all 180 lessons
- `course/modules/M01-M18/L001-L010/` — lesson artifacts
- `course/tools/` — pipeline scripts (TypeScript + Python)
- `course/prompts/agent-prompts/` — 12 agent prompt files for each pipeline stage
- `course/schemas/` — JSON schemas for all artifacts

## Sub-projects
- `thai_with_nine_tiktok/` — TikTok shortform series. Python + Manim pipeline for scripting, rendering, and QA. Active series: Thai Classifiers (8 episodes).
- `Thai images/` — Vocabulary image carousels for Instagram/TikTok. Managed by `/produce-carousel`.
- `src/` — Next.js web app (quiz system, course viewer).

## Reference docs
- `thai-transliteration-standard.md` — full PTM transliteration rules (the authority)
- `course/style-guide.md` — slide layout, font, colour, and formatting rules
- `course/transliteration-policy.md` — transliteration policy for pipeline

## Pipeline commands
```bash
npm run course:produce -- --lesson M01-L004   # Full pipeline
npm run course:validate                        # Validate all
npm run course:validate:lesson -- M01-L001     # Validate one
npm run course:translit-audit                  # Transliteration check
```

## Style rules
- **Transliteration:** PTM-adapted inline tone marks only (no superscript). Mid tone = unmarked.
- **Person:** Use "You" not "Learner" in all user-facing text. 2nd person for 1:1 feel.
- **Font:** Sarabun for Thai, transliteration, and English on slides.
- **Layout:** 16:9 slides with top-right PiP camera placeholder (4.2" × 3.15"). Content beside PiP uses constrained width (~7.7"). Content below PiP uses full width.
- **Dual purpose:** Every lesson works for self-paced online course AND live 1:1 teaching with Nine.

## Pedagogy rules
- 40%+ production drills (substitution, response-building, pause-and-produce)
- Input flood: each new item in 3+ contexts across the lesson
- Pronunciation beat in every lesson (M01-L002+) with minimal pairs
- 7 required teaching devices per lesson
- Chunks taught as whole units first (type: "chunk")
- Scored editorial QA rubric: 8 dimensions, avg 3.0+, no dimension below 2

## Skills
- `/produce-lesson M01-L004` — full 12-stage lesson pipeline from blueprint to READY_TO_RECORD
- `/produce-carousel "Topic"` — vocabulary image carousel from topic to finished PNGs

## Publishing safety
- NEVER post, publish, or upload to any platform (TikTok, YouTube, Instagram, or any other) without explicit per-action user confirmation — even if the user says "publish everything" or similar.
- NEVER assume a piece of content is live/published unless the platform API confirms it. Derive published status from API responses only, never from filename patterns or xlsx text-matching.
- When API credentials are missing or the API call fails, fall back to UNKNOWN status — never assume published=true.
- Scheduling a post (queuing) is allowed. Actually firing the publish API call requires a separate explicit approval.
- Required env vars for status checks: `TIKTOK_ACCESS_TOKEN` (+ optional `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` for future refresh), `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` (+ optional `YOUTUBE_OAUTH_TOKEN` for private/unlisted reads). Store in `.env` only, never in source.


<!-- ============================================================ -->
<!-- MERGED FROM sync/macbook-20260310-1805 (commit df330cd, 2026-04-16) -->
<!-- Review and de-duplicate manually. -->
<!-- ============================================================ -->

# Thai with Nine — Project Context

## What this is
A Thai language course (Immersion Thai with Nine) with 180 lessons across 18 modules, A0 to B2. Each lesson is a pre-recorded video tutorial with PPTX slides, also used for live 1:1 teaching with Nine.

## Key directories
- `course/exports/full-thai-course-blueprint.csv` — source of truth for all 180 lessons
- `course/modules/M01-M18/L001-L010/` — lesson artifacts
- `course/tools/` — pipeline scripts (TypeScript + Python)
- `course/prompts/agent-prompts/` — 13 agent prompt files for each pipeline stage (incl. Manim lesson generation)
- `course/schemas/` — JSON schemas for all artifacts
- `content-audit/nine-content-inventory.csv` — all 55 published IG/TikTok posts (@thaiwith.nine) with dates, captions, likes, views

## Sub-projects
- `youtube/` — YouTube longform series. Scripts, Whisper alignment, subtitle generation. See YouTube pipeline below.
- `thai_with_nine_tiktok/` — TikTok shortform series. Python + Manim pipeline for scripting, rendering, and QA. Active series: Thai Classifiers (8 episodes).
- `Thai images/` — Vocabulary image carousels for Instagram/TikTok. Managed by `/produce-carousel`.
- `src/` — Next.js web app (quiz system, course viewer).

## Reference docs
- `thai-transliteration-standard.md` — full PTM transliteration rules (the authority)
- `course/style-guide.md` — slide layout, font, colour, and formatting rules
- `course/transliteration-policy.md` — transliteration policy for pipeline
- `youtube-series-strategy.md` — YouTube series planning and strategy
- `screen-layout-mockups.html` — interactive screen layout mockups
- `thai-nine-project-tracker.xlsx` — project tracking spreadsheet

## Pipeline commands
```bash
npm run course:produce -- --lesson M01-L004   # Full pipeline
npm run course:validate                        # Validate all
npm run course:validate:lesson -- M01-L001     # Validate one
npm run course:translit-audit                  # Transliteration check
```

## Google Slides pipeline
```bash
# Generate AI watercolour images for a lesson (Gemini 3.1 Flash)
python3 course/tools/generate_lesson_images.py --repo-root . --lesson M01-L002

# Render PPTX with images placed
python3 course/tools/render_lesson_deck.py --repo-root . --lesson M01-L002

# Upload to Google Slides + Thai font pass
python3 course/tools/upload_gslides.py --repo-root . --lesson M01-L002
python3 course/tools/gslides_font_pass.py --repo-root . --lesson M01-L002
```
Or use the skill: `/render-gslides M01-L002`

## Style rules
- **Transliteration:** PTM-adapted inline tone marks only (no superscript). Mid tone = unmarked.
- **Person:** Use "You" not "Learner" in all user-facing text. 2nd person for 1:1 feel.
- **Font:** Sarabun for Thai, transliteration, and English on slides.
- **Layout:** 16:9 slides with top-right PiP camera placeholder (4.2" × 3.15"). Content beside PiP uses constrained width (~7.7"). Content below PiP uses full width.
- **Dual purpose:** Every lesson works for self-paced online course AND live 1:1 teaching with Nine.

## Pedagogy rules
- 40%+ production drills (substitution, response-building, pause-and-produce)
- Input flood: each new item in 3+ contexts across the lesson
- Pronunciation beat in every lesson (M01-L002+) with minimal pairs
- 7 required teaching devices per lesson
- Chunks taught as whole units first (type: "chunk")
- Scored editorial QA rubric: 8 dimensions, avg 3.0+, no dimension below 2

## YouTube pipeline
```bash
# Key directories:
# youtube/examples/       — episode script JSONs (YT-S01-E01.json etc.)
#                           Single source of truth: content + timestamps
# youtube/recordings/     — raw audio files (M4A/WAV)
# youtube/tools/          — pipeline scripts
# youtube/out/            — rendered output (scene.py, .mov, .mp4)

# Step 1: Validate script
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/validate_script.py youtube/examples/YT-S01-E01.json

# Step 2: Timestamp audio (manual tap-to-timestamp)
#   Plays audio, tap spacebar at each spoken line. Writes displayStart/displayEnd
#   directly into the script JSON. ~40 spoken lines, ~20 auto-computed.
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/timestamp_audio.py \
  --script youtube/examples/YT-S01-E01.json \
  --audio youtube/recordings/YT-S01-E01.m4a

# Preview timestamps (replay audio with text printed at each timestamp):
... --preview

# Re-time a single line:
... --retune l-0015

# Step 2b: Phrase-level subtitle timestamps (optional, for full-teleprompter subtitles)
#   Chunks the teleprompter into subtitle-sized phrases, then Nine taps SPACE
#   every few words in a karaoke-style UI to timestamp each phrase.
/usr/bin/python3 youtube/tools/chunk_teleprompter.py --episode YT-S01-E01
/usr/bin/python3 youtube/tools/timestamp_server.py \
  --phrases youtube/phrases/YT-S01-E01.phrases.json \
  --audio youtube/recordings/YT-S01-E01.m4a

# Step 3: Generate teleprompter + on-screen docs
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/generate_docs.py \
  --script youtube/examples/YT-S01-E01.json

# Step 4: Manim video pipeline (script → finished MP4)
#   Builds overlays internally from script JSON, runs codegen, renders, composites.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" /opt/homebrew/bin/python3 \
  -m youtube.tools.manim.pipeline --episode YT-S01-E01

# With phrase subtitles:
... --phrases youtube/phrases/YT-S01-E01.phrases.timed.json

# Scene generation only (review before render):
... --skip-render

# Use existing scene file (skip deterministic codegen):
... --scene-file youtube/out/YT-S01-E01/YT-S01-E01-scene.py

# Force past QA failures:
... --force

# Dependencies: pip install manim; brew install ffmpeg
# Note: /opt/homebrew/bin/python3 has manim
# Note: Scene generation is deterministic codegen (no Claude CLI, no Whisper)
```

## Manim pipeline architecture
- **Single-file architecture** — script JSON (`youtube/examples/`) is the sole source of truth. Contains content, timestamps, and all metadata. No intermediate timed.json or overlays.json.
- **Manual timestamping** — `youtube/tools/timestamp_audio.py` replaces Whisper alignment. Tap spacebar per spoken line, delayed lines auto-computed.
- **Scene generation is deterministic** — `youtube/tools/manim/codegen.py` builds overlays from script JSON internally (`build_overlays_from_script()`), preprocesses them, and emits a Manim scene file. Zero LLM, zero retries, pure Python codegen.
- **Split-frame screen layout**: Nine's 9:16 PiP fills right side (608x1080, FFmpeg), watercolour image fills left zone (1312x1080, FFmpeg), cards centred over left zone (Manim), subtitle bar at bottom of left zone only (Manim)
- **`_preprocess_overlays()`** in `generate_scene.py` is still used — it computes manimDuration, groups triplets/vocab/drills, enriches translit/english
- **Left-zone image video**: `background_video.py` generates per-block FFmpeg xfade video (1312x1080) from AI images + block timestamps. Composited at x=0 as the left-zone background.
- **Transliteration enforced**: codegen fails if any Thai overlay lacks translit
- **Phrase-driven scene generation** (preferred): When timed phrases are available (`--phrases`), codegen walks phrases chronologically, emitting `set_subtitle()` + `self.wait()` for each phrase, and triggering `show_*()` card methods only on card-key changes. No overlays, no dual timing systems. Every subtitle gets its own wait — zero batching.
- **Legacy overlay scene generation** (fallback): Without phrases, codegen builds overlays from script JSON via `build_overlays_from_script()` → `_preprocess_overlays()` → overlay-walking `_emit_construct_legacy()`. This path uses mock timestamps from the script.
- **Phrase-level subtitles**: `chunk_teleprompter.py` pre-chunks the teleprompter into subtitle-sized phrases (≤42 chars EN, ≤25 chars TH). `timestamp_server.py --phrases` provides karaoke UI for timestamping (supports 1x/1.5x/2x speed). Phrases stored in `youtube/phrases/*.phrases.timed.json`.
- **Block transitions use `snap_clear()`** — preserves subtitle layer across block boundaries (only clears card zone)
- **Block order may differ from numbering** — audio order is determined by phrase timestamps, not block IDs. Codegen sorts by `displayStart` automatically.
- **Deprecated files**: `align_whisper.py`, `generate_subtitles.py`, and `_apply_phrase_timestamps()` are kept for reference but no longer used in the pipeline

## Manim pipeline rules
- **`set_subtitle()` is zero-time** — it changes the subtitle strip instantly but consumes 0 Manim seconds. Never call it twice without a `self.wait()` or `show_*()` in between, or the first subtitle is invisible.
- **`show_*()` methods consume time** — they call `snap_clear()` internally, animate the card, then `self.wait(remaining)`. Cards persist on screen after the method returns until the next `snap_clear()`.
- **Card-subtitle pattern**: `set_subtitle()` BEFORE `show_*()`. The subtitle is visible during the card's wait. For phrases where the card doesn't change, just `set_subtitle()` + `self.wait()` — the card persists.
- **Card dedup by key**: Track `current_card_key` per block (e.g., `"vocab-card:v-001"`). Only call `show_*()` when the key changes. Same vocabId back-to-back → subtitle-only update. Different vocabId → new card with animation.
- **Synthetic phrases for silent blocks**: Blocks with no phrase chunks (e.g., drill-prompt pauses) get synthetic PhraseChunks injected at the timing gap between surrounding blocks.
- **Never use raw `displayEnd - displayStart` for Manim durations** — overlays JSON uses `displayEnd` = end of entire block. In phrase-driven mode this isn't relevant — duration = Δt to next phrase.
- **Breakdown triplet duration** (legacy) = sum of all 3 overlay manimDurations (th + translit + en)
- **Always `self.remove(old_mobject)` before replacing** — Manim's scene graph doesn't auto-remove. Assign through `_set_layer()` helper.
- **Always add/animate the tracked object, not a child** — if layer tracks `VGroup(label)`, do `self.add(group)` not `self.add(label)`.
- **Use `FadeIn()` not `animate.set_opacity()`** for nested submobjects inside VGroups/TextCards.
- See `insights/manim-pipeline-lessons.md` for full details.

## Phrase-driven pipeline process (learned 2026-04-09)
The full process for a new episode with phrase-level subtitles:
1. **Script JSON** (`youtube/examples/YT-S01-E01.json`) — write content, vocab, blocks, lines
2. **Record audio** → `youtube/recordings/YT-S01-E01.m4a`
3. **Line-level timestamps** — `timestamp_audio.py` (tap spacebar per spoken line)
4. **Generate teleprompter** — `generate_docs.py` produces teleprompter markdown
5. **Chunk teleprompter** — `chunk_teleprompter.py --episode YT-S01-E01` → `youtube/phrases/YT-S01-E01.phrases.json`
6. **Phrase timestamps** — `timestamp_server.py --phrases ... --audio ...` (karaoke UI, use 2x speed) → save as `.phrases.timed.json`
7. **Render** — `pipeline.py --episode YT-S01-E01 --phrases youtube/phrases/YT-S01-E01.phrases.timed.json`

Key gotchas learned:
- **Never mix two timing systems** — phrase timestamps are real audio time (0-948s). Script JSON timestamps are mock (0-167s). Phrase-driven mode ignores script timestamps entirely.
- **Subtitle batching kills visibility** — if `set_subtitle()` is called multiple times without a wait, only the last one is seen. The phrase-driven approach guarantees every subtitle gets visible time.
- **Suppressing overlays can delete blocks** — removing English overlays from explain blocks made those blocks vanish. Phrase-driven mode avoids this by not using overlays at all.
- **`_apply_phrase_timestamps()` corrupts timing** — it did a global sort across blocks which broke block-local displayEnd values. Deprecated in favour of phrase-driven generation.

## Skills
- `/produce-lesson M01-L004` — full 12-stage lesson pipeline from blueprint to READY_TO_RECORD
- `/render-gslides M01-L002` — generate AI images, render PPTX, upload to Google Slides with font pass
- `/produce-carousel "Topic"` — vocabulary image carousel from topic to finished PNGs
- `/produce-youtube-episode YT-S01-E01` — write script, generate images, and render YouTube episode
- `/youtube-transcript <URL>` — fetch and analyze a YouTube video transcript
