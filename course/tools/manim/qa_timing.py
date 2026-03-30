"""Timing QA for the Manim lesson pipeline.

Validates that TimedSlide[] has sane timing: no overlaps, no impossibly
short beats, no huge gaps, monotonic timestamps.
"""

from __future__ import annotations

from .types import QAResult, TimedSlide


def run_timing_qa(
    timed_slides: list[TimedSlide],
    recording_duration: float | None = None,
) -> QAResult:
    """Validate timing alignment of slides.

    Checks:
    - No overlapping slides
    - No slide shorter than 3s (transition) or 5s (teaching)
    - No gap > 15s between consecutive slides
    - Monotonic start times
    - Total span within 10% of recording duration
    """
    issues: list[str] = []
    warnings: list[str] = []
    max_gap = 0.0

    for i, ts in enumerate(timed_slides):
        prefix = f"Slide {ts.slide.id}"

        # Duration check
        slide_dur = ts.end_sec - ts.start_sec
        if slide_dur < 0:
            issues.append(f"{prefix}: negative duration ({slide_dur:.1f}s)")
        elif ts.slide.role == "teaching" and slide_dur < 5.0:
            warnings.append(f"{prefix}: very short teaching slide ({slide_dur:.1f}s)")
        elif slide_dur < 3.0:
            warnings.append(f"{prefix}: very short slide ({slide_dur:.1f}s)")

        # Overlap with next slide
        if i + 1 < len(timed_slides):
            next_ts = timed_slides[i + 1]
            if ts.end_sec > next_ts.start_sec + 0.01:
                issues.append(
                    f"{prefix}: overlaps with {next_ts.slide.id} "
                    f"({ts.end_sec:.1f}s > {next_ts.start_sec:.1f}s)"
                )

            # Gap check
            gap = next_ts.start_sec - ts.end_sec
            max_gap = max(max_gap, gap)
            if gap > 15.0:
                warnings.append(
                    f"{prefix} → {next_ts.slide.id}: large gap ({gap:.1f}s)"
                )

        # Monotonic start times
        if i > 0:
            prev_ts = timed_slides[i - 1]
            if ts.start_sec < prev_ts.start_sec:
                issues.append(
                    f"{prefix}: non-monotonic start "
                    f"({ts.start_sec:.1f}s < {prev_ts.start_sec:.1f}s)"
                )

        # Sub-event validation
        for j, ev in enumerate(ts.events):
            ev_prefix = f"{prefix}/event[{j}]"
            ev_dur = ev.end_sec - ev.start_sec
            if ev_dur < 0:
                issues.append(f"{ev_prefix}: negative duration ({ev_dur:.1f}s)")
            if ev.start_sec < ts.start_sec - 0.01:
                issues.append(f"{ev_prefix}: starts before slide ({ev.start_sec:.1f}s < {ts.start_sec:.1f}s)")
            if ev.end_sec > ts.end_sec + 0.5:
                warnings.append(f"{ev_prefix}: ends after slide ({ev.end_sec:.1f}s > {ts.end_sec:.1f}s)")

            # Overlap with next event
            if j + 1 < len(ts.events):
                next_ev = ts.events[j + 1]
                if ev.end_sec > next_ev.start_sec + 0.01:
                    issues.append(
                        f"{ev_prefix}: overlaps next event "
                        f"({ev.end_sec:.1f}s > {next_ev.start_sec:.1f}s)"
                    )

    # Per-event drift check (against expected cumulative timing)
    cumulative = 0.0
    for i, ts in enumerate(timed_slides):
        expected_start = ts.start_sec
        drift_from_expected = abs(cumulative - expected_start)
        prefix = f"Slide {ts.slide.id}"

        if drift_from_expected > 1.0:
            issues.append(
                f"{prefix}: cumulative drift {drift_from_expected:.1f}s exceeds 1.0s "
                f"(expected start={expected_start:.1f}s)"
            )
        elif drift_from_expected > 0.5:
            warnings.append(
                f"{prefix}: cumulative drift {drift_from_expected:.1f}s "
                f"(expected start={expected_start:.1f}s)"
            )

        cumulative = ts.end_sec

    # Total duration check — tighter: ≤2.0s absolute drift
    if timed_slides:
        total_span = timed_slides[-1].end_sec - timed_slides[0].start_sec
        if recording_duration:
            drift = abs(total_span - recording_duration)
            if drift > 2.0:
                issues.append(
                    f"Total span ({total_span:.1f}s) differs from recording "
                    f"({recording_duration:.1f}s) by {drift:.1f}s (threshold: 2.0s)"
                )
            elif drift > 1.0:
                warnings.append(
                    f"Total span ({total_span:.1f}s) differs from recording "
                    f"({recording_duration:.1f}s) by {drift:.1f}s"
                )
    else:
        total_span = 0.0

    metadata = {
        "slide_count": len(timed_slides),
        "total_span_sec": round(total_span, 1),
        "max_gap_sec": round(max_gap, 1),
    }
    if recording_duration:
        metadata["recording_duration_sec"] = round(recording_duration, 1)

    return QAResult(
        gate_name="timing",
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
        metadata=metadata,
    )
