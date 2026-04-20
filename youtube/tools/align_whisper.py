#!/usr/bin/env python3
"""
DEPRECATED — replaced by timestamp_audio.py (manual tap-to-timestamp).

Whisper auto-alignment fails on mixed Thai+English speech (~54% accuracy).
The new pipeline writes displayStart/displayEnd directly into the script
JSON via manual timestamping, eliminating the timed.json intermediate file.

See: youtube/tools/timestamp_audio.py

---

align_whisper.py — Align a YouTube episode script to audio using Whisper
word-level timestamps. Produces a timed script JSON that the subtitle
generator uses.

Usage:
    python3 youtube/tools/align_whisper.py \
        --script youtube/examples/YT-S01-E01.json \
        --audio  youtube/recordings/YT-S01-E01.wav \
        --output youtube/timed/YT-S01-E01.timed.json

Dependencies:
    pip install openai-whisper --break-system-packages

How it works:
    1. Run Whisper on the audio with word_timestamps=True
    2. Walk through the script's spoken lines in order
    3. For each spoken line, fuzzy-match its text against the Whisper
       transcript to find the start/end timestamps
    4. For non-spoken lines (display-only), calculate their timestamps
       based on the 'display' field (immediate, delayed-1s, delayed-2s)
       relative to the parent spoken line
    5. Output a timed script: same structure as the input, but every line
       now has 'startTime' and 'endTime' in seconds
"""

import argparse
import json
import sys
import re
import unicodedata
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict
from difflib import SequenceMatcher


@dataclass
class TimedWord:
    word: str
    start: float
    end: float


@dataclass
class TimedLine:
    line_id: str
    start_time: float
    end_time: float
    display_start: float  # when this line should appear on screen
    display_end: float    # when this line should disappear


@dataclass
class MatchDiagnostic:
    """Per-line diagnostic record for --diagnostic mode."""
    line_id: str
    lang: str
    spoken_text: str
    anchor: str
    matched: bool
    confidence: float
    whisper_span: str  # the Whisper words that matched
    start_time: float
    end_time: float


@dataclass
class AlignmentResult:
    episode_id: str
    audio_duration: float
    timed_blocks: list[dict] = field(default_factory=list)
    alignment_quality: float = 0.0  # 0-1 score
    unmatched_lines: list[str] = field(default_factory=list)
    diagnostics: list[MatchDiagnostic] = field(default_factory=list)


THAI_TONE_MARKS = re.compile(r'[\u0E48-\u0E4B]')  # mai ek, mai tho, mai tri, mai jattawa
ZERO_WIDTH = re.compile(r'[\u200B\u200C\u200D\uFEFF]')


def normalize_thai(text: str) -> str:
    """Normalize Thai text for matching.

    - NFC normalization (collapses Sara Am decomposition)
    - Strip tone marks (Whisper outputs these inconsistently)
    - Strip zero-width characters (inserted by Thai text tools)
    - Strip all whitespace (Thai has no word boundaries)
    """
    text = unicodedata.normalize('NFC', text)
    text = THAI_TONE_MARKS.sub('', text)
    text = ZERO_WIDTH.sub('', text)
    return re.sub(r'\s+', '', text)


def normalize_english(text: str) -> str:
    """Normalize English text for matching — strip punctuation and lowercase."""
    text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
    return re.sub(r'\s+', ' ', text.strip().lower())


def get_spoken_text(line: dict) -> Optional[str]:
    """Extract the text that Nine actually speaks for a given line."""
    if not line.get("spoken", True):
        return None

    lang = line.get("lang", "")
    if lang in ("th", "th-split"):
        return line.get("thai", "")
    elif lang == "en":
        return line.get("english", "")
    elif lang == "mixed":
        # Mixed lines — concatenate what's available
        parts = []
        if line.get("thai"):
            parts.append(line["thai"])
        if line.get("english"):
            parts.append(line["english"])
        return " ".join(parts)
    elif lang == "translit":
        # Transliteration lines are typically not spoken
        return None
    return None


