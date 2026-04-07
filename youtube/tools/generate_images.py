#!/usr/bin/env python3
"""Generate YouTube episode images using Gemini 3.1 Flash Image Preview.

Reads imagePrompts from episode script JSON and generates watercolour
illustrations for use as video backgrounds.

Usage:
    python3 youtube/tools/generate_images.py --episode YT-S01-E01
    python3 youtube/tools/generate_images.py --episode YT-S01-E01 --dry-run

Requires:
    pip install google-genai python-dotenv Pillow
    GEMINI_API_KEY in .env
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_ID = "gemini-3.1-flash-image-preview"

STYLE_PREFIX = (
    "Watercolour sketch illustration, soft brushstrokes, warm earthy palette, "
    "hand-drawn travel journal style, gentle ink outlines, slightly textured "
    "paper feel, no text or writing in the image. "
)

_HERE = Path(__file__).resolve().parent
_YT_DIR = _HERE.parent           # youtube/
_REPO_ROOT = _YT_DIR.parent      # thai-nine/


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len]


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

def generate_image(client, prompt: str, output_path: Path) -> dict:
    """Generate a single image via Google GenAI and save it."""
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


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate YouTube episode images via Gemini")
    parser.add_argument("--episode", required=True, help="Episode ID (e.g. YT-S01-E01)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without generating")
    parser.add_argument("--regenerate", action="store_true", help="Overwrite existing images")
    args = parser.parse_args()

    episode_id = args.episode

    # Load episode script
    script_path = _YT_DIR / "examples" / f"{episode_id}.json"
    if not script_path.exists():
        print(f"Episode script not found: {script_path}", file=sys.stderr)
        sys.exit(1)

    script = json.loads(script_path.read_text(encoding="utf-8"))
    image_prompts = script.get("imagePrompts", [])

    if not image_prompts:
        print("No imagePrompts in episode script.")
        return

    images_dir = _YT_DIR / "images" / episode_id

    # Collect images to generate
    to_generate: list[tuple[dict, str, Path]] = []
    for ip in image_prompts:
        img_id = ip["id"]
        prompt = STYLE_PREFIX + ip["prompt"]
        slug = slugify(ip.get("prompt", img_id)[:40])
        output_path = images_dir / f"{img_id}-{slug}.png"

        if output_path.exists() and not args.regenerate:
            print(f"  Skip (exists): {output_path.name}")
            continue

        to_generate.append((ip, prompt, output_path))

    if not to_generate:
        print("No images to generate.")
        return

    print(f"Found {len(to_generate)} images to generate for {episode_id}\n")

    if args.dry_run:
        for ip, prompt, output_path in to_generate:
            print(f"[DRY RUN] {ip['id']}")
            print(f"  Output: {output_path.name}")
            print(f"  Prompt: {prompt[:120]}...")
            print()
        return

    # Load API key
    try:
        from dotenv import load_dotenv
        load_dotenv(_REPO_ROOT / ".env")
    except ImportError:
        pass

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in environment or .env", file=sys.stderr)
        sys.exit(1)

    from google import genai

    client = genai.Client(api_key=api_key)
    print(f"Model: {MODEL_ID}\n")

    # Generate images
    manifest_entries: list[dict] = []

    for ip, prompt, output_path in to_generate:
        img_id = ip["id"]
        print(f"Generating: {img_id}")
        print(f"  Prompt: {prompt[:100]}...")

        try:
            meta = generate_image(client, prompt, output_path)
            print(f"  Saved: {output_path.name}")
            manifest_entries.append({
                "imageId": img_id,
                "prompt": ip["prompt"],
                "localPath": str(output_path.relative_to(_YT_DIR)),
                "model": meta["model"],
                "generatedAt": meta["generated_at"],
            })
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            continue

        print()

    # Write manifest
    manifest_path = images_dir / "image-manifest.json"
    manifest: dict = {"episodeId": episode_id, "images": []}
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    existing_ids = {e["imageId"] for e in manifest.get("images", [])}
    for entry in manifest_entries:
        if entry["imageId"] in existing_ids:
            manifest["images"] = [
                e if e["imageId"] != entry["imageId"] else entry
                for e in manifest["images"]
            ]
        else:
            manifest["images"].append(entry)

    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Manifest: {manifest_path}")
    print(f"\nDone! Generated {len(manifest_entries)} images.")


if __name__ == "__main__":
    main()
