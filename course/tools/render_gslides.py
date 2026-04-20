#!/usr/bin/env python3
"""Render a lesson deck to Google Slides from deck-source.json.

Mirrors the layout logic of render_lesson_deck.py (PPTX) but outputs to
Google Slides via the Slides API.  Uses a service account for headless auth.

Usage:
    python3 render_gslides.py --repo-root /path/to/repo --lesson M01-L001

Requires:
    pip install google-api-python-client google-auth Pillow
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ---------------------------------------------------------------------------
# Constants — mirrored from render_lesson_deck.py, converted to POINTS
# Google Slides uses Points (72 pt = 1 inch) or EMU (914400 EMU = 1 inch)
# We use PT dict format: {"magnitude": N, "unit": "PT"}
# ---------------------------------------------------------------------------

# Slide dimensions — Google Slides default 16:9 is 10" × 5.625"
# Our PPTX uses 13.333" × 7.5" — both are 16:9, so we scale by 0.75
SCALE = 10.0 / 13.333  # ≈ 0.75

# Convenience: convert inches to PT magnitude (scaled)
def _pt(inches: float) -> float:
    """Convert original PPTX inches to scaled Google Slides points."""
    return round(inches * SCALE * 72, 2)

def _pt_raw(inches: float) -> float:
    """Convert inches to points WITHOUT scaling (for absolute font sizes)."""
    return round(inches * 72, 2)

def pt(magnitude: float) -> dict:
    """Create a Slides API Dimension dict in PT."""
    return {"magnitude": magnitude, "unit": "PT"}

def emu(magnitude: float) -> dict:
    """Create a Slides API Dimension dict in EMU."""
    return {"magnitude": int(magnitude), "unit": "EMU"}

# Slide dimensions in PT
SLIDE_W_PT = _pt(13.333)   # 10" * 72 = 720 PT
SLIDE_H_PT = _pt(7.5)      # 5.625" * 72 = 405 PT

# PiP camera zone (top-right)
PIP_W_PT = _pt(4.2)
PIP_H_PT = _pt(3.15)
PIP_X_PT = SLIDE_W_PT - PIP_W_PT
PIP_Y_PT = 0.0
PIP_BOTTOM_PT = PIP_Y_PT + PIP_H_PT

# Content zones
CONTENT_LEFT_PT = _pt(0.8)
CONTENT_TOP_PT = _pt(1.15)
CONTENT_WIDTH_BESIDE_PIP_PT = PIP_X_PT - CONTENT_LEFT_PT - _pt(0.6)
CONTENT_WIDTH_PT = _pt(11.0)

# Colours (Google Slides uses 0-1 float RGB)
def hex_to_rgb(hex_str: str) -> dict:
    """Convert #RRGGBB to Slides API RgbColor dict (0-1 floats)."""
    hex_str = hex_str.lstrip("#")
    r, g, b = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)
    return {"red": r / 255.0, "green": g / 255.0, "blue": b / 255.0}

BG_IVORY = hex_to_rgb("#F5F7F8")
BG_SAND_LIGHT = hex_to_rgb("#DBE7EC")
INK_DARK = hex_to_rgb("#24333D")
INK_MEDIUM = hex_to_rgb("#566873")
INK_LIGHT = hex_to_rgb("#82909A")
ACCENT_GOLD = hex_to_rgb("#355C7D")
ACCENT_TEAL = hex_to_rgb("#7A8F54")
ACCENT_CLAY = hex_to_rgb("#C96F4A")
WHITE = hex_to_rgb("#FFFFFF")
DIVIDER_COLOR = hex_to_rgb("#C9D7DE")

# Font families
FONT_THAI = "Noto Sans Thai Looped"
FONT_LATIN = "Sarabun"
FONT_TRANSLIT = "Sarabun"

# Font sizes in PT (absolute — not scaled)
SIZE_TITLE = 36.0
SIZE_THAI_LARGE = 36.0
SIZE_THAI_MED = 30.0
SIZE_THAI_SMALL = 26.0
SIZE_TRANSLIT = 17.0
SIZE_ENGLISH = 17.0
SIZE_BODY = 22.0
SIZE_BODY_SMALL = 17.0
SIZE_LABEL = 12.0

# ---------------------------------------------------------------------------
# Helper: unique object ID generator
# ---------------------------------------------------------------------------

_OBJ_COUNTER = 0

def _new_id(prefix: str = "obj") -> str:
    global _OBJ_COUNTER
    _OBJ_COUNTER += 1
    return f"{prefix}_{_OBJ_COUNTER:04d}"


# ---------------------------------------------------------------------------
# Google Slides API request builders
# ---------------------------------------------------------------------------

def req_create_slide(slide_id: str, layout: str = "BLANK") -> dict:
    """Create a blank slide."""
    return {
        "createSlide": {
            "objectId": slide_id,
            "slideLayoutReference": {"predefinedLayout": layout},
        }
    }


