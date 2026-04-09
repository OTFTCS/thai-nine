#!/usr/bin/env python3
"""
timestamp_audio.py — Manual tap-to-timestamp tool for YouTube episode scripts.

Replaces Whisper automatic alignment with a reliable manual workflow.
Plays audio via ffplay while the user taps spacebar at the start of each
spoken line. Writes displayStart/displayEnd directly into the script JSON.

Usage:
    # Full timestamping session
    python3 youtube/tools/timestamp_audio.py \
        --script youtube/examples/YT-S01-E01.json \
        --audio youtube/recordings/YT-S01-E01.m4a

    # Preview existing timestamps (replay with text overlay in terminal)
    python3 youtube/tools/timestamp_audio.py \
        --script youtube/examples/YT-S01-E01.json \
        --audio youtube/recordings/YT-S01-E01.m4a \
        --preview

    # Re-time a specific line
    python3 youtube/tools/timestamp_audio.py \
        --script youtube/examples/YT-S01-E01.json \
        --audio youtube/recordings/YT-S01-E01.m4a \
        --retune l-0015

Controls:
    SPACE  — mark timestamp for current line, advance to next
    p      — pause / resume audio
    q      — quit (saves progress)
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import termios
import time
import tty
from pathlib import Path
from typing import Optional


# ── Colours for terminal output ──────────────────────────────────────────────

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"


# ── Script helpers ───────────────────────────────────────────────────────────

def get_spoken_text(line: dict) -> Optional[str]:
    """Extract the text Nine speaks for a given line."""
    if not line.get("spoken", True):
        return None
    lang = line.get("lang", "")
    if lang in ("th", "th-split"):
        return line.get("thai", "")
    elif lang == "en":
        return line.get("english", "")
    elif lang == "mixed":
        parts = []
        if line.get("thai"):
            parts.append(line["thai"])
        if line.get("english"):
            parts.append(line["english"])
        return " ".join(parts)
    return None


def extract_spoken_lines(script: dict) -> list[dict]:
    """Return ordered list of {line, block_id, block_idx, line_idx} for spoken lines."""
    spoken = []
    for bi, block in enumerate(script.get("blocks", [])):
        for li, line in enumerate(block.get("lines", [])):
            text = get_spoken_text(line)
            if text:
                spoken.append({
                    "line": line,
                    "text": text,
                    "block_id": block["id"],
                    "block_idx": bi,
                    "line_idx": li,
                })
    return spoken


def compute_all_timestamps(script: dict) -> dict:
    """Auto-compute timestamps for non-spoken lines and displayEnd for all lines.

    Requires that spoken lines already have displayStart set.
    Modifies the script dict in-place and returns it.
    """
    blocks = script.get("blocks", [])

    for bi, block in enumerate(blocks):
        lines = block.get("lines", [])
        last_spoken_start = None
        last_spoken_end = None

        # Pass 1: compute displayStart for non-spoken lines
        for line in lines:
            if line.get("spoken", True) and get_spoken_text(line):
                # Spoken line — should already have displayStart
                last_spoken_start = line.get("displayStart")
                last_spoken_end = line.get("displayEnd")  # may be None yet
                # Estimate end if not set: look ahead to next spoken line
                if last_spoken_end is None and last_spoken_start is not None:
                    last_spoken_end = last_spoken_start + 3.0  # fallback
            else:
                # Non-spoken line — compute from display field
                display = line.get("display", "immediate")
                if display == "immediate":
                    line["displayStart"] = last_spoken_start
                elif display == "delayed-1s":
                    if last_spoken_end is not None:
                        line["displayStart"] = round(last_spoken_end + 1.0, 3)
                    elif last_spoken_start is not None:
                        line["displayStart"] = round(last_spoken_start + 1.0, 3)
                elif display == "delayed-2s":
                    if last_spoken_end is not None:
                        line["displayStart"] = round(last_spoken_end + 2.0, 3)
                    elif last_spoken_start is not None:
                        line["displayStart"] = round(last_spoken_start + 2.0, 3)

        # Pass 2: compute displayEnd for all lines
        # Each line's displayEnd = next line's displayStart in same block,
        # or block boundary for last line
        timestamped = [(i, line) for i, line in enumerate(lines)
                       if line.get("displayStart") is not None]

        for idx, (i, line) in enumerate(timestamped):
            if idx + 1 < len(timestamped):
                next_start = timestamped[idx + 1][1]["displayStart"]
                line["displayEnd"] = round(max(next_start, line["displayStart"] + 0.5), 3)
            else:
                # Last line in block: use next block's first displayStart, or +3s
                next_block_start = _get_next_block_start(blocks, bi)
                if next_block_start is not None:
                    line["displayEnd"] = round(next_block_start, 3)
                else:
                    line["displayEnd"] = round(line["displayStart"] + 3.0, 3)

        # Now update spoken line displayEnd estimates with real values
        # (Pass 1 used fallback; Pass 2 computed real values)
        # Re-run Pass 1 for delayed lines that used fallback spoken_end
        last_spoken_start = None
        last_spoken_end = None
        for line in lines:
            if line.get("spoken", True) and get_spoken_text(line):
                last_spoken_start = line.get("displayStart")
                last_spoken_end = line.get("displayEnd")
            else:
                display = line.get("display", "immediate")
                if display == "delayed-1s" and last_spoken_end is not None:
                    line["displayStart"] = round(last_spoken_end + 1.0, 3)
                elif display == "delayed-2s" and last_spoken_end is not None:
                    line["displayStart"] = round(last_spoken_end + 2.0, 3)

        # Pass 3: recompute displayEnd after Pass 2 updated delayed displayStarts
        timestamped = [(i, line) for i, line in enumerate(lines)
                       if line.get("displayStart") is not None]

        for idx, (i, line) in enumerate(timestamped):
            if idx + 1 < len(timestamped):
                next_start = timestamped[idx + 1][1]["displayStart"]
                line["displayEnd"] = round(max(next_start, line["displayStart"] + 0.5), 3)
            else:
                next_block_start = _get_next_block_start(blocks, bi)
                if next_block_start is not None:
                    line["displayEnd"] = round(next_block_start, 3)
                else:
                    line["displayEnd"] = round(line["displayStart"] + 3.0, 3)

    return script


def _get_next_block_start(blocks: list[dict], current_idx: int) -> Optional[float]:
    """Get the first displayStart from the next block, if any."""
    for bi in range(current_idx + 1, len(blocks)):
        for line in blocks[bi].get("lines", []):
            ds = line.get("displayStart")
            if ds is not None:
                return ds
    return None


# ── Terminal raw input ───────────────────────────────────────────────────────

class RawInput:
    """Context manager for raw terminal input (no echo, no line buffering)."""

    def __init__(self):
        self._fd = sys.stdin.fileno()
        self._old_settings = None

    def __enter__(self):
        self._old_settings = termios.tcgetattr(self._fd)
        tty.setcbreak(self._fd)
        return self

    def __exit__(self, *args):
        if self._old_settings:
            termios.tcsetattr(self._fd, termios.TCSADRAIN, self._old_settings)

    def read_key(self, timeout: float = 0.1) -> Optional[str]:
        """Read a single keypress. Returns None if no key within timeout."""
        import select
        rlist, _, _ = select.select([sys.stdin], [], [], timeout)
        if rlist:
            return sys.stdin.read(1)
        return None


# ── Audio playback ───────────────────────────────────────────────────────────

class AudioPlayer:
    """Wraps ffplay for audio playback with pause/resume and seek."""

    def __init__(self, audio_path: str):
        self.audio_path = audio_path
        self.process: Optional[subprocess.Popen] = None
        self.start_time: float = 0.0
        self.pause_elapsed: float = 0.0
        self.paused: bool = False
        self._pause_start: float = 0.0
        self._seek_offset: float = 0.0

    def play(self, seek: float = 0.0):
        """Start playback from a given position (seconds)."""
        self._seek_offset = seek
        cmd = [
            "ffplay", "-nodisp", "-autoexit",
            "-ss", f"{seek:.2f}",
            "-loglevel", "quiet",
            self.audio_path,
        ]
        self.process = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.start_time = time.monotonic()
        self.pause_elapsed = 0.0
        self.paused = False

    def elapsed(self) -> float:
        """Current playback position in seconds."""
        if self.paused:
            raw = self._pause_start - self.start_time - self.pause_elapsed
        else:
            raw = time.monotonic() - self.start_time - self.pause_elapsed
        return round(raw + self._seek_offset, 3)

    def toggle_pause(self):
        """Pause or resume playback."""
        if not self.process:
            return
        if self.paused:
            # Resume: send SIGCONT
            self.process.send_signal(signal.SIGCONT)
            self.pause_elapsed += time.monotonic() - self._pause_start
            self.paused = False
        else:
            # Pause: send SIGSTOP
            self.process.send_signal(signal.SIGSTOP)
            self._pause_start = time.monotonic()
            self.paused = True

    def stop(self):
        """Stop playback."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    self.process.kill()
                except ProcessLookupError:
                    pass

    def is_running(self) -> bool:
        if not self.process:
            return False
        return self.process.poll() is None


