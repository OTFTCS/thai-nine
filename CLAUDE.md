# Thai with Nine — Project Context

## What this is
A Thai language course (Immersion Thai with Nine) with 180 lessons across 18 modules, A0 to B2. Each lesson is a pre-recorded video tutorial with PPTX slides, also used for live 1:1 teaching with Nine.

## Key directories
- `course/exports/full-thai-course-blueprint.csv` — source of truth for all 180 lessons
- `course/modules/M01-M18/L001-L010/` — lesson artifacts
- `course/tools/` — pipeline scripts (TypeScript + Python)
- `course/prompts/agent-prompts/` — 13 agent prompt files for each pipeline stage (incl. Manim lesson generation)
- `course/schemas/` — JSON schemas for all artifacts

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
# youtube/recordings/     — raw audio files (M4A/WAV)
# youtube/timed/          — Whisper-aligned timed scripts
# youtube/subtitles/      — generated subtitle files (ASS, SRT, overlays JSON)
# youtube/tools/          — pipeline scripts
# youtube/schemas/        — yt-script.schema.json

# Step 1: Validate script
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/validate_script.py youtube/examples/YT-S01-E01.json

# Step 2: Whisper alignment (audio + script → timed JSON)
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/align_whisper.py \
  --script youtube/examples/YT-S01-E01.json \
  --audio youtube/recordings/YT-S01-E01.m4a \
  --output youtube/timed/YT-S01-E01.timed.json \
  --model medium

# Step 3: Generate subtitles (timed JSON → ASS/SRT/overlays)
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/generate_subtitles.py \
  --script youtube/examples/YT-S01-E01.json \
  --timed youtube/timed/YT-S01-E01.timed.json \
  --outdir youtube/subtitles/YT-S01-E01/

# Step 4: Generate teleprompter + on-screen docs
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/generate_docs.py \
  --script youtube/examples/YT-S01-E01.json

# Step 5: Manim video pipeline (audio + overlays → finished MP4)
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" /opt/homebrew/bin/python3 \
  -m youtube.tools.manim.pipeline --episode YT-S01-E01

# Scene generation only (review before render):
... --skip-render

# Use existing scene file (skip deterministic codegen):
... --scene-file youtube/out/YT-S01-E01/YT-S01-E01-scene.py

# Force past QA failures:
... --force

# Dependencies: pip install openai-whisper manim; brew install ffmpeg
# Note: /usr/bin/python3 has whisper installed; /opt/homebrew/bin/python3 has manim
# Note: Scene generation is now deterministic codegen (no Claude CLI needed)
```

## Manim pipeline architecture
- **Scene generation is deterministic** — `youtube/tools/manim/codegen.py` (SceneCodegen class) replaces the old Claude CLI generation. Zero LLM, zero retries, pure Python codegen.
- **4-zone screen layout**: PiP (top-right, FFmpeg), Background image (FFmpeg), Card zone (centre, Manim), Subtitle zone (bottom strip, Manim)
- **`_preprocess_overlays()`** in `generate_scene.py` is still used — it computes manimDuration, groups triplets/vocab/drills, enriches translit/english
- **`fix_scene_timing.py`** is no longer called (deterministic codegen has zero drift)
- **Background video**: `background_video.py` generates per-block FFmpeg xfade video from AI images + block timestamps
- **Transliteration enforced**: codegen fails if any Thai overlay lacks translit

## Manim pipeline rules
- **Never use raw `displayEnd - displayStart` for Manim durations** — overlays JSON uses `displayEnd` = end of entire block (for concurrent subtitle display). Pre-compute `manimDuration` = time to next overlay's `displayStart` within block.
- **Breakdown triplet duration** = sum of all 3 overlay manimDurations (th + translit + en), not just the Thai overlay's manimDuration
- **Always `self.remove(old_mobject)` before replacing** — Manim's scene graph doesn't auto-remove. Assign through `_set_layer()` helper.
- **Always add/animate the tracked object, not a child** — if layer tracks `VGroup(label)`, do `self.add(group)` not `self.add(label)`. Otherwise the label survives removal of the VGroup.
- **Use `FadeIn()` not `animate.set_opacity()`** for nested submobjects inside VGroups/TextCards.
- See `insights/manim-pipeline-lessons.md` for full details.

## Skills
- `/produce-lesson M01-L004` — full 12-stage lesson pipeline from blueprint to READY_TO_RECORD
- `/render-gslides M01-L002` — generate AI images, render PPTX, upload to Google Slides with font pass
- `/produce-carousel "Topic"` — vocabulary image carousel from topic to finished PNGs
- `/youtube-transcript <URL>` — fetch and analyze a YouTube video transcript