def req_set_slide_bg(slide_id: str, color: dict) -> dict:
    """Set solid background colour on a slide."""
    return {
        "updatePageProperties": {
            "objectId": slide_id,
            "pageProperties": {
                "pageBackgroundFill": {
                    "solidFill": {
                        "color": {"rgbColor": color}
                    }
                }
            },
            "fields": "pageBackgroundFill",
        }
    }


def req_create_textbox(
    object_id: str,
    page_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
) -> dict:
    """Create a text box shape at exact position."""
    return {
        "createShape": {
            "objectId": object_id,
            "shapeType": "TEXT_BOX",
            "elementProperties": {
                "pageObjectId": page_id,
                "size": {
                    "width": pt(width_pt),
                    "height": pt(height_pt),
                },
                "transform": {
                    "scaleX": 1,
                    "scaleY": 1,
                    "translateX": left_pt,
                    "translateY": top_pt,
                    "unit": "PT",
                },
            },
        }
    }


def req_create_shape(
    object_id: str,
    page_id: str,
    shape_type: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
) -> dict:
    """Create a shape (rectangle, oval, etc.) at exact position."""
    return {
        "createShape": {
            "objectId": object_id,
            "shapeType": shape_type,
            "elementProperties": {
                "pageObjectId": page_id,
                "size": {
                    "width": pt(width_pt),
                    "height": pt(height_pt),
                },
                "transform": {
                    "scaleX": 1,
                    "scaleY": 1,
                    "translateX": left_pt,
                    "translateY": top_pt,
                    "unit": "PT",
                },
            },
        }
    }


def req_insert_text(object_id: str, text: str, index: int = 0) -> dict:
    """Insert text into a shape."""
    return {
        "insertText": {
            "objectId": object_id,
            "insertionIndex": index,
            "text": text,
        }
    }


def req_update_text_style(
    object_id: str,
    start: int,
    end: int,
    *,
    font_family: str | None = None,
    font_size: float | None = None,
    bold: bool | None = None,
    italic: bool | None = None,
    color: dict | None = None,
) -> dict:
    """Update text style for a character range."""
    style: dict[str, Any] = {}
    fields: list[str] = []
    if font_family is not None:
        style["fontFamily"] = font_family
        fields.append("fontFamily")
    if font_size is not None:
        style["fontSize"] = pt(font_size)
        fields.append("fontSize")
    if bold is not None:
        style["bold"] = bold
        fields.append("bold")
    if italic is not None:
        style["italic"] = italic
        fields.append("italic")
    if color is not None:
        style["foregroundColor"] = {"opaqueColor": {"rgbColor": color}}
        fields.append("foregroundColor")
    return {
        "updateTextStyle": {
            "objectId": object_id,
            "textRange": {
                "type": "FIXED_RANGE",
                "startIndex": start,
                "endIndex": end,
            },
            "style": style,
            "fields": ",".join(fields),
        }
    }


def req_update_paragraph_style(
    object_id: str,
    start: int,
    end: int,
    alignment: str = "START",
) -> dict:
    """Update paragraph alignment. alignment: START, CENTER, END."""
    return {
        "updateParagraphStyle": {
            "objectId": object_id,
            "textRange": {
                "type": "FIXED_RANGE",
                "startIndex": start,
                "endIndex": end,
            },
            "style": {"alignment": alignment},
            "fields": "alignment",
        }
    }


def req_shape_fill(object_id: str, color: dict) -> dict:
    """Set solid fill on a shape."""
    return {
        "updateShapeProperties": {
            "objectId": object_id,
            "shapeProperties": {
                "shapeBackgroundFill": {
                    "solidFill": {
                        "color": {"rgbColor": color}
                    }
                }
            },
            "fields": "shapeBackgroundFill",
        }
    }


def req_shape_outline(
    object_id: str,
    color: dict | None = None,
    weight_pt: float = 1.0,
    dash_style: str = "SOLID",
) -> dict:
    """Set outline on a shape. Set color=None to remove outline."""
    if color is None:
        return {
            "updateShapeProperties": {
                "objectId": object_id,
                "shapeProperties": {
                    "outline": {
                        "propertyState": "NOT_RENDERED",
                    }
                },
                "fields": "outline",
            }
        }
    return {
        "updateShapeProperties": {
            "objectId": object_id,
            "shapeProperties": {
                "outline": {
                    "outlineFill": {
                        "solidFill": {
                            "color": {"rgbColor": color}
                        }
                    },
                    "weight": pt(weight_pt),
                    "dashStyle": dash_style,
                }
            },
            "fields": "outline",
        }
    }


