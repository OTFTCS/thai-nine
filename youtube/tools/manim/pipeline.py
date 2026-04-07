#!/usr/bin/env python3
"""
YouTube Manim video pipeline — end-to-end orchestrator.

Takes an episode ID and produces a finished YouTube video:
  audio + script + overlays → Manim overlay → FFmpeg composite → final MP4

Pipeline steps:
  0. Validate inputs
  1. Generate background images (Gemini)
  2. Generate Manim scene .py (Claude CLI)
  3. Fix scene timing
  4. QA gates (layout + timing)
  5. Render transparent .mov
  6. FFmpeg composite (background + overlay + audio → MP4)
  7. QA report

Usage:
    python3 -m youtube.tools.manim.pipeline --episode YT-S01-E01
    python3 -m youtube.tools.manim.pipeline --episode YT-S01-E01 --skip-render
    python3 -m youtube.tools.manim.pipeline --episode YT-S01-E01 --force
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_TOOLS_DIR = _HERE.parent         # youtube/tools/
_YT_DIR = _TOOLS_DIR.parent       # youtube/
_REPO_ROOT = _YT_DIR.parent       # thai-nine/


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

def _resolve_paths(episode_id: str, output_dir: Path | None = None) -> dict[str, Path]:
    """Resolve all input/output paths from episode ID."""
    out = output_dir or (_YT_DIR / "out" / episode_id)
    return {
        "script": _YT_DIR / "examples" / f"{episode_id}.json",
        "timed": _YT_DIR / "timed" / f"{episode_id}.timed.json",
        "overlays": _YT_DIR / "subtitles" / episode_id / f"{episode_id}.overlays.json",
        "audio": _YT_DIR / "recordings" / f"{episode_id}.m4a",
        "images_dir": _YT_DIR / "images" / episode_id,
        "style": _YT_DIR / "config" / "manim-yt-style.json",
        "scene": out / f"{episode_id}-scene.py",
        "overlay_mov": out / f"{episode_id}-overlay.mov",
        "final_mp4": out / f"{episode_id}-final.mp4",
        "qa_report": out / "qa-report.json",
        "output_dir": out,
    }


# ---------------------------------------------------------------------------
# Step 0: Input validation
# ---------------------------------------------------------------------------

def step_validate(paths: dict[str, Path]) -> None:
    """Verify all required input files exist."""
    print("[0/7] Validating inputs...")
    required = ["script", "timed", "overlays", "audio"]
    missing = [k for k in required if not paths[k].exists()]
    if missing:
        for k in missing:
            print(f"  ✗ Missing: {paths[k]}")
        raise FileNotFoundError(f"Missing inputs: {', '.join(missing)}")
    for k in required:
        print(f"  ✓ {k}: {paths[k].name}")


# ---------------------------------------------------------------------------
# Step 1: Image generation
# ---------------------------------------------------------------------------

def step_images(paths: dict[str, Path], episode_id: str, *, skip: bool = False, regenerate: bool = False) -> None:
    """Generate background images via Gemini."""
    print("[1/7] Background images...")

    if skip:
        print("  Skipped (--skip-images)")
        return

    script = json.loads(paths["script"].read_text(encoding="utf-8"))
    image_prompts = script.get("imagePrompts", [])

    if not image_prompts:
        print("  No imagePrompts in script — will use solid background")
        return

    # Check if images already exist
    images_dir = paths["images_dir"]
    existing = list(images_dir.glob("*.png")) if images_dir.exists() else []
    if existing and not regenerate:
        print(f"  {len(existing)} images already exist — skipping (use --regenerate-images to overwrite)")
        return

    # Run image generator as subprocess
    cmd = [
        sys.executable, str(_TOOLS_DIR / "generate_images.py"),
        "--episode", episode_id,
    ]
    if regenerate:
        cmd.append("--regenerate")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"  ⚠ Image generation failed: {result.stderr[:300]}")
        else:
            print(f"  ✓ Images generated")
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"  ⚠ Image generation skipped: {e}")


# ---------------------------------------------------------------------------
# Step 2: Scene generation
# ---------------------------------------------------------------------------

def step_generate(paths: dict[str, Path], *, scene_file: Path | None = None) -> Path:
    """Generate Manim scene file from overlays JSON."""
    print("[2/7] Generating Manim scene...")

    from .generate_scene import generate_scene

    overlays_json = paths["overlays"].read_text(encoding="utf-8")
    output_path = paths["scene"]
    output_path.parent.mkdir(parents=True, exist_ok=True)

    return generate_scene(
        overlays_json, output_path,
        scene_file=scene_file,
        script_path=paths["script"],
    )


# ---------------------------------------------------------------------------
# Step 3: Timing fix
# ---------------------------------------------------------------------------

def step_timing_fix(paths: dict[str, Path]) -> None:
    """Apply post-generation timing correction."""
    print("[3/7] Fixing scene timing...")

    from .fix_scene_timing import fix_scene_timing

    scene_path = paths["scene"]
    overlays = json.loads(paths["overlays"].read_text(encoding="utf-8"))

    code = scene_path.read_text(encoding="utf-8")
    fixed = fix_scene_timing(code, overlays)

    if fixed != code:
        scene_path.write_text(fixed, encoding="utf-8")
        print("  ✓ Timing corrections applied")
    else:
        print("  ✓ No corrections needed")


# ---------------------------------------------------------------------------
# Step 4: QA gates
# ---------------------------------------------------------------------------

def step_qa(paths: dict[str, Path], *, force: bool = False) -> list[dict]:
    """Run layout + timing QA gates."""
    print("[4/7] Running QA gates...")

    from .qa_layout import run_layout_qa
    from .qa_timing import run_timing_qa

    qa_results = []

    # Layout QA
    layout_qa = run_layout_qa(paths["scene"])
    qa_results.append(layout_qa)
    _report_gate(layout_qa)

    # Timing QA
    scene_code = paths["scene"].read_text(encoding="utf-8")
    overlays = json.loads(paths["overlays"].read_text(encoding="utf-8"))

    # Get audio duration
    audio_duration = _get_audio_duration(paths["audio"])

    timing_qa = run_timing_qa(scene_code, overlays, audio_duration)
    qa_results.append(timing_qa)
    _report_gate(timing_qa)

    # Check for failures
    failed = [qa for qa in qa_results if not qa["passed"]]
    if failed and not force:
        raise RuntimeError(
            f"QA failed: {', '.join(qa['gate_name'] for qa in failed)}. "
            f"Use --force to continue past failures."
        )

    return qa_results


# ---------------------------------------------------------------------------
# Step 5: Render
# ---------------------------------------------------------------------------

def step_render(paths: dict[str, Path]) -> Path:
    """Render Manim scene to transparent .mov."""
    print("[5/7] Rendering Manim scene...")

    scene_path = paths["scene"]
    output_dir = paths["output_dir"]

    # Symlink scene_base.py into output dir
    base_src = _HERE / "scene_base.py"
    base_link = scene_path.parent / "scene_base.py"
    if not base_link.exists() and base_src.exists():
        base_link.symlink_to(base_src)

    media_dir = output_dir / "media"

    cmd = [
        sys.executable, "-m", "manim", "render",
        str(scene_path),
        "YouTubeOverlay",
        "-t",
        "--resolution", "1080,1920",
        "--fps", "30",
        "--media_dir", str(media_dir),
    ]

    print(f"  → {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        stderr = result.stderr[:500] if result.stderr else ""
        raise RuntimeError(f"Manim render failed:\n{stderr}")

    # Find output file
    mov_files = list(media_dir.rglob("*.mov"))
    if not mov_files:
        mov_files = list(media_dir.rglob("*.mp4"))
    if not mov_files:
        raise RuntimeError(f"No rendered video found in {media_dir}")

    output = mov_files[0]
    print(f"  ✓ Rendered: {output}")
    return output


# ---------------------------------------------------------------------------
# Step 6: FFmpeg composite
# ---------------------------------------------------------------------------

def step_composite(paths: dict[str, Path], overlay_path: Path) -> Path:
    """Composite: background image + Manim overlay + audio → final MP4."""
    print("[6/7] Compositing final video...")

    final_path = paths["final_mp4"]
    final_path.parent.mkdir(parents=True, exist_ok=True)

    audio_path = paths["audio"]

    # Find background image
    bg_image = _find_background_image(paths)

    if bg_image:
        # Background image + overlay + audio
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(bg_image),
            "-i", str(overlay_path),
            "-i", str(audio_path),
            "-filter_complex",
            "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,"
            "crop=1920:1080[bg];"
            "[1:v]format=rgba[ol];"
            "[bg][ol]overlay=0:0:shortest=1[out]",
            "-map", "[out]",
            "-map", "2:a:0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-shortest",
            str(final_path),
        ]
    else:
        # Solid dark background + overlay + audio
        audio_duration = _get_audio_duration(audio_path)
        dur_str = f"{audio_duration:.1f}" if audio_duration else "960"
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=0x141414:s=1920x1080:d={dur_str}:r=30",
            "-i", str(overlay_path),
            "-i", str(audio_path),
            "-filter_complex",
            "[1:v]format=rgba[ol];"
            "[0:v][ol]overlay=0:0:shortest=1[out]",
            "-map", "[out]",
            "-map", "2:a:0",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            "-shortest",
            str(final_path),
        ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg composite failed: {result.stderr[:500]}")

    print(f"  ✓ Final video: {final_path}")
    return final_path


def _find_background_image(paths: dict[str, Path]) -> Path | None:
    """Find the first available background image for the episode."""
    images_dir = paths["images_dir"]
    if images_dir.exists():
        pngs = sorted(images_dir.glob("*.png"))
        if pngs:
            return pngs[0]
    return None


# ---------------------------------------------------------------------------
# Step 7: QA report
# ---------------------------------------------------------------------------

def step_report(
    qa_results: list[dict],
    episode_id: str,
    paths: dict[str, Path],
) -> Path:
    """Write QA report JSON."""
    print("[7/7] Writing QA report...")

    report = {
        "episode": episode_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gates": {},
        "overall": "PASS",
    }

    for qr in qa_results:
        report["gates"][qr["gate_name"]] = {
            "pass": qr["passed"],
            "issues": qr["issues"],
            "warnings": qr["warnings"],
            **qr.get("metadata", {}),
        }
        if not qr["passed"]:
            report["overall"] = "FAIL"

    report_path = paths["qa_report"]
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  ✓ Report: {report_path}")
    return report_path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_audio_duration(audio_path: Path) -> float | None:
    """Get audio duration via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        pass
    return None


