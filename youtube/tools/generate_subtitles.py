#!/usr/bin/env python3
"""
generate_subtitles.py — Generate layered subtitle files from a timed script.

Outputs:
    1. SRT file with burned-in dual Thai + English subtitles
    2. Separate SRT tracks for YouTube CC (Thai-only, English-only, Transliteration)
    3. ASS/SSA file with styled, positioned, colour-coded subtitles for video editing
    4. JSON overlay spec for programmatic video compositing (e.g. Remotion, FFmpeg drawtext)

The ASS output is the primary deliverable — it encodes the full visual design:
    - White text for Thai script
    - Gold text for transliteration
    - Light blue text for English
    - Staged reveals (delayed appearance per the 'display' field)
    - Mode-aware positioning (bottom for breakdown, centre for natural-listen, etc.)

Usage:
    python3 youtube/tools/generate_subtitles.py \
        --script youtube/examples/YT-S01-E01.json \
        --timed  youtube/timed/YT-S01-E01.timed.json \
        --outdir youtube/subtitles/YT-S01-E01/
"""

import argparse
import json
import sys
from pathlib import Path
from dataclasses import dataclass


# ── Colour constants (ASS uses &HBBGGRR format) ──────────────────────────
COLOUR_THAI    = "&H00FFFFFF"  # White
COLOUR_TRANSLIT = "&H0040C0F0"  # Gold (#F0C040 → BGR)
COLOUR_ENGLISH = "&H00FFD4B0"  # Light blue (#B0D4FF → BGR)
COLOUR_PROMPT  = "&H0040C0F0"  # Gold for drill prompts
COLOUR_DIM     = "&H80FFFFFF"  # Semi-transparent white

# ── ASS style definitions ─────────────────────────────────────────────────
ASS_HEADER = """[Script Info]
Title: Thai with Nine — {episode_id}
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Thai,Sarabun,72,{colour_thai},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,60,1
Style: ThaiCentre,Sarabun,84,{colour_thai},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,5,40,40,0,1
Style: ThaiSplit,Sarabun,64,{colour_thai},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,3,2,5,80,80,0,1
Style: Translit,Inter,42,{colour_translit},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,40,40,30,1
Style: TranslitCentre,Inter,48,{colour_translit},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,5,40,40,0,1
Style: English,Inter,44,{colour_english},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,2,40,40,10,1
Style: EnglishCentre,Inter,50,{colour_english},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,5,40,40,0,1
Style: DrillPrompt,Inter,52,{colour_prompt},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,5,40,40,0,1
Style: VocabThai,Sarabun,96,{colour_thai},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,5,40,40,100,1
Style: VocabTranslit,Inter,48,{colour_translit},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,5,40,40,0,1
Style: VocabEnglish,Inter,52,{colour_english},&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,2,5,40,40,0,1
Style: Highlight,Sarabun,64,{colour_prompt},&H00FFFFFF,&H00000000,&H2040C0F0,-1,0,0,0,100,100,2,0,3,0,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def format_ass_time(seconds: float) -> str:
    """Convert seconds to ASS timestamp format H:MM:SS.cc"""
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    centiseconds = round((s % 1) * 100)
    if centiseconds >= 100:
        centiseconds = 99  # Clamp to valid range
    return f"{h}:{m:02d}:{int(s):02d}.{centiseconds:02d}"


def format_srt_time(seconds: float) -> str:
    """Convert seconds to SRT timestamp format HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{int(s):02d},{ms:03d}"


def get_style_for_mode_and_lang(mode: str, lang: str) -> str:
    """Map mode + language to an ASS style name."""
    if mode == "vocab-card":
        if lang in ("th", "th-split"):
            return "VocabThai"
        elif lang == "translit":
            return "VocabTranslit"
        else:
            return "VocabEnglish"
    elif mode in ("natural-listen",):
        if lang in ("th", "th-split"):
            return "ThaiCentre"
        else:
            return "EnglishCentre"
    elif mode in ("drill-prompt",):
        return "DrillPrompt"
    elif mode == "shadowing":
        if lang in ("th", "th-split"):
            return "ThaiSplit"
        elif lang == "translit":
            return "TranslitCentre"
        else:
            return "EnglishCentre"
    else:
        # Default: bottom-positioned
        if lang in ("th", "th-split"):
            return "Thai"
        elif lang == "translit":
            return "Translit"
        else:
            return "English"