def req_insert_image(
    object_id: str,
    page_id: str,
    image_url: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
) -> dict:
    """Insert an image from URL at exact position."""
    return {
        "createImage": {
            "objectId": object_id,
            "url": image_url,
            "elementProperties": {
                "pageObjectId": page_id,
                "size": {
                    "width": pt(width_pt),
                    "height": pt(height_pt),
                },
                "transform": {
                    "scaleX": 1,
                    "scaleY": 1,
                    "translateX": left_pt,
                    "translateY": top_pt,
                    "unit": "PT",
                },
            },
        }
    }


def req_create_speaker_notes(slide_id: str, notes_text: str) -> list[dict]:
    """Insert speaker notes on a slide. Returns list of requests."""
    notes_page_id = f"{slide_id}_notes"
    # Speaker notes use the notesPage's body shape which has a placeholder
    # We'll insert text via the notes page placeholder
    return [{
        "insertText": {
            "objectId": notes_page_id,
            "insertionIndex": 0,
            "text": notes_text,
        }
    }]


# ---------------------------------------------------------------------------
# High-level slide builders
# ---------------------------------------------------------------------------

def contains_thai(text: str) -> bool:
    return any("\u0E00" <= char <= "\u0E7F" for char in text)


def _you(text: str) -> str:
    """Replace 'Learner' with 'You' in user-facing text."""
    return (text
            .replace("Learner can ", "You can ")
            .replace("learner can ", "you can ")
            .replace("The learner ", "You ")
            .replace("the learner ", "you ")
            .replace("A learner ", "You ")
            .replace("a learner ", "you ")
            .replace("Learner ", "You ")
            .replace("learner ", "you "))


def parse_triplet_lines(lines: list[str]) -> list[tuple[str, str, str]]:
    triplets = []
    for line in lines:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3:
            triplets.append((parts[0], parts[1], parts[2]))
    return triplets


def translit_font_size(base_size: float) -> float:
    return max(SIZE_TRANSLIT, round(base_size * 0.62, 1))


def add_styled_textbox(
    requests: list,
    slide_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
    text: str,
    *,
    font_family: str = FONT_LATIN,
    font_size: float = SIZE_BODY,
    color: dict = INK_DARK,
    bold: bool = False,
    italic: bool = False,
    alignment: str = "START",
) -> str:
    """Add a text box with styled text. Returns the object ID."""
    obj_id = _new_id("tb")
    requests.append(req_create_textbox(obj_id, slide_id, left_pt, top_pt, width_pt, height_pt))

    if not text:
        return obj_id

    requests.append(req_insert_text(obj_id, text))
    requests.append(req_update_text_style(
        obj_id, 0, len(text),
        font_family=font_family,
        font_size=font_size,
        bold=bold,
        italic=italic,
        color=color,
    ))
    if alignment != "START":
        requests.append(req_update_paragraph_style(obj_id, 0, len(text), alignment))

    # Remove default outline
    requests.append(req_shape_outline(obj_id, color=None))

    return obj_id


def add_mixed_textbox(
    requests: list,
    slide_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    height_pt: float,
    segments: list[dict],
    *,
    alignment: str = "START",
) -> str:
    """Add a text box with mixed-font segments.

    Each segment: {"text": str, "font": str, "size": float, "color": dict,
                   "bold": bool, "italic": bool}
    """
    obj_id = _new_id("mtb")
    requests.append(req_create_textbox(obj_id, slide_id, left_pt, top_pt, width_pt, height_pt))

    full_text = "".join(seg["text"] for seg in segments)
    if not full_text:
        return obj_id

    requests.append(req_insert_text(obj_id, full_text))

    cursor = 0
    for seg in segments:
        end = cursor + len(seg["text"])
        if end > cursor:
            requests.append(req_update_text_style(
                obj_id, cursor, end,
                font_family=seg.get("font", FONT_LATIN),
                font_size=seg.get("size", SIZE_BODY),
                bold=seg.get("bold", False),
                italic=seg.get("italic", False),
                color=seg.get("color", INK_DARK),
            ))
        cursor = end

    if alignment != "START":
        requests.append(req_update_paragraph_style(obj_id, 0, len(full_text), alignment))

    requests.append(req_shape_outline(obj_id, color=None))
    return obj_id


def add_divider(requests: list, slide_id: str, left_pt: float, top_pt: float, width_pt: float, color: dict, height_pt: float = 2.0) -> str:
    """Add a thin coloured divider bar."""
    obj_id = _new_id("div")
    requests.append(req_create_shape(obj_id, slide_id, "RECTANGLE", left_pt, top_pt, width_pt, height_pt))
    requests.append(req_shape_fill(obj_id, color))
    requests.append(req_shape_outline(obj_id, color=None))
    return obj_id


