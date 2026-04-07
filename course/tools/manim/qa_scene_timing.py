"""Scene-level timing QA — simulates a generated scene file and compares
against TimedSlide targets to detect per-event drift.

Runs without Manim installed — pure regex parsing + arithmetic.

Thresholds:
  ≤ 0.5s per-event drift  → PASS
  ≤ 1.0s per-event drift  → WARN
  > 1.0s per-event drift   → FAIL
  ≤ 2.0s total duration drift → PASS
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .models import QAResult, TimedSlide

# Regex patterns matching the generated scene format
_SLIDE_MARKER_RE = re.compile(
    r"# === Slide:\s+(\S+)\s+\(([\d.]+)s\s*-\s*([\d.]+)s\)"
)
_DURATION_KW_RE = re.compile(r"duration\s*=\s*([\d.]+)")
_PAUSE_SECONDS_KW_RE = re.compile(r"pause_seconds\s*=\s*(\d+)")
_RUN_TIME_RE = re.compile(r"run_time\s*=\s*([\d.]+)")
_WAIT_RE = re.compile(r"self\.wait\(([\d.]+)\)")
_ELAPSED_RE = re.compile(r"elapsed\s*\+=\s*([\d.]+)")
_METHOD_RE = re.compile(
    r"self\.(show_\w+|transition_wipe)\("
)


@dataclass
class SimSlide:
    """Simulated timing for one slide section."""
    slide_id: str
    target_start: float
    target_end: float
    sim_start: float
    sim_end: float
    method_count: int = 0

    @property
    def target_duration(self) -> float:
        return self.target_end - self.target_start

    @property
    def sim_duration(self) -> float:
        return self.sim_end - self.sim_start

    @property
    def start_drift(self) -> float:
        return self.sim_start - self.target_start

    @property
    def duration_drift(self) -> float:
        return self.sim_duration - self.target_duration


def simulate_scene(scene_path: Path) -> list[SimSlide]:
    """Parse a generated lesson scene and simulate Manim timing.

    Walks through the code line by line, summing duration= values,
    transition times, and self.wait() calls to build a simulated timeline.
    """
    code = scene_path.read_text(encoding="utf-8")
    return simulate_scene_code(code)


def simulate_scene_code(code: str) -> list[SimSlide]:
    """Simulate timing from scene code string."""
    lines = code.split("\n")
    slides: list[SimSlide] = []
    elapsed = 0.0
    current_slide: SimSlide | None = None

    for line in lines:
        stripped = line.strip()

        # Slide marker — start new slide section
        m = _SLIDE_MARKER_RE.search(stripped)
        if m:
            if current_slide is not None:
                current_slide.sim_end = elapsed
                slides.append(current_slide)
            current_slide = SimSlide(
                slide_id=m.group(1),
                target_start=float(m.group(2)),
                target_end=float(m.group(3)),
                sim_start=elapsed,
                sim_end=elapsed,
            )
            continue

        if current_slide is None:
            continue

        # transition_wipe — fixed 0.6s
        if "self.transition_wipe()" in stripped:
            elapsed += 0.6
            continue

        # self.wait(X)
        wm = _WAIT_RE.search(stripped)
        if wm and "elapsed" not in stripped:
            elapsed += float(wm.group(1))
            continue

        # Method calls with duration= parameter
        if _METHOD_RE.search(stripped):
            current_slide.method_count += 1
            dm = _DURATION_KW_RE.search(stripped)
            if dm:
                elapsed += float(dm.group(1))
                continue

        # elapsed += X tracking lines (these tell us what the scene thinks)
        # We don't use these for simulation — we compute ourselves
        # But they're useful for cross-checking
        em = _ELAPSED_RE.search(stripped)
        if em:
            continue  # skip — we track elapsed ourselves

    # Close final slide
    if current_slide is not None:
        current_slide.sim_end = elapsed
        slides.append(current_slide)

    return slides


def run_scene_timing_qa(
    scene_code: str,
    timed_slides: list[TimedSlide] | None = None,
    recording_duration: float | None = None,
) -> QAResult:
    """Run per-event drift analysis on a generated scene.

    Args:
        scene_code: The generated scene .py content
        timed_slides: Optional TimedSlide targets for comparison
        recording_duration: Optional total recording duration

    Returns:
        QAResult with per-slide drift analysis
    """
    issues: list[str] = []
    warnings: list[str] = []

    sim_slides = simulate_scene_code(scene_code)

    if not sim_slides:
        issues.append("No slide markers found in scene code")
        return QAResult(
            gate_name="scene_timing",
            passed=False,
            issues=issues,
            warnings=warnings,
        )

    max_drift = 0.0
    drift_table: list[dict] = []

    for ss in sim_slides:
        drift = ss.start_drift
        abs_drift = abs(drift)
        max_drift = max(max_drift, abs_drift)

        flag = "pass" if abs_drift <= 0.5 else ("warn" if abs_drift <= 1.0 else "fail")

        drift_table.append({
            "slide_id": ss.slide_id,
            "target_start": round(ss.target_start, 1),
            "sim_start": round(ss.sim_start, 1),
            "drift_sec": round(drift, 2),
            "flag": flag,
        })

        if abs_drift > 1.0:
            issues.append(
                f"{ss.slide_id}: start drift {drift:+.1f}s exceeds 1.0s threshold "
                f"(target={ss.target_start:.1f}s, simulated={ss.sim_start:.1f}s)"
            )
        elif abs_drift > 0.5:
            warnings.append(
                f"{ss.slide_id}: start drift {drift:+.1f}s "
                f"(target={ss.target_start:.1f}s, simulated={ss.sim_start:.1f}s)"
            )

    # Total duration check
    total_sim = sim_slides[-1].sim_end
    total_target = sim_slides[-1].target_end
    dur_drift = total_sim - total_target
    if recording_duration:
        dur_drift = total_sim - recording_duration

    if abs(dur_drift) > 2.0:
        warnings.append(
            f"Total duration drift: {dur_drift:+.1f}s "
            f"(simulated={total_sim:.1f}s, target={recording_duration or total_target:.1f}s)"
        )

    metadata = {
        "slide_count": len(sim_slides),
        "total_simulated_sec": round(total_sim, 1),
        "total_target_sec": round(total_target, 1),
        "max_drift_sec": round(max_drift, 2),
        "drift_table": drift_table,
    }
    if recording_duration:
        metadata["recording_duration_sec"] = round(recording_duration, 1)

    return QAResult(
        gate_name="scene_timing",
        passed=len(issues) == 0,
        issues=issues,
        warnings=warnings,
        metadata=metadata,
    )


def print_drift_report(result: QAResult) -> None:
    """Pretty-print the drift analysis table."""
    table = result.metadata.get("drift_table", [])
    if not table:
        print("No drift data available.")
        return

    print(f"{'Slide':30s}  {'Target':>7s} {'Sim':>7s} {'Drift':>7s}  {'Status'}")
    print("-" * 65)

    for row in table:
        flag_icon = {"pass": "✓", "warn": "⚠", "fail": "✗"}[row["flag"]]
        print(
            f"{row['slide_id']:30s}  {row['target_start']:6.1f}s {row['sim_start']:6.1f}s "
            f"{row['drift_sec']:+6.1f}s  {flag_icon}"
        )

    print(f"\nMax drift: {result.metadata.get('max_drift_sec', 0):.2f}s")
    print(f"Simulated total: {result.metadata.get('total_simulated_sec', 0):.1f}s")
    print(f"Target total: {result.metadata.get('total_target_sec', 0):.1f}s")
