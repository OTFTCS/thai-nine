"""Visual QA frame extraction for YouTube Manim scenes.

Extracts frames at key timestamps (all line displayStart values) from
the rendered final MP4 and saves them as PNGs for visual inspection.

Usage:
    python3 -m youtube.tools.manim.qa_visual \
        --video youtube/out/YT-S01-E02/YT-S01-E02-final.mp4 \
        --script youtube/examples/YT-S01-E02.json \
        [--output youtube/out/YT-S01-E02/visual-qa-frames/]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def _collect_timestamps(script: dict) -> list[dict]:
    """Collect all displayStart timestamps from script lines with metadata."""
    timestamps: list[dict] = []
    seen: set[float] = set()

    for block in script.get("blocks", []):
        block_id = block["id"]
        mode = block.get("mode", "explain")
        for line in block.get("lines", []):
            t = line.get("displayStart")
            if t is not None and t not in seen:
                seen.add(t)
                timestamps.append({
                    "timestamp": t,
                    "block_id": block_id,
                    "mode": mode,
                    "line_id": line.get("id", "?"),
                    "lang": line.get("lang", "?"),
                    "text_preview": (
                        line.get("thai", line.get("english", line.get("translit", "")))
                    )[:50],
                })

    timestamps.sort(key=lambda x: x["timestamp"])
    return timestamps


def _extract_frame(video_path: Path, timestamp: float, output_path: Path) -> bool:
    """Extract a single frame at the given timestamp. Returns True on success."""
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-v", "quiet",
                "-ss", f"{timestamp:.2f}",
                "-i", str(video_path),
                "-frames:v", "1",
                "-f", "image2",
                "-y",
                str(output_path),
            ],
            capture_output=True,
            timeout=15,
        )
        return result.returncode == 0 and output_path.exists()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def extract_qa_frames(
    video_path: Path,
    script_path: Path,
    output_dir: Path | None = None,
) -> dict:
    """Extract frames at all line timestamps from the rendered video.

    Args:
        video_path: Path to the final composited MP4.
        script_path: Path to the episode script JSON.
        output_dir: Where to save frame PNGs. Defaults to
            {video_dir}/visual-qa-frames/

    Returns:
        Visual QA report dict with frame paths and metadata.
    """
    if output_dir is None:
        output_dir = video_path.parent / "visual-qa-frames"
    output_dir.mkdir(parents=True, exist_ok=True)

    script = json.loads(script_path.read_text(encoding="utf-8"))
    episode_id = script.get("episodeId", "unknown")

    timestamps = _collect_timestamps(script)

    if not timestamps:
        print("  ⚠ No timestamps found in script — skipping visual QA")
        return {"episode": episode_id, "frames": [], "total_frames": 0}

    frames: list[dict] = []
    for i, ts in enumerate(timestamps):
        frame_name = f"frame_{i:03d}_{ts['timestamp']:.1f}s.png"
        frame_path = output_dir / frame_name

        success = _extract_frame(video_path, ts["timestamp"], frame_path)

        entry = {
            "index": i,
            "timestamp": ts["timestamp"],
            "block_id": ts["block_id"],
            "mode": ts["mode"],
            "line_id": ts["line_id"],
            "lang": ts["lang"],
            "text_preview": ts["text_preview"],
            "path": str(frame_path.relative_to(video_path.parent)),
            "extracted": success,
        }
        if success:
            entry["file_size_bytes"] = frame_path.stat().st_size
        frames.append(entry)

    report = {
        "episode": episode_id,
        "video": str(video_path),
        "script": str(script_path),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_frames": len(frames),
        "extracted_ok": sum(1 for f in frames if f["extracted"]),
        "frames": frames,
    }

    report_path = output_dir / "visual-qa-report.json"
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"  Visual QA: {report['extracted_ok']}/{report['total_frames']} frames → {output_dir}")

    return report


def main():
    parser = argparse.ArgumentParser(description="Extract QA frames from rendered video")
    parser.add_argument("--video", required=True, help="Path to final composited MP4")
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--output", default=None, help="Output directory for frames")
    args = parser.parse_args()

    video_path = Path(args.video)
    script_path = Path(args.script)
    output_dir = Path(args.output) if args.output else None

    if not video_path.exists():
        print(f"ERROR: Video not found: {video_path}", file=sys.stderr)
        sys.exit(1)
    if not script_path.exists():
        print(f"ERROR: Script not found: {script_path}", file=sys.stderr)
        sys.exit(1)

    report = extract_qa_frames(video_path, script_path, output_dir)
    print(f"\nDone! {report['extracted_ok']} frames extracted.")


if __name__ == "__main__":
    main()