def get_display_text(line: dict) -> str:
    """Get the text to display for a given line, based on language."""
    lang = line.get("lang", "th")
    if lang in ("th",):
        return line.get("thai", "")
    elif lang == "th-split":
        return line.get("thaiSplit", line.get("thai", ""))
    elif lang == "translit":
        return line.get("translit", "")
    elif lang == "en":
        return line.get("english", "")
    elif lang == "mixed":
        parts = []
        if line.get("thai"):
            parts.append(line["thai"])
        if line.get("english"):
            parts.append(line["english"])
        return " — ".join(parts)
    return ""


def generate_ass(script: dict, timed: dict, episode_id: str) -> str:
    """Generate an ASS subtitle file with full styling."""
    header = ASS_HEADER.format(
        episode_id=episode_id,
        colour_thai=COLOUR_THAI,
        colour_translit=COLOUR_TRANSLIT,
        colour_english=COLOUR_ENGLISH,
        colour_prompt=COLOUR_PROMPT
    )

    events = []

    # Build a lookup from line ID to timing
    timing_map = {}
    for tb in timed.get("timedBlocks", []):
        for tl in tb.get("lines", []):
            timing_map[tl["id"]] = tl

    # Build a lookup from block ID to block data
    block_map = {b["id"]: b for b in script.get("blocks", [])}

    for timed_block in timed.get("timedBlocks", []):
        block_id = timed_block["id"]
        block = block_map.get(block_id, {})
        mode = block.get("mode", "explain")

        for line in block.get("lines", []):
            line_id = line["id"]
            tl = timing_map.get(line_id, {})

            display_start = tl.get("displayStart")
            display_end = tl.get("displayEnd")

            if display_start is None or display_start < 0:
                continue  # Hidden line
            if display_end is None:
                display_end = display_start + 5.0  # Fallback

            text = get_display_text(line)
            if not text:
                continue

            style = get_style_for_mode_and_lang(mode, line.get("lang", "th"))
            start_ts = format_ass_time(display_start)
            end_ts = format_ass_time(display_end)

            # Add fade-in effect for delayed lines
            display = line.get("display", "immediate")
            effect = ""
            if display in ("delayed-1s", "delayed-2s", "on-reveal"):
                effect = r"{\fad(300,200)}"  # 300ms fade in, 200ms fade out

            # Layer: Thai=10, Translit=11, English=12 (so Thai renders behind translit behind English)
            lang = line.get("lang", "th")
            if lang in ("th", "th-split"):
                layer = 10
            elif lang == "translit":
                layer = 11
            else:
                layer = 12

            events.append(
                f"Dialogue: {layer},{start_ts},{end_ts},{style},,0,0,0,,{effect}{text}"
            )

    return header + "\n".join(events) + "\n"


def generate_srt_track(script: dict, timed: dict, lang_filter: str) -> str:
    """
    Generate an SRT file for a single language track.
    lang_filter: 'th', 'en', or 'translit'
    """
    timing_map = {}
    for tb in timed.get("timedBlocks", []):
        for tl in tb.get("lines", []):
            timing_map[tl["id"]] = tl

    entries = []
    counter = 1

    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            line_id = line["id"]
            lang = line.get("lang", "")
            tl = timing_map.get(line_id, {})

            # Determine if this line has the requested language content
            if lang_filter == "th":
                text = line.get("thai", "") if lang in ("th", "th-split") else ""
            elif lang_filter == "en":
                # English lines + English translations from Thai lines
                if lang == "en":
                    text = line.get("english", "")
                elif lang in ("th", "th-split") and line.get("english"):
                    text = line["english"]
                else:
                    text = ""
            elif lang_filter == "translit":
                # Translit lines + transliteration from Thai lines
                if lang == "translit":
                    text = line.get("translit", "")
                elif lang in ("th", "th-split") and line.get("translit"):
                    text = line["translit"]
                else:
                    text = ""
            else:
                text = get_display_text(line)

            if not text:
                continue

            display_start = tl.get("displayStart")
            display_end = tl.get("displayEnd")
            if display_start is None or display_start < 0:
                continue
            if display_end is None:
                display_end = display_start + 5.0

            start_ts = format_srt_time(display_start)
            end_ts = format_srt_time(display_end)

            entries.append(f"{counter}\n{start_ts} --> {end_ts}\n{text}\n")
            counter += 1

    if not entries:
        return f"1\n00:00:00,000 --> 00:00:01,000\n[No {lang_filter} content]\n"

    return "\n".join(entries)


