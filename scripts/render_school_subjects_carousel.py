#!/usr/bin/env python3
"""Render school-subjects carousel PNGs with per-slide background colors
and improved text spacing.

─── Thai Text Style Preferences ───────────────────────────────────────
These were refined through iteration and should be reused in future carousels:

  Font:         Sarabun Medium (assets/fonts/Sarabun-Medium.ttf)
                NOT Bold — bold Sarabun renders blurry at these sizes.
                Use Regular for smaller supporting text (breakdowns).
  Colour:       #1a5276 (deep teal-blue) — distinct from dark-brown body text.
  Stroke:       0 — no stroke_width on Thai text. Stroke causes blur.
  English font: Tahoma Bold — fine for Latin glyphs, keeps contrast with Thai.
  Transliteration: Tahoma Bold, muted brown (#725d4e).

  Summary: Thai text = Sarabun Medium, teal-blue, no stroke.
───────────────────────────────────────────────────────────────────────
"""

import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# ── Paths ──────────────────────────────────────────────────────────────
ROOT = Path("/Users/Shared/work/thai-nine/archive/2026-03-10/thai-images/school-subjects-skill-trial")
MANIFEST_PATH = ROOT / "manifest.json"
PNG_DIR = ROOT / "out" / "final-png"
PREVIEW_DIR = ROOT / "out" / "preview"
PPTX_PATH = ROOT / "out" / "out.pptx"
COPY_MD_PATH = ROOT / "out" / "copy-spec.md"
COPY_CSV_PATH = ROOT / "out" / "copy-spec.csv"

FONT_REG = "/System/Library/Fonts/Supplemental/Tahoma.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"
FONT_FALLBACK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

REPO_ROOT = Path("/Users/Shared/work/thai-nine")
FONT_THAI_BOLD = str(REPO_ROOT / "assets/fonts/Sarabun-Bold.ttf")
FONT_THAI_MEDIUM = str(REPO_ROOT / "assets/fonts/Sarabun-Medium.ttf")
FONT_THAI_REGULAR = str(REPO_ROOT / "assets/fonts/Sarabun-Regular.ttf")

# ── Canvas ─────────────────────────────────────────────────────────────
W, H = 1080, 1350

# ── Per-slide background colours (soft, muted pastels) ─────────────────
SLIDE_COLORS: Dict[int, str] = {
    1:  "#ddd8cf",   # Cover — warm beige
    2:  "#d4dce8",   # Mathematics — soft blue
    3:  "#d6e5d4",   # Science — soft green
    4:  "#e8ddd4",   # Thai — warm sand
    5:  "#d4d8e8",   # English — lavender grey
    6:  "#e5ddd0",   # History — parchment
    7:  "#d0e0db",   # Geography — sage
    8:  "#e8d8df",   # Art — dusty rose
    9:  "#dde0d4",   # Music — soft olive
    10: "#d8dde5",   # Computer — steel blue
    11: "#dfe5d4",   # P.E. — lime mist
    12: "#e2dbd4",   # Social Studies — warm taupe
}

# ── Text colours ───────────────────────────────────────────────────────
COLORS = {
    "text": "#421f22",
    "muted": "#725d4e",
    "accent": "#d99028",
    "coverAccent": "#d99028",
    "thai": "#1a5276",        # Deep teal-blue — distinct & readable for Thai script
}

# ── Art frame ──────────────────────────────────────────────────────────
ART_FRAME = {"x": 300, "y": 84, "w": 480, "h": 720}
ART_BOTTOM = ART_FRAME["y"] + ART_FRAME["h"]  # 804

# ── Handle ─────────────────────────────────────────────────────────────
HANDLE_Y = 1306
HANDLE_H = 24

# ── Fonts ──────────────────────────────────────────────────────────────
def load_font(path: str, size: int):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(FONT_FALLBACK, size)


FONTS = {}


def init_fonts():
    global FONTS
    FONTS = {
        # Cover
        "coverTitle": load_font(FONT_BOLD, 66),
        "coverThai": load_font(FONT_THAI_MEDIUM, 50),
        "coverTranslit": load_font(FONT_BOLD, 30),
        "coverBreakdown": load_font(FONT_THAI_REGULAR, 28),
        "coverExampleThai": load_font(FONT_THAI_MEDIUM, 34),
        "coverExampleBody": load_font(FONT_REG, 26),
        # Teaching single
        "english": load_font(FONT_BOLD, 44),
        "thai": load_font(FONT_THAI_MEDIUM, 44),
        "translitInline": load_font(FONT_BOLD, 40),
        "breakdown": load_font(FONT_THAI_REGULAR, 24),
        "exampleThai": load_font(FONT_THAI_MEDIUM, 36),
        "exampleBody": load_font(FONT_REG, 26),
        # Handle
        "handle": load_font(FONT_BOLD, 18),
    }


