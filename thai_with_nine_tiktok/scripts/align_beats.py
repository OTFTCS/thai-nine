"""
Align parsed script beats to audio timestamps.

Two modes:
1. WhisperX: fuzzy-match spoken text from transcript to script beats
2. Manual CSV: load pre-timed beat timestamps directly

Output: TimedBeatSheet — the script beats with start_sec/end_sec attached.

Usage:
    from align_beats import align_beats_to_transcript, align_beats_manual, TimedBeat
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from difflib import SequenceMatcher
from pathlib import Path

from parse_script_beats import Beat
from audio_utils import TranscriptSegment


@dataclass
class TimedBeat:
    """A script beat with audio timing attached."""

    beat_type: str
    index: int
    start_sec: float
    end_sec: float

    # Content fields (from Beat)
    thai: str = ""
    translit: str = ""
    gloss: str = ""
    english: str = ""
    perform_text: str = ""
    buzzer_label: str = ""
    pause_seconds: int = 3
    direction: str = ""
    english_line_text: str = ""
    classifier: str = ""


class AlignmentError(Exception):
    """Raised when alignment quality is too low."""

    pass


# ---------------------------------------------------------------------------
# Text similarity
# ---------------------------------------------------------------------------


def _normalize(text: str) -> str:
    """Normalize text for fuzzy matching — lowercase, strip punctuation."""
    import re

    text = text.lower().strip()
    text = re.sub(r'[\"\'.,!?:;\(\)\[\]{}]', "", text)
    text = text.replace("\u201c", "").replace("\u201d", "").replace("\u2018", "").replace("\u2019", "")
    text = re.sub(r"\s+", " ", text)
    return text


def _similarity(a: str, b: str) -> float:
    """Fuzzy similarity between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def _get_spoken_texts(beat: Beat) -> list[str]:
    """Extract all possible spoken text variants for matching against transcript.

    Returns empty list for non-speech beats (buzzer, pause, reveal, stage_direction).
    Multiple variants improve matching when transcript language differs from script.
    """
    if beat.beat_type == "thai_triplet":
        # Transcript may be Thai text, transliteration, or English gloss
        return [t for t in [beat.thai, beat.translit, beat.english, beat.gloss] if t]
    elif beat.beat_type == "perform":
        return [beat.perform_text] if beat.perform_text else []
    elif beat.beat_type == "english_line":
        return [beat.english_line_text] if beat.english_line_text else []
    return []


def _get_spoken_text(beat: Beat) -> str | None:
    """Extract primary spoken text (for error reporting)."""
    texts = _get_spoken_texts(beat)
    return texts[0] if texts else None


def _is_speech_beat(beat: Beat) -> bool:
    """Whether this beat type corresponds to spoken audio."""
    return beat.beat_type in ("thai_triplet", "perform", "english_line")


# ---------------------------------------------------------------------------
# WhisperX alignment
# ---------------------------------------------------------------------------


