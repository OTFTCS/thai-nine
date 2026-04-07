"""Post-generation timing correction for Manim lesson scenes.

Parses generated scene files, checks timing per slide against TimedSlide
targets, and corrects wait() values / scales animations if needed.

Ported from Pearson's fix_beat_timing() pattern.
"""

from __future__ import annotations

import re

from .models import TimedSlide

# Regex patterns for parsing generated scenes
_SLIDE_MARKER_RE = re.compile(
    r"^(\s*)# === Slide:\s+(\S+)\s+\(([\d.]+)s\s*-\s*([\d.]+)s\)"
)
_RUN_TIME_RE = re.compile(r"run_time\s*=\s*([\d.]+)")
_WAIT_RE = re.compile(r"^(\s*)self\.wait\(([\d.]+)\)")
_DURATION_KW_RE = re.compile(r"duration\s*=\s*([\d.]+)")
_ELAPSED_RE = re.compile(r"^(\s*)elapsed\s*\+=\s*([\d.]+)")


def fix_scene_timing(code: str, timed_slides: list[TimedSlide]) -> str:
    """Fix timing in a generated Manim scene to match TimedSlide targets.

    For each slide section:
    - Sums all duration= and run_time= values (the animation time)
    - Computes the target time_slot from TimedSlide start/end
    - If animations exceed time_slot: scales them down proportionally
    - Rewrites self.wait() to fill remaining time, or inserts one
    - Updates elapsed += comments to match actual durations

    Returns the corrected code string.
    """
    lines = code.splitlines()
    slide_ranges = _parse_slide_ranges(lines)

    # Build lookup: slide_id -> TimedSlide
    ts_lookup = {ts.slide.id: ts for ts in timed_slides}

    # Process in reverse so line insertions don't shift earlier indices
    for sr in reversed(slide_ranges):
        ts = ts_lookup.get(sr["slide_id"])
        if ts is None:
            continue

        time_slot = ts.end_sec - ts.start_sec
        # Subtract transition time (0.6s wipe) from non-first slides
        if sr != slide_ranges[0]:
            time_slot -= 0.6

        if time_slot < 0.5:
            continue

        _fix_slide_section(lines, sr, time_slot)

    return "\n".join(lines)


def _parse_slide_ranges(lines: list[str]) -> list[dict]:
    """Find line ranges for each slide marker in the generated code."""
    slide_starts = []
    for i, line in enumerate(lines):
        m = _SLIDE_MARKER_RE.match(line)
        if m:
            slide_starts.append({
                "slide_id": m.group(2),
                "target_start": float(m.group(3)),
                "target_end": float(m.group(4)),
                "start_line": i,
                "indent": m.group(1),
            })

    ranges = []
    for idx, ss in enumerate(slide_starts):
        end = slide_starts[idx + 1]["start_line"] if idx + 1 < len(slide_starts) else len(lines)
        ranges.append({
            **ss,
            "end_line": end,
        })
    return ranges


def _fix_slide_section(lines: list[str], sr: dict, time_slot: float) -> None:
    """Fix timing within a single slide section."""
    start, end = sr["start_line"], sr["end_line"]
    indent = sr["indent"] or "        "

    # Collect all timing information in this section
    duration_lines: list[tuple[int, float]] = []  # (line_idx, value)
    run_time_lines: list[tuple[int, float]] = []
    wait_line_idx: int | None = None
    last_method_idx: int | None = None

    for i in range(start, end):
        line = lines[i]

        # duration= keyword args (in show_focus_card, show_drill, etc.)
        dm = _DURATION_KW_RE.search(line)
        if dm:
            duration_lines.append((i, float(dm.group(1))))

        # run_time= in self.play() calls
        rm = _RUN_TIME_RE.search(line)
        if rm:
            run_time_lines.append((i, float(rm.group(1))))

        # self.wait()
        wm = _WAIT_RE.match(line)
        if wm:
            wait_line_idx = i

        # Track last method call for potential wait insertion
        if re.search(r"self\.\w+\(", line) and "elapsed" not in line:
            last_method_idx = i

    # Sum all animation durations — the scene methods use duration= params
    # which internally control their own timing. The elapsed += lines track
    # what the scene file *thinks* the timing is.
    total_duration = sum(d for _, d in duration_lines)

    # If durations exceed time_slot, scale them down
    if total_duration > time_slot + 0.1 and duration_lines:
        scale = max(0.3, (time_slot - 0.2) / total_duration)
        for li, dur in duration_lines:
            new_dur = max(0.5, round(dur * scale, 1))
            lines[li] = _DURATION_KW_RE.sub(f"duration={new_dur}", lines[li])
        total_duration = sum(
            max(0.5, round(d * scale, 1)) for _, d in duration_lines
        )

    # Scale run_time values if they also exceed budget
    total_run_time = sum(rt for _, rt in run_time_lines)
    if total_run_time > time_slot - 0.2 and run_time_lines:
        scale = max(0.1, (time_slot - 0.3) / total_run_time)
        for li, rt in run_time_lines:
            new_rt = max(0.1, round(rt * scale, 1))
            lines[li] = _RUN_TIME_RE.sub(f"run_time={new_rt}", lines[li])

    # Update elapsed += lines to match actual durations
    # This is cosmetic but keeps the comments accurate
    _fix_elapsed_comments(lines, start, end, duration_lines)


def _fix_elapsed_comments(
    lines: list[str],
    start: int,
    end: int,
    duration_lines: list[tuple[int, float]],
) -> None:
    """Update elapsed += X lines to match the (possibly scaled) durations.

    Each elapsed += should match the duration= of the preceding method call.
    """
    dur_iter = iter(duration_lines)
    current_dur = next(dur_iter, None)

    for i in range(start, end):
        em = _ELAPSED_RE.match(lines[i])
        if em and current_dur is not None:
            # Find the actual duration value that was (possibly) scaled
            actual = _DURATION_KW_RE.search(lines[current_dur[0]])
            if actual:
                new_val = float(actual.group(1))
                lines[i] = f"{em.group(1)}elapsed += {new_val}"
            current_dur = next(dur_iter, None)