# ── Main timestamping session ────────────────────────────────────────────────

def run_timestamp_session(script: dict, audio_path: str) -> dict:
    """Interactive timestamping session. Returns modified script."""
    spoken_lines = extract_spoken_lines(script)
    total = len(spoken_lines)

    if total == 0:
        print("No spoken lines found in script.")
        return script

    print(f"\n{BOLD}Timestamp Session{RESET}")
    print(f"  {total} spoken lines to timestamp")
    print(f"  {CYAN}SPACE{RESET} = mark timestamp  {CYAN}p{RESET} = pause  {CYAN}q{RESET} = quit & save")
    print(f"\n  Press {CYAN}SPACE{RESET} to start playback...\n")

    player = AudioPlayer(audio_path)
    current = 0
    started = False

    # Show first line
    _print_line_prompt(spoken_lines[current], current, total, started=False)

    try:
        with RawInput() as raw:
            while current < total:
                key = raw.read_key(timeout=0.05)

                if key is None:
                    # Check if audio ended
                    if started and not player.is_running():
                        print(f"\n{YELLOW}Audio ended.{RESET} Saving progress ({current}/{total} lines timed).")
                        break
                    continue

                if key == " ":
                    if not started:
                        # First spacebar press starts playback
                        player.play()
                        started = True
                        # Don't mark first line yet — show it and wait for next press
                        _print_line_prompt(spoken_lines[current], current, total, started=True)
                        continue

                    # Mark current line
                    ts = player.elapsed()
                    spoken_lines[current]["line"]["displayStart"] = ts
                    _print_timestamp_marked(spoken_lines[current], current, total, ts)

                    current += 1
                    if current < total:
                        _print_line_prompt(spoken_lines[current], current, total, started=True)

                elif key == "p" and started:
                    player.toggle_pause()
                    state = "PAUSED" if player.paused else "RESUMED"
                    print(f"  {YELLOW}[{state}]{RESET} at {player.elapsed():.2f}s")

                elif key == "q":
                    print(f"\n{YELLOW}Quit.{RESET} Saving progress ({current}/{total} lines timed).")
                    break

    finally:
        player.stop()

    # Auto-compute non-spoken timestamps and displayEnd
    print(f"\n{DIM}Computing delayed line timestamps...{RESET}")
    compute_all_timestamps(script)

    timed_count = sum(
        1 for b in script["blocks"] for l in b["lines"]
        if l.get("displayStart") is not None
    )
    print(f"{GREEN}Done.{RESET} {timed_count} lines have timestamps.")

    return script


