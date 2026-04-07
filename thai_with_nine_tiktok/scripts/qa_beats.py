"""Pre-generation beat QA — validates parsed beats before sending to Claude.

Catches structural issues that would waste a Claude API call or produce
a broken scene file.
"""

from __future__ import annotations

from dataclasses import dataclass
from parse_script_beats import Beat


@dataclass
class BeatQAResult:
    passed: bool
    issues: list[str]
    warnings: list[str]

    def report(self) -> None:
        status = "✓ PASS" if self.passed else "✗ FAIL"
        print(f"  QA [beats]: {status}")
        for issue in self.issues:
            print(f"    ✗ {issue}")
        for warning in self.warnings:
            print(f"    ⚠ {warning}")


def run_beat_qa(beats: list[Beat]) -> BeatQAResult:
    """Validate beat list for structural completeness."""
    issues: list[str] = []
    warnings: list[str] = []

    # Minimum beat count
    if len(beats) < 5:
        issues.append(f"Only {len(beats)} beats parsed — expected at least 5 for an episode")

    # Check for required beat types
    beat_types = {b.beat_type for b in beats}
    if "thai_triplet" not in beat_types:
        issues.append("No thai_triplet beats found — episode must teach Thai vocabulary")
    if "pause_challenge" not in beat_types:
        warnings.append("No pause_challenge beats — episode has no interactive moments")

    # Validate individual beats
    for i, beat in enumerate(beats):
        prefix = f"Beat {i} ({beat.beat_type})"

        if beat.beat_type == "thai_triplet":
            if not beat.thai.strip():
                issues.append(f"{prefix}: empty Thai text")
            if not beat.translit.strip():
                issues.append(f"{prefix}: empty transliteration")
            if not beat.english.strip() and not beat.gloss.strip():
                issues.append(f"{prefix}: no English meaning or gloss")

        elif beat.beat_type == "perform":
            if not beat.perform_text.strip():
                issues.append(f"{prefix}: empty perform text")

        elif beat.beat_type == "english_line":
            if not beat.english_line_text.strip():
                issues.append(f"{prefix}: empty English line text")

    # Consecutive duplicate thai_triplet check
    prev_thai = ""
    for i, beat in enumerate(beats):
        if beat.beat_type == "thai_triplet":
            if beat.thai == prev_thai and prev_thai:
                warnings.append(
                    f"Beat {i}: duplicate consecutive thai_triplet '{beat.thai}'"
                )
            prev_thai = beat.thai
        else:
            prev_thai = ""

    return BeatQAResult(
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
    )