def run_whisper(audio_path: str, model_name: str = "large-v3") -> tuple[list[TimedWord], float]:
    """
    Run Whisper on an audio file and return word-level timestamps.
    Returns (list of TimedWord, audio_duration).
    """
    try:
        import whisper
    except ImportError:
        print("Error: openai-whisper not installed.")
        print("  pip install openai-whisper --break-system-packages")
        sys.exit(1)

    print(f"Loading Whisper model '{model_name}'...")
    model = whisper.load_model(model_name)

    print(f"Transcribing: {audio_path}")
    result = model.transcribe(
        audio_path,
        language="th",  # Primary language is Thai; cursor fix handles English mismatches
        word_timestamps=True,
        verbose=False
    )

    words = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            words.append(TimedWord(
                word=word_info["word"].strip(),
                start=round(word_info["start"], 3),
                end=round(word_info["end"], 3)
            ))

    # Get audio duration from the last segment
    duration = 0.0
    if result.get("segments"):
        duration = result["segments"][-1]["end"]

    print(f"Whisper found {len(words)} words across {len(result.get('segments', []))} segments")
    print(f"Audio duration: {duration:.1f}s")

    return words, duration


def fuzzy_match_line(
    spoken_text: str,
    whisper_words: list[TimedWord],
    search_start_idx: int,
    lang: str,
    anchor: Optional[str] = None
) -> tuple[Optional[int], Optional[int], float]:
    """
    Find the best match for a spoken line within the Whisper transcript.
    Returns (start_word_idx, end_word_idx, confidence).

    If an anchor phrase is provided, try matching that first (English
    normalization, higher threshold). Falls back to spoken_text matching.

    Uses a sliding window approach — concatenate Whisper words and find
    the best overlap with the expected text.
    """
    if not whisper_words:
        return None, None, 0.0

    # Try anchor first if provided — these are English phrases Nine speaks
    # as timing markers (e.g. "sentence three") that Whisper recognises well.
    if anchor:
        result = _sliding_window_match(
            normalize_english(anchor), whisper_words, search_start_idx,
            is_thai=False, min_threshold=0.7
        )
        if result[0] is not None:
            return result

    if not spoken_text:
        return None, None, 0.0

    is_thai = lang in ("th", "th-split", "mixed")
    if is_thai:
        target = normalize_thai(spoken_text)
    else:
        target = normalize_english(spoken_text)

    return _sliding_window_match(
        target, whisper_words, search_start_idx,
        is_thai=is_thai, min_threshold=0.5
    )


def _sliding_window_match(
    target: str,
    whisper_words: list[TimedWord],
    search_start_idx: int,
    is_thai: bool,
    min_threshold: float
) -> tuple[Optional[int], Optional[int], float]:
    """Sliding window fuzzy match over Whisper words."""
    best_score = 0.0
    best_start = None
    best_end = None

    max_search = min(search_start_idx + 600, len(whisper_words))

    for start_idx in range(search_start_idx, max_search):
        concat = ""
        for end_idx in range(start_idx, min(start_idx + 50, max_search)):
            word = whisper_words[end_idx].word
            if is_thai:
                concat += normalize_thai(word)
            else:
                concat += " " + normalize_english(word)
                concat = concat.strip()

            if is_thai:
                score = SequenceMatcher(None, target, concat).ratio()
            else:
                score = SequenceMatcher(None, target.split(), concat.split()).ratio()

            if score > best_score and score > min_threshold:
                best_score = score
                best_start = start_idx
                best_end = end_idx

            if score > 0.95:
                return best_start, best_end, best_score

    return best_start, best_end, best_score


