"""Post-ingest QA gate for the Manim lesson pipeline.

Validates that ingested SlideSpec[] data is complete, consistent,
and has correct PTM transliteration before scene generation.
"""

from __future__ import annotations

from .types import QAResult, SlideSpec
from .qa_transliteration import validate_translit


def run_ingest_qa(slides: list[SlideSpec]) -> QAResult:
    """Validate ingested slides. Returns QAResult with pass/fail and issues."""
    issues: list[str] = []
    warnings: list[str] = []

    if len(slides) < 3:
        issues.append(f"Too few slides: {len(slides)} (minimum 3: opener + teaching + recap)")

    teaching_count = sum(1 for s in slides if s.role == "teaching")
    if teaching_count < 4:
        warnings.append(f"Only {teaching_count} teaching sections (expected 4+)")

    has_roleplay = any(s.role == "roleplay" for s in slides)
    has_recap = any(s.role == "recap" for s in slides)

    if not has_roleplay:
        warnings.append("No roleplay slide found")
    if not has_recap:
        issues.append("No recap slide found")

    for slide in slides:
        prefix = f"Slide {slide.id}"

        # Teaching slides must have lexemes and drills
        if slide.role == "teaching":
            if not slide.lexemes:
                warnings.append(f"{prefix}: no lexemes in teaching slide")
            if not slide.drills:
                warnings.append(f"{prefix}: no drills in teaching slide")

        # Validate all lexeme transliterations
        for lex in slide.lexemes:
            if not lex.thai:
                issues.append(f"{prefix}: lexeme missing Thai text")
            if not lex.english:
                issues.append(f"{prefix}: lexeme missing English for '{lex.thai}'")
            if not lex.translit:
                issues.append(f"{prefix}: lexeme missing transliteration for '{lex.thai}'")
            else:
                translit_issues = validate_translit(lex.translit)
                for ti in translit_issues:
                    issues.append(f"{prefix}: translit '{lex.translit}' — {ti}")

        # Validate roleplay lines
        if slide.roleplay_lines:
            if len(slide.roleplay_lines) < 6:
                warnings.append(f"{prefix}: roleplay has {len(slide.roleplay_lines)} lines (expected 6+)")
            for j, line in enumerate(slide.roleplay_lines):
                if not line.thai or not line.translit or not line.english:
                    issues.append(f"{prefix}: roleplay line {j+1} has incomplete triplet")
                elif line.translit:
                    translit_issues = validate_translit(line.translit)
                    for ti in translit_issues:
                        issues.append(f"{prefix}: roleplay translit '{line.translit}' — {ti}")

        # Validate recap items
        if slide.recap_items is not None and len(slide.recap_items) < 3:
            warnings.append(f"{prefix}: recap has {len(slide.recap_items)} items (expected 3+)")

        # Validate minimal pairs
        if slide.minimal_pairs:
            for pair in slide.minimal_pairs:
                for side, lex in [("a", pair.a), ("b", pair.b)]:
                    if not lex.thai or not lex.translit:
                        issues.append(f"{prefix}: minimal pair {side} incomplete")
                    elif lex.translit:
                        translit_issues = validate_translit(lex.translit)
                        for ti in translit_issues:
                            issues.append(f"{prefix}: minimal pair {side} translit — {ti}")

        # Estimated seconds sanity
        if slide.estimated_seconds < 5:
            warnings.append(f"{prefix}: very short slide ({slide.estimated_seconds:.1f}s)")
        if slide.estimated_seconds > 120:
            warnings.append(f"{prefix}: very long slide ({slide.estimated_seconds:.1f}s)")

    total_est = sum(s.estimated_seconds for s in slides)
    metadata = {
        "slide_count": len(slides),
        "teaching_count": teaching_count,
        "total_estimated_seconds": round(total_est, 1),
        "lexeme_count": sum(len(s.lexemes) for s in slides),
    }

    passed = len(issues) == 0
    return QAResult(
        gate_name="ingest",
        passed=passed,
        issues=issues,
        warnings=warnings,
        metadata=metadata,
    )
