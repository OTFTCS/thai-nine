# Claude Cowork Briefing: Google Slides + AI Image Pipeline

## What exists

Thai with Nine is a 180-lesson Thai language course. Each lesson has a script (`script-master.json`), slide definitions (`deck-source.json`), and a PPTX deck. We've built a pipeline that generates watercolour sketch illustrations via AI, embeds them in PPTX slides, uploads to Google Slides, and applies Thai font corrections — all automated.

**The skill `/render-gslides M01-L002` runs the full pipeline for any lesson.**

## Architecture

```
deck-source.json (visualStrategy.imagePrompt)
       ↓
generate_lesson_images.py  →  Gemini 3.1 Flash Image Preview
       ↓
slide-assets/{slide-id}-{slug}.png  →  saved locally (~1MB each)
       ↓
render_lesson_deck.py  →  PPTX with images placed bottom-right
       ↓
upload_gslides.py  →  Drive upload + PPTX→Slides conversion
       ↓
gslides_font_pass.py  →  Sarabun → Noto Sans Thai Looped on Thai text
       ↓
Shareable Google Slides URL
```

## Key files

| File | Purpose |
|------|---------|
| `course/tools/generate_lesson_images.py` | Gemini image generation. Reads `deck-source.json` for slides with `imageUsage: "generated-ai"`, builds prompts from `visualStrategy.imagePrompt` (preferred) or `teachingVisuals[0]` (fallback). Uses `GEMINI_API_KEY` from `.env`. |
| `course/tools/render_lesson_deck.py` | PPTX rendering. `_place_slide_image()` places images at `(8.0", 3.6")` max `4.8"×3.4"` (bottom-right, below PiP). Has merge logic (~line 2830) that preserves `generated-ai`, `imagePrompt`, and `assets` from existing deck-source when regenerating. |
| `course/tools/upload_gslides.py` | Uploads PPTX to Google Drive with `mimeType: "application/vnd.google-apps.presentation"` for automatic conversion. Deletes old presentation first (idempotent). Verifies slide count, Thai text presence. |
| `course/tools/gslides_font_pass.py` | Walks every text run in the presentation, restyles Thai characters (U+0E00–U+0E7F) to Noto Sans Thai Looped via `updateTextStyle` batch requests. |
| `course/gslides-pipeline-config.json` | Config: `oauthClientPath`, `shareWith` emails, `targetDriveFolderId`. |
| `.env` | Contains `GEMINI_API_KEY` (Google AI Studio key). |
| `course/oauth-client.json` | OAuth desktop client for Google API auth. Token cached at `course/.gslides-token.json`. |
| `.claude/skills/render-gslides/SKILL.md` | The skill definition for `/render-gslides`. |

## How image selection works

In `deck-source.json`, each slide has a `visualStrategy` object:

```json
{
  "visualStrategy": {
    "imageUsage": "generated-ai",
    "imagePrompt": "A Thai woman at a street food stall pointing to a name tag on her apron, warm evening light and market lanterns",
    "teachingVisuals": ["...layout description..."],
    ...
  },
  "assets": [
    {
      "assetId": "slide-03-your-name-in-thai-asset-1",
      "localPath": "slide-assets/slide-03-your-name-in-thai-your-name-in-thai.png",
      "sourceProvider": "gemini-3.1-flash-image-preview",
      ...
    }
  ]
}
```

- `imageUsage: "generated-ai"` → this slide gets an AI image
- `imageUsage: "text-only"` → no image
- `imagePrompt` → the scene description (English only, no Thai). The watercolour style prefix is added automatically.
- `assets` → populated by `generate_lesson_images.py` after generation

**Guidelines for which slides get images:**
- Opener: always (scene-setting)
- Teaching slides with concrete content (countries, food, places, people): yes
- Roleplay: always (scenario scene)
- Recap: usually (travel journal style)
- Objectives: skip (text list)
- Pronunciation: usually skip (abstract phonetics)
- Closing: skip (minimal text)
- Typical: 6-10 images per lesson

## Critical gotchas (learned the hard way)

### 1. `render_lesson_deck.py` overwrites deck-source.json
Every time you run the renderer, it rebuilds deck-source from `script-master.json`. All `imageUsage` and `imagePrompt` edits would be lost — EXCEPT there's merge logic that reads the existing deck-source first and preserves `generated-ai` entries by matching slide IDs.

**Implication:** Always edit deck-source.json BEFORE the first render. After that, re-renders preserve your image data. If you need to change an `imagePrompt`, edit deck-source.json directly — the merge will keep it.

### 2. Gemini uses `generate_content`, not `generate_images`
The `generate_images` method is for Imagen models only. Gemini 3.1 Flash Image Preview uses:
```python
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
)
```
The image is in `response.candidates[0].content.parts[0].inline_data.data`.

### 3. Google Slides API can't do layout
We tried building slides via the Slides API directly — it has no text measurement, no autofit, no overflow control. Overlapping text on every layout. The solution: render perfect PPTX with python-pptx → upload to Google Drive with PPTX→Slides conversion.

### 4. Service accounts can't create Slides on personal accounts
OAuth desktop flow is required. Port 8085, token cached. If auth fails, delete `course/.gslides-token.json` and re-auth.

### 5. Python 3.9 compatibility
The machine runs Python 3.9. Use `datetime.timezone.utc` not `datetime.UTC` (3.11+).

### 6. Image prompts must be English-only
Thai characters are stripped from prompts. The `imagePrompt` field should contain vivid English scene descriptions. Include: setting (Bangkok street, cafe, hostel), people (Thai woman, Western traveller), actions (greeting, pointing, chatting), atmosphere (warm light, sunset, lanterns).

## Style consistency

All images use this prefix (applied automatically):
```
Watercolour sketch illustration, soft brushstrokes, warm earthy palette,
hand-drawn travel journal style, gentle ink outlines, slightly textured
paper feel, no text or writing in the image.
```

This produces consistent hand-drawn travel journal illustrations across all lessons.

## What's been produced so far

| Lesson | Images | Google Slides |
|--------|--------|--------------|
| M01-L001 | 3 (opener, teaching, roleplay) | Done |
| M01-L002 | 8 (opener, 4 teaching, roleplay, recap) | Done |

## Running the pipeline for a new lesson

```bash
# If deck-source.json exists with image prompts already set:
python3 course/tools/generate_lesson_images.py --repo-root . --lesson M01-L003
python3 course/tools/render_lesson_deck.py --repo-root . --lesson M01-L003
python3 course/tools/upload_gslides.py --repo-root . --lesson M01-L003
python3 course/tools/gslides_font_pass.py --repo-root . --lesson M01-L003

# Or use the skill:
/render-gslides M01-L003
```

If deck-source.json exists but doesn't have `imagePrompt` entries yet, you need to:
1. Read the lesson content (script-master.json, deck-source.json)
2. Decide which slides get images
3. Write `imagePrompt` scene descriptions into deck-source.json
4. Then run the pipeline

The `/render-gslides` skill handles all of this end-to-end.