def run_retune(script: dict, audio_path: str, line_id: str) -> dict:
    """Re-time a specific line. Plays audio from 5s before its current timestamp."""
    # Find the line
    target_line = None
    target_block_idx = None
    for bi, block in enumerate(script.get("blocks", [])):
        for line in block.get("lines", []):
            if line["id"] == line_id:
                target_line = line
                target_block_idx = bi
                break
        if target_line:
            break

    if not target_line:
        print(f"Error: line {line_id} not found in script.")
        sys.exit(1)

    current_ts = target_line.get("displayStart")
    if current_ts is None:
        print(f"Error: line {line_id} has no displayStart. Run a full session first.")
        sys.exit(1)

    text = get_spoken_text(target_line) or target_line.get("english", "") or target_line.get("thai", "")
    seek_to = max(0, current_ts - 5.0)

    print(f"\n{BOLD}Retune: {line_id}{RESET}")
    print(f"  Current: {current_ts:.2f}s")
    print(f"  Text: {text[:80]}")
    print(f"\n  Playing from {seek_to:.1f}s. Press {CYAN}SPACE{RESET} at the correct moment.\n")

    player = AudioPlayer(audio_path)
    player.play(seek=seek_to)

    try:
        with RawInput() as raw:
            while player.is_running():
                key = raw.read_key(timeout=0.05)
                if key == " ":
                    ts = player.elapsed()
                    target_line["displayStart"] = ts
                    print(f"  {GREEN}Marked:{RESET} {ts:.3f}s (was {current_ts:.3f}s)")
                    break
                elif key == "q":
                    print(f"  {YELLOW}Cancelled.{RESET}")
                    player.stop()
                    return script
    finally:
        player.stop()

    # Recompute dependent timestamps
    compute_all_timestamps(script)
    print(f"{GREEN}Recomputed{RESET} dependent timestamps.")
    return script


