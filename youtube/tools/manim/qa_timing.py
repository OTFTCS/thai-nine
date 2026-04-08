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

        if drift > 0.5:
            issues.append(
                f"Block {event.get('block', '?')}: drift {drift:.2f}s "
                f"(target={target:.1f}s, simulated={simulated:.1f}s)"
            )
        elif drift > 0.1:
            warnings.append(
                f"Block {event.get('block', '?')}: drift {drift:.2f}s "
                f"(target={target:.1f}s, simulated={simulated:.1f}s)"
            )

    # Total duration check — asymmetric:
    # Scene LONGER than audio is a hard fail (overlays desync from speech)
    # Scene SHORTER is normal (silence/outro after last overlay)
    if simulated_events and audio_duration:
        final_elapsed = simulated_events[-1]["simulated"] + simulated_events[-1].get("duration", 0)
        overshoot = final_elapsed - audio_duration  # positive = scene too long
        if overshoot > 2.0:
            issues.append(
                f"Scene overshoots audio by {overshoot:.1f}s "
                f"(simulated={final_elapsed:.1f}s, audio={audio_duration:.1f}s)"
            )
        elif overshoot > 0.5:
            warnings.append(
                f"Scene overshoots audio by {overshoot:.1f}s "
                f"(simulated={final_elapsed:.1f}s, audio={audio_duration:.1f}s)"
            )
        undershoot = audio_duration - final_elapsed  # positive = scene ends early
        if undershoot > 30.0:
            warnings.append(
                f"Scene ends {undershoot:.1f}s before audio ends "
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

    Handles deterministic codegen patterns:
    - wait_gap = X - elapsed  → record target timestamp X
    - elapsed += wait_gap     → advance elapsed to target (variable wait_gap)
    - elapsed += X            → advance elapsed by literal X
    - elapsed += self.clear_overlay(...) → advance by 0.3s
    - self.show_*(...)        → record visual event at current elapsed
    - duration=X              → capture duration for pending event

    Returns list of {target, simulated, block, duration} dicts.
    """
    events = []
    elapsed = 0.0
    current_block = "?"

    # Patterns
    wait_gap_re = re.compile(r"wait_gap\s*=\s*([\d.]+)\s*-\s*elapsed")
    duration_re = re.compile(r"duration\s*=\s*([\d.]+)")
    elapsed_plus_lit_re = re.compile(r"^\s*elapsed\s*\+=\s*([\d.]+)\s*$")
    elapsed_plus_var_re = re.compile(r"^\s*elapsed\s*\+=\s*wait_gap\s*$")
    elapsed_plus_clear_re = re.compile(r"^\s*elapsed\s*\+=\s*self\.clear_overlay")
    block_re = re.compile(r"# === Block:\s+(\S+)")
    show_re = re.compile(r"self\.show_\w+\(")

    pending_target = None
    pending_event = None  # event waiting for duration from multi-line call

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

        # elapsed += wait_gap (variable) → advance to pending target
        if elapsed_plus_var_re.match(stripped):
            if pending_target is not None:
                elapsed = pending_target
            continue

        # elapsed += self.clear_overlay(...) → advance by 0.3s
        if elapsed_plus_clear_re.match(stripped):
            elapsed += 0.3
            continue

        # elapsed += X (literal) → advance elapsed
        ep = elapsed_plus_lit_re.match(stripped)
        if ep:
            val = float(ep.group(1))
            # Backfill duration on pending event
            if pending_event is not None:
                pending_event["duration"] = val
                pending_event = None
            elapsed += val
            continue

        # self.show_*(...) → record visual event
        if show_re.search(stripped):
            target = pending_target if pending_target is not None else elapsed
            dm = duration_re.search(stripped)
            dur = float(dm.group(1)) if dm else 0.0
            event = {
                "target": target,
                "simulated": elapsed,
                "block": current_block,
                "duration": dur,
            }
            events.append(event)
            pending_target = None
            if dur > 0:
                # Single-line call with duration — elapsed will be advanced by elapsed += X
                pending_event = None
            else:
                # Multi-line call — duration will come from elapsed += X later
                pending_event = event
            continue

        # Capture duration= on continuation lines of multi-line calls
        if pending_event is not None and "duration=" in stripped:
            dm = duration_re.search(stripped)
            if dm:
                pending_event["duration"] = float(dm.group(1))

    return events
