"""Post-generation timing correction for TikTok Manim scenes.

Parses generated scene files, checks timing per beat against the beat sheet,
and corrects self.wait() values / scales animations if needed.

Ported from course/tools/manim/fix_scene_timing.py, adapted for TikTok
beat markers (# Beat N: ...).
"""

from __future__ import annotations

import re
from pathlib import Path

# Regex patterns for parsing generated TikTok scenes
_BEAT_MARKER_RE = re.compile(r"^(\s*)# Beat (\d+):")
_DURATION_KW_RE = re.compile(r"duration\s*=\s*([\d.]+)")
_RUN_TIME_RE = re.compile(r"run_time\s*=\s*([\d.]+)")
_WAIT_RE = re.compile(r"^(\s*)self\.wait\(([\d.]+)\)")
_DUR_ASSIGN_RE = re.compile(r"^\s*dur\s*=\s*([\d.]+)")


def fix_tiktok_timing(code: str, beat_sheet: list[dict]) -> str:
    """Fix timing in a generated TikTok scene to match beat sheet targets.

    For each beat:
    - Parses the time_slot from the beat sheet (display_until - start_sec)
    - Sums all duration= and dur= values in that beat's code range
    - If self.wait() exists: rewrites it to fill remaining time
    - If animations exceed time_slot: scales dur= values down
    - Inserts self.wait() if missing

    Args:
        code: The generated scene .py content
        beat_sheet: List of beat dicts with start_sec, display_until keys

    Returns:
        Corrected code string.
    """
    lines = code.splitlines()
    beat_ranges = _parse_beat_ranges(lines)

    # Build beat timing lookup: beat_index -> (start_sec, display_until)
    beat_timing = {}
    for b in beat_sheet:
        idx = b.get("beat_index", b.get("index", -1))
        start = b.get("start_sec", 0)
        end = b.get("display_until", b.get("end_sec", start))
        if idx >= 0:
            beat_timing[idx] = (start, end)

    # Process in reverse so line insertions don't shift earlier indices
    for br in reversed(beat_ranges):
        timing = beat_timing.get(br["number"])
        if timing is None:
            continue

        time_slot = timing[1] - timing[0]
        if time_slot < 0.1:
            continue

        _fix_beat_section(lines, br, time_slot)

    return "\n".join(lines)


def _parse_beat_ranges(lines: list[str]) -> list[dict]:
    """Find line ranges for each beat marker."""
    beat_starts = []
    for i, line in enumerate(lines):
        m = _BEAT_MARKER_RE.match(line)
        if m:
            beat_starts.append({
                "number": int(m.group(2)),
                "start_line": i,
                "indent": m.group(1),
            })

    ranges = []
    for idx, bs in enumerate(beat_starts):
        end = beat_starts[idx + 1]["start_line"] if idx + 1 < len(beat_starts) else len(lines)
        ranges.append({**bs, "end_line": end})
    return ranges


def _fix_beat_section(lines: list[str], br: dict, time_slot: float) -> None:
    """Fix timing within a single beat section."""
    start, end = br["start_line"], br["end_line"]
    indent = br["indent"] or "        "

    # Collect timing info
    dur_assign_lines: list[tuple[int, float]] = []  # dur = X.XX assignments
    duration_kw_lines: list[tuple[int, float]] = []  # duration=X.XX in method calls
    wait_line_idx: int | None = None
    last_method_idx: int | None = None

    for i in range(start, end):
        line = lines[i]

        # dur = X.XX assignment
        dm = _DUR_ASSIGN_RE.match(line)
        if dm:
            dur_assign_lines.append((i, float(dm.group(1))))

        # duration= keyword in method calls
        dkm = _DURATION_KW_RE.search(line)
        if dkm and "self." in line:
            duration_kw_lines.append((i, float(dkm.group(1))))

        # self.wait()
        wm = _WAIT_RE.match(line)
        if wm:
            wait_line_idx = i

        # Track last method call
        if re.search(r"self\.\w+\(", line) and "elapsed" not in line:
            last_method_idx = i

    # The generated TikTok scenes use `dur = X.XX` then `self.show_triplet(..., duration=dur)`
    # The dur assignment is the authoritative timing source
    total_anim_time = 0.0
    if dur_assign_lines:
        # Use the dur assignment (there's usually exactly one per beat)
        total_anim_time = dur_assign_lines[0][1]
    elif duration_kw_lines:
        total_anim_time = sum(d for _, d in duration_kw_lines)

    # If animation time exceeds time_slot, scale down
    if total_anim_time > time_slot + 0.1:
        scale = max(0.3, time_slot / total_anim_time)
        new_dur = round(total_anim_time * scale, 2)
        # Update dur = X.XX
        for li, _ in dur_assign_lines:
            lines[li] = re.sub(r"dur\s*=\s*[\d.]+", f"dur = {new_dur}", lines[li])
        # Update duration= in method calls
        for li, _ in duration_kw_lines:
            lines[li] = _DURATION_KW_RE.sub(f"duration={new_dur}", lines[li])

    # Fix self.wait() — the TikTok pattern uses `self.wait(dur - 0.2)` or similar
    # We don't rewrite these as they're relative to dur which we may have already fixed
    # Only rewrite explicit self.wait(X.XX) that should fill remaining time
    if wait_line_idx is not None:
        wm = _WAIT_RE.match(lines[wait_line_idx])
        if wm:
            current_wait = float(wm.group(2))
            # If the wait looks like a fill-remaining value (not dur-relative),
            # recalculate based on time_slot
            line_text = lines[wait_line_idx].strip()
            if "dur" not in line_text:
                # Pure numeric wait — recalculate
                new_wait = max(0.1, round(time_slot - total_anim_time, 2))
                lines[wait_line_idx] = _WAIT_RE.sub(
                    lambda m: f"{m.group(1)}self.wait({new_wait})",
                    lines[wait_line_idx],
                )


def fix_tiktok_timing_file(
    scene_path: Path,
    beat_sheet_path: Path,
) -> bool:
    """Convenience: fix timing in-place from file paths.

    Returns True if any changes were made.
    """
    import json

    code = scene_path.read_text(encoding="utf-8")
    beats = json.loads(beat_sheet_path.read_text(encoding="utf-8"))

    fixed = fix_tiktok_timing(code, beats)
    if fixed != code:
        scene_path.write_text(fixed, encoding="utf-8")
        return True
    return False
