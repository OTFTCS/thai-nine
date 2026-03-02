# Thai With Nine TikTok Automation Pipeline

This folder contains a practical automation pipeline for two things:

1. **Script Generator** (topic + goals -> structured TikTok script)
2. **Post-Production Assist** (video + transcript -> captions + visual cues + remotion render)

It is designed to reuse existing project rules, especially PTM transliteration validation from `course/tools/lib/transliteration-policy.ts`.

---

## What it generates

### A) Script Generator output

Each generated script always includes:

- **Hook**
- **Setup**
- **Teaching blocks**
- **Recap**
- **CTA**

And also includes:

- runtime profile metadata (`default`, `short`, `micro`)
- template-driven prompt pack (repeatable structure)
- transliteration validation report (PASS/FAIL)

### B) Post-Production Assist output

From a transcript + video, it creates:

- subtitle timeline (`subtitles.srt`)
- visual cue suggestions (`overlay-cues.json`)
- remotion-ready data (`remotion-data.json` + `thaiwith-nine-remotion/src/data/auto-generated.json`)
- optional rendered vertical MP4 from Remotion (`AutoTikTokOverlay` composition)

---

## Setup

### 1) Node dependencies (required)

From repo root:

```bash
npm install
npm --prefix thaiwith-nine-remotion install
```

### 2) FFmpeg (recommended)

FFmpeg/ffprobe is used for video duration detection and audio extraction.

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

### 3) WhisperX — optional, for forced alignment

WhisperX is a local Python tool. No paid API required. Only needed if you use `--aligner whisperx`.

```bash
# Create a Python virtualenv (Python 3.10+ recommended)
python3 -m venv ~/.venvs/whisperx
source ~/.venvs/whisperx/bin/activate

# Install WhisperX and its dependencies
pip install whisperx

# Verify
whisperx --help
```

After activating the venv, `whisperx` will be in your PATH. Add the activate line to your shell profile or
activate it before running `build-post` with `--aligner whisperx`.

> **Model downloads**: WhisperX downloads Whisper and wav2vec2 alignment models on first use.
> These are cached in `~/.cache/whisper` and `~/.cache/huggingface`. Expect ~1-2 GB on first run.
> Tests in this repo do **not** trigger model downloads.

---

## End-to-end commands

### 1) Generate script from a brief

```bash
npm run tiktok:script -- \
  --brief thai_with_nine_tiktok/samples/brief-one-word-many-uses.json
```

Optional:

- `--out-dir <path>`
- `--name <slug>`

### 2) Validate transliteration in generated script

```bash
npm run tiktok:validate-script -- \
  --script thai_with_nine_tiktok/out/scripts/<your-script>.json
```

### 3) Build post-production assets + render upload-ready output

```bash
npm run tiktok:produce -- \
  --video /absolute/or/relative/path/to/edited-video.mp4 \
  --transcript /absolute/or/relative/path/to/transcript.srt

# (equivalent)
npm run tiktok:build-post -- \
  --video /absolute/or/relative/path/to/edited-video.mp4 \
  --transcript /absolute/or/relative/path/to/transcript.srt
```

Optional flags:

- `--fps 30`
- `--width 1080`
- `--height 1920`
- `--output auto-my-video.mp4`
- `--no-render` (generate JSON/SRT only)
- `--dry-run` (no video copy, no render)
- `--aligner none|whisperx` (default: `none`)
- `--audio <path>` (pre-extracted audio for WhisperX; omit to auto-extract from `--video`)
- `--lang <code>` (language hint for WhisperX, e.g. `th`, `en`; default: `auto`)
- `--max-cps <number>` (max characters-per-second per caption before splitting; default: `17`)

### 3a) With forced alignment (WhisperX)

```bash
# Activate your whisperx venv first
source ~/.venvs/whisperx/bin/activate

# Run with WhisperX — audio extracted automatically from video
npm run tiktok:build-post -- \
  --video ~/Desktop/raw.mp4 \
  --transcript ~/Desktop/script.txt \
  --aligner whisperx \
  --lang th \
  --no-render

# Pre-extracted audio (faster — skip ffmpeg extraction step)
npm run tiktok:build-post -- \
  --video ~/Desktop/raw.mp4 \
  --audio ~/Desktop/audio.wav \
  --transcript ~/Desktop/script.txt \
  --aligner whisperx \
  --lang th \
  --max-cps 14 \
  --no-render
```

### 3b) Fallback behaviour

If `--aligner whisperx` is requested but fails (whisperx not installed, model error, ffmpeg missing, etc.),
the pipeline **automatically falls back** to `parseTranscriptFile` — the same behaviour as `--aligner none`.
A warning is printed to stderr explaining the failure. Artifacts are always written.

```
[alignment] WhisperX failed: whisperx not found in PATH — install it (see README) or use --aligner none
[alignment] Falling back to parseTranscriptFile.
```

No data is lost. The pipeline never exits with an error solely due to alignment failure.

---

## Example artifacts

After running `build-post`, you get:

- `thai_with_nine_tiktok/out/post/<timestamp>/subtitles.srt`
- `thai_with_nine_tiktok/out/post/<timestamp>/overlay-cues.json`
- `thai_with_nine_tiktok/out/post/<timestamp>/remotion-data.json`
- `thaiwith-nine-remotion/src/data/auto-generated.json` (composition input)
- `thaiwith-nine-remotion/public/autogen/<video-file>`
- `thaiwith-nine-remotion/out/auto-<timestamp>.mp4` (unless `--no-render`)

---

## Runtime profiles and templates

Config files:

- `config/runtime-profiles.json`
- `config/script-templates.json`

You can tune:

- target runtime/word count
- number of teaching blocks
- hook/setup/teaching/recap/CTA formulas
- style tags for Nine’s delivery

---

## PTM transliteration policy integration

The script generator validates all lexeme transliteration values with:

- inline PTM tones required
- superscript/caret/legacy suffixes rejected
- forbidden symbols blocked

Source reused from existing policy code:

- `course/tools/lib/transliteration-policy.ts`

---

## Tests / validators

Run pipeline tests:

```bash
npm run tiktok:test
```

Covers:

- transliteration fail/pass behavior
- required script sections presence
- transcript parsing -> remotion data conversion

---

## Troubleshooting

### `build-post` says missing `--video`
Use `--dry-run` if you only want caption/cue JSON generation without render.

### Render fails with missing media
Check that video was copied to:
`thaiwith-nine-remotion/public/autogen/<file>.mp4`

### `ffprobe` unavailable
Pipeline still works with transcript timing. If transcript has no timestamps, it estimates segment durations.

### `whisperx` command not found
Either the venv is not activated or WhisperX is not installed. Either activate the venv or use `--aligner none`.
The pipeline falls back to `parseTranscriptFile` automatically and prints a warning.

### WhisperX model download fails / HuggingFace rate limit
WhisperX downloads models from HuggingFace on first use. If the download fails, set:
```bash
export HF_TOKEN=<your-hf-token>
```
or pass `--hf_token <token>` as an extra arg (edit the `runWhisperXAlignment` args array in `forced-alignment.ts`).

### CPS cap produces too many small captions
Lower `--max-cps` for tighter caps (e.g. `--max-cps 12`) or pass `--max-cps 9999` to effectively disable splitting.

### Transliteration validation fails
Fix lexeme translit in your brief/script using inline tone marks (e.g., `mâeng`, `khôot`) and rerun.
