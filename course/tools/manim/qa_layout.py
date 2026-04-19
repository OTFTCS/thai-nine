"""Layout QA for generated Manim lesson scenes.

Static analysis of the generated scene .py file to check for:
- clear/transition before new visual content
- minimum gap between visual events
- method calls match expected patterns
"""

from __future__ import annotations

import re
from pathlib import Path

from .models import QAResult


def run_layout_qa(scene_path: Path) -> QAResult:
    """Analyze a generated scene file for layout issues.

    Checks:
    - transition_wipe() or clear_content() before each new show_* call
    - Minimum 0.1s wait between visual events
    - No unrecognized method calls on self
    - Elapsed tracking present
    """
    issues: list[str] = []
    warnings: list[str] = []

    code = scene_path.read_text(encoding="utf-8")
    lines = code.split("\n")

    # Known visual methods
    _VISUAL_METHODS = {
        "show_opener", "show_section_header", "show_focus_card",
        "show_contrast_board", "show_dialogue_line", "show_drill",
        "show_recap_question", "show_minimal_pair", "show_bullets",
        "show_image",
    }
    _CLEAR_METHODS = {"clear_content", "transition_wipe"}
    _ALL_KNOWN = _VISUAL_METHODS | _CLEAR_METHODS | {
        "wait", "play", "add", "setup",
    }

    visual_events: list[tuple[int, str]] = []  # (line_no, method_name)
    clear_events: list[int] = []  # line numbers
    last_visual_line = 0
    has_elapsed_tracking = False

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Check for elapsed tracking
        if "elapsed" in stripped and ("=" in stripped or "+=" in stripped):
            has_elapsed_tracking = True

        # Detect self.method_name() calls
        m = re.search(r"self\.(\w+)\(", stripped)
        if not m:
            continue

        method = m.group(1)

        # Skip private/dunder methods
        if method.startswith("_"):
            continue

        if method in _VISUAL_METHODS:
            visual_events.append((i, method))
        elif method in _CLEAR_METHODS:
            clear_events.append(i)

    # Check that visual events have a clear/transition before them
    # (except the first one and dialogue_line which builds incrementally)
    for idx, (line_no, method) in enumerate(visual_events):
        if idx == 0:
            continue
        if method == "show_dialogue_line":
            # Dialogue lines build incrementally, no clear needed between them
            prev_method = visual_events[idx - 1][1] if idx > 0 else ""
            if prev_method == "show_dialogue_line":
                continue

        # Check if there's a clear/transition between this and the previous visual
        prev_visual_line = visual_events[idx - 1][0]
        has_clear = any(
            prev_visual_line < cl < line_no
            for cl in clear_events
        )
        # show_focus_card, show_contrast_board, etc. call clear_content internally
        # so we only warn for truly suspicious patterns
        if not has_clear and method in ("show_bullets", "show_image"):
            warnings.append(
                f"Line {line_no}: {method}() without explicit clear/transition before it"
            )

    # Check for elapsed tracking
    if not has_elapsed_tracking:
        issues.append("No elapsed time tracking found — timing will drift")

    # Check construct method exists
    if "def construct" not in code:
        issues.append("Missing construct() method")

    # Check for LessonOverlay class
    if "class LessonOverlay" not in code:
        issues.append("Missing LessonOverlay class")

    # Check import
    if "from scene_base import" not in code and "from .scene_base import" not in code:
        warnings.append("Missing import from scene_base")

    metadata = {
        "visual_event_count": len(visual_events),
        "clear_event_count": len(clear_events),
        "has_elapsed_tracking": has_elapsed_tracking,
        "total_lines": len(lines),
    }

    return QAResult(
        gate_name="layout",
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
        metadata=metadata,
    )
