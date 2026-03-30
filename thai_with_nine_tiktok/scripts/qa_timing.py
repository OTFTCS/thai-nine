#!/usr/bin/env python3
"""Timing QA for generated Manim TikTok scenes.

Simulates Manim timing from a generated scene file and compares against
the beat sheet to detect drift.  Runs without Manim installed — pure
regex parsing + arithmetic.

Usage:
    python3 scripts/qa_timing.py \
        --scene out/tiktok-ep02-v8/scene.py \
        --beatsheet out/tiktok-ep02-v8/beatsheet.json \
        --recording-duration 119.4
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

# Animation constants (must match config/manim-style.json)
_SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS_DIR))

try:
    from manim_thai_base import (
        DUR_TRIPLET, DUR_PERFORM, DUR_RED_X, DUR_FADE_OUT,
    )
except ImportError:
    # Fallback if manim not installed — use defaults from config
    DUR_TRIPLET = 0.6
    DUR_PERFORM = 0.5
    DUR_RED_X = 0.3
    DUR_FADE_OUT = 0.3


@dataclass
class SimEvent:
    """One step in the simulated timeline."""
    line_no: int
    kind: str           # wait, show_triplet, show_perform, show_english, etc.
    target_start: float | None  # from wait_gap = X - elapsed
    duration: float     # duration param or wait time
    sim_start: float    # simulated start time
    sim_end: float      # simulated end time
    text: str           # label for reporting


@dataclass
class OverlayState:
    """Tracks what's currently on screen."""
    triplet: bool = False
    gloss: bool = False
    other: bool = False

    @property
    def has_content(self) -> bool:
        return self.triplet or self.gloss or self.other

    def clear_time(self, run_time: float = DUR_FADE_OUT) -> float:
        """Time consumed by clear_overlay()."""
        if self.has_content:
            self.triplet = False
            self.gloss = False
            self.other = False
            return run_time
        return 0.0

    def clear_gloss_time(self, run_time: float = 0.15) -> float:
        if self.gloss:
            self.gloss = False
            return run_time
        return 0.0

    def clear_other_time(self, run_time: float = 0.15) -> float:
        if self.other:
            self.other = False
            return run_time
        return 0.0


def simulate_scene(scene_path: Path) -> list[SimEvent]:
    """Parse a generated scene .py and simulate Manim timing."""
    code = scene_path.read_text(encoding="utf-8")
    lines = code.split("\n")

    state = OverlayState()
    elapsed = 0.0
    events: list[SimEvent] = []
    current_target: float | None = None

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Track target start: wait_gap = X.XX - elapsed
        m = re.search(r"wait_gap\s*=\s*([\d.]+)\s*-\s*elapsed", stripped)
        if m:
            current_target = float(m.group(1))
            continue

        # elapsed = X.XX (reset)
        m = re.match(r"elapsed\s*=\s*([\d.]+)", stripped)
        if m:
            continue  # just tracking, doesn't consume time

        # self.wait(X.XX) or self.wait(dur - 0.2) etc
        m = re.search(r"self\.wait\(([\d.]+)\)", stripped)
        if m:
            wait_t = float(m.group(1))
            events.append(SimEvent(i, "wait", current_target, wait_t, elapsed, elapsed + wait_t, ""))
            elapsed += wait_t
            continue

        # self.wait(dur - 0.2) pattern for stage_direction/reveal
        m = re.search(r"self\.wait\(dur\s*-\s*([\d.]+)\)", stripped)
        if m:
            # Need to know dur — look backwards for dur = X
            dur = _find_dur(lines, i - 1)
            if dur is not None:
                wait_t = dur - float(m.group(1))
                if wait_t > 0:
                    events.append(SimEvent(i, "wait", current_target, wait_t, elapsed, elapsed + wait_t, ""))
                    elapsed += wait_t
            continue

        # self.clear_overlay(X.XX) — standalone (not inside show_*)
        m = re.search(r"self\.clear_overlay\(([\d.]+)\)", stripped)
        if m:
            rt = float(m.group(1))
            ct = state.clear_time(rt)
            if ct > 0:
                events.append(SimEvent(i, "clear_overlay", None, ct, elapsed, elapsed + ct, ""))
                elapsed += ct
            continue

        # self.show_triplet(..., duration=dur) or duration=X.XX
        # Total Manim time = exactly dur (clear + reveal + hold fitted inside)
        m = re.search(r'self\.show_triplet\("([^"]*)".*duration=(\w+)', stripped)
        if m:
            thai = m.group(1)
            dur = _resolve_dur(m.group(2), lines, i - 1)
            state.clear_time()  # update state (content removed)
            sim_start = elapsed
            elapsed += dur  # total = exactly dur
            state.triplet = True
            events.append(SimEvent(i, "show_triplet", current_target, dur, sim_start, elapsed, thai))
            continue

        # self.show_perform(..., duration=dur)
        # Total Manim time = exactly dur
        m = re.search(r'self\.show_perform\("([^"]*)".*duration=(\w+)', stripped)
        if m:
            text = m.group(1)
            dur = _resolve_dur(m.group(2), lines, i - 1)
            state.clear_gloss_time()
            state.clear_other_time()
            sim_start = elapsed
            elapsed += dur
            state.gloss = True
            events.append(SimEvent(i, "show_perform", current_target, dur, sim_start, elapsed, text))
            continue

        # self.show_english(..., duration=dur)
        # Total Manim time = exactly dur
        m = re.search(r'self\.show_english\("([^"]*)".*duration=(\w+)', stripped)
        if m:
            text = m.group(1)[:40]
            dur = _resolve_dur(m.group(2), lines, i - 1)
            state.clear_time()
            sim_start = elapsed
            elapsed += dur
            state.triplet = False
            state.gloss = False
            state.other = True
            events.append(SimEvent(i, "show_english", current_target, dur, sim_start, elapsed, text))
            continue

        # self.show_your_turn(dur)
        m = re.search(r"self\.show_your_turn\(([\w.]+)\)", stripped)
        if m:
            dur_str = m.group(1)
            if dur_str == "dur":
                dur = _find_dur(lines, i - 1) or 3.0
            else:
                dur = float(dur_str)
            ct = state.clear_time()
            sim_start = elapsed
            elapsed += ct
            elapsed += dur
            state.other = True
            events.append(SimEvent(i, "show_your_turn", current_target, dur, sim_start, elapsed, "YOUR TURN"))
            continue

        # self.show_red_x(...)
        m = re.search(r"self\.show_red_x\(.*duration=([\d.]+)", stripped)
        if m:
            dur = float(m.group(1))
            sim_start = elapsed
            elapsed += dur
            events.append(SimEvent(i, "show_red_x", current_target, dur, sim_start, elapsed, "RED X"))
            continue

    return events


