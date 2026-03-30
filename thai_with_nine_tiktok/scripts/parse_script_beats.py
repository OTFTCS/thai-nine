"""
Parse Thai TikTok episode scripts (.md) into an ordered list of beats.

Each beat has a type and associated text fields. The beats are ordered
as they appear in the script and represent the visual/audio events
that need to be timed against the recording.

Usage:
    from parse_script_beats import parse_episode_script, Beat
    beats = parse_episode_script("series/thai-classifiers/scripts/episode-02.md")
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Literal

BeatType = Literal[
    "thai_triplet",
    "perform",
    "buzzer",
    "pause_challenge",
    "reveal",
    "stage_direction",
    "english_line",
]


@dataclass
class Beat:
    """A single visual/audio beat parsed from a script."""

    beat_type: BeatType
    index: int = 0

    # thai_triplet fields
    thai: str = ""
    translit: str = ""
    gloss: str = ""
    english: str = ""

    # perform fields
    perform_text: str = ""

    # buzzer fields
    buzzer_label: str = ""  # e.g. "Wrong.", "Still wrong."

    # pause_challenge fields
    pause_seconds: int = 3

    # stage_direction fields
    direction: str = ""

    # english_line fields
    english_line_text: str = ""

    # classifier info (enriched from episodes.json)
    classifier: str = ""


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Thai triplet: **Thai** | translit | gloss | meaning
# Note: the Thai part may be inside **bold** markers
_RE_TRIPLET = re.compile(
    r"^\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$"
)
# Unbolded triplet: Thai | translit | gloss | meaning (no ** wrappers)
_RE_TRIPLET_PLAIN = re.compile(
    r"^([^|*]+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$"
)

# [PERFORM] "text" or **[PERFORM] "text"** — capture the quoted text
_RE_PERFORM = re.compile(
    r'\*?\*?\[PERFORM\]\*?\*?\s*["""](.+?)["""]', re.IGNORECASE
)

# Buzzer: [BUZZER] or (X) — optionally followed by text like "Wrong."
_RE_BUZZER = re.compile(
    r"^(?:\[BUZZER\]|\(X\))\s*(.*)?$", re.IGNORECASE
)

# Also match lines like: (X) incorrect buzzer
_RE_BUZZER_ALT = re.compile(
    r"^\(X\)\s+(.*)$", re.IGNORECASE
)

# Pause: [PAUSE 3s ...] or [PAUSE 3s — ...]
_RE_PAUSE = re.compile(
    r"\[PAUSE\s+(\d+)s", re.IGNORECASE
)

# Reveal: [Reveal]
_RE_REVEAL = re.compile(
    r"^\[Reveal\]$", re.IGNORECASE
)

# Stage direction: [To camera], [Beat], [MINI-SCENE: ...], [Rapid fire, ...],
# [Say the wrong ...], [Back to camera], etc.
_RE_STAGE_DIRECTION = re.compile(
    r"^\[([^\]]+)\]$"
)

# Bold English line (no pipes) — e.g. **One student. One cat.**
_RE_ENGLISH_BOLD = re.compile(
    r"^\*\*([^|*]+)\*\*\.?$"
)


def _strip_bold(text: str) -> str:
    """Remove markdown bold markers."""
    return text.replace("**", "").strip()


def _clean_quotes(text: str) -> str:
    """Strip trailing quote characters (straight and curly) and whitespace."""
    return text.strip().rstrip('"\u201c\u201d\u2018\u2019')


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------


def parse_episode_script(script_path: str | Path) -> list[Beat]:
    """Parse a .md episode script into an ordered list of Beat objects.

    Stops parsing at "On-screen beats:" section (stage directions for
    editors, not spoken content).
    """
    path = Path(script_path)
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    beats: list[Beat] = []
    idx = 0

    for line_num, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue

        # Stop at the "On-screen beats:" metadata section
        if line.startswith("On-screen beats:"):
            break

        # Skip header lines (Episode title, Target runtime, Goal, etc.)
        if line.startswith("Episode ") or line.startswith("Target runtime:"):
            continue
        if line.startswith("Goal:") or line.startswith("Full script:"):
            continue
        if line.startswith("### "):
            continue

        # --- Order matters: check specific patterns before generic ones ---

        # 1. Standalone [PERFORM] (no pipe-delimited triplet on same line)
        m_perform = _RE_PERFORM.search(line)
        has_pipes = "|" in line
        if m_perform and not has_pipes:
            beats.append(Beat(
                beat_type="perform",
                index=idx,
                perform_text=_clean_quotes(m_perform.group(1)),
            ))
            idx += 1
            continue

        # 2. Thai triplet (may have [PERFORM] after it on the same line)
        # Match against raw line (bold markers intact) since regex expects **...**
        m_triplet = _RE_TRIPLET.match(line) or _RE_TRIPLET_PLAIN.match(line)
        if m_triplet:
            beats.append(Beat(
                beat_type="thai_triplet",
                index=idx,
                thai=m_triplet.group(1).strip(),
                translit=m_triplet.group(2).strip(),
                gloss=m_triplet.group(3).strip(),
                english=m_triplet.group(4).strip(),
            ))
            idx += 1

            # Check if same line also has [PERFORM]
            m_perf_inline = _RE_PERFORM.search(line)
            if m_perf_inline:
                beats.append(Beat(
                    beat_type="perform",
                    index=idx,
                    perform_text=_clean_quotes(m_perf_inline.group(1)),
                ))
                idx += 1
            continue

        # 3. Buzzer: [BUZZER] or (X)
        m_buzzer = _RE_BUZZER.match(line) or _RE_BUZZER_ALT.match(line)
        if m_buzzer:
            label = (m_buzzer.group(1) or "").strip()
            # Clean bold from label
            label = _strip_bold(label)
            beats.append(Beat(
                beat_type="buzzer",
                index=idx,
                buzzer_label=label,
            ))
            idx += 1
            continue

        # 4. Pause challenge: [PAUSE 3s ...]
        m_pause = _RE_PAUSE.search(line)
        if m_pause:
            beats.append(Beat(
                beat_type="pause_challenge",
                index=idx,
                pause_seconds=int(m_pause.group(1)),
            ))
            idx += 1
            continue

        # 5. Reveal
        if _RE_REVEAL.match(line):
            beats.append(Beat(
                beat_type="reveal",
                index=idx,
            ))
            idx += 1
            continue

        # 6. Stage direction: [anything in brackets on its own line]
        m_stage = _RE_STAGE_DIRECTION.match(line)
        if m_stage:
            beats.append(Beat(
                beat_type="stage_direction",
                index=idx,
                direction=m_stage.group(1).strip(),
            ))
            idx += 1
            continue

        # 7. Section labels like "Counting:", "Pointing:", "Describing:"
        if re.match(r"^[A-Z][a-z]+:$", line):
            beats.append(Beat(
                beat_type="stage_direction",
                index=idx,
                direction=line.rstrip(":"),
            ))
            idx += 1
            continue

        # 8. Bold English line (standalone statement, not a triplet)
        m_eng = _RE_ENGLISH_BOLD.match(line)
        if m_eng:
            beats.append(Beat(
                beat_type="english_line",
                index=idx,
                english_line_text=m_eng.group(1).strip(),
            ))
            idx += 1
            continue

        # 9. Plain text lines that are spoken (non-empty, not metadata)
        # These are English spoken lines without bold
        if line and not line.startswith("#") and not line.startswith("---"):
            beats.append(Beat(
                beat_type="english_line",
                index=idx,
                english_line_text=_strip_bold(line),
            ))
            idx += 1

    return beats


# ---------------------------------------------------------------------------
# Enrichment from episodes.json
# ---------------------------------------------------------------------------


def enrich_with_episode_data(
    beats: list[Beat],
    episodes_json_path: str | Path,
    episode_id: int | str,
) -> list[Beat]:
    """Cross-reference beats with episodes.json to add classifier info.

    Looks up the episode by number and adds classifier metadata to
    thai_triplet beats where the classifier appears in the Thai text.
    """
    path = Path(episodes_json_path)
    data = json.loads(path.read_text(encoding="utf-8"))

    episodes = data if isinstance(data, list) else data.get("episodes", [])
    episode = None
    for ep in episodes:
        ep_num = ep.get("episode", ep.get("id", ""))
        if str(ep_num) == str(episode_id):
            episode = ep
            break

    if not episode:
        return beats

    # Collect all classifiers mentioned in the episode
    classifiers: list[str] = []
    main_classifier = episode.get("classifier", "")
    if main_classifier:
        classifiers.append(main_classifier)
    for ex in episode.get("examples", []):
        c = ex.get("classifier", "")
        if c and c not in classifiers:
            classifiers.append(c)

    # Tag triplet beats where a classifier appears in the Thai text
    for beat in beats:
        if beat.beat_type == "thai_triplet":
            for c in classifiers:
                if c in beat.thai:
                    beat.classifier = c
                    break

    return beats


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------


def beats_to_json(beats: list[Beat]) -> str:
    """Serialize beats to JSON string."""
    return json.dumps([asdict(b) for b in beats], ensure_ascii=False, indent=2)


def summarize_beats(beats: list[Beat]) -> dict[str, int]:
    """Return a count of each beat type."""
    counts: dict[str, int] = {}
    for b in beats:
        counts[b.beat_type] = counts.get(b.beat_type, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python parse_script_beats.py <script.md> [episodes.json] [episode_id]")
        sys.exit(1)

    script_path = sys.argv[1]
    beats = parse_episode_script(script_path)

    if len(sys.argv) >= 4:
        beats = enrich_with_episode_data(beats, sys.argv[2], sys.argv[3])

    print(f"Parsed {len(beats)} beats:")
    for bt, count in summarize_beats(beats).items():
        print(f"  {bt}: {count}")
    print()
    for b in beats:
        if b.beat_type == "thai_triplet":
            print(f"  [{b.index:02d}] TRIPLET: {b.thai} | {b.translit}")
        elif b.beat_type == "perform":
            print(f"  [{b.index:02d}] PERFORM: {b.perform_text}")
        elif b.beat_type == "buzzer":
            print(f"  [{b.index:02d}] BUZZER: {b.buzzer_label}")
        elif b.beat_type == "pause_challenge":
            print(f"  [{b.index:02d}] PAUSE: {b.pause_seconds}s")
        elif b.beat_type == "reveal":
            print(f"  [{b.index:02d}] REVEAL")
        elif b.beat_type == "stage_direction":
            print(f"  [{b.index:02d}] STAGE: {b.direction}")
        elif b.beat_type == "english_line":
            print(f"  [{b.index:02d}] ENGLISH: {b.english_line_text[:60]}")