def align_beats_to_transcript(
    beats: list[Beat],
    segments: list[TranscriptSegment],
    total_duration: float,
    match_threshold: float = 0.3,
) -> list[TimedBeat]:
    """Fuzzy-match script beats to WhisperX transcript segments.

    Strategy:
    1. Speech beats are matched to transcript segments by text similarity
    2. Non-speech beats get interpolated timing from surrounding speech beats
    3. Chronological order is enforced

    Args:
        beats: Parsed script beats in order
        segments: WhisperX transcript segments with timing
        total_duration: Total audio duration in seconds
        match_threshold: Minimum fraction of speech beats that must match

    Returns:
        List of TimedBeat with timing information

    Raises:
        AlignmentError: If match rate is below threshold
    """
    if not beats:
        return []

    if not segments:
        # No transcript — fall back to even distribution
        return _distribute_evenly(beats, total_duration)

    # Step 1: Two-pass alignment to prevent cascading drift.
    #
    # Pass 1 — high-confidence anchors (score ≥ 0.6, lookahead 3).
    #   These are near-exact matches that we can trust absolutely.
    #   They partition the timeline into windows for pass 2.
    #
    # Pass 2 — fill gaps using constrained windows.
    #   For unmatched beats between two anchors, only search the
    #   segment range between those anchors.  This prevents a weak
    #   match on "fish one BODY" from jumping to "bird two bodies"
    #   30 seconds later.

    speech_beats = [(i, b) for i, b in enumerate(beats) if _is_speech_beat(b)]
    matched_times: dict[int, tuple[float, float]] = {}  # beat list index -> (start, end)
    matched_seg: dict[int, int] = {}  # beat list index -> segment index

    def _best_match(
        beat: "Beat",
        seg_range: range,
    ) -> tuple[float, int]:
        """Find best matching segment for beat within seg_range.

        When two segments score within 0.1 of each other, prefer the
        closer one (lower index).  This prevents a gloss variant like
        "fish one BODY" from jumping past the Thai segment "ปาหนึ่งตัว"
        that scores 0.95 to match an English segment scoring 1.0 two
        positions later.
        """
        spoken_variants = _get_spoken_texts(beat)
        if not spoken_variants:
            return 0.0, -1
        best_score = 0.0
        best_si = -1
        for si in seg_range:
            seg = segments[si]
            for spoken in spoken_variants:
                score = _similarity(spoken, seg.text)
                if score > best_score + 0.1:
                    # Clear winner — take it
                    best_score = score
                    best_si = si
                elif score > best_score and best_si == -1:
                    # First match
                    best_score = score
                    best_si = si
                # Otherwise: similar score but further away — keep closer match
        return best_score, best_si

    # ---- Pass 1: anchor high-confidence matches ----
    seg_idx = 0
    for beat_list_idx, beat in speech_beats:
        search_end = min(seg_idx + 3, len(segments))
        score, si = _best_match(beat, range(seg_idx, search_end))
        if score >= 0.6 and si >= 0:
            matched_times[beat_list_idx] = (segments[si].start_sec, segments[si].end_sec)
            matched_seg[beat_list_idx] = si
            seg_idx = si + 1

    # ---- Pass 2: fill gaps between anchors ----
    anchor_indices = sorted(matched_seg.keys())

    # Build (beat_range, seg_range) windows between consecutive anchors
    windows: list[tuple[list[tuple[int, "Beat"]], range]] = []

    # Before first anchor
    if anchor_indices:
        pre_beats = [(i, b) for i, b in speech_beats if i < anchor_indices[0] and i not in matched_times]
        if pre_beats:
            seg_end = matched_seg[anchor_indices[0]]
            windows.append((pre_beats, range(0, seg_end)))

        # Between consecutive anchors
        for a_idx in range(len(anchor_indices) - 1):
            a1 = anchor_indices[a_idx]
            a2 = anchor_indices[a_idx + 1]
            gap_beats = [(i, b) for i, b in speech_beats if a1 < i < a2 and i not in matched_times]
            if gap_beats:
                seg_start = matched_seg[a1] + 1
                seg_end = matched_seg[a2]
                if seg_start < seg_end:
                    windows.append((gap_beats, range(seg_start, seg_end)))

        # After last anchor
        post_beats = [(i, b) for i, b in speech_beats if i > anchor_indices[-1] and i not in matched_times]
        if post_beats:
            seg_start = matched_seg[anchor_indices[-1]] + 1
            windows.append((post_beats, range(seg_start, len(segments))))

    for gap_beats, seg_range in windows:
        sub_seg_idx = seg_range.start
        for beat_list_idx, beat in gap_beats:
            search_end = min(sub_seg_idx + 4, seg_range.stop)
            score, si = _best_match(beat, range(sub_seg_idx, search_end))
            if score >= 0.15 and si >= 0:
                matched_times[beat_list_idx] = (segments[si].start_sec, segments[si].end_sec)
                matched_seg[beat_list_idx] = si
                sub_seg_idx = si + 1

    # Check match rate
    match_rate = len(matched_times) / max(len(speech_beats), 1)
    if match_rate < match_threshold:
        unmatched = [
            f"  beat[{i}] {b.beat_type}: {_get_spoken_text(b)!r}"
            for i, b in speech_beats
            if i not in matched_times
        ]
        raise AlignmentError(
            f"Only {match_rate:.0%} of speech beats matched (need {match_threshold:.0%}).\n"
            f"Unmatched beats:\n" + "\n".join(unmatched[:20])
        )

    # Step 2: Interpolate timing for unmatched beats
    timed_beats = _interpolate_timing(beats, matched_times, total_duration)
    return timed_beats


