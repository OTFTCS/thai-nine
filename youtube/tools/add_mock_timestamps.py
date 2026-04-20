#!/usr/bin/env python3
"""Add mock timestamps to a YouTube episode script JSON.

Walks all blocks in order and assigns estimated displayStart/displayEnd
to every line, so the Manim pipeline can render a preview without real audio.

Timing heuristics:
  - Thai spoken lines: ~2.5 seconds each
  - English spoken lines: ~0.07 seconds per character (including spaces)
  - Non-spoken display lines (translit, delayed English): ~1.5 seconds each
  - 0.5s gap between lines

Usage:
    python3 youtube/tools/add_mock_timestamps.py --script youtube/examples/YT-S01-E03.json
"""

import argparse
import json
import sys
from pathlib import Path


def estimate_line_duration(line: dict) -> float:
    """Estimate how long a line should be displayed/spoken."""
    lang = line.get("lang", "en")
    spoken = line.get("spoken", False)

    if lang in ("th", "th-split"):
        if spoken:
            return 2.5
        else:
            return 1.5
    elif lang == "translit":
        return 1.5
    elif lang == "en":
        text = line.get("english", "")
        if spoken and text:
            # ~0.07 seconds per character for English speech
            duration = len(text) * 0.07
            return max(duration, 2.0)  # minimum 2 seconds
        else:
            return 1.5
    else:
        return 2.0


def add_mock_timestamps(script: dict) -> dict:
    """Add displayStart and displayEnd to every line in the script."""
    t = 1.0  # Start at 1 second
    gap = 0.5  # Gap between lines

    total_lines = 0
    timestamped_lines = 0

    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            total_lines += 1
            duration = estimate_line_duration(line)
            line["displayStart"] = round(t, 2)
            line["displayEnd"] = round(t + duration, 2)
            timestamped_lines += 1
            t += duration + gap

    total_duration = round(t, 2)
    print(f"Timestamped {timestamped_lines}/{total_lines} lines")
    print(f"Total estimated duration: {total_duration:.1f}s ({total_duration/60:.1f} min)")
    return script


def main():
    parser = argparse.ArgumentParser(description="Add mock timestamps to episode script")
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--dry-run", action="store_true", help="Print stats without writing")
    args = parser.parse_args()

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Error: {script_path} not found", file=sys.stderr)
        sys.exit(1)

    with open(script_path, "r", encoding="utf-8") as f:
        script = json.load(f)

    script = add_mock_timestamps(script)

    if args.dry_run:
        print("Dry run — no file written.")
    else:
        with open(script_path, "w", encoding="utf-8") as f:
            json.dump(script, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Written to {script_path}")


if __name__ == "__main__":
    main()
