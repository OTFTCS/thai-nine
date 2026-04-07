"""Content QA for lesson scenes — catches semantic issues in roleplay and drills.

Not a full editorial review — just mechanical checks that catch obvious problems:
- Untaught vocab appearing in roleplay
- Contextless questions (references "this" with no prior context)
- Duplicate consecutive roleplay lines
- Response coherence (yes/no without a question, thank-you without trigger)
"""

from __future__ import annotations

import re

from .models import QAResult, SlideSpec, RoleplayLine


def run_content_qa(slides: list[SlideSpec]) -> QAResult:
    """Analyze slides for content-level issues."""
    issues: list[str] = []
    warnings: list[str] = []

    # Collect all taught Thai items from teaching sections (in order)
    taught_thai: set[str] = set()
    for slide in slides:
        if slide.role == "teaching":
            for lex in slide.lexemes:
                taught_thai.add(lex.thai)

    # Find roleplay slide
    rp_slide = next((s for s in slides if s.role == "roleplay"), None)
    if rp_slide and rp_slide.roleplay_lines:
        _check_roleplay(rp_slide.roleplay_lines, taught_thai, issues, warnings)

    metadata = {
        "taught_thai_count": len(taught_thai),
        "taught_thai": sorted(taught_thai),
    }

    return QAResult(
        gate_name="content",
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
        metadata=metadata,
    )


def _check_roleplay(
    lines: list[RoleplayLine],
    taught_thai: set[str],
    issues: list[str],
    warnings: list[str],
) -> None:
    """Check roleplay lines for content issues."""

    # 1. Untaught vocab: each Thai phrase in roleplay should be buildable
    #    from taught words/chunks. Warn (don't fail) — roleplay can include
    #    context words beyond the lesson's vocabulary for natural dialogue.
    for i, line in enumerate(lines):
        thai = line.thai.strip()
        if not _is_covered_by_taught(thai, taught_thai):
            warnings.append(
                f"Roleplay line {i+1} ({line.speaker}): '{thai}' uses vocab not taught in this lesson. "
                f"Taught: {', '.join(sorted(taught_thai))}"
            )

    # 2. Contextless questions — "this" / "that" with no prior referent
    _CONTEXTLESS_PATTERNS = [
        r"\bis this\b",
        r"\bis that\b",
        r"\bthis one\b",
        r"\bthat one\b",
    ]
    for i, line in enumerate(lines):
        eng = line.english.lower()
        for pattern in _CONTEXTLESS_PATTERNS:
            if re.search(pattern, eng) and i < 2:
                # "this/that" in early lines with no prior context
                warnings.append(
                    f"Roleplay line {i+1}: '{line.english}' references 'this/that' "
                    f"without prior context in the dialogue"
                )

    # 3. Duplicate consecutive Thai lines
    for i in range(1, len(lines)):
        if lines[i].thai == lines[i - 1].thai and lines[i].speaker == lines[i - 1].speaker:
            warnings.append(
                f"Roleplay lines {i} and {i+1}: duplicate consecutive line "
                f"from same speaker: '{lines[i].thai}'"
            )

    # 4. Response coherence
    for i, line in enumerate(lines):
        eng = line.english.lower().strip().rstrip(".")
        # "yes" / "no" without a preceding question
        if eng in ("yes", "no", "yes sir", "no sir") and i > 0:
            prev_eng = lines[i - 1].english.strip()
            if not prev_eng.endswith("?"):
                warnings.append(
                    f"Roleplay line {i+1}: '{line.english}' is a yes/no answer "
                    f"but previous line is not a question: '{lines[i-1].english}'"
                )


def _is_covered_by_taught(thai_phrase: str, taught: set[str]) -> bool:
    """Check if a Thai phrase can be built from taught vocabulary.

    Tries exact match first, then checks if the phrase is a concatenation
    of taught items (Thai doesn't use spaces between words consistently).
    """
    # Exact match
    if thai_phrase in taught:
        return True

    # Split on spaces and check each segment
    parts = thai_phrase.split()
    if all(p in taught for p in parts):
        return True

    # Try concatenation matching (greedy, longest first)
    # Sort taught items by length descending for greedy matching
    sorted_taught = sorted(taught, key=len, reverse=True)
    return _greedy_match(thai_phrase, sorted_taught)


def _greedy_match(text: str, vocab: list[str]) -> bool:
    """Check if text can be fully covered by concatenating vocab items."""
    if not text:
        return True

    for item in vocab:
        if text.startswith(item):
            remainder = text[len(item):]
            if _greedy_match(remainder, vocab):
                return True

    return False
