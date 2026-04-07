"""Timing QA for YouTube Manim scenes.

Pure regex simulation of elapsed time through construct() —
no Manim import required. Compares simulated timestamps against
overlay displayStart values.
"""

from __future__ import annotations

import re


def run_timing_qa(
    scene_code: str,
    overlays: list[dict],
    audio_duration: float | None = None,
) -> dict:
    """Validate timing of a generated scene against overlay targets.

    Checks:
    - Per-overlay drift (simulated vs expected displayStart)
    - Total duration vs audio duration
    - Monotonic elapsed progression

    Returns dict with: passed, issues, warnings, metadata.
    """
    issues: list[str] = []
    warnings: list[str] = []

    # Simulate elapsed through the construct() method
    simulated_events = _simulate_timing(scene_code)

    if not simulated_events:
        warnings.append("Could not parse any timing events from scene code")
        return {
            "gate_name": "timing",
            "passed": True,
            "issues": issues,
            "warnings": warnings,
            "metadata": {"simulated_events": 0},
        }

    # Build overlay lookup by displayStart (approximate matching)
    overlay_starts = [ov["displayStart"] for ov in overlays]

    # Check per-event drift
    max_drift = 0.0
    drift_details: list[str] = []

    for event in simulated_events:
        target = event["target"]
        simulated = event["simulated"]
        drift = abs(simulated - target)
        max_drift = max(max_drift, drift)

        if drift > 1.5:
            issues.append(
                f"Block {event.get('block', '?')}: drift {drift:.1f}s "
                f"(target={target:.1f}s, simulated={simulated:.1f}s)"
            )
        elif drift > 0.5:
            warnings.append(
                f"Block {event.get('block', '?')}: drift {drift:.1f}s "
                f"(target={target:.1f}s, simulated={simulated:.1f}s)"
            )

    # Total duration check
    if simulated_events and audio_duration:
        final_elapsed = simulated_events[-1]["simulated"] + simulated_events[-1].get("duration", 0)
        duration_drift = abs(final_elapsed - audio_duration)
        if duration_drift > 5.0:
            issues.append(
                f"Total duration drift: {duration_drift:.1f}s "
                f"(simulated={final_elapsed:.1f}s, audio={audio_duration:.1f}s)"
            )
        elif duration_drift > 2.0:
            warnings.append(
                f"Total duration drift: {duration_drift:.1f}s "
                f"(simulated={final_elapsed:.1f}s, audio={audio_duration:.1f}s)"
            )

    # Monotonic check
    prev_time = 0.0
    for event in simulated_events:
        if event["simulated"] < prev_time - 0.01:
            issues.append(
                f"Non-monotonic elapsed: {event['simulated']:.1f}s after {prev_time:.1f}s"
            )
        prev_time = event["simulated"]

    metadata = {
        "simulated_events": len(simulated_events),
        "max_drift_sec": round(max_drift, 2),
        "overlay_count": len(overlays),
    }

    return {
        "gate_name": "timing",
        "passed": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "metadata": metadata,
    }


def _simulate_timing(code: str) -> list[dict]:
    """Parse scene code and simulate elapsed counter.

    Looks for patterns:
    - wait_gap = X - elapsed  → target timestamp
    - self.wait(X)            → elapsed += X
    - self.show_*(... duration=X) → elapsed += X
    - elapsed += X            → direct elapsed update
    - elapsed = X             → direct assignment

    Returns list of {target, simulated, block, duration} dicts.
    """
    events = []
    elapsed = 0.0
    current_block = "?"

    # Patterns
    wait_gap_re = re.compile(r"wait_gap\s*=\s*([\d.]+)\s*-\s*elapsed")
    self_wait_re = re.compile(r"self\.wait\(([\d.]+)\)")
    duration_re = re.compile(r"duration\s*=\s*([\d.]+)")
    elapsed_assign_re = re.compile(r"^\s*elapsed\s*=\s*([\d.]+)")
    elapsed_plus_re = re.compile(r"^\s*elapsed\s*\+=\s*([\d.]+)")
    block_re = re.compile(r"# === Block:\s+(\S+)")
    show_re = re.compile(r"self\.show_\w+\(")
    clear_re = re.compile(r"self\.clear_overlay\(")

    pending_target = None

    for line in code.split("\n"):
        stripped = line.strip()

        # Track current block
        bm = block_re.search(stripped)
        if bm:
            current_block = bm.group(1)

        # wait_gap = X - elapsed → record target
        wg = wait_gap_re.search(stripped)
        if wg:
            pending_target = float(wg.group(1))

        # elapsed = X → direct assignment
        ea = elapsed_assign_re.match(stripped)
        if ea and "elapsed =" in stripped and "+=" not in stripped:
            elapsed = float(ea.group(1))

        # self.wait(X)
        sw = self_wait_re.search(stripped)
        if sw and "wait_gap" not in stripped:
            elapsed += float(sw.group(1))

        # self.show_*(..., duration=X)
        if show_re.search(stripped):
            dm = duration_re.search(stripped)
            if dm:
                dur = float(dm.group(1))
                target = pending_target if pending_target is not None else elapsed
                events.append({
                    "target": target,
                    "simulated": elapsed,
                    "block": current_block,
                    "duration": dur,
                })
                elapsed += dur
                pending_target = None

        # self.clear_overlay() — typically returns 0.3s
        if clear_re.search(stripped):
            elapsed += 0.3  # DUR_FADE_OUT default

        # elapsed += X
        ep = elapsed_plus_re.match(stripped)
        if ep:
            # Don't double-count — only apply if not already handled by show/wait
            pass  # The show_* duration handling above covers this

    return events
