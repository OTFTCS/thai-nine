"""Generate layout mockup images to preview video frame designs.

Layouts:
  - 16:9 YouTube: Nine's 9:16 PiP fills right side, image top-left, card centre, subtitle bar below image
  - 9:16 Shorts: Nine full-screen, card + subtitle overlaid
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

_YT_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _YT_DIR.parent

# Colours
COL_THAI = (255, 255, 255)
COL_TRANSLIT = (255, 213, 79)
COL_ENGLISH = (179, 229, 252)
COL_CARD_BG = (27, 38, 49, 216)
COL_BAR = (0, 0, 0, 160)
COL_LABEL = (120, 120, 120)
COL_PIP_FILL = (40, 40, 55, 220)


def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    fonts_dir = _REPO_ROOT / "assets" / "fonts"
    name = "Sarabun-SemiBold.ttf" if bold else "Sarabun-Regular.ttf"
    path = fonts_dir / name
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _draw_rounded_rect(img: Image.Image, x: int, y: int, w: int, h: int,
                        color: tuple, radius: int = 12):
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=radius, fill=color)
    img.paste(overlay, (x, y), overlay)


def _draw_pip_zone(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int,
                    img: Image.Image, label: str = "Nine"):
    _draw_rounded_rect(img, x, y, w, h, COL_PIP_FILL, radius=0)
    draw.rectangle([(x, y), (x + w - 1, y + h - 1)], outline=(255, 255, 255, 25), width=1)
    font = _load_font(22)
    bb = draw.textbbox((0, 0), label, font=font)
    lw = bb[2] - bb[0]
    draw.text((x + w // 2 - lw // 2, y + h // 2 - 12), label, fill=(255, 255, 255, 70), font=font)


def _draw_card(draw: ImageDraw.Draw, img: Image.Image, cx: int, cy: int,
               thai: str, translit: str, english: str, scale: float = 1.0):
    ft = _load_font(int(80 * scale), bold=True)
    ftr = _load_font(int(32 * scale))
    fen = _load_font(int(32 * scale))

    bb_th = draw.textbbox((0, 0), thai, font=ft)
    bb_tr = draw.textbbox((0, 0), translit, font=ftr)
    bb_en = draw.textbbox((0, 0), english, font=fen)

    th_w, th_h = bb_th[2] - bb_th[0], bb_th[3] - bb_th[1]
    tr_w, tr_h = bb_tr[2] - bb_tr[0], bb_tr[3] - bb_tr[1]
    en_w, en_h = bb_en[2] - bb_en[0], bb_en[3] - bb_en[1]

    gap = int(10 * scale)
    content_h = th_h + gap + tr_h + gap + en_h
    content_w = max(th_w, tr_w, en_w)

    pad_x, pad_y = int(70 * scale), int(40 * scale)
    card_w = content_w + pad_x * 2
    card_h = content_h + pad_y * 2
    card_x = cx - card_w // 2
    card_y = cy - card_h // 2

    _draw_rounded_rect(img, card_x, card_y, card_w, card_h, COL_CARD_BG, radius=14)

    ty = card_y + pad_y
    draw.text((cx - th_w // 2, ty), thai, fill=COL_THAI, font=ft)
    ty += th_h + gap
    draw.text((cx - tr_w // 2, ty), translit, fill=COL_TRANSLIT, font=ftr)
    ty += tr_h + gap
    draw.text((cx - en_w // 2, ty), english, fill=COL_ENGLISH, font=fen)


def _draw_subtitle_bar(draw: ImageDraw.Draw, img: Image.Image, x: int, y: int,
                        w: int, h: int, text: str):
    bar = Image.new("RGBA", (w, h), COL_BAR)
    img.paste(bar, (x, y), bar)
    font = _load_font(26)
    bb = draw.textbbox((0, 0), text, font=font)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    draw.text((x + (w - tw) // 2, y + (h - th) // 2), text, fill=COL_ENGLISH, font=font)


def _paste_bg_image(img: Image.Image, bg_path: Path | None, x: int, y: int,
                     w: int, h: int, darken: int = 60):
    if bg_path and bg_path.exists():
        bg = Image.open(bg_path).convert("RGBA")
        # Crop to target aspect ratio then resize
        src_w, src_h = bg.size
        target_ratio = w / h
        src_ratio = src_w / src_h
        if src_ratio > target_ratio:
            new_w = int(src_h * target_ratio)
            crop_x = (src_w - new_w) // 2
            bg = bg.crop((crop_x, 0, crop_x + new_w, src_h))
        else:
            new_h = int(src_w / target_ratio)
            crop_y = (src_h - new_h) // 2
            bg = bg.crop((0, crop_y, src_w, crop_y + new_h))
        bg = bg.resize((w, h), Image.LANCZOS)
        if darken > 0:
            dark = Image.new("RGBA", (w, h), (0, 0, 0, darken))
            bg = Image.alpha_composite(bg, dark)
        img.paste(bg, (x, y))


# ---------------------------------------------------------------------------
# 16:9 YouTube layout
# ---------------------------------------------------------------------------

def mockup_16x9(bg_path: Path | None = None) -> Image.Image:
    """
    16:9 YouTube layout:
    - Right side: Nine's 9:16 PiP (fills full height)
    - Left side: Generated image fills entire left zone (full height)
    - Card: centred over the image
    - Subtitle: bar at bottom over the image
    """
    W, H = 1920, 1080

    # Nine's PiP is 9:16 filling the right side, full height
    pip_aspect = 9 / 16
    pip_h = H  # full height
    pip_w = int(pip_h * pip_aspect)  # 608px
    pip_x = W - pip_w  # 1312

    # Left zone = everything left of PiP
    left_w = pip_x  # 1312px

    # --- Draw ---
    img = Image.new("RGBA", (W, H), (20, 20, 20, 255))
    draw = ImageDraw.Draw(img)

    # Generated image fills entire left side
    _paste_bg_image(img, bg_path, 0, 0, left_w, H, darken=60)

    # PiP right side
    _draw_pip_zone(draw, pip_x, 0, pip_w, pip_h, img, label="Nine (9:16)")

    # Card centred over the image
    card_cx = left_w // 2
    card_cy = H // 2 - 30
    _draw_card(draw, img, card_cx, card_cy, "เผ็ด", "phèt", "spicy", scale=1.2)

    # Subtitle bar at bottom over the image
    sub_h = 80
    _draw_subtitle_bar(draw, img, 0, H - sub_h, left_w, sub_h,
                        "you want to know what that means before")

    _add_label(draw, 10, 10, "16:9 YouTube — image fills left, card + subtitle over it, Nine right")
    return img


# ---------------------------------------------------------------------------
# 9:16 Shorts layout
# ---------------------------------------------------------------------------

def mockup_shorts(bg_path: Path | None = None) -> Image.Image:
    """
    9:16 Shorts layout:
    - Nine fills the entire screen (9:16 video = full frame)
    - Learning card overlaid in centre
    - Subtitle bar overlaid at bottom
    """
    W, H = 1080, 1920
    img = Image.new("RGBA", (W, H), (20, 20, 20, 255))
    draw = ImageDraw.Draw(img)

    # Nine fills entire frame
    _draw_pip_zone(draw, 0, 0, W, H, img, label="Nine (full screen)")

    # Card centred (slightly above middle)
    _draw_card(draw, img, W // 2, H // 2 - 60, "เผ็ด", "phèt", "spicy", scale=1.4)

    # Subtitle bar at bottom
    sub_h = 110
    _draw_subtitle_bar(draw, img, 0, H - sub_h, W, sub_h,
                        "you want to know what that means before")

    _add_label(draw, 10, 10, "9:16 Shorts — Nine full-screen, card + subtitle overlaid")
    return img


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_label(draw: ImageDraw.Draw, x: int, y: int, text: str):
    font = _load_font(14)
    draw.text((x, y), text, fill=COL_LABEL, font=font)


# ---------------------------------------------------------------------------
# Comparison sheet
# ---------------------------------------------------------------------------

def generate_comparison(bg_path: Path | None = None, output_path: Path | None = None) -> Path:
    out = output_path or (_YT_DIR / "out" / "layout-comparison.png")
    out.parent.mkdir(parents=True, exist_ok=True)

    yt = mockup_16x9(bg_path).convert("RGB")
    shorts = mockup_shorts(bg_path).convert("RGB")

    # Scale for comparison
    yt_w = 1100
    yt_h = int(yt_w * 1080 / 1920)
    yt_thumb = yt.resize((yt_w, yt_h), Image.LANCZOS)

    shorts_w = 320
    shorts_h = int(shorts_w * 1920 / 1080)
    shorts_thumb = shorts.resize((shorts_w, shorts_h), Image.LANCZOS)

    gap = 30
    total_w = yt_w + gap + shorts_w + 60
    total_h = max(yt_h, shorts_h) + 100

    sheet = Image.new("RGB", (total_w, total_h), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)

    font_title = _load_font(22, bold=True)
    draw.text((30, 15), "Layout — 16:9 YouTube + 9:16 Shorts", fill=(200, 200, 200), font=font_title)

    y_top = 55
    # 16:9 on left
    sheet.paste(yt_thumb, (30, y_top))
    font_lbl = _load_font(16)
    draw.text((30, y_top + yt_h + 8), "YouTube (16:9)", fill=(150, 150, 150), font=font_lbl)

    # 9:16 on right, vertically centred
    shorts_y = y_top + (yt_h - shorts_h) // 2
    if shorts_y < y_top:
        shorts_y = y_top
    shorts_x = 30 + yt_w + gap
    sheet.paste(shorts_thumb, (shorts_x, shorts_y))
    draw.text((shorts_x, shorts_y + shorts_h + 8), "Shorts (9:16)", fill=(150, 150, 150), font=font_lbl)

    sheet.save(str(out), quality=95)
    return out


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--bg", default=None)
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    bg_path = Path(args.bg) if args.bg else None
    if bg_path is None:
        imgs = sorted((_YT_DIR / "images" / "YT-S01-E01").glob("img-001*"))
        if imgs:
            bg_path = imgs[0]

    result = generate_comparison(bg_path, Path(args.out) if args.out else None)
    print(f"Comparison: {result}")
