"""Ingest script-master.json into SlideSpec[] for Manim rendering.

Transforms the canonical lesson data into a flat list of slides,
each with layout type, lexemes, drills, and speaker notes for timing.
"""

from __future__ import annotations

import json
from pathlib import Path

from .types import (
    DrillSpec,
    LexemeDisplay,
    MinimalPair,
    RoleplayLine,
    SlideSpec,
)


def _parse_lexeme(item: dict) -> LexemeDisplay:
    return LexemeDisplay(
        thai=item["thai"],
        translit=item["translit"],
        english=item["english"],
        type=item.get("type", "word"),
        notes=item.get("notes", ""),
    )


def _parse_drill(drill_text: str, section_lexemes: list[LexemeDisplay]) -> DrillSpec:
    """Parse a drill string into a DrillSpec with inferred type and pause."""
    text_lower = drill_text.lower()

    if "listen and repeat" in text_lower:
        dtype = "listen-repeat"
        pause = 3
    elif "pause-and-produce" in text_lower or "pause and produce" in text_lower or "your turn" in text_lower:
        dtype = "pause-produce"
        pause = 5
    elif "discrimination" in text_lower:
        dtype = "discrimination"
        pause = 5
    elif "substitution" in text_lower:
        dtype = "substitution"
        pause = 5
    elif "minimal pair" in text_lower or "tone echo" in text_lower:
        dtype = "minimal-pair"
        pause = 3
    else:
        dtype = "pause-produce"
        pause = 5

    return DrillSpec(
        type=dtype,
        instruction=drill_text,
        pause_seconds=pause,
        items=section_lexemes,
    )


def ingest_lesson(script_master_path: Path) -> list[SlideSpec]:
    """Parse a script-master.json into a list of SlideSpec for Manim rendering.

    Returns slides in presentation order:
      1. Opener (title + hook)
      2. Teaching sections (one per section)
      3. Roleplay
      4. Recap
      5. Pronunciation focus (if present)
    """
    data = json.loads(script_master_path.read_text(encoding="utf-8"))
    slides: list[SlideSpec] = []
    lesson_id = data["lessonId"]

    # --- Opener slide ---
    tf = data.get("teachingFrame", {})
    slides.append(SlideSpec(
        id=f"{lesson_id}-opener",
        role="opener",
        title=data["title"],
        layout="focus-card",
        hook_text=tf.get("openingHook", ""),
        objective_text=data.get("objective", ""),
        speaker_notes=[
            tf.get("openingHook", ""),
            tf.get("scenario", ""),
        ],
        estimated_seconds=15.0,
    ))

    # --- Teaching sections ---
    for i, section in enumerate(data.get("sections", []), start=1):
        lexemes = [_parse_lexeme(lf) for lf in section.get("languageFocus", [])]
        drills = [_parse_drill(d, lexemes) for d in section.get("drills", [])]

        vp = section.get("visualPlan", {})
        layout = vp.get("leftPanelLayout", "focus-card")

        # Estimate: ~6s per narration line + drill pauses
        narration_lines = section.get("spokenNarration", [])
        drill_pause_total = sum(d.pause_seconds for d in drills)
        est_seconds = max(len(narration_lines) * 6.0 + drill_pause_total, 15.0)

        slides.append(SlideSpec(
            id=f"{lesson_id}-s{i}",
            role="teaching",
            title=section.get("heading", f"Section {i}"),
            layout=layout,
            lexemes=lexemes,
            drills=drills,
            bullets=section.get("onScreenBullets", []),
            speaker_notes=narration_lines,
            estimated_seconds=est_seconds,
            section_num=i,
        ))

    # --- Roleplay slide ---
    rp = data.get("roleplay")
    if rp and rp.get("lines"):
        rp_lines = [
            RoleplayLine(
                speaker=line["speaker"],
                thai=line["thai"],
                translit=line["translit"],
                english=line["english"],
            )
            for line in rp["lines"]
        ]
        est_rp = max(len(rp_lines) * 5.0, 20.0)
        slides.append(SlideSpec(
            id=f"{lesson_id}-roleplay",
            role="roleplay",
            title="Roleplay: " + rp.get("scenario", "")[:60],
            layout="dialogue-ladder",
            roleplay_lines=rp_lines,
            speaker_notes=[rp.get("scenario", "")],
            estimated_seconds=est_rp,
        ))

    # --- Recap slide ---
    recap = data.get("recap", [])
    if recap:
        slides.append(SlideSpec(
            id=f"{lesson_id}-recap",
            role="recap",
            title="Recap",
            layout="drill-stack",
            recap_items=recap,
            speaker_notes=recap,
            estimated_seconds=max(len(recap) * 8.0, 20.0),
        ))

    # --- Pronunciation focus slide ---
    pf = data.get("pronunciationFocus")
    if pf:
        pairs = []
        for mp in pf.get("minimalPairs", []):
            pairs.append(MinimalPair(
                a=_parse_lexeme(mp["a"]),
                b=_parse_lexeme(mp["b"]),
            ))

        target_text = "; ".join(pf.get("targetSounds", []))
        slides.append(SlideSpec(
            id=f"{lesson_id}-pronunciation",
            role="pronunciation",
            title="Pronunciation Focus",
            layout="contrast-board",
            minimal_pairs=pairs,
            bullets=[
                target_text,
                pf.get("mouthMapAnchor", ""),
            ],
            speaker_notes=[target_text, pf.get("mouthMapAnchor", "")],
            estimated_seconds=30.0,
        ))

    return slides


def slides_to_json(slides: list[SlideSpec]) -> str:
    """Serialize slides to JSON for scene generation prompt."""
    import dataclasses
    return json.dumps(
        [dataclasses.asdict(s) for s in slides],
        ensure_ascii=False,
        indent=2,
    )
