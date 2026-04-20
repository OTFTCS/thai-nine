#!/usr/bin/env python3
"""Generate lesson images using Gemini 3.1 Flash Image Preview.

Reads deck-source.json for slides with imageUsage "generated-ai",
generates watercolour sketch illustrations via Vertex AI, and saves
them to slide-assets/ with provenance tracking.

Usage:
    python3 generate_lesson_images.py --repo-root /path/to/repo --lesson M01-L001

Requires:
    pip install google-cloud-aiplatform Pillow
    Enable Vertex AI API: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com
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

GCP_PROJECT = "gen-lang-client-0739488282"
GCP_LOCATION = "us-central1"
MODEL_ID = "gemini-3.1-flash-image-preview"

STYLE_PREFIX = (
    "Watercolour sketch illustration, soft brushstrokes, warm earthy palette, "
    "hand-drawn travel journal style, gentle ink outlines, slightly textured "
    "paper feel, no text or writing in the image. "
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str, max_len: int = 40) -> str:
    """Convert text to a safe filename slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len]


def contains_thai(text: str) -> bool:
    return any("\u0E00" <= c <= "\u0E7F" for c in text)


def build_prompt(slide_data: dict) -> str | None:
    """Build an image generation prompt from slide visual strategy."""
    vs = slide_data.get("visualStrategy", {})
    if vs.get("imageUsage") != "generated-ai":
        return None

    # Prefer explicit imagePrompt (specific scene description for AI generation)
    image_prompt = vs.get("imagePrompt")
    if image_prompt:
        return STYLE_PREFIX + image_prompt

    # Fallback: use the first teaching visual as the subject
    visuals = vs.get("teachingVisuals", [])
    subject = visuals[0] if visuals else slide_data.get("title", "")

    # Strip any Thai characters from the prompt (Gemini works better with English)
    subject_clean = "".join(c for c in subject if not ("\u0E00" <= c <= "\u0E7F"))
    subject_clean = re.sub(r"\s+", " ", subject_clean).strip()

    if not subject_clean:
        subject_clean = slide_data.get("title", "Thai language lesson")

    return STYLE_PREFIX + subject_clean


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

def generate_image(client, prompt: str, output_path: Path) -> dict:
    """Generate a single image via Google GenAI and save it. Returns metadata dict."""
    from google.genai import types
    import base64

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    # Extract image from response parts
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
    parser = argparse.ArgumentParser(description="Generate lesson images via Gemini")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    parser.add_argument("--lesson", required=True, help="Lesson ID (e.g. M01-L001)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without generating")
    parser.add_argument("--regenerate", action="store_true", help="Overwrite existing images")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    lesson_id = args.lesson

    # Resolve lesson directory
    match = re.fullmatch(r"(M\d{2})-(L\d{3})", lesson_id)
    if not match:
        print(f"Invalid lesson ID: {lesson_id}", file=sys.stderr)
        sys.exit(1)
    module_id, lesson_key = match.group(1), match.group(2)
    lesson_root = repo_root / "course" / "modules" / module_id / lesson_key

    # Load deck source
    deck_source_path = lesson_root / f"{lesson_id}-deck-source.json"
    if not deck_source_path.exists():
        print(f"Deck source not found: {deck_source_path}", file=sys.stderr)
        sys.exit(1)
    deck_source = json.loads(deck_source_path.read_text(encoding="utf-8"))

    assets_dir = lesson_root / "slide-assets"

    # Collect slides that need images
    to_generate: list[tuple[dict, str, Path]] = []
    for slide_data in deck_source.get("slides", []):
        prompt = build_prompt(slide_data)
        if not prompt:
            continue

        slide_id = slide_data["id"]
        slug = slugify(slide_data.get("title", slide_id))
        output_path = assets_dir / f"{slide_id}-{slug}.png"

        if output_path.exists() and not args.regenerate:
            print(f"  Skip (exists): {output_path.name}")
            continue

        to_generate.append((slide_data, prompt, output_path))

    if not to_generate:
        print("No images to generate.")
        return

    print(f"Found {len(to_generate)} images to generate for {lesson_id}\n")

    if args.dry_run:
        for slide_data, prompt, output_path in to_generate:
            print(f"[DRY RUN] {slide_data['id']}")
            print(f"  Output: {output_path.name}")
            print(f"  Prompt: {prompt[:120]}...")
            print()
        return

    # Load API key from .env
    from dotenv import load_dotenv
    load_dotenv(repo_root / ".env", override=True)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in .env", file=sys.stderr)
        sys.exit(1)

    # Initialize Google GenAI client
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    print(f"Model: {MODEL_ID}")
    print(f"Auth: Google AI Studio API key\n")

    # Generate images
    provenance_entries: list[dict] = []

    for slide_data, prompt, output_path in to_generate:
        slide_id = slide_data["id"]
        print(f"Generating: {slide_id}")
        print(f"  Prompt: {prompt[:100]}...")

        try:
            meta = generate_image(client, prompt, output_path)
            print(f"  Saved: {output_path.name}")

            # Build provenance entry
            provenance_entries.append({
                "assetId": f"{slide_id}-asset-1",
                "slideId": slide_id,
                "kind": "image",
                "status": "resolved",
                "sourceProvider": MODEL_ID,
                "generationPrompt": prompt,
                "generationParams": {
                    "model": meta["model"],
                },
                "license": "ai-generated",
                "localPath": f"slide-assets/{output_path.name}",
                "generated_at": meta["generated_at"],
            })

            # Update deck-source asset entry
            asset_entry = {
                "assetId": f"{slide_id}-asset-1",
                "kind": "image",
                "query": prompt.replace(STYLE_PREFIX, ""),
                "sourcePolicy": "ai-generated",
                "status": "resolved",
                "sourceProvider": MODEL_ID,
                "license": "ai-generated",
                "localPath": f"slide-assets/{output_path.name}",
            }
            slide_data["assets"] = [asset_entry]

        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            continue

        print()

    # Save updated deck-source
    deck_source_path.write_text(
        json.dumps(deck_source, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Updated deck-source: {deck_source_path}")

    # Save/update asset provenance
    provenance_path = lesson_root / f"{lesson_id}-asset-provenance.json"
    provenance: dict = {"schemaVersion": 1, "lessonId": lesson_id, "assets": []}
    if provenance_path.exists():
        try:
            provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    # Merge new entries (replace by assetId)
    existing_ids = {e["assetId"] for e in provenance.get("assets", [])}
    for entry in provenance_entries:
        if entry["assetId"] in existing_ids:
            provenance["assets"] = [
                e if e["assetId"] != entry["assetId"] else entry
                for e in provenance["assets"]
            ]
        else:
            provenance["assets"].append(entry)

    provenance["generatedAt"] = datetime.now(timezone.utc).isoformat()
    provenance_path.write_text(
        json.dumps(provenance, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Updated provenance: {provenance_path}")
    print(f"\nDone! Generated {len(provenance_entries)} images.")


if __name__ == "__main__":
    main()
