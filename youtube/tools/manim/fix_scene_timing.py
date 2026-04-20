"""Post-generation timing correction for YouTube Manim scenes.

Parses generated scene files, checks timing per block against overlay
targets, and corrects wait() values / scales animations if needed.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

# Regex patterns for parsing generated scenes
_BLOCK_MARKER_RE = re.compile(
    r"^(\s*)# === Block:\s+(\S+)\s+\((\w[\w-]*)\)"
)
_DURATION_KW_RE = re.compile(r"duration\s*=\s*([\d.]+)")
_WAIT_RE = re.compile(r"^(\s*)self\.wait\(([\d.]+)\)")
_ELAPSED_ASSIGN_RE = re.compile(r"^(\s*)elapsed\s*=\s*([\d.]+)")
_ELAPSED_PLUS_RE = re.compile(r"^(\s*)elapsed\s*\+=\s*([\d.]+)")


def fix_scene_timing(code: str, overlays: list[dict]) -> str:
    """Fix timing in a generated Manim scene to match overlay targets.

    For each block section:
    - Sums all duration= values (the animation time)
    - Computes the target time_slot from block's first/last overlay
    - If animations exceed time_slot: scales them down proportionally
    - Updates elapsed comments to match actual durations

    Returns the corrected code string.
    """
    lines = code.splitlines()
    block_ranges = _parse_block_ranges(lines)

    # Build block timing from overlays
    block_timing = _compute_block_timing(overlays)

    # Process in reverse so line insertions don't shift earlier indices
    for br in reversed(block_ranges):
        block_id = br["block_id"]
        if block_id not in block_timing:
            continue

        bt = block_timing[block_id]
        time_slot = bt["end"] - bt["start"]

        if time_slot < 0.5:
            continue

        _fix_block_section(lines, br, time_slot)

    return "\n".join(lines)


def _compute_block_timing(overlays: list[dict]) -> dict[str, dict]:
    """Compute start/end times for each block from overlays."""
    blocks: dict[str, dict] = {}
    for ov in overlays:
        bid = ov["blockId"]
        if bid not in blocks:
            blocks[bid] = {
                "start": ov["displayStart"],
                "end": ov["displayEnd"],
            }
        else:
            blocks[bid]["start"] = min(blocks[bid]["start"], ov["displayStart"])
            blocks[bid]["end"] = max(blocks[bid]["end"], ov["displayEnd"])
    return blocks


def _parse_block_ranges(lines: list[str]) -> list[dict]:
    """Find line ranges for each block marker in the generated code."""
    block_starts = []
    for i, line in enumerate(lines):
        m = _BLOCK_MARKER_RE.match(line)
        if m:
            block_starts.append({
                "block_id": m.group(2),
                "mode": m.group(3),
                "start_line": i,
                "indent": m.group(1),
            })

    ranges = []
    for idx, bs in enumerate(block_starts):
        end = block_starts[idx + 1]["start_line"] if idx + 1 < len(block_starts) else len(lines)
        ranges.append({**bs, "end_line": end})
    return ranges


def _fix_block_section(lines: list[str], br: dict, time_slot: float) -> None:
    """Fix timing within a single block section."""
    start, end = br["start_line"], br["end_line"]

    # Collect all duration= values
    duration_lines: list[tuple[int, float]] = []

    for i in range(start, end):
        line = lines[i]
        dm = _DURATION_KW_RE.search(line)
        if dm:
            duration_lines.append((i, float(dm.group(1))))

    total_duration = sum(d for _, d in duration_lines)

    # If durations exceed time_slot, scale them down
    if total_duration > time_slot + 0.5 and duration_lines:
        scale = max(0.3, (time_slot - 0.5) / total_duration)
        for li, dur in duration_lines:
            new_dur = max(0.5, round(dur * scale, 2))
            lines[li] = _DURATION_KW_RE.sub(f"duration={new_dur}", lines[li])

    # Update elapsed += lines to match actual durations
    dur_iter = iter(duration_lines)
    current_dur = next(dur_iter, None)

    for i in range(start, end):
        em = _ELAPSED_PLUS_RE.match(lines[i])
        if em and current_dur is not None:
            actual = _DURATION_KW_RE.search(lines[current_dur[0]])
            if actual:
                new_val = float(actual.group(1))
                lines[i] = f"{em.group(1)}elapsed += {new_val}"
            current_dur = next(dur_iter, None)