def _interpolate_timing(
    beats: list[Beat],
    matched_times: dict[int, tuple[float, float]],
    total_duration: float,
) -> list[TimedBeat]:
    """Assign timing to all beats, interpolating unmatched ones."""
    n = len(beats)
    times: list[tuple[float, float]] = [(0.0, 0.0)] * n

    # Fill in matched times
    for idx, (start, end) in matched_times.items():
        times[idx] = (start, end)

    # Edge case: if beat 0 is unmatched and the first matched beat starts
    # after 0.0, give beat 0 the gap from 0 to the first match
    if 0 not in matched_times and matched_times:
        first_matched = min(matched_times.keys())
        first_start = matched_times[first_matched][0]
        if first_start > 0.0:
            times[0] = (0.0, first_start)

    # For unmatched beats, interpolate between nearest matched neighbors.
    # First pass: identify contiguous gaps of unmatched beats.
    # Second pass: distribute each gap evenly between its bounding anchors.
    i = 0
    while i < n:
        if i in matched_times:
            i += 1
            continue

        # Found start of a gap — find the end
        gap_start = i
        while i < n and i not in matched_times:
            i += 1
        gap_end = i  # exclusive

        # Find bounding anchors
        prev_end = 0.0
        for j in range(gap_start - 1, -1, -1):
            if j in matched_times:
                prev_end = matched_times[j][1]
                break

        next_start = total_duration
        for j in range(gap_end, n):
            if j in matched_times:
                next_start = matched_times[j][0]
                break

        gap_count = gap_end - gap_start
        gap_duration = next_start - prev_end

        if gap_count > 0 and gap_duration > 0:
            slot = gap_duration / gap_count
            for k in range(gap_start, gap_end):
                pos = k - gap_start
                start = prev_end + pos * slot
                end = start + slot

                # Special handling for pause beats — give them their full pause_seconds
                beat = beats[k]
                if beat.beat_type == "pause_challenge" and beat.pause_seconds > 0:
                    end = min(start + beat.pause_seconds, next_start)

                times[k] = (start, end)
        elif gap_count > 0 and gap_duration <= 0:
            # No gap available — place beats at the boundary with minimal duration
            for k in range(gap_start, gap_end):
                times[k] = (prev_end, prev_end)

    # Apply pre-roll: shift speech beat starts earlier so text appears
    # just as the speaker begins (accounts for fade-in animation time).
    # Non-speech beats (stage_direction, buzzer, etc.) are not shifted.
    PRE_ROLL = 0.4  # seconds
    for i, beat in enumerate(beats):
        if _is_speech_beat(beat) and times[i][0] > PRE_ROLL:
            start, end = times[i]
            # Don't overlap with the previous beat's end
            prev_end = times[i - 1][1] if i > 0 else 0.0
            new_start = max(start - PRE_ROLL, prev_end)
            times[i] = (new_start, end)

    # Build TimedBeat objects
    result: list[TimedBeat] = []
    for i, beat in enumerate(beats):
        start, end = times[i]
        result.append(TimedBeat(
            beat_type=beat.beat_type,
            index=beat.index,
            start_sec=round(start, 2),
            end_sec=round(end, 2),
            thai=beat.thai,
            translit=beat.translit,
            gloss=beat.gloss,
            english=beat.english,
            perform_text=beat.perform_text,
            buzzer_label=beat.buzzer_label,
            pause_seconds=beat.pause_seconds,
            direction=beat.direction,
            english_line_text=beat.english_line_text,
            classifier=beat.classifier,
        ))

    return result


# ---------------------------------------------------------------------------
# Even distribution (no transcript available)
# ---------------------------------------------------------------------------