def add_pip_placeholder(requests: list, slide_id: str) -> str:
    """Add PiP camera zone placeholder (semi-transparent rectangle + label)."""
    obj_id = _new_id("pip")
    requests.append(req_create_shape(obj_id, slide_id, "RECTANGLE", PIP_X_PT, PIP_Y_PT, PIP_W_PT, PIP_H_PT))
    requests.append(req_shape_fill(obj_id, BG_SAND_LIGHT))
    requests.append(req_shape_outline(obj_id, ACCENT_GOLD, weight_pt=1.5, dash_style="DASH"))
    requests.append(req_insert_text(obj_id, "Nine"))
    requests.append(req_update_text_style(
        obj_id, 0, 4,
        font_family=FONT_LATIN,
        font_size=18.0,
        bold=True,
        color=ACCENT_GOLD,
    ))
    requests.append(req_update_paragraph_style(obj_id, 0, 4, "CENTER"))
    return obj_id


def add_phrase_card(
    requests: list,
    slide_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    thai: str,
    translit: str,
    english: str,
    compact: bool = False,
) -> float:
    """Add a triplet phrase card (Thai / Transliteration / English). Returns bottom Y."""
    card_h = _pt(1.0) if compact else _pt(1.72)
    accent_h = _pt(0.72) if compact else _pt(1.25)

    # Gold accent stripe
    add_divider(
        requests, slide_id,
        left_pt + _pt(0.15),
        top_pt + (_pt(0.12) if compact else _pt(0.22)),
        _pt(0.08),
        ACCENT_GOLD,
        height_pt=accent_h,
    )

    text_left = left_pt + _pt(0.38)
    text_w = width_pt - _pt(0.5)

    if compact:
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.08), text_w, _pt(0.28),
                           thai, font_family=FONT_THAI, font_size=SIZE_BODY_SMALL)
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.36), text_w, _pt(0.26),
                           translit, font_family=FONT_TRANSLIT, font_size=SIZE_BODY_SMALL, color=INK_MEDIUM, italic=True)
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.62), text_w, _pt(0.26),
                           english, font_family=FONT_LATIN, font_size=SIZE_BODY_SMALL, color=INK_LIGHT)
    else:
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.15), text_w, _pt(0.35),
                           thai, font_family=FONT_THAI, font_size=SIZE_BODY_SMALL)
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.55), text_w, _pt(0.3),
                           translit, font_family=FONT_TRANSLIT, font_size=SIZE_BODY_SMALL, color=INK_MEDIUM, italic=True)
        add_styled_textbox(requests, slide_id, text_left, top_pt + _pt(0.96), text_w, _pt(0.3),
                           english, font_family=FONT_LATIN, font_size=SIZE_BODY_SMALL, color=INK_LIGHT)

    return top_pt + card_h


def add_section_header(requests: list, slide_id: str, title: str, eyebrow: str) -> float:
    """Add top accent bar + eyebrow label + title. Returns the Y where content can start."""
    add_divider(requests, slide_id, 0, 0, SLIDE_W_PT, ACCENT_GOLD, height_pt=_pt_raw(5.0 / 72))
    header_width = CONTENT_WIDTH_BESIDE_PIP_PT

    if eyebrow:
        add_styled_textbox(
            requests, slide_id,
            CONTENT_LEFT_PT, _pt(0.15), header_width, _pt(0.22),
            eyebrow,
            font_family=FONT_LATIN, font_size=SIZE_LABEL,
            color=ACCENT_GOLD, bold=True,
        )

    title_font = 22.0 if len(title) > 45 else 26.0 if len(title) > 30 else SIZE_TITLE
    title_top = _pt(0.4)
    title_height = _pt(0.85) if len(title) > 30 else _pt(0.6)
    add_styled_textbox(
        requests, slide_id,
        CONTENT_LEFT_PT, title_top, header_width, title_height,
        title,
        font_family=FONT_LATIN, font_size=title_font, bold=True,
    )
    return title_top + title_height + _pt(0.1)


def add_bullet_block(
    requests: list,
    slide_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    heading: str,
    lines: list[str],
    accent_color: dict,
) -> float:
    """Add a headed bullet list. Returns bottom Y in PT."""
    display_lines = lines[:5]

    # Heading
    add_styled_textbox(
        requests, slide_id,
        left_pt + _pt(0.22), top_pt + _pt(0.16), width_pt - _pt(0.4), _pt(0.25),
        heading,
        font_family=FONT_LATIN, font_size=SIZE_BODY_SMALL,
        color=accent_color, bold=True,
    )

    body_top = top_pt + _pt(0.48)
    text_width = width_pt - _pt(0.3)
    body_height = max(_pt(0.5), SLIDE_H_PT - body_top - _pt(0.3))

    # Combine all bullets into a single text box with bullet characters
    combined = "\n".join(f"• {_you(line)}" for line in display_lines)

    # Use smaller font if text is long to avoid overflow
    total_chars = sum(len(line) for line in display_lines)
    bullet_font = SIZE_LABEL if total_chars > 250 else 14.0 if total_chars > 150 else SIZE_BODY_SMALL

    add_styled_textbox(
        requests, slide_id,
        left_pt + _pt(0.15), body_top, text_width, body_height,
        combined,
        font_family=FONT_LATIN, font_size=bullet_font,
        color=INK_DARK,
    )

    return body_top + body_height


