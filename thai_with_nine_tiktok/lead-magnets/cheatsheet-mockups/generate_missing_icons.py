#!/usr/bin/env python3
"""Generate replacement icons for slugs Iconify didn't have.

Reads missing_icons.txt, generates one image per slug via Gemini 3.1 Flash Image
using a prompt tuned to match Fluent Emoji Flat's visual DNA.
Saves to images/examples/<slug>.png (render.js picks up either .svg or .png).

Usage:
    python3 generate_missing_icons.py
    python3 generate_missing_icons.py blender office   # regenerate specific slugs
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

DIR = Path(__file__).parent
MISSING_FILE = DIR / "missing_icons.txt"
OUT_DIR = DIR / "images" / "examples"
MODEL_ID = "gemini-3.1-flash-image-preview"

# Style prompt tuned to match Fluent Emoji Flat.
STYLE_PREFIX = (
    "Flat vector emoji-style illustration of {subject}. "
    "Style: Microsoft Fluent Emoji Flat — bold block colour fills, rounded chunky shapes, "
    "subtle soft shading for depth, NO outline strokes, centred composition, "
    "friendly playful vibe, high saturation. "
    "Pure white background. 128x128 square. "
    "Single object, no text, no drop shadow, no border. "
)

# Per-slug subject descriptions (tuned for ambiguous/missing slugs)
SLUG_PROMPTS = {
    "blender": "a modern kitchen blender with a clear jug and a white base",
    "lasso": "a coiled brown rope in a loop shape, cowboy lasso",
    "microwave": "a silver microwave oven with a digital display and a square window",
    "office": "a modern office building with many windows, blue glass facade",
    # Additional Thai-food specific replacements (if user later wants them regenerated):
    "pad-thai": "a plate of pad thai noodles with shrimp, lime, and peanuts on a round white plate, top-down view",
    "tom-yum": "a bowl of tom yum soup with red chilli, mushrooms, and lemongrass, steam rising",
    "thai-iced-coffee": "a tall glass of Thai iced coffee with cream swirling and ice cubes",
    "sticky-rice-basket": "a woven bamboo basket containing white sticky rice",
    # Bottle classifier (ขวด) — needs a still wine bottle, not a champagne/cork pop
    "wine-bottle": "a dark green wine bottle standing upright, deep red foil capsule over the neck, simple cream rectangular label on the body, no glass, no cork, no fizz",
    # Tree classifier (ต้น) — the fruit emoji was wrong; these need actual trees
    "banana-tree": "a tall tropical banana tree with a slender trunk and large drooping green leaves fanning outward, a small green bunch of bananas hanging, no close-up fruit, full tree silhouette",
    "mango-tree": "a broad leafy mango tree with a thick brown trunk and dense dark green canopy, two or three small orange-red mangoes hanging among the leaves, full tree silhouette",
    "bamboo": "a cluster of three or four tall green bamboo stalks with slender pointed leaves, segmented nodes visible on the stems, no pot, full upright stalks",
    "durian-tree": "a tropical durian tree with a thick brown trunk and dense green canopy, two spiky green durian fruits hanging from the branches, full tree silhouette",
    "rubber-tree": "a tall slender rubber tree with a pale grey-brown trunk, a diagonal spiral cut in the bark, and a small white cup attached below collecting white latex sap, a few green leaves at the top",
    # Item classifier (อัน)
    "eraser": "a pink rectangular pencil eraser or rubber, rounded corners, lying diagonally on white, single solid colour block, no pencil attached",
    "lighter": "a plastic pocket cigarette lighter with a bright red body and silver metal top, small orange flame rising from the nozzle, upright",
    # Machine classifier (เครื่อง)
    "tablet-device": "a thin rectangular tablet computer in landscape orientation, black screen bezel, silver or white body, single home button at the bottom, no keyboard, clearly distinct from a laptop",
    "washing-machine": "a white front-loading washing machine with a round glass door showing a swirl of soapy water and clothes inside, two small control dials on top, simple flat block shapes",
    # Glass classifier (แก้ว)
    "juice-glass": "a tall clear drinking glass filled with bright orange juice, a small half-slice of orange on the rim, no straw, no ice",
    # Bottle classifier (ขวด) extra
    "hot-sauce": "a small clear glass bottle of red chilli hot sauce, bright green cap, red sauce clearly visible through the glass, a simple rectangular paper label on the front",
    "fish-sauce": "a clear tall glass bottle of amber-coloured Thai fish sauce with a small red cap and a simple yellow and red rectangular label, upright",
    "oil-bottle": "a clear tall glass bottle of golden cooking oil with a narrow neck and a red cap, oil visible inside, simple rectangular label",
    # Strand classifier (เส้น)
    "hair-strand": "a single thin wavy strand of dark brown hair curving across a white background, no person visible, just the strand itself",
    # Pair classifier (คู่)
    "earrings": "a matching pair of gold hoop earrings side by side on a white background, simple round loops, jewellery only",
    # Room classifier (ห้อง)
    "meeting-room": "a conference meeting room with a long oval brown table, four small chairs around it, and a rectangular presentation screen on the back wall, top-down angled view",
    # Person classifier (คน)
    "person-shopping": "a cheerful person carrying two shopping bags, one in each hand, full body, flat emoji style, simple clothing, no face detail",
    # Item classifier (อัน) extras — replacements for words that actually take different classifiers
    "toothpick": "a single thin wooden toothpick with pointed ends lying diagonally on white, simple slender stick shape",
    "remote-control": "a black TV remote control in portrait orientation, rectangular with rounded corners, multiple small coloured buttons in neat rows, one larger red power button at the top",
    "rubber-band": "a circular yellow rubber band shaped as a loose loop, slightly twisted, single solid colour, no shadow",
    # Tree classifier (ต้น) — papaya tree replacement for the flower misclassification
    "papaya-tree": "a tall tropical papaya tree with a slender trunk, a crown of large palm-like green leaves at the top, a cluster of green and orange papaya fruits hanging below the leaves, full tree silhouette",
    # Bottle classifier (ขวด) — bottled beer instead of beer mug
    "beer-bottle": "a brown glass beer bottle with a cream and red label, upright, simple classic beer bottle silhouette with a narrow neck and crown cap",
    # Sheet classifier (แผ่น) — flat tiles not in Unicode emoji
    "floor-tile": "a single square ceramic floor tile, warm terracotta brown colour, flat top-down view, plain surface, no grout, single solid block",
    "wall-tile": "a single square glazed ceramic wall tile, pale blue colour, flat front view, subtle ceramic sheen, single solid block",
}


def generate_image(client, prompt: str, output_path: Path) -> None:
    from google.genai import types

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            output_path.write_bytes(part.inline_data.data)
            return

    raise RuntimeError(f"No image in response for prompt: {prompt[:80]}...")


def main():
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found. Set it in ~/src/thai-nine/.env.", file=sys.stderr)
        sys.exit(1)

    # Argument: specific slugs on CLI, otherwise read missing_icons.txt
    if len(sys.argv) > 1:
        slugs = sys.argv[1:]
    elif MISSING_FILE.exists():
        slugs = [s.strip() for s in MISSING_FILE.read_text().splitlines() if s.strip()]
    else:
        print("No missing_icons.txt and no CLI slugs. Nothing to do.", file=sys.stderr)
        sys.exit(0)

    if not slugs:
        print("No slugs to generate. Exiting.")
        return

    print(f"Generating {len(slugs)} icon(s): {slugs}")

    from google import genai
    client = genai.Client(api_key=api_key)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for i, slug in enumerate(slugs, 1):
        out_path = OUT_DIR / f"{slug}.png"

        # Skip if .svg already exists for this slug (Iconify won)
        svg_path = OUT_DIR / f"{slug}.svg"
        if svg_path.exists():
            print(f"  [{i}/{len(slugs)}] {slug}: SVG already exists, skipping")
            continue

        # Pick subject
        subject = SLUG_PROMPTS.get(slug) or f"a {slug.replace('-', ' ')}"
        prompt = STYLE_PREFIX.format(subject=subject)

        print(f"  [{i}/{len(slugs)}] {slug}: generating...")
        try:
            generate_image(client, prompt, out_path)
            print(f"         ✓ saved {out_path.name}")
        except Exception as e:
            print(f"         ✗ failed: {e}", file=sys.stderr)

    print("\nDone.")


if __name__ == "__main__":
    main()