def _report_gate(qa: dict) -> None:
    """Print QA gate results."""
    status = "✓ PASS" if qa["passed"] else "✗ FAIL"
    print(f"  QA [{qa['gate_name']}]: {status}")
    for issue in qa["issues"]:
        print(f"    ✗ {issue}")
    for warning in qa["warnings"]:
        print(f"    ⚠ {warning}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(args: argparse.Namespace) -> Path:
    """Run the full pipeline."""
    episode_id = args.episode
    output_dir = Path(args.output_dir).resolve() if args.output_dir else None
    paths = _resolve_paths(episode_id, output_dir)
    paths["output_dir"].mkdir(parents=True, exist_ok=True)

    qa_results: list[dict] = []

    # Step 0: Validate
    step_validate(paths)

    # Step 1: Images
    step_images(
        paths, episode_id,
        skip=args.skip_images,
        regenerate=args.regenerate_images,
    )

    # Step 2: Generate scene
    scene_file = Path(args.scene_file).resolve() if args.scene_file else None
    scene_path = step_generate(paths, scene_file=scene_file)

    # Step 3: Timing fix
    step_timing_fix(paths)

    # Step 4: QA gates
    qa_results = step_qa(paths, force=args.force)

    if args.skip_render:
        print(f"\n✓ Stopped after scene generation (--skip-render)")
        step_report(qa_results, episode_id, paths)
        return scene_path

    # Step 5: Render
    overlay_path = step_render(paths)

    # Post-render QA
    from .qa_render import run_render_qa
    audio_duration = _get_audio_duration(paths["audio"])
    render_qa = run_render_qa(overlay_path, audio_duration)
    qa_results.append(render_qa)
    _report_gate(render_qa)

    # Step 6: Composite
    final_path = step_composite(paths, overlay_path)

    # Step 7: Report
    step_report(qa_results, episode_id, paths)

    print(f"\n✓ Pipeline complete: {final_path}")
    return final_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="YouTube Manim video pipeline — audio + script → finished video",
    )
    parser.add_argument(
        "--episode", required=True,
        help="Episode ID (e.g. YT-S01-E01)",
    )
    parser.add_argument(
        "--scene-file", default=None,
        help="Use existing Manim scene .py instead of generating",
    )
    parser.add_argument(
        "--skip-render", action="store_true",
        help="Stop after scene generation (don't render or composite)",
    )
    parser.add_argument(
        "--skip-images", action="store_true",
        help="Skip image generation step",
    )
    parser.add_argument(
        "--regenerate-images", action="store_true",
        help="Overwrite existing AI-generated images",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Continue past QA gate failures",
    )
    parser.add_argument(
        "--output-dir", default=None,
        help="Output directory (default: youtube/out/{EPISODE_ID}/)",
    )

    args = parser.parse_args()
    run_pipeline(args)


if __name__ == "__main__":
    main()