def _resolve_dur(val: str, lines: list[str], before_line_idx: int) -> float:
    """Resolve a duration value — either a literal float or 'dur' variable."""
    try:
        return float(val)
    except ValueError:
        # It's a variable name like 'dur' — look backwards for assignment
        return _find_dur(lines, before_line_idx) or 2.0


def _find_dur(lines: list[str], before_line_idx: int) -> float | None:
    """Look backwards from line index to find `dur = X.XX` or `dur = X - Y`."""
    for j in range(before_line_idx - 1, max(before_line_idx - 6, -1), -1):
        m = re.search(r"dur\s*=\s*([\d.]+)\s*-\s*([\d.]+)", lines[j])
        if m:
            return float(m.group(1)) - float(m.group(2))
        m = re.search(r"dur\s*=\s*([\d.]+)", lines[j])
        if m:
            return float(m.group(1))
    return None


def run_qa(
    scene_path: Path,
    beatsheet_path: Path,
    recording_duration: float | None = None,
) -> bool:
    """Run timing QA. Returns True if all checks pass."""
    events = simulate_scene(scene_path)
    beats = json.loads(beatsheet_path.read_text(encoding="utf-8"))

    # Filter to show_* events (visual beats)
    visual_events = [e for e in events if e.kind.startswith("show_")]

    print(f"Timing QA: {len(visual_events)} visual events, {len(beats)} beats")
    print(f"{'Beat':4s} {'Type':18s} {'Text':30s}  {'target':>7s} {'sim':>7s} {'drift':>7s}")
    print("-" * 82)

    max_drift = 0.0
    all_ok = True

    # Match visual events to beat sheet entries
    # Skip only non-visual, non-interactive beats
    beat_idx = 0
    for ev in visual_events:
        # Find corresponding beat — skip stage_direction and reveal only
        while beat_idx < len(beats):
            b = beats[beat_idx]
            bt = b["beat_type"]
            if bt in ("stage_direction", "reveal"):
                beat_idx += 1
                continue
            # Skip zero-duration pause_challenge
            if bt == "pause_challenge" and b["end_sec"] - b["start_sec"] < 0.01:
                beat_idx += 1
                continue
            break
        else:
            break

        b = beats[beat_idx]
        target = b["start_sec"]
        # sim_start includes the bonus clear time, so content actually appears
        # a bit after sim_start. For reporting, use the midpoint assumption:
        # content appears after clear_time within the sim window.
        drift = ev.sim_start - target
        abs_drift = abs(drift)
        max_drift = max(max_drift, abs_drift)

        flag = "✓" if abs_drift <= 0.5 else ("⚠" if abs_drift <= 1.0 else "✗")
        if abs_drift > 0.5:
            all_ok = False

        label = ev.text[:28]
        print(f"{beat_idx:4d} {ev.kind:18s} {label:30s}  {target:6.1f}s {ev.sim_start:6.1f}s {drift:+6.1f}s {flag}")
        beat_idx += 1

    # Total duration check
    total_sim = events[-1].sim_end if events else 0.0
    print(f"\nSimulated total: {total_sim:.1f}s")
    if recording_duration:
        dur_drift = total_sim - recording_duration
        dur_flag = "✓" if abs(dur_drift) <= 2.0 else "⚠"
        print(f"Recording:       {recording_duration:.1f}s")
        print(f"Duration drift:  {dur_drift:+.1f}s {dur_flag}")
        if abs(dur_drift) > 2.0:
            all_ok = False

    print(f"\nMax per-beat drift: {max_drift:.1f}s {'✓' if max_drift <= 0.5 else '⚠'}")

    return all_ok


def main():
    parser = argparse.ArgumentParser(description="Timing QA for Manim TikTok scenes")
    parser.add_argument("--scene", required=True, type=Path, help="Generated scene .py")
    parser.add_argument("--beatsheet", required=True, type=Path, help="Beat sheet .json")
    parser.add_argument("--recording-duration", type=float, help="Recording duration (seconds)")
    args = parser.parse_args()

    ok = run_qa(args.scene, args.beatsheet, args.recording_duration)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
