#!/usr/bin/env python3
"""Generic Thai vocabulary carousel renderer.

Usage:
    python3 scripts/render_carousel.py --root "Thai images/thai-fruits"

Reads manifest.json + art/ from the given directory, renders 1080×1350 PNGs
to out/final-png/ with per-slide pastel backgrounds and vertically centred text.

─── Thai Text Style Rules (LOCKED) ───────────────────────────────────
  Font:         Sarabun Medium (assets/fonts/Sarabun-Medium.ttf)
                NOT Bold — bold Sarabun renders blurry at these sizes.
                Use Regular for smaller supporting text (breakdowns).
  Colour:       #1a5276 (deep teal-blue) — distinct from dark-brown body text.
  Stroke:       0 — never use stroke_width on Thai text. Stroke causes blur.
  English font: Tahoma Bold — fine for Latin glyphs, keeps contrast with Thai.
  Transliteration: Tahoma Bold, muted brown (#725d4e).
───────────────────────────────────────────────────────────────────────
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

# ── Repo root (for font paths) ────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent

# ── System fonts ──────────────────────────────────────────────────────
FONT_REG = "/System/Library/Fonts/Supplemental/Tahoma.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"
FONT_FALLBACK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

# ── Thai fonts (Sarabun — downloaded to assets/fonts/) ────────────────
FONT_THAI_MEDIUM = str(REPO_ROOT / "assets/fonts/Sarabun-Medium.ttf")
FONT_THAI_REGULAR = str(REPO_ROOT / "assets/fonts/Sarabun-Regular.ttf")

# ── Canvas ─────────────────────────────────────────────────────────────
W, H = 1080, 1350

# ── Pastel palette (auto-assigned to slides by index) ──────────────────
PASTEL_PALETTE = [
    "#ddd8cf",  # warm beige (always used for cover)
    "#d4dce8",  # soft blue
    "#d6e5d4",  # soft green
    "#e8ddd4",  # warm sand
    "#d4d8e8",  # lavender grey
    "#e5ddd0",  # parchment
    "#d0e0db",  # sage
    "#e8d8df",  # dusty rose
    "#dde0d4",  # soft olive
    "#d8dde5",  # steel blue
    "#dfe5d4",  # lime mist
    "#e2dbd4",  # warm taupe
    "#d9e3d6",  # mint
    "#e4d8e0",  # mauve
    "#dce0cc",  # pale khaki
]

# ── Text colours ───────────────────────────────────────────────────────
COLORS = {
    "text": "#421f22",
    "muted": "#725d4e",
    "accent": "#d99028",
    "thai": "#1a5276",
}

# ── Art frame ──────────────────────────────────────────────────────────
ART_FRAME = {"x": 300, "y": 84, "w": 480, "h": 720}
ART_BOTTOM = ART_FRAME["y"] + ART_FRAME["h"]  # 804

# ── Handle ─────────────────────────────────────────────────────────────
HANDLE_Y = 1306


# ── Font loading ───────────────────────────────────────────────────────
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


# ── Text helpers ───────────────────────────────────────────────────────
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


# ── Image helpers ──────────────────────────────────────────────────────
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


def slide_bg_color(index: int) -> str:
    """Return a pastel background colour for the given slide index."""
    return PASTEL_PALETTE[(index - 1) % len(PASTEL_PALETTE)]


# ── Measure text block height (for vertical centering) ─────────────────
def measure_single_block(draw, item):
    w = 720
    h = 0
    _, eh = measure_text(draw, item["english"], FONTS["english"], w, 8)
    h += eh + 10
    thai_h = max(sum(FONTS["thai"].getmetrics()), sum(FONTS["translitInline"].getmetrics()))
    h += thai_h + 16
    if item.get("breakdown"):
        _, bh = measure_text(draw, format_breakdown(item["breakdown"]), FONTS["breakdown"], w, 8)
        h += bh + 16
    _, eth = measure_text(draw, item["example"]["thai"], FONTS["exampleThai"], w, 10)
    h += eth + 6
    _, etr = measure_text(draw, item["example"]["translit"], FONTS["exampleBody"], w, 6)
    h += etr + 4
    _, een = measure_text(draw, item["example"]["english"], FONTS["exampleBody"], w, 6)
    h += een
    return h


# ── Render functions ───────────────────────────────────────────────────

def render_cover(slide, root: Path):
    bg_color = slide_bg_color(slide["index"])
    image = Image.new("RGBA", (W, H), bg_color)
    paste_image(image, fit_image(root / slide["image"], ART_FRAME), ART_FRAME)
    draw = ImageDraw.Draw(image)
    cx, cw = 120, 840

    y = 820
    y += draw_text_block(draw, cx, y, cw, slide["heading"], FONTS["coverTitle"], COLORS["text"], 10, "center") + 10
    y += draw_text_block(draw, cx, y, cw, slide["thai"], FONTS["coverThai"], COLORS["thai"], 12, "center") + 6
    y += draw_text_block(draw, cx, y, cw, slide["translit"], FONTS["coverTranslit"], COLORS["muted"], 6, "center") + 12
    y += draw_text_block(draw, cx, y, cw, format_breakdown(slide["breakdown"]), FONTS["coverBreakdown"], COLORS["text"], 8, "center") + 20
    y += draw_text_block(draw, cx, y, cw, slide["example"]["thai"], FONTS["coverExampleThai"], COLORS["thai"], 10, "center") + 4
    y += draw_text_block(draw, cx, y, cw, slide["example"]["translit"], FONTS["coverExampleBody"], COLORS["text"], 6, "center") + 2
    draw_text_block(draw, cx, y, cw, slide["example"]["english"], FONTS["coverExampleBody"], COLORS["text"], 6, "center")

    handle = slide.get("footer_handle", "@thaiwith.nine")
    draw_text_block(draw, 390, HANDLE_Y, 300, handle, FONTS["handle"], COLORS["text"], 4, "center")
    return image.convert("RGB")


def render_single(slide, root: Path, footer_handle: str = "@thaiwith.nine"):
    bg_color = slide_bg_color(slide["index"])
    image = Image.new("RGBA", (W, H), bg_color)
    paste_image(image, fit_image(root / slide["image"], ART_FRAME), ART_FRAME)
    draw = ImageDraw.Draw(image)

    item = slide["item"]
    cx, cw = 180, 720

    total_h = measure_single_block(draw, item)
    available = HANDLE_Y - 20 - (ART_BOTTOM + 20)
    y_start = ART_BOTTOM + 20 + max((available - total_h) // 2, 0)
    y = y_start

    y += draw_text_block(draw, cx, y, cw, item["english"], FONTS["english"], COLORS["text"], 8, "center") + 10

    draw_centered_segments(draw, cx, y, cw, [
        (item["thai"], FONTS["thai"], COLORS["thai"], 0),
        (f"({item['translit']})", FONTS["translitInline"], COLORS["muted"], 0),
    ])
    y += max(FONTS["thai"].size, FONTS["translitInline"].size) + 16

    if item.get("breakdown"):
        y += draw_text_block(draw, cx, y, cw, format_breakdown(item["breakdown"]), FONTS["breakdown"], COLORS["text"], 8, "center") + 16

    y += draw_text_block(draw, cx, y, cw, item["example"]["thai"], FONTS["exampleThai"], COLORS["thai"], 10, "center") + 6
    y += draw_text_block(draw, cx, y, cw, item["example"]["translit"], FONTS["exampleBody"], COLORS["text"], 6, "center") + 4
    draw_text_block(draw, cx, y, cw, item["example"]["english"], FONTS["exampleBody"], COLORS["text"], 6, "center")

    draw_text_block(draw, 390, HANDLE_Y, 300, footer_handle, FONTS["handle"], COLORS["text"], 4, "center")
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

def render_carousel(root: Path):
    """Render all slides from manifest.json in the given directory."""
    manifest_path = root / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No manifest.json in {root}")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    footer_handle = manifest.get("footer_handle", "@thaiwith.nine")
    init_fonts()

    png_dir = root / "out" / "final-png"
    preview_dir = root / "out" / "preview"
    png_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    out_files = []
    for slide in manifest["slides"]:
        if slide["kind"] == "cover":
            canvas = render_cover(slide, root)
        else:
            canvas = render_single(slide, root, footer_handle)
        out_path = png_dir / f"{slide['index']:02d}.png"
        canvas.save(out_path, quality=95)
        out_files.append(out_path)
        print(f"  ✓ {out_path.name}")

    create_preview(out_files, preview_dir / "contact-sheet.jpg")
    print(f"\nRendered {len(out_files)} slides → {png_dir}")
    return out_files


def main():
    parser = argparse.ArgumentParser(description="Render a Thai vocabulary carousel")
    parser.add_argument("--root", required=True, help="Path to carousel directory (contains manifest.json + art/)")
    args = parser.parse_args()
    root = Path(args.root)
    if not root.is_absolute():
        root = REPO_ROOT / root
    render_carousel(root)


if __name__ == "__main__":
    main()
