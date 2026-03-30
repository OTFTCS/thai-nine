---
name: produce-carousel
description: Produce a complete Thai vocabulary image carousel — writes manifest, generates AI art, renders PNGs, and runs QA gates
user-invocable: true
---

# /produce-carousel

Produce a complete Thai vocabulary carousel for Instagram/TikTok. One-shot from topic to finished PNGs.

## Arguments
The user provides a topic string, e.g.:
- `/produce-carousel "Thai Fruits"`
- `/produce-carousel "Days of the Week"`

## Already completed (do NOT repeat these topics)
- Family Members in Thai
- Giving Directions in Thai
- Thai Prepositions of Place
- Thai Life Habits
- School Subjects in Thai

## Suggested next topics
1. Thai Fruits (ผลไม้)
2. Thai Animals (สัตว์)
3. Thai Colours (สี)
4. Thai Food (อาหารไทย)
5. Thai Transport (การเดินทาง)

## Full workflow

Execute these steps in order. If a QA gate fails, fix and retry (max 3 attempts per gate).

### Step 1: Plan the carousel

1. Choose 10-12 vocabulary items for the topic — beginner-friendly, commonly used Thai words.
2. For each item prepare: English name, Thai script, PTM transliteration (inline tone marks, mid tone unmarked), and a natural example sentence.
3. **All compound words MUST have breakdowns** — decompose into component morphemes with individual Thai/translit/English for each part. Single-morpheme words get an empty breakdown `[]`.
4. Choose a cover word/phrase that summarises the topic (e.g. ผลไม้ for fruits).

### Step 2: Write the manifest

Create the directory `Thai images/{slug}/` and write `manifest.json`:

```json
{
  "title": "Thai Fruits",
  "slug": "thai-fruits",
  "size": { "width": 1080, "height": 1350 },
  "providerDefaults": {
    "imageProvider": "gemini-flash-image",
    "modelEnv": "GEMINI_IMAGE_MODEL"
  },
  "footer_handle": "@thaiwith.nine",
  "slides": [
    {
      "index": 1,
      "kind": "cover",
      "image": "art/01-cover.png",
      "image_prompt": "...",
      "heading": "Thai Fruits",
      "thai": "ผลไม้",
      "translit": "phǒn-lá-máai",
      "breakdown": [
        { "thai": "ผล", "translit": "phǒn", "english": "fruit/result" },
        { "thai": "ไม้", "translit": "máai", "english": "wood/tree" }
      ],
      "example": {
        "thai": "...",
        "translit": "...",
        "english": "..."
      }
    },
    {
      "index": 2,
      "kind": "teaching-single",
      "image": "art/02.png",
      "image_prompt": "...",
      "heading": "Thai Fruits",
      "item": {
        "english": "Mango",
        "thai": "มะม่วง",
        "translit": "má-mûuang",
        "breakdown": [],
        "example": {
          "thai": "...",
          "translit": "...",
          "english": "..."
        }
      }
    }
  ]
}
```

**Rules:**
- Cover slide: `kind: "cover"` with top-level thai/translit/breakdown/example
- Teaching slides: `kind: "teaching-single"` with nested `item` object
- `image_prompt`: Short description for AI illustration (no text in image)
- All slides need `image` path pointing to `art/{index}.png`

### Step 3: QA Gate — Content review

Check the manifest against ALL of these rules. FAIL and fix if any are violated:

| # | Check | Rule |
|---|-------|------|
| 1 | **Breakdown completeness** | Every compound word (2+ morphemes) has a non-empty `breakdown[]`. Single-morpheme words have `[]`. |
| 2 | **Transliteration format** | PTM inline tone marks only. Mid tone = unmarked. No IPA, no superscript, no academic notation. |
| 3 | **Example sentence quality** | Natural spoken Thai, not textbook-stiff. Must use the target word. |
| 4 | **No duplicates** | No repeated vocabulary items across slides. |
| 5 | **Slide count** | 1 cover + 10-12 teaching slides (11-13 total). |
| 6 | **Consistent transliteration** | Same word always transliterated identically across all slides (including in example sentences). |
| 7 | **Example transliteration** | The translit of the example sentence must match the Thai exactly — no missing or extra words. |

**Be honest in QA. Do not rubber-stamp PASS.** Actually check each rule.

### Step 4: Generate AI illustrations

Write `gemini-prompts.json` with expanded prompts for each slide.

**System prompt prefix (prepend to every image_prompt):**
> Create polished digital illustration art for a Thai learning carousel. This image will be placed inside a centered 2:3 frame with teaching text below, so keep the visual composition clean and top-heavy. Use a premium friendly educational style, soft natural lighting, gentle depth, clean shapes, subtle texture, and a simple uncluttered background. The main subject must fill most of the frame without being cropped awkwardly. Avoid cut-off heads, missing limbs, tiny props, chaotic scenes, or busy backgrounds. No text, letters, numbers, captions, logos, packaging text, signs, UI, speech bubbles, or watermarks.

**Suffix for teaching slides:**
> Keep the concept literal, easy to recognize, and centered. The image should read instantly when small in an Instagram carousel.

Then generate each illustration using the Gemini Flash Image API:
```bash
# For each slide, call the API and save to art/{index}.png
```

Save generated images to `Thai images/{slug}/art/`.

### Step 5: Render PNGs

Run the generic carousel renderer:
```bash
python3 scripts/render_carousel.py --root "Thai images/{slug}"
```

**Thai text style rules (LOCKED — do NOT change these):**
- Font: **Sarabun Medium** (`assets/fonts/Sarabun-Medium.ttf`) — NOT Bold. Bold renders blurry.
- Colour: **#1a5276** (deep teal-blue)
- Stroke: **0** — never use stroke_width on Thai text
- Breakdowns: Sarabun Regular
- English: Tahoma Bold
- Transliteration: Tahoma Bold, muted brown #725d4e
- Per-slide background: auto-assigned soft muted pastels from built-in palette
- Text block: vertically centred between art frame bottom and footer handle

Output goes to `Thai images/{slug}/out/final-png/`.

### Step 6: QA Gate — Visual review

Read back 3-4 rendered PNGs and verify:

| # | Check | Rule |
|---|-------|------|
| 1 | **Thai text clarity** | Sarabun Medium, teal-blue, crisp (not blurry). No stroke artefacts. |
| 2 | **No overflow** | All text fits within content width (720px). No clipping. |
| 3 | **Breakdowns visible** | Compound words show their morpheme breakdown lines. |
| 4 | **Background colours** | Each slide has a distinct pastel background. |
| 5 | **Spacing** | Text is vertically centred and balanced — no cramped or empty areas. |
| 6 | **Example sentences** | All three lines present (Thai, translit, English). |

If any check fails: diagnose, fix source, re-render.

### Step 7: Output

1. Report all produced files and their count.
2. Open the output folder: `open "Thai images/{slug}/out/final-png/"`
3. Show 2-3 sample slide images to the user.

## Error handling
- If a QA gate fails 3 times: STOP and report what failed.
- If Gemini API fails: report the error, suggest the user check their API key.
- If render script fails: read the traceback, fix manifest data, retry.
- Never skip a QA gate. Never mark PASS when checks actually fail.