# ── Helpers ────────────────────────────────────────────────────────────
def hex_rgb(value: str) -> Tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> List[str]:
    if not text:
        return [""]
    words = text.split()
    lines: List[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def font_line_height(font, line_gap=6):
    """Use actual font metrics (ascent+descent) instead of font.size to prevent
    Thai stacked diacritics (vowel+tone above consonant, e.g. น้ำ เพื่อน ที่)
    from being clipped."""
    ascent, descent = font.getmetrics()
    return ascent + descent + line_gap


def measure_text(draw, text, font, max_width, line_gap=6):
    lines = text.split("\n") if "\n" in text else wrap_lines(draw, text, font, max_width)
    line_height = font_line_height(font, line_gap)
    return lines, len(lines) * line_height


def draw_text_block(draw, x, y, w, text, font, fill, line_gap=6, align="center", stroke_width=0):
    lines, total_h = measure_text(draw, text, font, w, line_gap)
    line_height = font_line_height(font, line_gap)
    for idx, line in enumerate(lines):
        lx = x
        if align == "center":
            lx = x + max((w - draw.textlength(line, font=font)) / 2, 0)
        draw.text((lx, y + idx * line_height), line, font=font, fill=fill,
                  stroke_width=stroke_width, stroke_fill=fill)
    return total_h


def draw_centered_segments(draw, x, y, width, segments):
    total = sum(draw.textlength(text, font=font) for text, font, _, _ in segments)
    cursor = x + max((width - total) / 2, 0)
    max_h = 0
    for text, font, color, sw in segments:
        draw.text((cursor, y), text, font=font, fill=color, stroke_width=sw, stroke_fill=color)
        cursor += draw.textlength(text, font=font)
        max_h = max(max_h, sum(font.getmetrics()))
    return max_h


def format_breakdown(entries) -> str:
    return "\n".join(f"{e['thai']} = {e['english']} ({e['translit']})" for e in entries)


def fit_image(image_path: Path, box: Dict[str, int]) -> Image.Image:
    img = ImageOps.exif_transpose(Image.open(image_path).convert("RGB"))
    img = img.crop((0, 0, img.width, int(img.height * 0.84)))
    return ImageOps.fit(img, (box["w"], box["h"]), method=Image.Resampling.LANCZOS, centering=(0.5, 0.0))


def paste_image(base: Image.Image, fitted: Image.Image, box: Dict[str, int]):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (box["x"] + 8, box["y"] + 12, box["x"] + box["w"] + 8, box["y"] + box["h"] + 12),
        radius=26, fill=(70, 52, 36, 28),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    base.alpha_composite(shadow)
    base.alpha_composite(fitted.convert("RGBA"), (box["x"], box["y"]))


# ── Measure a single-slide text block height (for vertical centering) ──
def measure_single_block(draw, item):
    """Return total pixel height of the teaching-single text block."""
    w = 720
    h = 0
    # English heading
    _, eh = measure_text(draw, item["english"], FONTS["english"], w, 8)
    h += eh + 10  # heading + gap

    # Thai + translit line
    thai_h = max(FONTS["thai"].size, FONTS["translitInline"].size)
    h += thai_h + 16  # thai line + gap

    # Breakdown (if any)
    if item.get("breakdown"):
        _, bh = measure_text(draw, format_breakdown(item["breakdown"]), FONTS["breakdown"], w, 8)
        h += bh + 16  # breakdown + gap

    # Example Thai
    _, eth = measure_text(draw, item["example"]["thai"], FONTS["exampleThai"], w, 10)
    h += eth + 6

    # Example translit
    _, etr = measure_text(draw, item["example"]["translit"], FONTS["exampleBody"], w, 6)
    h += etr + 4

    # Example English
    _, een = measure_text(draw, item["example"]["english"], FONTS["exampleBody"], w, 6)
    h += een

    return h


# ── Render functions ───────────────────────────────────────────────────

def render_cover(slide):
    bg_color = SLIDE_COLORS.get(slide["index"], "#ddd8cf")
    image = Image.new("RGBA", (W, H), bg_color)
    paste_image(image, fit_image(ROOT / slide["image"], ART_FRAME), ART_FRAME)
    draw = ImageDraw.Draw(image)

    # Cover layout — fixed positions, tuned for balance
    cx, cw = 120, 840

    y = 820
    y += draw_text_block(draw, cx, y, cw, slide["heading"], FONTS["coverTitle"], COLORS["text"], 10, "center") + 10
    y += draw_text_block(draw, cx, y, cw, slide["thai"], FONTS["coverThai"], COLORS["thai"], 12, "center") + 6
    y += draw_text_block(draw, cx, y, cw, slide["translit"], FONTS["coverTranslit"], COLORS["muted"], 6, "center") + 12
    y += draw_text_block(draw, cx, y, cw, format_breakdown(slide["breakdown"]), FONTS["coverBreakdown"], COLORS["text"], 8, "center") + 20
    y += draw_text_block(draw, cx, y, cw, slide["example"]["thai"], FONTS["coverExampleThai"], COLORS["thai"], 10, "center") + 4
    y += draw_text_block(draw, cx, y, cw, slide["example"]["translit"], FONTS["coverExampleBody"], COLORS["text"], 6, "center") + 2
    draw_text_block(draw, cx, y, cw, slide["example"]["english"], FONTS["coverExampleBody"], COLORS["text"], 6, "center")

    # Handle
    draw_text_block(draw, 390, HANDLE_Y, 300, "@thaiwith.nine", FONTS["handle"], COLORS["text"], 4, "center")

    return image.convert("RGB")


def render_single(slide):
    bg_color = SLIDE_COLORS.get(slide["index"], "#ddd8cf")
    image = Image.new("RGBA", (W, H), bg_color)
    paste_image(image, fit_image(ROOT / slide["image"], ART_FRAME), ART_FRAME)
    draw = ImageDraw.Draw(image)

    item = slide["item"]
    cx, cw = 180, 720

    # Measure total text height and vertically center between art bottom and handle
    total_h = measure_single_block(draw, item)
    available = HANDLE_Y - 20 - (ART_BOTTOM + 20)  # usable vertical space
    y_start = ART_BOTTOM + 20 + max((available - total_h) // 2, 0)

    y = y_start

    # English heading
    y += draw_text_block(draw, cx, y, cw, item["english"], FONTS["english"], COLORS["text"], 8, "center") + 10

    # Thai + translit on same line
    draw_centered_segments(draw, cx, y, cw, [
        (item["thai"], FONTS["thai"], COLORS["thai"], 0),
        (f"({item['translit']})", FONTS["translitInline"], COLORS["muted"], 0),
    ])
    y += max(FONTS["thai"].size, FONTS["translitInline"].size) + 16

    # Breakdown (if any)
    if item.get("breakdown"):
        y += draw_text_block(draw, cx, y, cw, format_breakdown(item["breakdown"]), FONTS["breakdown"], COLORS["text"], 8, "center") + 16

    # Example sentence
    y += draw_text_block(draw, cx, y, cw, item["example"]["thai"], FONTS["exampleThai"], COLORS["thai"], 10, "center") + 6
    y += draw_text_block(draw, cx, y, cw, item["example"]["translit"], FONTS["exampleBody"], COLORS["text"], 6, "center") + 4
    draw_text_block(draw, cx, y, cw, item["example"]["english"], FONTS["exampleBody"], COLORS["text"], 6, "center")

    # Handle
    draw_text_block(draw, 390, HANDLE_Y, 300, "@thaiwith.nine", FONTS["handle"], COLORS["text"], 4, "center")

    return image.convert("RGB")


# ── Contact sheet ──────────────────────────────────────────────────────

def create_preview(out_files: List[Path], out_path: Path):
    thumb_w, thumb_h = 216, 270
    cols = 3
    rows = (len(out_files) + cols - 1) // cols
    margin = 20
    label_h = 28
    sheet = Image.new("RGB", (margin + cols * (thumb_w + margin),
                              margin + rows * (thumb_h + label_h + margin)), "white")
    font = load_font(FONT_REG, 16)
    for idx, path in enumerate(out_files):
        img = Image.open(path).convert("RGB")
        img.thumbnail((thumb_w, thumb_h))
        cell = Image.new("RGB", (thumb_w, thumb_h), "#f5f3ef")
        x = (thumb_w - img.width) // 2
        y = (thumb_h - img.height) // 2
        cell.paste(img, (x, y))
        row, col = divmod(idx, cols)
        sx = margin + col * (thumb_w + margin)
        sy = margin + row * (thumb_h + label_h + margin)
        sheet.paste(cell, (sx, sy))
        ImageDraw.Draw(sheet).text((sx, sy + thumb_h + 6), path.stem, font=font, fill="#333333")
    sheet.save(out_path, quality=92)


# ── Main ───────────────────────────────────────────────────────────────

def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    init_fonts()

    PNG_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    out_files = []
    for slide in manifest["slides"]:
        if slide["kind"] == "cover":
            canvas = render_cover(slide)
        else:
            canvas = render_single(slide)
        out_path = PNG_DIR / f"{slide['index']:02d}.png"
        canvas.save(out_path, quality=95)
        out_files.append(out_path)
        print(f"  ✓ {out_path.name}")

    create_preview(out_files, PREVIEW_DIR / "contact-sheet.jpg")
    print(f"\nRendered {len(out_files)} slides → {PNG_DIR}")


if __name__ == "__main__":
    main()