def _distribute_evenly(beats: list[Beat], total_duration: float) -> list[TimedBeat]:
    """Distribute beats evenly across the total duration.

    Used when no transcript is available. Gives pause beats their
    full pause_seconds, distributes remaining time evenly.
    """
    # Calculate time needed for pauses
    pause_time = sum(
        b.pause_seconds for b in beats if b.beat_type == "pause_challenge"
    )
    remaining = max(total_duration - pause_time, 0)
    non_pause_count = sum(1 for b in beats if b.beat_type != "pause_challenge")
    slot = remaining / max(non_pause_count, 1)

    result: list[TimedBeat] = []
    cursor = 0.0

    for beat in beats:
        if beat.beat_type == "pause_challenge":
            dur = beat.pause_seconds
        else:
            dur = slot

        result.append(TimedBeat(
            beat_type=beat.beat_type,
            index=beat.index,
            start_sec=round(cursor, 2),
            end_sec=round(cursor + dur, 2),
            thai=beat.thai,
            translit=beat.translit,
            gloss=beat.gloss,
            english=beat.english,
            perform_text=beat.perform_text,
            buzzer_label=beat.buzzer_label,
            pause_seconds=beat.pause_seconds,
            direction=beat.direction,
            english_line_text=beat.english_line_text,
            classifier=beat.classifier,
        ))
        cursor += dur

    return result


# ---------------------------------------------------------------------------
# Manual CSV alignment
# ---------------------------------------------------------------------------


def align_beats_manual(
    beats: list[Beat],
    segments: list[TranscriptSegment],
) -> list[TimedBeat]:
    """Align beats using manual timestamp CSV.

    Each CSV row maps to a beat by index. If there are fewer CSV rows
    than beats, remaining beats are distributed in the remaining time.
    """
    result: list[TimedBeat] = []

    for i, beat in enumerate(beats):
        if i < len(segments):
            seg = segments[i]
            start, end = seg.start_sec, seg.end_sec
        else:
            # Beyond CSV rows — estimate from last known time
            last_end = segments[-1].end_sec if segments else 0.0
            remaining_beats = len(beats) - i
            slot = 2.0  # default 2s per beat
            start = last_end + (i - len(segments)) * slot
            end = start + slot

        result.append(TimedBeat(
            beat_type=beat.beat_type,
            index=beat.index,
            start_sec=round(start, 2),
            end_sec=round(end, 2),
            thai=beat.thai,
            translit=beat.translit,
            gloss=beat.gloss,
            english=beat.english,
            perform_text=beat.perform_text,
            buzzer_label=beat.buzzer_label,
            pause_seconds=beat.pause_seconds,
            direction=beat.direction,
            english_line_text=beat.english_line_text,
            classifier=beat.classifier,
        ))

    return result


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def _add_display_until(timed_beats: list[TimedBeat]) -> list[dict]:
    """Add `display_until` to each beat dict.

    For visual beats (triplet, perform, english_line, buzzer), content should
    linger on screen until the next beat that needs the screen.  This means
    `display_until` = start_sec of the next beat (any type), since even a
    stage_direction should clear the overlay to show the teacher's face.

    For non-visual beats (stage_direction, reveal, pause_challenge),
    display_until = end_sec (they don't show persistent content).
    """
    dicts = [asdict(tb) for tb in timed_beats]
    visual_types = {"thai_triplet", "perform", "english_line", "buzzer"}

    for i, d in enumerate(dicts):
        if d["beat_type"] in visual_types:
            # Find the start of the next beat (any type)
            if i + 1 < len(dicts):
                d["display_until"] = dicts[i + 1]["start_sec"]
            else:
                # Last beat — linger for 2 extra seconds or to end
                d["display_until"] = d["end_sec"] + 2.0
        else:
            d["display_until"] = d["end_sec"]

    return dicts


def timed_beats_to_json(timed_beats: list[TimedBeat]) -> str:
    """Serialize TimedBeat list to JSON (the TimedBeatSheet).

    Includes `display_until` — the time each visual should stay on screen.
    """
    dicts = _add_display_until(timed_beats)
    return json.dumps(dicts, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    from parse_script_beats import parse_episode_script

    if len(sys.argv) < 3:
        print("Usage: python align_beats.py <script.md> <duration_sec>")
        print("  Distributes beats evenly (for testing without audio)")
        sys.exit(1)

    script_path = sys.argv[1]
    duration = float(sys.argv[2])

    beats = parse_episode_script(script_path)
    timed = _distribute_evenly(beats, duration)

    print(f"Distributed {len(timed)} beats across {duration}s:")
    for tb in timed:
        label = tb.thai or tb.perform_text or tb.english_line_text or tb.direction or tb.beat_type
        print(f"  [{tb.start_sec:6.1f}-{tb.end_sec:6.1f}] {tb.beat_type:18s} {label[:50]}")