def generate_burned_in_srt(script: dict, timed: dict) -> str:
    """
    Generate a dual-language burned-in SRT (Thai on top line, English below).
    For use with FFmpeg or video editors.
    """
    timing_map = {}
    for tb in timed.get("timedBlocks", []):
        for tl in tb.get("lines", []):
            timing_map[tl["id"]] = tl

    entries = []
    counter = 1

    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            lang = line.get("lang", "")
            if lang not in ("th", "th-split"):
                continue

            tl = timing_map.get(line["id"], {})
            display_start = tl.get("displayStart")
            display_end = tl.get("displayEnd")
            if display_start is None or display_start < 0:
                continue
            if display_end is None:
                display_end = display_start + 5.0

            thai = line.get("thai", "")
            english = line.get("english", "")

            if not thai:
                continue

            text = thai
            if english:
                text += f"\n{english}"

            start_ts = format_srt_time(display_start)
            end_ts = format_srt_time(display_end)

            entries.append(f"{counter}\n{start_ts} --> {end_ts}\n{text}\n")
            counter += 1

    return "\n".join(entries)


def generate_overlay_json(script: dict, timed: dict) -> list[dict]:
    """
    Generate a JSON overlay spec for programmatic compositing.
    Each entry is one text overlay with position, style, and timing.
    """
    timing_map = {}
    for tb in timed.get("timedBlocks", []):
        for tl in tb.get("lines", []):
            timing_map[tl["id"]] = tl

    block_map = {b["id"]: b for b in script.get("blocks", [])}
    overlays = []

    for timed_block in timed.get("timedBlocks", []):
        block_id = timed_block["id"]
        block = block_map.get(block_id, {})
        mode = block.get("mode", "explain")

        for line in block.get("lines", []):
            tl = timing_map.get(line["id"], {})
            display_start = tl.get("displayStart")
            display_end = tl.get("displayEnd")
            if display_start is None or display_start < 0:
                continue

            text = get_display_text(line)
            if not text:
                continue

            lang = line.get("lang", "th")
            overlay = {
                "lineId": line["id"],
                "blockId": block_id,
                "mode": mode,
                "lang": lang,
                "text": text,
                "displayStart": display_start,
                "displayEnd": display_end or display_start + 5.0,
                "style": get_style_for_mode_and_lang(mode, lang),
                "highlight": line.get("highlight", False),
                "fadeIn": line.get("display", "immediate") != "immediate"
            }
            overlays.append(overlay)

    return overlays


def main():
    parser = argparse.ArgumentParser(description="Generate subtitle files from timed script")
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--timed", required=True, help="Path to timed script JSON (from align_whisper.py)")
    parser.add_argument("--outdir", required=True, help="Output directory for subtitle files")
    args = parser.parse_args()

    script = json.loads(Path(args.script).read_text())
    timed = json.loads(Path(args.timed).read_text())

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    episode_id = script.get("episodeId", "unknown")

    # 1. ASS file (primary — full styled subtitles)
    ass_content = generate_ass(script, timed, episode_id)
    ass_path = outdir / f"{episode_id}.ass"
    ass_path.write_text(ass_content, encoding="utf-8")
    print(f"✅ ASS (styled):       {ass_path}")

    # 2. Burned-in dual SRT (Thai + English)
    burned_srt = generate_burned_in_srt(script, timed)
    burned_path = outdir / f"{episode_id}.burned.srt"
    burned_path.write_text(burned_srt, encoding="utf-8")
    print(f"✅ SRT (burned-in):    {burned_path}")

    # 3. Separate language tracks for YouTube CC
    for lang in ("th", "en", "translit"):
        srt_content = generate_srt_track(script, timed, lang)
        srt_path = outdir / f"{episode_id}.{lang}.srt"
        srt_path.write_text(srt_content, encoding="utf-8")
        print(f"✅ SRT ({lang:>8s}):    {srt_path}")

    # 4. JSON overlay spec
    overlays = generate_overlay_json(script, timed)
    overlay_path = outdir / f"{episode_id}.overlays.json"
    overlay_path.write_text(json.dumps(overlays, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ JSON (overlays):    {overlay_path}")

    print(f"\n📁 All outputs in: {outdir}")


if __name__ == "__main__":
    main()
