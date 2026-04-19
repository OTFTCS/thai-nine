"""
Audio extraction and WhisperX transcription utilities.

Python port of tools/lib/forced-alignment.ts. Provides WhisperX
integration for word-level timestamps, plus a manual CSV fallback.

Usage:
    from audio_utils import extract_audio, run_whisperx, load_manual_timestamps
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TranscriptSegment:
    """A timed segment of transcribed speech."""

    start_sec: float
    end_sec: float
    text: str


# ---------------------------------------------------------------------------
# Audio extraction
# ---------------------------------------------------------------------------


def extract_audio(video_path: str | Path, output_wav: str | Path | None = None) -> Path:
    """Extract 16kHz mono WAV from a video/audio file using ffmpeg.

    If output_wav is None, creates a temp file. Returns the path to the WAV.
    Raises RuntimeError if ffmpeg fails.
    """
    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Input file not found: {video_path}")

    if output_wav is None:
        fd, tmp = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        output_wav = Path(tmp)
    else:
        output_wav = Path(output_wav)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-ar", "16000",
        "-ac", "1",
        "-vn",
        str(output_wav),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        timeout=120,
    )

    if result.returncode != 0 or not output_wav.exists():
        stderr = result.stderr.decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"ffmpeg audio extraction failed: {stderr}")

    return output_wav


# ---------------------------------------------------------------------------
# WhisperX
# ---------------------------------------------------------------------------


def whisperx_available() -> bool:
    """Check if whisperx CLI or faster-whisper Python library is available."""
    if shutil.which("whisperx") is not None:
        return True
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def run_whisperx(
    audio_path: str | Path,
    lang: str = "th",
) -> list[TranscriptSegment]:
    """Run WhisperX or faster-whisper on an audio file and return transcript segments.

    Tries faster-whisper first (Python library), then whisperx CLI as fallback.
    Raises RuntimeError if neither is available or both fail.
    """
    # Try faster-whisper Python library first
    try:
        return _run_faster_whisper(audio_path, lang)
    except ImportError:
        pass
    except RuntimeError as e:
        print(f"  ⚠ faster-whisper failed: {e}, trying whisperx CLI...")

    # Fall back to whisperx CLI
    if shutil.which("whisperx") is None:
        raise RuntimeError(
            "Neither faster-whisper nor whisperx available. "
            "Install with: pip install faster-whisper"
        )

    audio_path = Path(audio_path)
    with tempfile.TemporaryDirectory(prefix="tiktok-align-") as tmp_dir:
        out_dir = Path(tmp_dir) / "wx-out"
        out_dir.mkdir()

        cmd = [
            "whisperx",
            str(audio_path),
            "--output_format", "json",
            "--output_dir", str(out_dir),
        ]
        if lang != "auto":
            cmd.extend(["--language", lang])

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            stderr = (result.stderr or "")[:600]
            raise RuntimeError(f"whisperx failed (exit {result.returncode}): {stderr}")

        json_files = list(out_dir.glob("*.json"))
        if not json_files:
            raise RuntimeError("whisperx produced no JSON output")

        raw = json_files[0].read_text(encoding="utf-8")
        return parse_whisperx_json(raw)


def _run_faster_whisper(
    audio_path: str | Path,
    lang: str = "th",
) -> list[TranscriptSegment]:
    """Run faster-whisper Python library for transcription with word timestamps."""
    from faster_whisper import WhisperModel

    audio_path = str(audio_path)
    print("  → Loading faster-whisper model (medium)...")
    model = WhisperModel("medium", device="cpu", compute_type="int8")

    print(f"  → Transcribing ({lang})...")
    segments_gen, info = model.transcribe(
        audio_path,
        language=lang if lang != "auto" else None,
        word_timestamps=True,
    )

    segments = []
    for segment in segments_gen:
        text = segment.text.strip()
        if not text:
            continue
        start = segment.start
        end = max(segment.end, start + 0.6)
        segments.append(TranscriptSegment(start_sec=start, end_sec=end, text=text))

    print(f"  → {len(segments)} segments transcribed")
    return segments


def parse_whisperx_json(raw: str) -> list[TranscriptSegment]:
    """Parse raw WhisperX JSON output into TranscriptSegments.

    Compatible with WhisperX format: {segments: [{start, end, text, words?}]}
    """
    data = json.loads(raw)

    if isinstance(data, dict):
        segments_raw = data.get("segments", [])
    elif isinstance(data, list):
        segments_raw = data
    else:
        return []

    segments = []
    for seg in segments_raw:
        if not isinstance(seg, dict):
            continue
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        # Enforce minimum segment duration (0.6s), same as TS version
        end = max(start + 0.6, end)
        segments.append(TranscriptSegment(start_sec=start, end_sec=end, text=text))

    return segments


# ---------------------------------------------------------------------------
# Manual timestamps (CSV fallback)
# ---------------------------------------------------------------------------


def load_manual_timestamps(csv_path: str | Path) -> list[TranscriptSegment]:
    """Load manual timestamps from a CSV file.

    Expected format:
        beat_index,start_sec,end_sec[,text]

    The text column is optional. Returns segments sorted by start_sec.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Timestamps file not found: {path}")

    segments: list[TranscriptSegment] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            segments.append(TranscriptSegment(
                start_sec=float(row["start_sec"]),
                end_sec=float(row["end_sec"]),
                text=row.get("text", "").strip(),
            ))

    segments.sort(key=lambda s: s.start_sec)
    return segments


# ---------------------------------------------------------------------------
# Probe duration
# ---------------------------------------------------------------------------


def get_duration(media_path: str | Path) -> float:
    """Get duration of a media file in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        str(media_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr[:300]}")

    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python audio_utils.py <media_file> [--timestamps timestamps.csv]")
        sys.exit(1)

    media = sys.argv[1]

    if "--timestamps" in sys.argv:
        csv_idx = sys.argv.index("--timestamps") + 1
        segs = load_manual_timestamps(sys.argv[csv_idx])
        print(f"Loaded {len(segs)} manual timestamps")
    else:
        print(f"Duration: {get_duration(media):.1f}s")
        wav = extract_audio(media)
        print(f"Extracted audio to: {wav}")

        if whisperx_available():
            segs = run_whisperx(wav)
            print(f"WhisperX returned {len(segs)} segments:")
            for s in segs[:10]:
                print(f"  [{s.start_sec:.1f}-{s.end_sec:.1f}] {s.text}")
        else:
            print("WhisperX not installed — use --timestamps for manual CSV fallback")
