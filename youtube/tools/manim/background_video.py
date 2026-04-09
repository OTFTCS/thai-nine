"""Generate a per-block background video from AI-generated images.

Reads block timestamps and imageRef from script JSON (timestamps are
written directly into lines by timestamp_audio.py).
Produces an FFmpeg concat video that transitions between images
at block boundaries.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


def generate_background_video(
    script_path: Path,
    images_dir: Path,
    output_path: Path,
    *,
    audio_duration: float | None = None,
    crossfade_sec: float = 0.5,
) -> Path | None:
    """Build a background video from per-block images.

    Algorithm:
    1. Parse blocks from script JSON (imageRef + line timestamps)
    2. Map each block's imageRef to an actual PNG in images_dir
    3. Build segments: [(image_path, start_time, duration)]
    4. Generate FFmpeg concat with xfade transitions
    5. Output a single background.mp4

    Returns output_path, or None if no images available.
    """
    script = json.loads(script_path.read_text(encoding="utf-8"))

    # Build imageRef -> file mapping
    image_files = _map_image_files(script, images_dir)
    if not image_files:
        return None

    # Build segments from script block timestamps
    segments = _build_segments(script, image_files, audio_duration)
    if not segments:
        return None

    # Generate the concat video
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _ffmpeg_concat(segments, output_path, crossfade_sec)
    return output_path


def _map_image_files(script: dict, images_dir: Path) -> dict[str, Path]:
    """Map imageRef IDs to actual PNG files in images_dir."""
    mapping: dict[str, Path] = {}
    if not images_dir.exists():
        return mapping
    for prompt in script.get("imagePrompts", []):
        img_id = prompt["id"]
        # Look for img-001.png, img-001-*.png, etc.
        candidates = sorted(images_dir.glob(f"{img_id}*"))
        if candidates:
            mapping[img_id] = candidates[0]
    return mapping


def _build_segments(
    script: dict,
    image_files: dict[str, Path],
    audio_duration: float | None,
) -> list[dict]:
    """Build ordered segments: [{image, start, duration}]."""
    blocks = script.get("blocks", [])

    # Find default image (first available)
    default_image = next(iter(image_files.values()), None)

    segments: list[dict] = []
    prev_end = 0.0

    for block in blocks:
        # Derive block start/end from line timestamps
        line_starts = [
            line["displayStart"]
            for line in block.get("lines", [])
            if line.get("displayStart") is not None
        ]
        line_ends = [
            line["displayEnd"]
            for line in block.get("lines", [])
            if line.get("displayEnd") is not None
        ]
        if not line_starts:
            continue

        start = min(line_starts)
        end = max(line_ends) if line_ends else start

        image_ref = block.get("imageRef")
        image_path = image_files.get(image_ref) if image_ref else None
        if image_path is None:
            image_path = default_image
        if image_path is None:
            continue

        # Fill gap from previous block end to this block start
        if start > prev_end + 0.1 and segments:
            segments.append({
                "image": segments[-1]["image"],
                "start": prev_end,
                "duration": round(start - prev_end, 2),
            })

        segments.append({
            "image": image_path,
            "start": round(start, 2),
            "duration": round(end - start, 2),
        })
        prev_end = end

    # Extend last segment to audio duration if needed
    if audio_duration and segments and prev_end < audio_duration:
        segments.append({
            "image": segments[-1]["image"],
            "start": round(prev_end, 2),
            "duration": round(audio_duration - prev_end, 2),
        })

    # Merge consecutive segments with same image
    merged: list[dict] = []
    for seg in segments:
        if merged and merged[-1]["image"] == seg["image"]:
            merged[-1]["duration"] = round(merged[-1]["duration"] + seg["duration"], 2)
        else:
            merged.append(dict(seg))

    return merged


def _ffmpeg_concat(
    segments: list[dict],
    output_path: Path,
    crossfade_sec: float,
) -> None:
    """Generate background video with xfade transitions between images."""
    if len(segments) == 0:
        return

    if len(segments) == 1:
        # Single image — just loop it for the segment duration
        seg = segments[0]
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(seg["image"]),
            "-t", f"{seg['duration']:.2f}",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg single-image background failed: {result.stderr[:300]}")
        return

    # Multiple segments: build complex filter with xfade chain
    inputs: list[str] = []
    for seg in segments:
        inputs.extend([
            "-loop", "1",
            "-t", f"{seg['duration'] + crossfade_sec:.2f}",
            "-i", str(seg["image"]),
        ])

    # Build xfade filter chain
    filter_parts: list[str] = []
    # Scale each input first
    for i in range(len(segments)):
        filter_parts.append(
            f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=increase,"
            f"crop=1920:1080,setsar=1[s{i}]"
        )

    # Chain xfade transitions
    prev_label = "s0"
    offset = segments[0]["duration"] - crossfade_sec

    for i in range(1, len(segments)):
        out_label = f"v{i}"
        xfade_offset = max(0, offset)
        filter_parts.append(
            f"[{prev_label}][s{i}]xfade=transition=fade:"
            f"duration={crossfade_sec}:offset={xfade_offset:.2f}[{out_label}]"
        )
        prev_label = out_label
        offset += segments[i]["duration"] - crossfade_sec

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", f"[{prev_label}]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg xfade background failed: {result.stderr[:500]}")