def add_dialogue_turn(
    requests: list,
    slide_id: str,
    left_pt: float,
    top_pt: float,
    width_pt: float,
    speaker: str,
    thai: str,
    translit: str,
    english: str,
    learner: bool = False,
) -> None:
    """Add a dialogue turn with speaker pill + triplet text."""
    pill_label = speaker.split("(")[0].strip() if "(" in speaker else speaker
    pill_w = max(_pt(1.15), _pt(0.12 * len(pill_label) + 0.3))
    pill_w = min(pill_w, _pt(2.5))
    pill_h = _pt(0.3)

    # Speaker pill
    pill_id = _new_id("pill")
    requests.append(req_create_shape(pill_id, slide_id, "ROUND_RECTANGLE", left_pt, top_pt, pill_w, pill_h))
    requests.append(req_shape_fill(pill_id, ACCENT_CLAY if learner else ACCENT_TEAL))
    requests.append(req_shape_outline(pill_id, color=None))
    requests.append(req_insert_text(pill_id, pill_label))
    requests.append(req_update_text_style(
        pill_id, 0, len(pill_label),
        font_family=FONT_LATIN, font_size=SIZE_LABEL,
        color=WHITE, bold=True,
    ))
    requests.append(req_update_paragraph_style(pill_id, 0, len(pill_label), "CENTER"))

    # Thai / Translit / English lines beside pill
    text_left = left_pt + _pt(1.35)
    text_w = width_pt - _pt(1.35)

    add_styled_textbox(
        requests, slide_id,
        text_left, top_pt - _pt(0.03), text_w, _pt(0.28),
        thai, font_family=FONT_THAI, font_size=SIZE_BODY_SMALL,
    )
    add_styled_textbox(
        requests, slide_id,
        text_left, top_pt + _pt(0.28), text_w, _pt(0.26),
        translit, font_family=FONT_TRANSLIT, font_size=SIZE_BODY_SMALL,
        color=INK_MEDIUM, italic=True,
    )
    add_styled_textbox(
        requests, slide_id,
        text_left, top_pt + _pt(0.56), text_w, _pt(0.26),
        english, font_family=FONT_LATIN, font_size=SIZE_BODY_SMALL,
        color=INK_MEDIUM,
    )


# ---------------------------------------------------------------------------
# Slide type renderers
# ---------------------------------------------------------------------------

def render_opener(
    requests: list,
    slide_id: str,
    slide_data: dict,
    row: dict[str, str],
) -> None:
    """Opener slide: accent bar, eyebrow, lesson ID, title, focus bullets."""
    add_divider(requests, slide_id, 0, 0, SLIDE_W_PT, ACCENT_GOLD, height_pt=_pt_raw(6.0 / 72))

    eyebrow = f"{row.get('module_title', '').strip()}  ·  {row.get('cefr_band', '').strip()}".strip(" ·")
    add_styled_textbox(
        requests, slide_id,
        CONTENT_LEFT_PT, _pt(1.75), CONTENT_WIDTH_BESIDE_PIP_PT, _pt(0.25),
        eyebrow or "Immersion Thai with Nine",
        font_family=FONT_LATIN, font_size=SIZE_LABEL,
        color=ACCENT_GOLD, bold=True,
    )
    add_styled_textbox(
        requests, slide_id,
        CONTENT_LEFT_PT, _pt(2.18), CONTENT_WIDTH_BESIDE_PIP_PT, _pt(0.36),
        row.get("lesson_id", slide_data["id"]),
        font_family=FONT_LATIN, font_size=20.0,
        color=INK_MEDIUM,
    )
    add_styled_textbox(
        requests, slide_id,
        CONTENT_LEFT_PT, _pt(2.78), CONTENT_WIDTH_BESIDE_PIP_PT, _pt(1.2),
        slide_data["title"],
        font_family=FONT_LATIN, font_size=32.0, bold=True,
    )

    note_lines = slide_data["textBlocks"][0]["lines"][:2]
    add_bullet_block(
        requests, slide_id,
        CONTENT_LEFT_PT, _pt(4.5), CONTENT_WIDTH_BESIDE_PIP_PT,
        "Lesson focus", note_lines, ACCENT_GOLD,
    )

    add_styled_textbox(
        requests, slide_id,
        CONTENT_LEFT_PT, _pt(6.2), CONTENT_WIDTH_PT, _pt(0.25),
        "Immersion Thai with Nine",
        font_family=FONT_LATIN, font_size=SIZE_LABEL,
        color=INK_LIGHT,
    )