def calculate_display_times(
    line: dict,
    spoken_start: float,
    spoken_end: float,
    block_end: float
) -> tuple[Optional[float], Optional[float]]:
    """
    Calculate when a line should appear and disappear on screen,
    based on its 'display' field.
    """
    display = line.get("display", "immediate")

    if display == "immediate":
        start = spoken_start
    elif display == "delayed-1s":
        start = spoken_end + 1.0
    elif display == "delayed-2s":
        start = spoken_end + 2.0
    elif display == "on-reveal":
        # Appears when the NEXT spoken line starts
        start = spoken_end
    elif display == "hidden":
        return None, None
    else:
        start = spoken_start

    # Lines stay visible until the block ends (or next block starts)
    end = block_end

    return round(start, 3), round(end, 3)


def align_script(
    script: dict,
    whisper_words: list[TimedWord],
    audio_duration: float
) -> AlignmentResult:
    """
    Main alignment function. Walk through script blocks and match
    spoken lines to Whisper timestamps.
    """
    result = AlignmentResult(
        episode_id=script.get("episodeId", "unknown"),
        audio_duration=audio_duration
    )

    word_cursor = 0  # Current position in Whisper word list
    matched_count = 0
    total_spoken = 0

    for block in script.get("blocks", []):
        timed_block = {
            "id": block["id"],
            "mode": block["mode"],
            "startTime": None,
            "endTime": None,
            "lines": []
        }

        block_spoken_start = None
        block_spoken_end = None
        last_spoken_start = 0.0
        last_spoken_end = 0.0

        for line in block.get("lines", []):
            spoken_text = get_spoken_text(line)

            if spoken_text:
                total_spoken += 1

                # Try to match this line in the Whisper output
                line_anchor = line.get("anchor")
                start_idx, end_idx, confidence = fuzzy_match_line(
                    spoken_text, whisper_words, word_cursor,
                    line.get("lang", "th"), anchor=line_anchor
                )

                if start_idx is not None and end_idx is not None:
                    matched_count += 1
                    start_time = whisper_words[start_idx].start
                    end_time = whisper_words[end_idx].end
                    word_cursor = end_idx + 1

                    last_spoken_start = start_time
                    last_spoken_end = end_time

                    if block_spoken_start is None:
                        block_spoken_start = start_time
                    block_spoken_end = end_time
                else:
                    # Couldn't match — estimate based on position
                    result.unmatched_lines.append(line["id"])
                    # Use Whisper cursor position if available, else fallback
                    if word_cursor < len(whisper_words):
                        start_time = whisper_words[word_cursor].start
                    else:
                        start_time = last_spoken_end + 0.5
                    end_time = start_time + 3.0  # Estimate 3s per unmatched line
                    last_spoken_start = start_time
                    last_spoken_end = end_time

                    # Advance cursor past estimated region so next match
                    # doesn't search from a stale position
                    estimated_words = max(3, len(spoken_text.split()) * 2) if spoken_text else 5
                    word_cursor = min(word_cursor + estimated_words, len(whisper_words) - 1)

                    if block_spoken_start is None:
                        block_spoken_start = start_time
                    block_spoken_end = end_time

                # Collect diagnostic info for this line
                whisper_span = ""
                if start_idx is not None and end_idx is not None:
                    whisper_span = " ".join(
                        whisper_words[i].word for i in range(start_idx, end_idx + 1)
                    )
                result.diagnostics.append(MatchDiagnostic(
                    line_id=line["id"],
                    lang=line.get("lang", "th"),
                    spoken_text=spoken_text or "",
                    anchor=line_anchor or "",
                    matched=start_idx is not None,
                    confidence=round(confidence, 2),
                    whisper_span=whisper_span,
                    start_time=round(start_time, 3),
                    end_time=round(end_time, 3),
                ))

                timed_line = {
                    "id": line["id"],
                    "startTime": round(start_time, 3),
                    "endTime": round(end_time, 3),
                    "displayStart": round(start_time, 3),
                    "displayEnd": None,  # Filled in below
                    "confidence": round(confidence, 2) if start_idx is not None else 0.0
                }
            else:
                # Non-spoken line — calculate display time from parent spoken line
                timed_line = {
                    "id": line["id"],
                    "startTime": None,
                    "endTime": None,
                    "displayStart": None,
                    "displayEnd": None,
                    "confidence": None
                }
                # Display times calculated after we know block boundaries
                display_start, _ = calculate_display_times(
                    line, last_spoken_start, last_spoken_end,
                    last_spoken_end + 5.0  # Temporary block end
                )
                timed_line["displayStart"] = display_start

            timed_block["lines"].append(timed_line)

        # Set block boundaries
        timed_block["startTime"] = block_spoken_start or last_spoken_end
        timed_block["endTime"] = block_spoken_end or (last_spoken_end + 2.0)

        # Fill in displayEnd per line: each line is visible until the next
        # line's displayStart (not block end), giving correct sequential timing.
        block_end = timed_block["endTime"]
        visible_lines = [tl for tl in timed_block["lines"]
                         if tl.get("displayStart") is not None]
        for i, tl in enumerate(visible_lines):
            if tl["displayEnd"] is not None:
                continue
            # Next visible line's displayStart, or block end for last line
            if i + 1 < len(visible_lines):
                next_start = visible_lines[i + 1]["displayStart"]
                tl["displayEnd"] = round(max(next_start, tl["displayStart"] + 0.5), 3)
            else:
                tl["displayEnd"] = round(max(block_end, tl["displayStart"] + 0.5), 3)

        result.timed_blocks.append(timed_block)

    # Overall quality score
    result.alignment_quality = round(matched_count / max(total_spoken, 1), 3)

    return result


