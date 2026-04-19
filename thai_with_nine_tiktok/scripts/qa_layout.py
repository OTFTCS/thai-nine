"""Layout QA for generated TikTok Manim scenes.

Validates scene structure after generation — catches structural issues
that would cause render failures or visual glitches.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class LayoutQAResult:
    passed: bool
    issues: list[str]
    warnings: list[str]

    def report(self) -> None:
        status = "✓ PASS" if self.passed else "✗ FAIL"
        print(f"  QA [layout]: {status}")
        for issue in self.issues:
            print(f"    ✗ {issue}")
        for warning in self.warnings:
            print(f"    ⚠ {warning}")


def run_layout_qa(scene_path: Path) -> LayoutQAResult:
    """Validate a generated TikTok scene file for structural correctness."""
    code = scene_path.read_text(encoding="utf-8")
    lines = code.splitlines()
    issues: list[str] = []
    warnings: list[str] = []

    # Required class and method
    if "class ThaiTikTokOverlay" not in code:
        issues.append("Missing required class 'ThaiTikTokOverlay'")
    if "ThaiTikTokScene" not in code:
        issues.append("Missing required base class 'ThaiTikTokScene'")
    if "def construct(self)" not in code:
        issues.append("Missing 'construct(self)' method")

    # Check for elapsed tracking
    has_elapsed = "elapsed" in code
    if not has_elapsed:
        warnings.append("No elapsed tracking — timing simulation won't work")

    # Count visual methods
    show_triplet_count = len(re.findall(r"self\.show_triplet\(", code))
    show_perform_count = len(re.findall(r"self\.show_perform\(", code))
    show_english_count = len(re.findall(r"self\.show_english\(", code))
    clear_count = len(re.findall(r"self\.clear_overlay\(", code))

    total_visual = show_triplet_count + show_perform_count + show_english_count
    if total_visual == 0:
        issues.append("No visual methods called (show_triplet, show_perform, show_english)")

    # Check for beat markers
    beat_markers = re.findall(r"# Beat \d+:", code)
    if len(beat_markers) < 3:
        warnings.append(f"Only {len(beat_markers)} beat markers — expected more for a full episode")

    # Check for dangling show_ calls without eventual clear
    # Simple heuristic: if there are show_ calls but no clear_overlay, warn
    if total_visual > 0 and clear_count == 0:
        warnings.append("No clear_overlay() calls — content may accumulate on screen")

    # Check for self.wait() with negative or zero values
    for i, line in enumerate(lines, 1):
        m = re.search(r"self\.wait\(([-\d.]+)\)", line)
        if m:
            wait_val = float(m.group(1))
            if wait_val < 0:
                issues.append(f"Line {i}: negative self.wait({wait_val})")
            elif wait_val == 0:
                warnings.append(f"Line {i}: zero-duration self.wait(0)")

    # Check for duration= with very small values
    for i, line in enumerate(lines, 1):
        m = re.search(r"duration\s*=\s*([\d.]+)", line)
        if m:
            dur = float(m.group(1))
            if dur < 0.3 and "self.show" in line:
                warnings.append(f"Line {i}: very short duration={dur}s — may not be visible")

    # Check monotonic elapsed tracking
    elapsed_values = []
    for i, line in enumerate(lines, 1):
        m = re.search(r"elapsed\s*=\s*([\d.]+)", line)
        if m:
            elapsed_values.append((i, float(m.group(1))))

    for j in range(1, len(elapsed_values)):
        line_num, val = elapsed_values[j]
        prev_line, prev_val = elapsed_values[j - 1]
        if val < prev_val:
            warnings.append(
                f"Line {line_num}: elapsed goes backwards "
                f"({val} < {prev_val} at line {prev_line})"
            )

    return LayoutQAResult(
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
    )