def run_preview(script: dict, audio_path: str):
    """Preview mode: replay audio and print each line at its timestamp."""
    # Collect all timestamped lines in order
    events = []
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            ds = line.get("displayStart")
            if ds is None:
                continue
            lang = line.get("lang", "")
            if lang in ("th", "th-split"):
                text = line.get("thai", "")
            elif lang == "translit":
                text = line.get("translit", "")
            elif lang == "en":
                text = line.get("english", "")
            else:
                text = line.get("thai", "") or line.get("english", "")
            if text:
                events.append((ds, line["id"], lang, text, line.get("spoken", True)))

    events.sort(key=lambda e: e[0])

    if not events:
        print("No timestamps found. Run a timestamping session first.")
        return

    print(f"\n{BOLD}Preview Mode{RESET} — {len(events)} lines")
    print(f"  Press {CYAN}q{RESET} to stop\n")

    player = AudioPlayer(audio_path)
    player.play()
    event_idx = 0

    try:
        with RawInput() as raw:
            while player.is_running() and event_idx < len(events):
                key = raw.read_key(timeout=0.02)
                if key == "q":
                    break

                elapsed = player.elapsed()

                # Print any events that should have fired by now
                while event_idx < len(events) and events[event_idx][0] <= elapsed:
                    ts, lid, lang, text, spoken = events[event_idx]
                    spoken_marker = "" if spoken else f" {DIM}(display){RESET}"
                    lang_color = CYAN if lang in ("th", "th-split") else (YELLOW if lang == "translit" else "")
                    print(f"  {DIM}[{ts:7.2f}s]{RESET} {lang_color}{text[:70]}{RESET}{spoken_marker}")
                    event_idx += 1

    finally:
        player.stop()

    print(f"\n{GREEN}Preview complete.{RESET}")


# ── Mock timestamps ──────────────────────────────────────────────────────────