def render_objectives(requests: list, slide_id: str, slide_data: dict) -> None:
    """Objectives slide: section header + 2×2 objective cards."""
    content_top = add_section_header(requests, slide_id, slide_data["title"], "Lesson objectives")

    lines = slide_data["textBlocks"][0]["lines"]
    card_w = _pt(3.5)
    row2_top = content_top + _pt(1.6)
    positions = [
        (CONTENT_LEFT_PT, content_top),
        (CONTENT_LEFT_PT + _pt(3.85), content_top),
        (CONTENT_LEFT_PT, row2_top),
        (CONTENT_LEFT_PT + _pt(3.85), row2_top),
    ]

    for idx, line in enumerate(lines[:4]):
        left, top = positions[idx]

        # Card number
        add_styled_textbox(
            requests, slide_id,
            left + _pt(0.24), top + _pt(0.18), _pt(0.4), _pt(0.25),
            str(idx + 1),
            font_family=FONT_LATIN, font_size=SIZE_LABEL,
            color=ACCENT_GOLD, bold=True,
        )
        # Card text
        add_styled_textbox(
            requests, slide_id,
            left + _pt(0.24), top + _pt(0.46), card_w - _pt(0.48), _pt(0.7),
            _you(line),
            font_family=FONT_LATIN, font_size=SIZE_BODY_SMALL,
            color=INK_DARK,
        )


def render_teaching(requests: list, slide_id: str, slide_data: dict) -> None:
    """Teaching slide: section header + triplet cards + practice bullets."""
    content_top = add_section_header(requests, slide_id, slide_data["title"], "Teaching slide")

    top = content_top
    usable_width = CONTENT_WIDTH_BESIDE_PIP_PT

    triplet_block = next((b for b in slide_data["textBlocks"] if b["kind"] == "triplet-list"), None)
    drill_block = next((b for b in slide_data["textBlocks"] if b["kind"] in ("bullet-list", "note")), None)

    current_top = top

    if triplet_block:
        parsed = parse_triplet_lines(triplet_block["lines"][:6])
        compact = len(parsed) > 4
        spacing = _pt(1.92) if len(parsed) <= 3 else _pt(1.4) if len(parsed) <= 4 else _pt(0.88)

        card_gap = _pt(0.12) if compact else _pt(0.2)
        for thai, translit, english in parsed:
            current_top = add_phrase_card(
                requests, slide_id,
                CONTENT_LEFT_PT, current_top, usable_width * 0.55,
                thai, translit, english, compact=compact,
            )
            current_top += card_gap

    if drill_block:
        # Place Practice below phrase cards, using full width below PiP zone
        drill_top = max(current_top + _pt(0.15), PIP_BOTTOM_PT + _pt(0.15))
        drill_width = CONTENT_WIDTH_PT  # full width since we're below PiP
        # Truncate long lines to ~80 chars to prevent overflow
        truncated = []
        for l in drill_block["lines"][:3]:
            t = _you(l)
            if len(t) > 80:
                t = t[:77] + "..."
            truncated.append(t)
        add_bullet_block(
            requests, slide_id,
            CONTENT_LEFT_PT, drill_top, drill_width,
            drill_block.get("heading", "Practice"),
            truncated,
            ACCENT_TEAL,
        )


def render_roleplay(requests: list, slide_id: str, slide_data: dict) -> None:
    """Roleplay slide: dialogue turns with speaker pills."""
    content_top = add_section_header(requests, slide_id, "Roleplay", "Roleplay")

    current_top = content_top
    for index, line in enumerate(slide_data["textBlocks"][0]["lines"][:5]):
        parts = [p.strip() for p in line.split("|", 3)]
        if len(parts) < 4:
            continue
        speaker, thai, translit, english = parts

        turn_width = CONTENT_WIDTH_BESIDE_PIP_PT if current_top < PIP_BOTTOM_PT else CONTENT_WIDTH_PT
        add_dialogue_turn(
            requests, slide_id,
            CONTENT_LEFT_PT, current_top, turn_width,
            speaker, thai, translit, english,
            learner=(index % 2 == 1),
        )
        current_top += _pt(1.0)


