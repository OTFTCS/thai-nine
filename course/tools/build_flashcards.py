#!/usr/bin/env python3
"""build_flashcards.py — Anki .apkg writer for the W8 flashcards pipeline.

Companion to course/tools/build_flashcards.ts. The TS tool emits per-module
JSON sidecars at course/exports/flashcards/M??.json; this script converts each
to course/exports/flashcards/M??.apkg using the official `genanki` Python
package.

Why Python: there is no maintained `genanki-js` on npm with parity for the
official sqlite-backed format. The Python `genanki` library is the canonical
producer of .apkg files and is already installed in this project's tooling
patterns.

Usage:
    python3 course/tools/build_flashcards.py --module M01
    python3 course/tools/build_flashcards.py --all

Front: Thai (Sarabun, large)
Back:  PTM transliteration + English gloss + lesson_id where introduced
Tags:  module-M??, lesson-M??-L???, plus any flashcard_tags from skool-metadata
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import genanki  # type: ignore[import-not-found]


REPO_ROOT = Path(__file__).resolve().parents[2]
FLASHCARDS_DIR = REPO_ROOT / "course" / "exports" / "flashcards"

# Stable model + deck IDs derived from a fixed seed so re-runs reuse the same
# Anki model/deck identity. genanki recommends fixed integer IDs.
MODEL_ID = 1742065580  # Thai with Nine — Module Vocab v1
DECK_ID_BASE = 1742065600  # +N for module index 1..18

THAI_WITH_NINE_MODEL = genanki.Model(
    MODEL_ID,
    "Thai with Nine — Vocab v1",
    fields=[
        {"name": "Thai"},
        {"name": "Translit"},
        {"name": "English"},
        {"name": "LessonId"},
        {"name": "VocabId"},
    ],
    templates=[
        {
            "name": "Thai -> English",
            "qfmt": (
                '<div style="font-family: Sarabun, sans-serif; font-size: 48px; '
                'text-align: center;">{{Thai}}</div>'
            ),
            "afmt": (
                '{{FrontSide}}<hr id="answer">'
                '<div style="font-family: Sarabun, sans-serif; font-size: 28px; '
                'text-align: center; color: #555;">{{Translit}}</div>'
                '<div style="font-family: Sarabun, sans-serif; font-size: 24px; '
                'text-align: center; margin-top: 12px;">{{English}}</div>'
                '<div style="font-family: Sarabun, sans-serif; font-size: 14px; '
                'text-align: center; color: #999; margin-top: 18px;">'
                "Introduced in {{LessonId}}</div>"
            ),
        },
    ],
    css=(
        ".card { background: #fafafa; color: #222; }\n"
        "hr#answer { border: 0; border-top: 1px solid #ddd; margin: 14px 0; }\n"
    ),
)


def module_index(module_id: str) -> int:
    """Return the 1-based numeric index of a module id like 'M07' -> 7."""
    return int(module_id[1:])


def deck_id_for_module(module_id: str) -> int:
    return DECK_ID_BASE + module_index(module_id)


def build_deck(module_payload: dict[str, Any]) -> genanki.Deck:
    module_id: str = module_payload["moduleId"]
    module_title: str = module_payload.get("moduleTitle") or module_id
    deck_name = f"Thai with Nine::{module_id} {module_title}".rstrip()

    deck = genanki.Deck(deck_id_for_module(module_id), deck_name)

    for card in module_payload["cards"]:
        tags: list[str] = card.get("tags", [])
        # genanki rejects spaces in tags; replace just in case.
        clean_tags = [t.replace(" ", "_") for t in tags if t]
        note = genanki.Note(
            model=THAI_WITH_NINE_MODEL,
            fields=[
                card["thai"],
                card["translit"],
                card["english"],
                card["lessonId"],
                card.get("vocabId", ""),
            ],
            tags=clean_tags,
            # Stable guid so re-builds don't duplicate cards on import.
            guid=genanki.guid_for(card["vocabId"], module_id),
        )
        deck.add_note(note)

    return deck


def build_module(module_id: str) -> Path:
    json_path = FLASHCARDS_DIR / f"{module_id}.json"
    if not json_path.exists():
        raise SystemExit(
            f"Missing JSON sidecar at {json_path}. Run build_flashcards.ts first."
        )
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    deck = build_deck(payload)
    pkg = genanki.Package(deck)
    out_path = FLASHCARDS_DIR / f"{module_id}.apkg"
    pkg.write_to_file(str(out_path))
    print(f"  wrote {out_path.relative_to(REPO_ROOT)} ({len(payload['cards'])} cards)")
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Anki .apkg files per module")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--module", help="Single module id, e.g. M01")
    group.add_argument("--all", action="store_true", help="Build all modules with a JSON sidecar")
    args = parser.parse_args()

    FLASHCARDS_DIR.mkdir(parents=True, exist_ok=True)

    if args.module:
        targets = [args.module]
    else:
        targets = sorted(p.stem for p in FLASHCARDS_DIR.glob("M??.json"))

    if not targets:
        print("No JSON sidecars found. Run build_flashcards.ts first.", file=sys.stderr)
        return 1

    print(f"Writing {len(targets)} Anki deck(s)...")
    for module_id in targets:
        build_module(module_id)
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
