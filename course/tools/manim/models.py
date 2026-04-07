"""Data types for the Manim lesson video pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class LexemeDisplay:
    """A single Thai vocabulary item with full triplet."""
    thai: str
    translit: str
    english: str
    type: str = "word"  # "word" or "chunk"
    highlight: bool = False
    notes: str = ""


@dataclass
class DrillSpec:
    """An active practice moment within a section."""
    type: str  # "listen-repeat", "pause-produce", "discrimination", "substitution", "minimal-pair", "tone-echo"
    instruction: str
    pause_seconds: int = 5
    items: list[LexemeDisplay] = field(default_factory=list)


@dataclass
class RoleplayLine:
    """A single line in a roleplay exchange."""
    speaker: str  # "You" or other speaker name
    thai: str
    translit: str
    english: str


@dataclass
class MinimalPair:
    """A pair of items for pronunciation discrimination."""
    a: LexemeDisplay
    b: LexemeDisplay


@dataclass
class SlideSpec:
    """Specification for one visual slide in the lesson."""
    id: str
    role: str  # "opener", "teaching", "roleplay", "recap", "pronunciation"
    title: str
    layout: str  # "focus-card", "contrast-board", "dialogue-ladder", "drill-stack", "image-anchored"
    lexemes: list[LexemeDisplay] = field(default_factory=list)
    drills: list[DrillSpec] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)
    speaker_notes: list[str] = field(default_factory=list)
    estimated_seconds: float = 30.0
    roleplay_lines: list[RoleplayLine] | None = None
    recap_items: list[str] | None = None
    minimal_pairs: list[MinimalPair] | None = None
    section_num: int | None = None
    hook_text: str = ""
    objective_text: str = ""


@dataclass
class TimedEvent:
    """A single visual event within a slide, with timing."""
    type: str  # "heading_show", "lexeme_reveal", "drill_cue", "drill_pause", "bullet_show",
               # "roleplay_line", "highlight", "recap_question", "minimal_pair", "transition"
    start_sec: float
    end_sec: float
    data: dict = field(default_factory=dict)


@dataclass
class TimedSlide:
    """A slide with absolute timing from audio alignment."""
    slide: SlideSpec
    start_sec: float
    end_sec: float
    events: list[TimedEvent] = field(default_factory=list)


@dataclass
class TranscriptSegment:
    """A timed segment of transcribed speech from faster-whisper."""
    start_sec: float
    end_sec: float
    text: str


@dataclass
class QAResult:
    """Result from a QA gate."""
    gate_name: str
    passed: bool
    issues: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