def generate_mock_alignment(script: dict) -> AlignmentResult:
    """
    Generate a mock timed script without audio — useful for previewing
    the subtitle layout before recording.

    Estimates ~3s per spoken Thai line, ~4s per spoken English line,
    with appropriate gaps.
    """
    result = AlignmentResult(
        episode_id=script.get("episodeId", "unknown"),
        audio_duration=0.0
    )

    current_time = 0.0

    for block in script.get("blocks", []):
        timed_block = {
            "id": block["id"],
            "mode": block["mode"],
            "startTime": current_time,
            "endTime": None,
            "lines": []
        }

        block_start = current_time

        for line in block.get("lines", []):
            spoken_text = get_spoken_text(line)
            is_spoken = line.get("spoken", True) and spoken_text

            if is_spoken:
                lang = line.get("lang", "th")
                # Estimate duration
                if lang in ("th", "th-split"):
                    duration = max(2.0, len(spoken_text) * 0.15)  # ~0.15s per Thai char
                else:
                    word_count = len(spoken_text.split())
                    duration = max(2.0, word_count * 0.4)  # ~0.4s per English word

                start_time = current_time
                end_time = current_time + duration

                display_start, display_end = calculate_display_times(
                    line, start_time, end_time, end_time + 2.0
                )

                timed_block["lines"].append({
                    "id": line["id"],
                    "startTime": round(start_time, 3),
                    "endTime": round(end_time, 3),
                    "displayStart": round(display_start, 3) if display_start is not None else None,
                    "displayEnd": None,  # Set after block
                    "confidence": 1.0
                })

                current_time = end_time + 0.3  # Small gap between lines
            else:
                # Non-spoken — calculate display time
                display = line.get("display", "immediate")
                if display == "delayed-1s":
                    ds = current_time + 1.0
                elif display == "delayed-2s":
                    ds = current_time + 2.0
                else:
                    ds = current_time

                timed_block["lines"].append({
                    "id": line["id"],
                    "startTime": None,
                    "endTime": None,
                    "displayStart": round(ds, 3),
                    "displayEnd": None,
                    "confidence": None
                })

        # Add gap between blocks
        current_time += 1.0

        timed_block["endTime"] = round(current_time, 3)

        # Fill displayEnd per line: each visible until next line starts
        visible_lines = [tl for tl in timed_block["lines"]
                         if tl.get("displayStart") is not None]
        for i, tl in enumerate(visible_lines):
            if tl["displayEnd"] is not None:
                continue
            if i + 1 < len(visible_lines):
                next_start = visible_lines[i + 1]["displayStart"]
                tl["displayEnd"] = round(max(next_start, tl["displayStart"] + 0.5), 3)
            else:
                tl["displayEnd"] = round(max(timed_block["endTime"], tl["displayStart"] + 0.5), 3)

        result.timed_blocks.append(timed_block)

    result.audio_duration = current_time
    result.alignment_quality = 1.0  # Mock is always "perfect"

    return result


