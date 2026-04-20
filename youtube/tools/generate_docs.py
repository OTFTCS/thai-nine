#!/usr/bin/env python3
"""
generate_docs.py — Generate readable documents from a YouTube script JSON.

Produces two separate documents:
  1. Teleprompter (what Nine reads): Thai + English + speaker notes only.
     No transliterations — Nine reads Thai natively.
  2. On-screen text guide (what the viewer sees): Thai + transliteration + English
     with display timing notes for the editor.

Usage:
    python3 youtube/tools/generate_docs.py \
        --script youtube/examples/YT-S01-E01.json \
        --outdir youtube/examples/
"""

import argparse
import json
import sys
from pathlib import Path


MODE_LABELS = {
    "hook": "HOOK",
    "explain": "EXPLAIN",
    "section-intro": "SECTION INTRO",
    "vocab-card": "VOCAB CARD",
    "vocab-explain": "VOCAB EXPLAIN",
    "natural-listen": "NATURAL LISTEN",
    "breakdown": "BREAKDOWN",
    "drill-prompt": "DRILL",
    "drill-answer": "DRILL ANSWER",
    "shadowing": "SHADOWING",
    "recap": "RECAP",
    "teaser": "TEASER",
}

DISPLAY_LABELS = {
    "immediate": "",
    "delayed-1s": "(appears after 1s)",
    "delayed-2s": "(appears after 2s)",
    "on-reveal": "(appears on next line)",
    "hidden": "(hidden)",
}


def generate_teleprompter(script: dict) -> str:
    """
    Generate teleprompter markdown — only what Nine reads aloud.
    Thai spoken lines + English spoken lines + speaker notes for delivery.
    No transliterations, no on-screen-only text, no production metadata.
    """
    lines = []
    ep = script.get("episodeId", "?")
    title = script.get("title", "?")

    lines.append(f"# {ep} — {title}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Blocks — spoken content only
    drill_num = 0
    for block in script.get("blocks", []):
        mode = block.get("mode", "")
        mode_label = MODE_LABELS.get(mode, mode.upper())

        # Drill numbering
        if mode == "drill-prompt":
            drill_num += 1
            mode_label = f"DRILL {drill_num}"
        elif mode == "drill-answer":
            mode_label = f"DRILL {drill_num} — ANSWER"

        lines.append(f"## {mode_label}")
        lines.append("")

        # Speaker note — delivery guidance
        note = block.get("speakerNote", "")
        if note:
            lines.append(f"> *{note}*")
            lines.append("")

        # Only spoken lines
        for line in block.get("lines", []):
            spoken = line.get("spoken", True)
            if not spoken:
                continue

            thai = line.get("thai", "")
            english = line.get("english", "")

            if thai:
                lines.append(thai)
            elif english:
                lines.append(english)

        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def generate_onscreen_guide(script: dict) -> str:
    """
    Generate on-screen text guide — Thai + transliteration + English with
    display timing. This is the reference for the video editor showing
    exactly what text appears on screen and when.
    """
    lines = []
    ep = script.get("episodeId", "?")
    title = script.get("title", "?")

    lines.append(f"# {ep} — On-Screen Text Guide")
    lines.append("")
    lines.append(f"**Episode:** {title}")
    lines.append("")
    lines.append("This document shows all text that appears on screen for the viewer,")
    lines.append("with transliterations and display timing. Colours: Thai (white),")
    lines.append("transliteration (gold), English (blue).")
    lines.append("")
    lines.append("---")
    lines.append("")

    for block in script.get("blocks", []):
        mode = block.get("mode", "")
        mode_label = MODE_LABELS.get(mode, mode.upper())
        lines.append(f"## [{mode_label}] Block {block.get('id', '?')}")
        lines.append("")

        for line in block.get("lines", []):
            lang = line.get("lang", "")
            thai = line.get("thai", "")
            thai_split = line.get("thaiSplit", "")
            translit = line.get("translit", "")
            english = line.get("english", "")
            display = line.get("display", "immediate")
            spoken = line.get("spoken", True)
            highlight = line.get("highlight", False)

            display_note = DISPLAY_LABELS.get(display, "")
            spoken_tag = "🗣️" if spoken else "👁️"
            highlight_tag = " 🎤karaoke" if highlight else ""

            # Build the on-screen text representation
            parts = []
            if thai_split:
                parts.append(f"**Thai:** {thai_split}")
            elif thai:
                parts.append(f"**Thai:** {thai}")
            if translit:
                parts.append(f"**Translit:** {translit}")
            if english:
                parts.append(f"**English:** {english}")

            if parts:
                line_id = line.get("id", "?")
                lines.append(f"- `{line_id}` {spoken_tag}{highlight_tag} {display_note}")
                for part in parts:
                    lines.append(f"  - {part}")
            else:
                lines.append(f"- `{line.get('id', '?')}` (no visible text)")

        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Generate teleprompter and on-screen text documents from a YouTube script JSON"
    )
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--outdir", help="Output directory (default: same as script)")
    args = parser.parse_args()

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Error: script not found: {script_path}")
        sys.exit(1)

    script = json.loads(script_path.read_text())
    ep_id = script.get("episodeId", "unknown")

    outdir = Path(args.outdir) if args.outdir else script_path.parent
    outdir.mkdir(parents=True, exist_ok=True)

    # Generate teleprompter
    teleprompter = generate_teleprompter(script)
    tp_path = outdir / f"{ep_id}-teleprompter.md"
    tp_path.write_text(teleprompter)
    print(f"✅ Teleprompter: {tp_path}")

    # Generate on-screen guide
    onscreen = generate_onscreen_guide(script)
    os_path = outdir / f"{ep_id}-onscreen.md"
    os_path.write_text(onscreen)
    print(f"✅ On-screen guide: {os_path}")


if __name__ == "__main__":
    main()