def render_recap(requests: list, slide_id: str, slide_data: dict) -> None:
    """Recap slide: checklist + takeaway."""
    content_top = add_section_header(requests, slide_id, slide_data["title"], "Recap")

    block_bottom = add_bullet_block(
        requests, slide_id,
        CONTENT_LEFT_PT, content_top, CONTENT_WIDTH_BESIDE_PIP_PT,
        "What you can now do",
        [_you(l) for l in slide_data["textBlocks"][0]["lines"][:5]],
        ACCENT_GOLD,
    )

    takeaway = slide_data["speakerNotes"][-1] if slide_data.get("speakerNotes") else "Ready to record."
    remember_top = max(block_bottom + _pt(0.3), PIP_BOTTOM_PT + _pt(0.15))
    add_bullet_block(
        requests, slide_id,
        CONTENT_LEFT_PT, remember_top, CONTENT_WIDTH_PT,
        "Remember", [takeaway], ACCENT_TEAL,
    )


def render_closing(requests: list, slide_id: str, slide_data: dict) -> None:
    """Closing slide: next steps bullets."""
    content_top = add_section_header(requests, slide_id, slide_data["title"], "Closing")

    add_bullet_block(
        requests, slide_id,
        CONTENT_LEFT_PT, content_top, CONTENT_WIDTH_BESIDE_PIP_PT,
        "Next steps",
        [_you(l) for l in slide_data["textBlocks"][0]["lines"][:4]],
        ACCENT_CLAY,
    )


# ---------------------------------------------------------------------------
# Main: Build full deck
# ---------------------------------------------------------------------------

def build_slide_requests(
    deck_source: dict,
    row: dict[str, str],
    lesson_id: str,
) -> list[dict]:
    """Build all Google Slides API requests for a full lesson deck."""
    global _OBJ_COUNTER
    _OBJ_COUNTER = 0

    requests: list[dict] = []

    for slide_idx, slide_data in enumerate(deck_source["slides"]):
        slide_id = f"slide_{slide_idx:02d}"

        # Create blank slide with ivory background
        requests.append(req_create_slide(slide_id))
        requests.append(req_set_slide_bg(slide_id, BG_IVORY))

        # Render content by role
        role = slide_data["role"]
        if role == "opener":
            render_opener(requests, slide_id, slide_data, row)
        elif role == "objectives":
            render_objectives(requests, slide_id, slide_data)
        elif role == "teaching":
            render_teaching(requests, slide_id, slide_data)
        elif role == "roleplay":
            render_roleplay(requests, slide_id, slide_data)
        elif role == "recap":
            render_recap(requests, slide_id, slide_data)
        else:
            render_closing(requests, slide_id, slide_data)

        # PiP placeholder on every slide (added last = rendered on top)
        add_pip_placeholder(requests, slide_id)

    return requests


def create_presentation(
    service,
    title: str,
    requests: list[dict],
    folder_id: str | None = None,
) -> dict:
    """Create a Google Slides presentation and apply all requests."""
    # Create presentation
    presentation = service.presentations().create(
        body={"title": title}
    ).execute()
    presentation_id = presentation["presentationId"]
    print(f"Created presentation: {presentation_id}")
    print(f"URL: https://docs.google.com/presentation/d/{presentation_id}/edit")

    # Delete the default blank first slide
    default_slides = presentation.get("slides", [])
    if default_slides:
        delete_requests = [
            {"deleteObject": {"objectId": default_slides[0]["objectId"]}}
        ]
        service.presentations().batchUpdate(
            presentationId=presentation_id,
            body={"requests": delete_requests},
        ).execute()

    # Apply all slide creation and content requests
    if requests:
        # Google Slides API has a max of ~1000 requests per batch
        # Split into chunks if needed
        chunk_size = 500
        for i in range(0, len(requests), chunk_size):
            chunk = requests[i : i + chunk_size]
            service.presentations().batchUpdate(
                presentationId=presentation_id,
                body={"requests": chunk},
            ).execute()
            print(f"  Applied requests {i+1}-{min(i+chunk_size, len(requests))} of {len(requests)}")

    # Move to folder if specified (requires Drive API)
    if folder_id:
        try:
            drive_service = build("drive", "v3", credentials=service._http.credentials)
            drive_service.files().update(
                fileId=presentation_id,
                addParents=folder_id,
                removeParents="root",
                fields="id, parents",
            ).execute()
            print(f"  Moved to folder: {folder_id}")
        except Exception as e:
            print(f"  Warning: Could not move to folder: {e}", file=sys.stderr)

    return {
        "presentationId": presentation_id,
        "url": f"https://docs.google.com/presentation/d/{presentation_id}/edit",
        "slideCount": len([r for r in requests if "createSlide" in r]),
    }


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
]


