#!/usr/bin/env python3
"""
Refresh the Nine content inventory from Instagram.

Usage:
    python3 content-audit/refresh_inventory.py

Requires: Chrome running with Instagram logged in (uses session cookies).
Uses Instagram's internal API — same approach as the initial audit.

For manual one-off refresh, run the JS snippet in browser console instead:
  1. Go to https://www.instagram.com/thaiwith.nine/
  2. Open DevTools console
  3. Paste the fetch script from content-audit/README.md
"""

import csv
import json
import re
import sys
from pathlib import Path

INVENTORY_PATH = Path(__file__).parent / "nine-content-inventory.csv"

# Thai Unicode range for extracting Thai words from captions
THAI_RE = re.compile(r"[\u0E00-\u0E7F]+(?:\([\w\s\-àáâãäåèéêëìíîïòóôõöùúûüýÿǎǐǒǔ]+\))?")


def extract_thai_words(caption: str) -> list[str]:
    """Pull Thai words/phrases from a caption string."""
    return THAI_RE.findall(caption)


def extract_topic(caption: str) -> str:
    """Best-effort topic extraction from caption first line."""
    first_line = caption.split("\n")[0].strip()
    # Remove hashtags, emojis, and common filler
    first_line = re.sub(r"#\w+", "", first_line)
    first_line = re.sub(r"[!?.,]+$", "", first_line).strip()
    return first_line[:120]


def load_existing_inventory() -> dict[str, dict]:
    """Load existing CSV into a dict keyed by shortcode."""
    if not INVENTORY_PATH.exists():
        return {}
    rows = {}
    with open(INVENTORY_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows[row["shortcode"]] = row
    return rows


def write_inventory(rows: list[dict]) -> None:
    """Write the inventory CSV sorted by date descending."""
    rows.sort(key=lambda r: r["date"], reverse=True)
    fields = ["date", "type", "likes", "views", "duration_s", "shortcode", "url", "caption"]
    with open(INVENTORY_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} posts to {INVENTORY_PATH}")


def parse_json_dump(json_path: str) -> list[dict]:
    """Parse a JSON array dumped from the browser (array of post objects)."""
    with open(json_path, encoding="utf-8") as f:
        posts = json.load(f)

    seen = set()
    rows = []
    for p in posts:
        sc = p.get("shortcode") or p.get("sc")
        if not sc or sc in seen:
            continue
        seen.add(sc)
        caption = p.get("caption") or p.get("c") or ""
        rows.append({
            "date": p.get("date") or p.get("d", ""),
            "type": p.get("type") or p.get("t", ""),
            "likes": p.get("likes") or p.get("l", 0),
            "views": p.get("video_views") or p.get("v", 0),
            "duration_s": int(p.get("duration") or p.get("dur", 0)),
            "shortcode": sc,
            "url": f"https://www.instagram.com/p/{sc}/",
            "caption": caption.split("\n")[0][:150],
        })
    return rows


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # If a JSON file is provided, parse it and write the inventory
        json_path = sys.argv[1]
        print(f"Parsing {json_path}...")
        rows = parse_json_dump(json_path)
        write_inventory(rows)
    else:
        # Show current inventory stats
        existing = load_existing_inventory()
        if existing:
            dates = sorted(existing.keys(), key=lambda k: existing[k]["date"])
            print(f"Current inventory: {len(existing)} posts")
            print(f"  Oldest: {existing[dates[0]]['date']} — {existing[dates[0]]['caption'][:60]}")
            print(f"  Newest: {existing[dates[-1]]['date']} — {existing[dates[-1]]['caption'][:60]}")
            types = {}
            for r in existing.values():
                types[r["type"]] = types.get(r["type"], 0) + 1
            print(f"  Types: {types}")
        else:
            print("No inventory found. Run with a JSON dump file to create one.")
        print()
        print("To refresh, dump posts JSON from browser and run:")
        print(f"  python3 {__file__} content-audit/posts-dump.json")
