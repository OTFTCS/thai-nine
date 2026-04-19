#!/usr/bin/env python3
"""Generate classifier illustration images via Gemini 3.1 Flash.

Creates one image per classifier for the cheat sheet PDF.
Images are saved to ./images/ as PNG files.

Usage:
    python3 generate_images.py
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

DIR = Path(__file__).parent
DATA = json.loads((DIR / "data.json").read_text())
IMAGES_DIR = DIR / "images"

GCP_PROJECT = "gen-lang-client-0739488282"
GCP_LOCATION = "us-central1"
MODEL_ID = "gemini-3.1-flash-image-preview"

STYLE_PREFIX = (
    "Cute flat vector illustration, simple shapes, bold cheerful colours, "
    "rounded edges, white background, no text or writing in the image, "
    "clean minimal style suitable for an educational poster. "
)

# One prompt per classifier describing what to illustrate
CLASSIFIER_PROMPTS = {
    "คน": "A friendly diverse group of five people standing together, smiling, different ages and outfits",
    "ตัว": "A cute cat, dog, and bird sitting together happily, cartoon style animals",
    "อัน": "A collection of small everyday objects: a spoon, fork, pillow, and toy arranged neatly",
    "ใบ": "A collection of flat thin items: a ticket, playing card, green leaf, and plate arranged flat",
    "เล่ม": "A small stack of colourful books, a notebook, and a passport arranged neatly",
    "คัน": "A cute red car, blue bicycle, and yellow tuk-tuk side by side",
    "เครื่อง": "A phone, laptop computer, and small fridge arranged as cute cartoon appliances",
    "ลูก": "Round fruits and objects: an orange, watermelon slice, ball, and egg arranged together",
    "ชิ้น": "Slices and pieces of food: a slice of cake, pizza slice, and bread on a cutting board",
    "แก้ว": "A collection of drinks in glasses: water glass, coffee cup, iced tea with straw, milk glass",
    "ขวด": "A row of cute bottles: water bottle, soy sauce bottle, fish sauce bottle, cooking oil",
    "ครั้ง": "A calendar or clock with the number 3 highlighted, suggesting counting occasions",
    "รอบ": "A circular running track with a small runner doing laps, arrows showing the loop",
    "ที่": "A medal podium showing 1st 2nd 3rd places with cute trophies, ordinal numbers concept",
    "หลัง": "A row of cute buildings: a house, hotel, temple with pointed roof, school",
    "คู่": "Pairs of items: a pair of shoes, pair of socks, pair of chopsticks side by side",
    "ห้อง": "A cross-section dollhouse view showing a bedroom, bathroom, and kitchen",
    "ฉบับ": "A neat stack of documents: newspaper, envelope with letter, official certificate",
    "ชุด": "A school uniform, business suit, and traditional Thai outfit hanging on display",
    "จาน/ชาม": "A plate of fried rice and a bowl of noodle soup side by side, Thai food",
    "เรื่อง": "A movie clapperboard, TV screen showing a scene, and an open storybook",
    "ต้น": "A collection of tropical trees: coconut palm tree, banana tree, and mango tree",
    "ถุง": "Thai street food in clear plastic bags, iced drinks in bags with straws, colourful",
    "เส้น": "A bowl of Thai noodles and a road stretching into distance, side by side",
}


def generate_image(client, prompt: str, output_path: Path) -> dict:
    from google.genai import types

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    saved = False
    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.mime_type.startswith("image/"):
            output_path.write_bytes(part.inline_data.data)
            saved = True
            break

    if not saved:
        raise RuntimeError(f"No image in response for prompt: {prompt[:80]}...")

    return {
        "model": MODEL_ID,
        "prompt": prompt,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def main():
    # Load API key from .env
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found. Set it in .env or environment.", file=sys.stderr)
        sys.exit(1)

    from google import genai
    client = genai.Client(api_key=api_key)

    IMAGES_DIR.mkdir(exist_ok=True)

    # Collect all classifiers from data
    all_classifiers = []
    for section in DATA["sections"]:
        all_classifiers.extend(section["classifiers"])

    total = len(all_classifiers)
    generated = 0
    skipped = 0

    for clf in all_classifiers:
        thai = clf["thai"]
        gloss = clf["gloss"].lower().replace("-", "_")
        filename = f"{gloss}.png"
        output_path = IMAGES_DIR / filename

        if output_path.exists():
            print(f"  [skip] {thai} ({gloss}) — already exists")
            skipped += 1
            continue

        prompt_subject = CLASSIFIER_PROMPTS.get(thai)
        if not prompt_subject:
            print(f"  [warn] No prompt for {thai} ({gloss}), skipping")
            continue

        full_prompt = STYLE_PREFIX + prompt_subject

        print(f"  [{generated+1}/{total}] Generating {thai} ({gloss})...")
        try:
            meta = generate_image(client, full_prompt, output_path)
            generated += 1
            print(f"         ✓ Saved {filename}")
        except Exception as e:
            print(f"         ✗ Failed: {e}", file=sys.stderr)

    print(f"\nDone: {generated} generated, {skipped} skipped, {total} total classifiers")


if __name__ == "__main__":
    main()