def run_mock_timestamps(script: dict) -> dict:
    """Generate estimated timestamps without audio. For testing/preview.

    Estimates ~3s per spoken Thai line, ~4s per spoken English line,
    with gaps between blocks.
    """
    spoken_lines = extract_spoken_lines(script)
    total = len(spoken_lines)

    print(f"\n{BOLD}Mock Timestamps{RESET}")
    print(f"  Generating estimated timing for {total} spoken lines...")

    current_time = 1.0  # Start 1s in

    prev_block = None
    for entry in spoken_lines:
        # Add gap between blocks
        if prev_block is not None and entry["block_id"] != prev_block:
            current_time += 1.5

        line = entry["line"]
        text = entry["text"]
        lang = line.get("lang", "th")

        # Estimate duration
        if lang in ("th", "th-split"):
            duration = max(2.0, len(text) * 0.15)  # ~0.15s per Thai char
        else:
            word_count = len(text.split())
            duration = max(2.0, word_count * 0.35)  # ~0.35s per English word

        line["displayStart"] = round(current_time, 3)
        current_time += duration + 0.3  # Small gap between lines
        prev_block = entry["block_id"]

    # Auto-compute non-spoken timestamps and displayEnd
    compute_all_timestamps(script)

    timed_count = sum(
        1 for b in script["blocks"] for l in b["lines"]
        if l.get("displayStart") is not None
    )
    print(f"{GREEN}Done.{RESET} {timed_count}/{sum(len(b['lines']) for b in script['blocks'])} lines timestamped.")

    return script


# ── Display helpers ──────────────────────────────────────────────────────────

def _print_line_prompt(entry: dict, idx: int, total: int, started: bool):
    """Print the current line waiting for timestamp."""
    line = entry["line"]
    lang = line.get("lang", "")
    block_id = entry["block_id"]

    prefix = f"  {DIM}[{idx+1}/{total}]{RESET} {DIM}{block_id}{RESET}"

    if lang in ("th", "th-split"):
        text = line.get("thai", "")
        translit = line.get("translit", "")
        print(f"{prefix}  {CYAN}{text}{RESET}")
        if translit:
            print(f"          {YELLOW}{translit}{RESET}")
    elif lang == "en":
        text = line.get("english", "")
        print(f"{prefix}  {text}")
    else:
        text = entry["text"]
        print(f"{prefix}  {text[:80]}")


def _print_timestamp_marked(entry: dict, idx: int, total: int, ts: float):
    """Print confirmation that a timestamp was marked."""
    print(f"  {GREEN}{ts:7.2f}s{RESET} <- {entry['line']['id']}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Manual tap-to-timestamp tool for YouTube episode scripts"
    )
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--audio", help="Path to audio file (M4A/WAV) — required unless --mock")
    parser.add_argument("--preview", action="store_true", help="Preview existing timestamps")
    parser.add_argument("--retune", metavar="LINE_ID", help="Re-time a specific line")
    parser.add_argument("--mock", action="store_true",
                        help="Generate estimated timestamps without audio (for testing)")
    parser.add_argument("--output", help="Output path (default: overwrite script in-place)")
    args = parser.parse_args()

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Error: script not found: {script_path}")
        sys.exit(1)

    script = json.loads(script_path.read_text(encoding="utf-8"))
    output_path = Path(args.output) if args.output else script_path

    if args.mock:
        script = run_mock_timestamps(script)
    elif args.preview:
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"Error: audio not found: {audio_path}")
            sys.exit(1)
        run_preview(script, str(audio_path))
        return
    elif args.retune:
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"Error: audio not found: {audio_path}")
            sys.exit(1)
        if not _which("ffplay"):
            print("Error: ffplay not found. Install ffmpeg: brew install ffmpeg")
            sys.exit(1)
        script = run_retune(script, str(audio_path), args.retune)
    else:
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"Error: audio not found: {audio_path}")
            sys.exit(1)
        if not _which("ffplay"):
            print("Error: ffplay not found. Install ffmpeg: brew install ffmpeg")
            sys.exit(1)
        script = run_timestamp_session(script, str(audio_path))

    # Write output
    output_path.write_text(
        json.dumps(script, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nSaved: {output_path}")


def _which(cmd: str) -> bool:
    """Check if a command is available on PATH."""
    from shutil import which
    return which(cmd) is not None


if __name__ == "__main__":
    main()
