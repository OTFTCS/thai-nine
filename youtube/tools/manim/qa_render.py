"""Post-render validation for YouTube Manim scenes.

Checks rendered video file for size, duration, and format.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def run_render_qa(
    video_path: Path,
    audio_duration: float | None = None,
    overlays: list[dict] | None = None,
) -> dict:
    """Validate a rendered video file.

    Checks:
    - File exists and size > 1MB
    - Duration within 10% of audio duration (via ffprobe)

    Returns dict with: passed, issues, warnings, metadata.
    """
    issues: list[str] = []
    warnings: list[str] = []

    if not video_path.exists():
        issues.append(f"Rendered video not found: {video_path}")
        return {
            "gate_name": "render",
            "passed": False,
            "issues": issues,
            "warnings": warnings,
            "metadata": {},
        }

    file_size = video_path.stat().st_size
    if file_size < 1_000_000:
        issues.append(f"Rendered video too small: {file_size / 1e6:.1f}MB (expected >1MB)")

    # Get video duration via ffprobe
    video_duration = None
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(video_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            video_duration = float(result.stdout.strip())
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        warnings.append("Could not determine video duration via ffprobe")

    if video_duration and audio_duration:
        drift = abs(video_duration - audio_duration)
        pct = drift / audio_duration * 100
        if pct > 10:
            issues.append(
                f"Duration mismatch: video={video_duration:.1f}s, "
                f"audio={audio_duration:.1f}s ({pct:.0f}% drift)"
            )
        elif pct > 5:
            warnings.append(
                f"Duration drift: video={video_duration:.1f}s, "
                f"audio={audio_duration:.1f}s ({pct:.1f}% drift)"
            )

    # Frame sampling — check overlays are visually present
    if overlays and video_path.exists():
        frame_warnings = _check_frame_samples(video_path, overlays)
        warnings.extend(frame_warnings)

    metadata = {
        "file_size_mb": round(file_size / 1e6, 2),
    }
    if video_duration:
        metadata["video_duration_sec"] = round(video_duration, 1)
    if audio_duration:
        metadata["audio_duration_sec"] = round(audio_duration, 1)

    return {
        "gate_name": "render",
        "passed": len(issues) == 0,
        "issues": issues,
        "warnings": warnings,
        "metadata": metadata,
    }


def _check_frame_samples(
    video_path: Path,
    overlays: list[dict],
    sample_count: int = 5,
) -> list[str]:
    """Sample frames at overlay timestamps and check they're not blank.

    Extracts frames at evenly-spaced overlay displayStart times via ffmpeg.
    Checks that frame file size exceeds a minimum (indicating non-trivial content).
    """
    import tempfile

    warnings = []
    # Pick evenly-spaced overlays for sampling
    active = [ov for ov in overlays if not ov.get("skipInScene")]
    if not active:
        return warnings

    step = max(1, len(active) // sample_count)
    samples = active[::step][:sample_count]

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, ov in enumerate(samples):
            t = ov.get("displayStart", 0)
            frame_path = Path(tmpdir) / f"frame_{i}.png"
            try:
                result = subprocess.run(
                    [
                        "ffmpeg", "-v", "quiet",
                        "-ss", f"{t:.2f}",
                        "-i", str(video_path),
                        "-frames:v", "1",
                        "-f", "image2",
                        str(frame_path),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode == 0 and frame_path.exists():
                    size = frame_path.stat().st_size
                    # A completely blank 1920x1080 PNG is ~5KB; overlays make it larger
                    if size < 3000:
                        warnings.append(
                            f"Frame at {t:.1f}s appears blank ({size} bytes) "
                            f"— overlay {ov.get('lineId', '?')} may not be rendering"
                        )
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass  # non-critical check

    return warnings
