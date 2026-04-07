#!/usr/bin/env python3
"""Fetch YouTube video transcript and output as plain text."""

import re
import sys
import json

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)


def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from a YouTube URL or return as-is if already an ID."""
    patterns = [
        r"(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    if re.match(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id
    print(f"Error: Could not extract video ID from '{url_or_id}'", file=sys.stderr)
    sys.exit(1)


def fetch_transcript(video_id: str) -> list:
    """Fetch transcript for a video, trying English first then any available language."""
    api = YouTubeTranscriptApi()
    try:
        # Try English first via the shortcut
        result = api.fetch(video_id, languages=["en"])
        return [{"text": s.text, "start": s.start, "duration": s.duration} for s in result]
    except NoTranscriptFound:
        pass
    except (TranscriptsDisabled, VideoUnavailable) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Fall back to any available transcript
    try:
        transcript_list = api.list(video_id)
        for transcript in transcript_list:
            result = transcript.fetch()
            return [{"text": s.text, "start": s.start, "duration": s.duration} for s in result]
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print("Error: No transcript available for this video.", file=sys.stderr)
    sys.exit(1)


def format_transcript(segments: list, with_timestamps: bool = False) -> str:
    """Format transcript segments into readable text."""
    lines = []
    for seg in segments:
        if with_timestamps:
            mins, secs = divmod(int(seg["start"]), 60)
            hours, mins = divmod(mins, 60)
            ts = f"[{hours:02d}:{mins:02d}:{secs:02d}]" if hours else f"[{mins:02d}:{secs:02d}]"
            lines.append(f"{ts} {seg['text']}")
        else:
            lines.append(seg["text"])
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: fetch_transcript.py <youtube-url-or-id> [--timestamps] [--json]", file=sys.stderr)
        sys.exit(1)

    video_id = extract_video_id(sys.argv[1])
    with_timestamps = "--timestamps" in sys.argv
    as_json = "--json" in sys.argv

    segments = fetch_transcript(video_id)

    if as_json:
        print(json.dumps(segments, indent=2))
    else:
        print(format_transcript(segments, with_timestamps=with_timestamps))