def get_slides_service(key_path: str | None = None, oauth_client_path: str | None = None):
    """Build an authenticated Google Slides API service.

    Prefers OAuth desktop flow (required for personal Google accounts).
    Falls back to service account if oauth_client_path is not provided.
    """
    if oauth_client_path and Path(oauth_client_path).exists():
        token_path = Path(oauth_client_path).parent / ".gslides-token.json"
        creds = None
        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                from google.auth.transport.requests import Request
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(str(oauth_client_path), SCOPES)
                creds = flow.run_local_server(port=8085, open_browser=True)
            token_path.write_text(creds.to_json())
        return build("slides", "v1", credentials=creds, cache_discovery=False)

    if key_path and Path(key_path).exists():
        credentials = service_account.Credentials.from_service_account_file(
            key_path, scopes=SCOPES,
        )
        return build("slides", "v1", credentials=credentials, cache_discovery=False)

    raise FileNotFoundError("No OAuth client or service account key found.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Render lesson deck to Google Slides")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    parser.add_argument("--lesson", required=True, help="Lesson ID (e.g. M01-L001)")
    parser.add_argument("--dry-run", action="store_true", help="Output JSON requests without calling API")
    parser.add_argument("--key", help="Path to service account JSON key (overrides config)")
    parser.add_argument("--share-with", action="append", default=[], help="Email to share with (repeatable)")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    lesson_id = args.lesson

    # Resolve paths
    match = re.fullmatch(r"(M\d{2})-(L\d{3})", lesson_id)
    if not match:
        print(f"Invalid lesson ID: {lesson_id}", file=sys.stderr)
        sys.exit(1)
    module_id, lesson_key = match.group(1), match.group(2)
    lesson_root = repo_root / "course" / "modules" / module_id / lesson_key

    deck_source_path = lesson_root / f"{lesson_id}-deck-source.json"
    if not deck_source_path.exists():
        print(f"deck-source.json not found: {deck_source_path}", file=sys.stderr)
        print("Run Stage 3 (PPTX mode) first to generate deck-source.json.", file=sys.stderr)
        sys.exit(1)

    deck_source = json.loads(deck_source_path.read_text(encoding="utf-8"))

    # Read blueprint row for opener metadata
    blueprint_path = repo_root / "course" / "exports" / "full-thai-course-blueprint.csv"
    row: dict[str, str] = {}
    if blueprint_path.exists():
        import csv
        with blueprint_path.open("r", encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("lesson_id", "").strip() == lesson_id:
                    row = {k: (v or "").strip() for k, v in r.items()}
                    break

    # Load config
    config_path = repo_root / "course" / "gslides-pipeline-config.json"
    config: dict = {}
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))

    # Build requests
    title = f"{lesson_id} — {deck_source['slides'][0].get('title', 'Lesson Deck')}"
    requests = build_slide_requests(deck_source, row, lesson_id)

    print(f"Built {len(requests)} API requests for {len(deck_source['slides'])} slides")

    if args.dry_run:
        output_path = lesson_root / f"{lesson_id}-gslides-requests.json"
        output_path.write_text(json.dumps(requests, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Dry run: wrote requests to {output_path}")
        return

    # Authenticate and create
    key_path = args.key or config.get("serviceAccountKeyPath", "")
    if key_path and not Path(key_path).exists():
        key_path = str(repo_root / key_path) if key_path else ""

    oauth_client_path = config.get("oauthClientPath", "")
    if oauth_client_path and not Path(oauth_client_path).exists():
        oauth_client_path = str(repo_root / oauth_client_path) if oauth_client_path else ""

    if not (oauth_client_path and Path(oauth_client_path).exists()) and not (key_path and Path(key_path).exists()):
        print("No credentials found.", file=sys.stderr)
        print("Set oauthClientPath (recommended) or serviceAccountKeyPath in gslides-pipeline-config.json", file=sys.stderr)
        sys.exit(1)

    service = get_slides_service(key_path=key_path, oauth_client_path=oauth_client_path)
    folder_id = config.get("targetDriveFolderId")
    result = create_presentation(service, title, requests, folder_id)

    # Share with specified emails
    share_emails = args.share_with or config.get("shareWith", [])
    if share_emails:
        try:
            drive_service = build("drive", "v3", credentials=service._http.credentials)
            for email in share_emails:
                drive_service.permissions().create(
                    fileId=result["presentationId"],
                    body={
                        "type": "user",
                        "role": "writer",
                        "emailAddress": email,
                    },
                    sendNotificationEmail=False,
                ).execute()
                print(f"  Shared with: {email}")
        except Exception as e:
            print(f"  Warning: Could not share: {e}", file=sys.stderr)

    # Write design record
    record_path = lesson_root / f"{lesson_id}-gslides-design.json"
    record = {
        "schemaVersion": 1,
        "lessonId": lesson_id,
        "presentationId": result["presentationId"],
        "url": result["url"],
        "slideCount": result["slideCount"],
        "pipeline": "gslides-direct-api",
        "fonts": {
            "thai": FONT_THAI,
            "latin": FONT_LATIN,
            "translit": FONT_TRANSLIT,
        },
    }
    record_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote design record: {record_path}")
    print(f"\nDone! Open: {result['url']}")


if __name__ == "__main__":
    main()
