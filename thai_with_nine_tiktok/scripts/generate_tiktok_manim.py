#!/usr/bin/env python3
"""
Generate a Manim overlay video for a Thai TikTok teaching episode.

Single command that runs the full pipeline:
  1. Parse script → beats
  2. Transcribe audio (WhisperX or manual CSV)
  3. Align beats → timed beat sheet
  4. Generate Manim scene via Claude CLI
  5. Render Manim → transparent .mov
  6. Composite camera + overlay → final .mp4

Usage:
    python3 scripts/generate_tiktok_manim.py \\
        --recording recordings/ep02.mp4 \\
        --script series/thai-classifiers/scripts/episode-02-khon-vs-dtua.md \\
        [--episode-json series/thai-classifiers/episodes.json] \\
        [--episode-id 2] \\
        [--timestamps timestamps.csv]  \\  # manual fallback
        [--skip-render]                \\  # stop after Manim .py generation
        [--scene-file existing.py]     \\  # skip Claude generation, use this file
        [--output-dir out/tiktok]
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Ensure scripts/ is on path
_SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS_DIR))

from parse_script_beats import parse_episode_script, enrich_with_episode_data, Beat
from audio_utils import (
    extract_audio,
    get_duration,
    load_manual_timestamps,
    run_whisperx,
    whisperx_available,
)
from align_beats import (
    AlignmentError,
    TimedBeat,
    align_beats_manual,
    align_beats_to_transcript,
    timed_beats_to_json,
)
from qa_beats import run_beat_qa
from qa_layout import run_layout_qa
from fix_tiktok_timing import fix_tiktok_timing_file

_PROJECT_ROOT = _SCRIPTS_DIR.parent  # thai_with_nine_tiktok/
_PROMPT_PATH = _PROJECT_ROOT / "prompts" / "manim-generation.prompt.md"

MAX_CLAUDE_RETRIES = 2


# ---------------------------------------------------------------------------
# Step 1: Parse script
# ---------------------------------------------------------------------------


def step_parse_script(
    script_path: Path,
    episode_json: Path | None,
    episode_id: str | None,
) -> list[Beat]:
    """Parse episode script into beats, optionally enriching with episode data."""
    print(f"[1/6] Parsing script: {script_path}")
    beats = parse_episode_script(script_path)
    print(f"  → {len(beats)} beats parsed")

    if episode_json and episode_id:
        beats = enrich_with_episode_data(beats, episode_json, episode_id)
        classified = sum(1 for b in beats if b.classifier)
        print(f"  → {classified} beats enriched with classifier data")

    return beats


# ---------------------------------------------------------------------------
# Step 2: Transcribe
# ---------------------------------------------------------------------------


def step_transcribe(
    recording_path: Path,
    timestamps_csv: Path | None,
):
    """Extract audio and transcribe, or load manual timestamps.

    Returns (segments, duration).
    """
    print(f"[2/6] Processing audio: {recording_path}")
    duration = get_duration(recording_path)
    print(f"  → Duration: {duration:.1f}s")

    if timestamps_csv:
        print(f"  → Loading manual timestamps from {timestamps_csv}")
        segments = load_manual_timestamps(timestamps_csv)
        print(f"  → {len(segments)} timestamp rows loaded")
        return segments, duration

    if whisperx_available():
        print("  → Running WhisperX...")
        wav_path = extract_audio(recording_path)
        try:
            segments = run_whisperx(wav_path)
            print(f"  → {len(segments)} segments from WhisperX")
            return segments, duration
        except RuntimeError as e:
            print(f"  ⚠ WhisperX failed: {e}")
            print("  → Falling back to even distribution")
            return [], duration
        finally:
            wav_path.unlink(missing_ok=True)
    else:
        print("  → WhisperX not available, using even distribution")
        return [], duration


# ---------------------------------------------------------------------------
# Step 3: Align
# ---------------------------------------------------------------------------


def step_align(
    beats: list[Beat],
    segments,
    duration: float,
    manual: bool,
) -> list[TimedBeat]:
    """Align beats to audio timestamps."""
    print(f"[3/6] Aligning beats to audio...")

    if manual:
        timed = align_beats_manual(beats, segments)
    else:
        try:
            timed = align_beats_to_transcript(beats, segments, duration)
        except AlignmentError as e:
            print(f"  ⚠ Alignment failed: {e}")
            print("  → Falling back to even distribution")
            from align_beats import _distribute_evenly
            timed = _distribute_evenly(beats, duration)

    print(f"  → {len(timed)} timed beats")
    return timed


# ---------------------------------------------------------------------------
# Step 4: Generate Manim scene via Claude CLI
# ---------------------------------------------------------------------------


def step_generate_manim(
    timed_beats: list[TimedBeat],
    output_scene_path: Path,
    scene_file: Path | None = None,
) -> Path:
    """Generate Manim scene file, either from Claude CLI or an existing file."""
    if scene_file:
        print(f"[4/6] Using existing scene: {scene_file}")
        if scene_file != output_scene_path:
            shutil.copy2(scene_file, output_scene_path)
        return output_scene_path

    print(f"[4/6] Generating Manim scene via Claude CLI...")

    # Check claude CLI is available
    if not shutil.which("claude"):
        raise RuntimeError(
            "claude CLI not found in PATH. Install Claude Code or use --scene-file."
        )

    # Load the system prompt
    system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

    # Build the user prompt with the beat sheet
    beat_sheet_json = timed_beats_to_json(timed_beats)
    user_prompt = (
        f"{system_prompt}\n\n"
        f"## TimedBeatSheet\n\n"
        f"```json\n{beat_sheet_json}\n```\n\n"
        f"Generate the complete Manim scene file now."
    )

    for attempt in range(1, MAX_CLAUDE_RETRIES + 1):
        print(f"  → Attempt {attempt}/{MAX_CLAUDE_RETRIES}")

        # Unset CLAUDECODE env var to allow nested claude CLI calls
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "-p", user_prompt, "--output-format", "text"],
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
        )

        if result.returncode != 0:
            print(f"  ⚠ Claude CLI failed: {result.stderr[:300]}")
            continue

        code = _extract_python(result.stdout)
        if not code.strip():
            print("  ⚠ Claude returned empty output")
            continue
        output_scene_path.write_text(code, encoding="utf-8")

        # Validate: syntax check
        error = _validate_scene(output_scene_path)
        if error:
            print(f"  ⚠ Validation failed: {error}")
            # Append error to prompt for retry
            user_prompt += f"\n\nThe previous attempt had this error:\n{error}\nFix it and output the corrected Python file."
            continue

        print(f"  → Scene written to {output_scene_path}")
        return output_scene_path

    raise RuntimeError(f"Failed to generate valid Manim scene after {MAX_CLAUDE_RETRIES} attempts")


def _extract_python(text: str) -> str:
    """Extract Python code from Claude's response.

    Handles both raw Python output and markdown-fenced code blocks.
    """
    text = text.strip()

    # Look for ```python ... ``` fence anywhere in the text
    import re

    m = re.search(r"```python\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    # Look for generic ``` ... ``` fence
    m = re.search(r"```\s*\n(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()

    # No fences — assume raw Python
    return text


def _validate_scene(scene_path: Path) -> str | None:
    """Validate a Manim scene file. Returns error message or None."""
    code = scene_path.read_text(encoding="utf-8")

    # Syntax check
    try:
        compile(code, str(scene_path), "exec")
    except SyntaxError as e:
        return f"SyntaxError: {e}"

    # Check for required class
    if "ThaiTikTokOverlay" not in code:
        return "Missing required class 'ThaiTikTokOverlay'"

    if "ThaiTikTokScene" not in code:
        return "Missing required base class 'ThaiTikTokScene'"

    if "def construct" not in code:
        return "Missing 'construct' method"

    return None


# ---------------------------------------------------------------------------
# Step 5: Render Manim
# ---------------------------------------------------------------------------


def step_render_manim(scene_path: Path, output_dir: Path) -> Path:
    """Render Manim scene to transparent-background video.

    Returns path to the rendered .mov file.
    """
    print(f"[5/6] Rendering Manim scene...")

    # Manim renders to media/ by default. Use --media_dir to control output.
    media_dir = output_dir / "media"

    cmd = [
        sys.executable, "-m", "manim", "render",
        str(scene_path),
        "ThaiTikTokOverlay",
        "-t",  # transparent background → auto-outputs .mov (qtrle + argb)
        "--resolution", "1920,1080",  # Manim format: HEIGHT,WIDTH
        "--fps", "30",
        "--media_dir", str(media_dir),
    ]

    print(f"  → {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        stderr = result.stderr[:500] if result.stderr else ""
        stdout = result.stdout[:500] if result.stdout else ""
        raise RuntimeError(f"Manim render failed:\nstderr: {stderr}\nstdout: {stdout}")

    # Find the output file
    mov_files = list(media_dir.rglob("*.mov"))
    if not mov_files:
        # Try mp4 as fallback
        mov_files = list(media_dir.rglob("*.mp4"))

    if not mov_files:
        raise RuntimeError(f"No rendered video found in {media_dir}")

    output = mov_files[0]
    print(f"  → Rendered: {output}")
    return output


# ---------------------------------------------------------------------------
# Step 6: Composite
# ---------------------------------------------------------------------------


def step_composite(
    camera_path: Path,
    overlay_path: Path,
    output_path: Path,
) -> Path:
    """Composite camera footage with Manim overlay using ffmpeg.

    The overlay (transparent .mov) is placed on top of the camera video.
    Audio comes from the camera recording.
    """
    print(f"[6/6] Compositing final video...")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(camera_path),
        "-i", str(overlay_path),
        "-filter_complex",
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[bg];"
        "[1:v]format=rgba[overlay];[bg][overlay]overlay=0:0:shortest=1[out]",
        "-map", "[out]",
        "-map", "0:a:0?",  # first audio stream from camera (? = optional)
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg composite failed: {result.stderr[:500]}")

    print(f"  → Final video: {output_path}")
    return output_path


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def run_pipeline(args: argparse.Namespace) -> Path:
    """Run the full pipeline and return the path to the final video."""
    recording = Path(args.recording).resolve()
    script = Path(args.script).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Validate inputs
    if not recording.exists():
        raise FileNotFoundError(f"Recording not found: {recording}")
    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    # Derive stem from script name
    stem = script.stem  # e.g. "episode-02-khon-vs-dtua"

    episode_json = Path(args.episode_json).resolve() if args.episode_json else None
    episode_id = args.episode_id
    timestamps_csv = Path(args.timestamps).resolve() if args.timestamps else None
    scene_file = Path(args.scene_file).resolve() if args.scene_file else None

    # Step 1: Parse
    beats = step_parse_script(script, episode_json, episode_id)

    # QA gate: beat structure
    beat_qa = run_beat_qa(beats)
    beat_qa.report()
    if not beat_qa.passed and not getattr(args, 'force', False):
        raise RuntimeError("Beat QA failed — halting pipeline. Use --force to override.")

    # Step 2: Transcribe
    segments, duration = step_transcribe(recording, timestamps_csv)

    # Step 3: Align
    manual = timestamps_csv is not None
    timed_beats = step_align(beats, segments, duration, manual)

    # Save beat sheet for debugging
    beat_sheet_path = output_dir / f"{stem}-beatsheet.json"
    beat_sheet_path.write_text(timed_beats_to_json(timed_beats), encoding="utf-8")
    print(f"  → Beat sheet saved to {beat_sheet_path}")

    # Step 4: Generate Manim scene
    scene_path = output_dir / f"{stem}-scene.py"
    step_generate_manim(timed_beats, scene_path, scene_file)

    # Post-generation timing fix
    try:
        changed = fix_tiktok_timing_file(scene_path, beat_sheet_path)
        if changed:
            print("  → Applied post-generation timing fix")
    except Exception as e:
        print(f"  ⚠ Post-generation timing fix skipped: {e}")

    # QA gate: layout
    layout_qa = run_layout_qa(scene_path)
    layout_qa.report()
    if not layout_qa.passed and not getattr(args, 'force', False):
        raise RuntimeError("Layout QA failed — halting pipeline. Use --force to override.")

    # QA gate: timing
    from qa_timing import run_qa
    print(f"[4.5/6] Timing QA...")
    qa_ok = run_qa(scene_path, beat_sheet_path, duration)
    if not qa_ok:
        if getattr(args, 'force', False):
            print("  ⚠ Timing QA flagged drift — continuing (--force)")
        else:
            raise RuntimeError("Timing QA failed — halting pipeline. Use --force to override.")

    if args.skip_render:
        print("\n✓ Stopped after scene generation (--skip-render)")
        return scene_path

    # Step 5: Render
    overlay_path = step_render_manim(scene_path, output_dir)

    # Step 6: Composite
    final_path = output_dir / f"{stem}-final.mp4"
    step_composite(recording, overlay_path, final_path)

    print(f"\n✓ Pipeline complete: {final_path}")
    return final_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Generate Manim overlay video for Thai TikTok episode",
    )
    parser.add_argument(
        "--recording", required=True,
        help="Path to Nine's recording (.mp4 or .m4a)",
    )
    parser.add_argument(
        "--script", required=True,
        help="Path to episode script (.md)",
    )
    parser.add_argument(
        "--episode-json", default=None,
        help="Path to episodes.json for classifier enrichment",
    )
    parser.add_argument(
        "--episode-id", default=None,
        help="Episode number/id from episodes.json",
    )
    parser.add_argument(
        "--timestamps", default=None,
        help="Manual timestamp CSV (fallback for WhisperX). Format: beat_index,start_sec,end_sec[,text]",
    )
    parser.add_argument(
        "--scene-file", default=None,
        help="Use existing Manim scene .py file instead of generating via Claude",
    )
    parser.add_argument(
        "--skip-render", action="store_true",
        help="Stop after Manim scene generation (don't render or composite)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Continue past QA failures (beat, layout, timing)",
    )
    parser.add_argument(
        "--output-dir", default="out/tiktok",
        help="Output directory (default: out/tiktok)",
    )

    args = parser.parse_args()
    run_pipeline(args)


if __name__ == "__main__":
    main()
