#!/usr/bin/env python3
"""
Fetch per-example icons from Iconify for the Thai classifiers cheat sheet.

Reads data.json, iterates every example's `iconSlug`, tries Fluent Emoji Flat
first, falls back to Noto Emoji. Writes SVGs to images/examples/<slug>.svg.
Logs any slug that neither set has to missing_icons.txt so we can generate
replacements via Gemini.

Idempotent: skips slugs already on disk.

Usage: python3 fetch_icons.py
"""

import json
import ssl
import sys
import urllib.request
import urllib.error
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

DIR = Path(__file__).parent
DATA = json.loads((DIR / "data.json").read_text())
OUT_DIR = DIR / "images" / "examples"
OUT_DIR.mkdir(parents=True, exist_ok=True)

PREFIXES = ("fluent-emoji-flat", "noto")
BASE_URL = "https://api.iconify.design"


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"


def fetch(prefix: str, slug: str) -> str | None:
    url = f"{BASE_URL}/{prefix}/{slug}.svg?width=128"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
            body = r.read().decode("utf-8")
        if body.startswith("<svg") and "</svg>" in body:
            return body
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
        # Expected 404s for real misses; only log other errors
        if not (isinstance(e, urllib.error.HTTPError) and e.code == 404):
            print(f"    err {prefix}/{slug}: {e}", file=sys.stderr)
    return None


def main() -> int:
    # Collect all unique slugs (dedupe — e.g. pad thai + noodle soup share one)
    slugs: set[str] = set()
    for clf in DATA["classifiers"]:
        for ex in clf["examples"]:
            slug = ex.get("iconSlug")
            if slug:
                slugs.add(slug)

    print(f"Found {len(slugs)} unique icon slugs to fetch.")

    fetched: list[tuple[str, str]] = []  # (slug, prefix)
    skipped: list[str] = []
    missing: list[str] = []

    for slug in sorted(slugs):
        out_path = OUT_DIR / f"{slug}.svg"
        png_path = OUT_DIR / f"{slug}.png"
        if out_path.exists() or png_path.exists():
            skipped.append(slug)
            continue

        found = False
        for prefix in PREFIXES:
            svg = fetch(prefix, slug)
            if svg:
                out_path.write_text(svg)
                fetched.append((slug, prefix))
                print(f"  ✓ {slug} ({prefix})")
                found = True
                break

        if not found:
            missing.append(slug)
            print(f"  ✗ {slug} — no match in any prefix")

    # Summary
    print()
    print(f"Fetched {len(fetched)} new icons.")
    print(f"Skipped {len(skipped)} already on disk.")
    print(f"Missing {len(missing)}: {missing}")

    (DIR / "missing_icons.txt").write_text("\n".join(missing) + ("\n" if missing else ""))
    if missing:
        print(f"Wrote missing slugs to missing_icons.txt.")

    # Count by prefix
    from collections import Counter
    counts = Counter(prefix for _, prefix in fetched)
    for prefix, count in counts.items():
        print(f"  {prefix}: {count}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
