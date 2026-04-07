"""Layout QA for generated YouTube Manim scenes.

Static analysis of the generated scene .py file.
"""

from __future__ import annotations

import re
from pathlib import Path


def run_layout_qa(scene_path: Path) -> dict:
    """Analyze a generated scene file for layout issues.

    Returns dict with: passed, issues, warnings, metadata.
    """
    issues: list[str] = []
    warnings: list[str] = []

    code = scene_path.read_text(encoding="utf-8")
    lines = code.split("\n")

    # Known visual methods
    _VISUAL_METHODS = {
        "show_thai_line", "show_english_line", "show_translit_line",
        "show_breakdown_triplet", "show_vocab_card", "show_drill_prompt",
        "show_shadowing_line", "show_accumulate", "show_stacked_pair",
    }
    _CLEAR_METHODS = {"clear_overlay", "snap_clear"}
    _ALL_KNOWN = _VISUAL_METHODS | _CLEAR_METHODS | {
        "wait", "play", "add", "remove", "setup",
    }

    visual_count = 0
    clear_count = 0
    block_marker_count = 0
    has_elapsed_tracking = False
    elapsed_count = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Check for elapsed tracking
        if "elapsed" in stripped and ("=" in stripped or "+=" in stripped):
            has_elapsed_tracking = True
            elapsed_count += 1

        # Block markers
        if stripped.startswith("# === Block:"):
            block_marker_count += 1

        # Detect self.method_name() calls
        m = re.search(r"self\.(\w+)\(", stripped)
        if not m:
            continue

        method = m.group(1)
        if method.startswith("_"):
            continue

        if method in _VISUAL_METHODS:
            visual_count += 1
        elif method in _CLEAR_METHODS:
            clear_count += 1

        # Check for zero-duration waits
        wm = re.match(r"\s*self\.wait\((0(?:\.0*)?)\)", stripped)
        if wm:
            warnings.append(f"Line {i}: zero-duration self.wait(0)")

    # Structural checks
    if "class YouTubeOverlay" not in code:
        issues.append("Missing YouTubeOverlay class")

    if "YouTubeScene" not in code:
        issues.append("Missing YouTubeScene base class reference")

    if "def construct" not in code:
        issues.append("Missing construct() method")

    if not has_elapsed_tracking:
        issues.append("No elapsed time tracking found — timing will drift")

    if elapsed_count < 5:
        warnings.append(f"Low elapsed tracking count ({elapsed_count}) — may have drift")

    if block_marker_count < 2:
        warnings.append(f"Only {block_marker_count} block markers found — timing fixer needs these")

    if "from scene_base import" not in code:
        warnings.append("Missing import from scene_base")

    if visual_count < 3:
        warnings.append(f"Very few visual method calls ({visual_count})")

    metadata = {
        "visual_event_count": visual_count,
        "clear_event_count": clear_count,
        "block_marker_count": block_marker_count,
        "elapsed_tracking_count": elapsed_count,
        "total_lines": len(lines),
    }

    return {
        "gate_name": "layout",
        "passed": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "metadata": metadata,
    }