def write_diagnostics(
    output_path: Path,
    whisper_words: list[TimedWord],
    alignment: AlignmentResult
) -> None:
    """Write diagnostic files for debugging alignment issues.

    Produces:
    - *.whisper.txt  — raw Whisper transcript with timestamps
    - *.diagnostic.txt — per-line match report
    """
    base = output_path.with_suffix("")

    # 1. Raw Whisper transcript
    whisper_path = Path(f"{base}.whisper.txt")
    with open(whisper_path, "w") as f:
        f.write(f"Whisper transcript — {len(whisper_words)} words\n")
        f.write("=" * 60 + "\n\n")
        for w in whisper_words:
            f.write(f"[{w.start:7.2f} - {w.end:7.2f}]  {w.word}\n")
    print(f"Whisper transcript: {whisper_path}")

    # 2. Per-line match report
    diag_path = Path(f"{base}.diagnostic.txt")
    with open(diag_path, "w") as f:
        f.write(f"Alignment diagnostic — {alignment.episode_id}\n")
        f.write(f"Quality: {alignment.alignment_quality:.0%}\n")
        f.write(f"Unmatched: {len(alignment.unmatched_lines)}\n")
        f.write("=" * 80 + "\n\n")

        for d in alignment.diagnostics:
            status = "✓" if d.matched else "✗"
            f.write(f"[{d.start_time:7.2f}-{d.end_time:7.2f}] "
                    f"{d.line_id} {status} {d.confidence:.2f}  "
                    f"({d.lang})\n")
            f.write(f"  script:  {d.spoken_text[:80]}\n")
            if d.anchor:
                f.write(f"  anchor:  {d.anchor}\n")
            if d.whisper_span:
                f.write(f"  whisper: {d.whisper_span[:80]}\n")
            else:
                f.write(f"  whisper: (no match)\n")
            f.write("\n")
    print(f"Diagnostic report: {diag_path}")


def main():
    parser = argparse.ArgumentParser(description="Align YouTube script to audio via Whisper")
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--audio", help="Path to audio/video file (WAV, MP4, etc.)")
    parser.add_argument("--output", required=True, help="Path for timed script output JSON")
    parser.add_argument("--model", default="large-v3", help="Whisper model name (default: large-v3)")
    parser.add_argument("--mock", action="store_true", help="Generate mock timing without audio (for preview)")
    parser.add_argument("--diagnostic", action="store_true", help="Dump Whisper transcript and per-line match report for debugging")
    args = parser.parse_args()

    # Load script
    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Error: script not found: {script_path}")
        sys.exit(1)

    script = json.loads(script_path.read_text())

    if args.mock:
        print("Generating mock alignment (no audio)...")
        alignment = generate_mock_alignment(script)
    else:
        if not args.audio:
            print("Error: --audio required unless --mock is set")
            sys.exit(1)
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"Error: audio not found: {audio_path}")
            sys.exit(1)

        whisper_words, duration = run_whisper(str(audio_path), args.model)
        alignment = align_script(script, whisper_words, duration)

        if args.diagnostic:
            write_diagnostics(Path(args.output), whisper_words, alignment)

    # Build output
    output = {
        "episodeId": alignment.episode_id,
        "audioDuration": alignment.audio_duration,
        "alignmentQuality": alignment.alignment_quality,
        "unmatchedLines": alignment.unmatched_lines,
        "timedBlocks": alignment.timed_blocks
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False))

    print(f"\nAlignment quality: {alignment.alignment_quality:.0%}")
    if alignment.unmatched_lines:
        print(f"Unmatched lines: {len(alignment.unmatched_lines)}")
        for lid in alignment.unmatched_lines:
            print(f"  - {lid}")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
