---
name: produce-youtube-episode
description: Write a YouTube episode script, generate images, and render the final video
user-invocable: true
---

# /produce-youtube-episode

Produce a Thai with Nine YouTube episode — from script writing through to final rendered MP4.

## Arguments

The user provides an episode ID and optionally a mode flag:

- `/produce-youtube-episode YT-S01-E01` — render an existing episode (script + audio must exist)
- `/produce-youtube-episode --new YT-S01-E05 "Thai Directions"` — write a new episode script

Parse the episode ID from the user's message. Format: `YT-S\d{2}-E\d{2}`.

---

## Mode A: Render existing episode

Use this when the episode already has a script JSON and recorded audio with timestamps.

### Step 1: Validate inputs

Check these files exist:
- `youtube/examples/{ID}.json` — episode script
- `youtube/recordings/{ID}.m4a` — recorded audio

Check the script has timestamps (look for `displayStart` fields on lines). If missing, tell the user:
```
Run timestamp_audio.py first:
  PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/timestamp_audio.py \
    --script youtube/examples/{ID}.json --audio youtube/recordings/{ID}.m4a
```

### Step 2: Validate script

```bash
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/validate_script.py youtube/examples/{ID}.json
```

Fix any validation errors before proceeding.

### Step 3: Generate images

Check if images exist in `youtube/images/{ID}/`. If not enough images exist:

```bash
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/generate_images.py --episode {ID}
```

Images are generated via Gemini and automatically cropped to 1312x1080 (left-zone aspect ratio).

### Step 4: Check for phrase timestamps (optional)

If `youtube/phrases/{ID}.phrases.timed.json` exists, use it for phrase-level subtitles. If only line-level timestamps exist, the pipeline still works but subtitles will be less granular.

To generate phrase timestamps:
```bash
/usr/bin/python3 youtube/tools/chunk_teleprompter.py --episode {ID}
/usr/bin/python3 youtube/tools/timestamp_server.py \
  --phrases youtube/phrases/{ID}.phrases.json \
  --audio youtube/recordings/{ID}.m4a
```

### Step 5: Render

```bash
PYTHONUNBUFFERED=1 PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" /opt/homebrew/bin/python3 -u \
  -m youtube.tools.manim.pipeline --episode {ID} \
  [--phrases youtube/phrases/{ID}.phrases.timed.json] \
  [--pip-video path/to/nine-pip.mp4]
```

Add `--phrases` if timed phrases exist. Add `--pip-video` if Nine's camera recording is available.

Add `--force` to continue past QA failures if needed.

### Step 6: Report

Report to the user:
1. Final MP4 path: `youtube/out/{ID}/{ID}-final.mp4`
2. Video duration
3. Number of images used
4. QA warnings (if any)

---

## Mode B: Write new episode script

Use this when creating a new episode from scratch.

### Step 1: Load the script-writing prompt

Read the full prompt at `youtube/prompts/script-writing.prompt.md`. This defines the JSON schema, episode structure, transliteration rules, and editorial voice.

### Step 2: Gather inputs

Ask the user for (or derive from their message):
- `episodeId` — e.g. `YT-S01-E05`
- `seriesId` — e.g. `S01`
- `seriesName` — e.g. `"Thai Survival Phrases"`
- `title` — YouTube video title
- `topic` — slug, e.g. `asking-directions`
- `level` — `A0` / `A1` / `A2` / `B1` / `B2`
- `vocabList` — 8 items with Thai + English gloss
- `naturalListenDialogue` — 5-7 sentence Thai conversation
- `nextEpisodeTease` — one Thai phrase + English for teaser
- `culturalFactSeed` — 2-4 real, verifiable facts about Thailand related to the topic (NO fabricated stories)

If the user only provides a topic and episode ID, help them build the vocab list and dialogue.

### Step 3: Generate script JSON

Following the script-writing prompt exactly, generate a complete episode JSON. Write it to:
```
youtube/examples/{ID}.json
```

Key requirements:
- `schemaVersion: 2`
- 8 vocab items with full explanations and example sentences
- 10-15 image prompts (one per vocab + section transitions)
- Every block has an `imageRef`
- All cross-references resolve (vocabRefs, imageRef, shortFormClips)
- No `displayStart`/`displayEnd` on any line (added post-recording)
- PTM transliteration only (no IPA)

### Step 4: Validate

```bash
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/validate_script.py youtube/examples/{ID}.json
```

Fix any errors and re-validate until clean.

### Step 5: Generate images

```bash
PATH="/opt/homebrew/bin:$PATH" /usr/bin/python3 youtube/tools/generate_images.py --episode {ID}
```

Visually inspect each generated image by reading the PNG files.

### Step 6: Report

Report to the user:
1. Script JSON path
2. Number of blocks, vocab items, and image prompts
3. Images generated and their paths
4. Next steps:
   - Record audio → `youtube/recordings/{ID}.m4a`
   - Run timestamp_audio.py (line-level timestamps)
   - Optionally: chunk_teleprompter.py + timestamp_server.py (phrase-level)
   - Render: `/produce-youtube-episode {ID}`

---

## Video layout

The final video uses a split-frame 16:9 layout:
- **Left zone (1312x1080)**: Watercolour images with crossfade transitions. Learning cards and subtitles overlay this zone.
- **Right zone (608x1080)**: Nine's 9:16 PiP camera video (or solid dark if not provided).

Cards are centred over the left zone. Subtitle bar spans the bottom of the left zone only.

## Key files

| File | Purpose |
|------|---------|
| `youtube/prompts/script-writing.prompt.md` | AI prompt for generating episode script JSON |
| `youtube/tools/validate_script.py` | Script JSON validation |
| `youtube/tools/generate_images.py` | Gemini image generation + crop to 1312x1080 |
| `youtube/tools/timestamp_audio.py` | Line-level timestamp tool (interactive) |
| `youtube/tools/chunk_teleprompter.py` | Chunk teleprompter into subtitle phrases |
| `youtube/tools/timestamp_server.py` | Phrase-level timestamp tool (karaoke UI) |
| `youtube/tools/manim/pipeline.py` | Full render pipeline orchestrator |
| `youtube/config/manim-yt-style.json` | Layout, colour, font, animation config |

## Dependencies

```bash
pip install manim google-genai python-dotenv Pillow
brew install ffmpeg
```

- `/opt/homebrew/bin/python3` has manim installed
- `GEMINI_API_KEY` must be in `.env` for image generation
