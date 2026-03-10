#!/usr/bin/env python3
import json
import math
import os
import textwrap
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path("/Users/Shared/work/thai-nine/Thai images/family-members-carousel-v1")
DATA_PATH = ROOT / "carousel-data.json"
SVG_DIR = ROOT / "source-svg"
PNG_DIR = ROOT / "final-png"
PREVIEW_DIR = ROOT / "preview"

W = 1080
H = 1920
Y_SHIFT = 150
PANEL_Y = 820 + Y_SHIFT
PANEL_RADIUS = 46

FONT_REG = "/System/Library/Fonts/Supplemental/Tahoma.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Tahoma Bold.ttf"
FONT_FALLBACK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(FONT_FALLBACK, size)


def rounded_panel(draw: ImageDraw.ImageDraw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def wrap_lines(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = word if not current else f"{current} {word}"
        if draw.textlength(test, font=font) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_text_block(draw, x, y, text, font, fill, max_width, line_gap=8):
    lines = wrap_lines(draw, text, font, max_width)
    line_height = font.size + line_gap
    for idx, line in enumerate(lines):
        draw.text((x, y + idx * line_height), line, font=font, fill=fill)
    return y + len(lines) * line_height


def draw_line_list(draw, x, y, lines, font, fill, max_width, bullet=False, line_gap=6):
    for line in lines:
        text = f"• {line}" if bullet else line
        y = draw_text_block(draw, x, y, text, font, fill, max_width, line_gap)
    return y


def make_background(image_path: Path) -> Image.Image:
    base = Image.new("RGB", (W, H), "#efe7dc")
    img = ImageOps.exif_transpose(Image.open(image_path).convert("RGB"))
    scaled_h = int(H * 0.95)
    scaled_w = int(img.width * scaled_h / img.height)
    resized = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    left = (W - scaled_w) // 2
    base.paste(resized, (left, 0))
    blur = resized.filter(ImageFilter.GaussianBlur(36)).resize((W, H), Image.Resampling.LANCZOS)
    overlay = Image.blend(blur, base, 0.78)
    return overlay


def panel_overlay() -> Image.Image:
    panel = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(panel)
    rounded_panel(pdraw, (28, PANEL_Y, W - 28, H - 28), PANEL_RADIUS, (252, 248, 242, 77))
    pdraw.rounded_rectangle((44, PANEL_Y + 22, W - 44, H - 44), radius=36, outline=(224, 208, 189, 200), width=2)
    return panel


def draw_chip(draw, text):
    font = load_font(FONT_BOLD, 28)
    x, y = 56, 54
    pad_x = 18
    width = int(draw.textlength(text, font=font)) + pad_x * 2
    draw.rounded_rectangle((x, y, x + width, y + 52), radius=24, fill="#f4b76e")
    draw.text((x + pad_x, y + 10), text, font=font, fill="#4b2e1f")


def render_cover(slide, out_png: Path, out_svg: Path):
    bg = make_background(ROOT / slide["image"]).convert("RGBA")
    bg.alpha_composite(panel_overlay())
    draw = ImageDraw.Draw(bg)

    draw_chip(draw, "THAI WITH NINE")
    title_font = load_font(FONT_BOLD, 78)
    thai_font = load_font(FONT_BOLD, 54)
    body_font = load_font(FONT_REG, 28)
    body_bold = load_font(FONT_BOLD, 30)

    x = 84
    y = PANEL_Y + 96
    draw.text((x, y), slide["heading"], font=title_font, fill="#1f1a17")
    y += 106
    draw.text((x, y), slide["thai"], font=thai_font, fill="#b45d13")
    y += 74
    draw.text((x, y), slide["translit"], font=body_bold, fill="#5b4a42")
    y += 76
    y = draw_line_list(draw, x, y, slide["breakdown"], body_font, "#3f342f", 900)
    y += 20
    y = draw_text_block(draw, x, y, slide["example_thai"], body_bold, "#1f1a17", 900)
    y = draw_text_block(draw, x, y + 8, slide["example_translit"], body_font, "#6d5f56", 900)
    draw.text((x, y + 10), slide["example_english"], font=body_font, fill="#6d5f56")

    bg.convert("RGB").save(out_png, quality=95)
    write_cover_svg(slide, out_svg)


def column_card(draw, box, item):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=28, fill=(255, 250, 244, 77), outline="#e6d7c7", width=2)
    pad = 28
    max_width = x2 - x1 - pad * 2
    x = x1 + pad
    y = y1 + 26

    en_font = load_font(FONT_BOLD, 30)
    thai_font = load_font(FONT_BOLD, 44)
    translit_font = load_font(FONT_REG, 26)
    small_font = load_font(FONT_REG, 22)
    ex_font = load_font(FONT_BOLD, 26)

    y = draw_text_block(draw, x, y, item["english"], en_font, "#8f4a11", max_width, 6)
    y += 4
    draw.text((x, y), item["thai"], font=thai_font, fill="#201913")
    y += 58
    y = draw_text_block(draw, x, y, item["translit"], translit_font, "#5f524a", max_width, 4)
    y += 10
    y = draw_line_list(draw, x, y, item["breakdown"], small_font, "#443832", max_width, False, 4)
    y += 18
    y = draw_text_block(draw, x, y, item["example_thai"], ex_font, "#201913", max_width, 6)
    y = draw_text_block(draw, x, y + 6, item["example_translit"], small_font, "#5f524a", max_width, 4)
    draw_text_block(draw, x, y + 8, item["example_english"], small_font, "#5f524a", max_width, 4)


def render_pair(slide, out_png: Path, out_svg: Path):
    bg = make_background(ROOT / slide["image"]).convert("RGBA")
    bg.alpha_composite(panel_overlay())
    draw = ImageDraw.Draw(bg)
    draw_chip(draw, "FAMILY MEMBERS")
    heading_font = load_font(FONT_BOLD, 36)
    draw.text((58, PANEL_Y + 46), slide["heading"], font=heading_font, fill="#1f1a17")

    left_box = (52, PANEL_Y + 110, 520, H - 56)
    right_box = (560, PANEL_Y + 110, 1028, H - 56)
    column_card(draw, left_box, slide["left"])
    column_card(draw, right_box, slide["right"])
    bg.convert("RGB").save(out_png, quality=95)
    write_pair_svg(slide, out_svg)


def render_single(slide, out_png: Path, out_svg: Path):
    bg = make_background(ROOT / slide["image"]).convert("RGBA")
    bg.alpha_composite(panel_overlay())
    draw = ImageDraw.Draw(bg)
    draw_chip(draw, "FAMILY MEMBERS")
    heading_font = load_font(FONT_BOLD, 36)
    draw.text((58, PANEL_Y + 46), slide["heading"], font=heading_font, fill="#1f1a17")

    box = (74, PANEL_Y + 126, 1006, H - 64)
    draw.rounded_rectangle(box, radius=34, fill=(255, 250, 244, 77), outline="#e6d7c7", width=2)
    x = box[0] + 34
    y = box[1] + 34
    max_width = box[2] - box[0] - 68
    en_font = load_font(FONT_BOLD, 36)
    thai_font = load_font(FONT_BOLD, 52)
    translit_font = load_font(FONT_REG, 28)
    small_font = load_font(FONT_REG, 24)
    ex_font = load_font(FONT_BOLD, 28)

    y = draw_text_block(draw, x, y, slide["english"], en_font, "#8f4a11", max_width, 6)
    y += 6
    draw.text((x, y), slide["thai"], font=thai_font, fill="#201913")
    y += 66
    y = draw_text_block(draw, x, y, slide["translit"], translit_font, "#5f524a", max_width, 4)
    y += 14
    y = draw_line_list(draw, x, y, slide["breakdown"], small_font, "#443832", max_width, False, 6)
    y += 20
    y = draw_text_block(draw, x, y, slide["example_thai"], ex_font, "#201913", max_width, 6)
    y = draw_text_block(draw, x, y + 6, slide["example_translit"], small_font, "#5f524a", max_width, 4)
    draw_text_block(draw, x, y + 8, slide["example_english"], small_font, "#5f524a", max_width, 4)
    bg.convert("RGB").save(out_png, quality=95)
    write_single_svg(slide, out_svg)


def svg_header():
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        f'<style>'
        f'.chip{{font:700 28px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#4b2e1f}}'
        f'.heading{{font:700 36px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#1f1a17}}'
        f'.title{{font:700 78px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#1f1a17}}'
        f'.thai-title{{font:700 54px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#b45d13}}'
        f'.en{{font:700 30px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#8f4a11}}'
        f'.thai{{font:700 44px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#201913}}'
        f'.thai-large{{font:700 52px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#201913}}'
        f'.translit{{font:400 26px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#5f524a}}'
        f'.translit-large{{font:400 28px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#5f524a}}'
        f'.small{{font:400 22px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#443832}}'
        f'.small-large{{font:400 24px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#443832}}'
        f'.example{{font:700 26px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#201913}}'
        f'.example-large{{font:700 28px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#201913}}'
        f'.body{{font:400 28px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#6d5f56}}'
        f'.body-small{{font:400 24px Tahoma,Thonburi,Arial Unicode MS,sans-serif;fill:#5f524a}}'
        f'</style>'
    )


def svg_bg(image_name):
    href = image_name
    return (
        f'<rect width="{W}" height="{H}" fill="#efe7dc"/>'
        f'<image href="{href}" x="0" y="0" width="{W}" height="{int(H*0.95)}" preserveAspectRatio="xMidYMin slice"/>'
        f'<rect x="28" y="{PANEL_Y}" width="{W-56}" height="{H-PANEL_Y-56}" rx="{PANEL_RADIUS}" fill="#fcf8f2" fill-opacity="0.96" stroke="#e0d0bd" stroke-width="2"/>'
        f'<rect x="56" y="54" width="240" height="52" rx="24" fill="#f4b76e"/>'
    )


def svg_text_multiline(x, y, lines, cls, line_height):
    out = [f'<text x="{x}" y="{y}" class="{cls}">']
    for idx, line in enumerate(lines):
        dy = "0" if idx == 0 else str(line_height)
        out.append(f'<tspan x="{x}" dy="{dy}">{escape_xml(line)}</tspan>')
    out.append("</text>")
    return "".join(out)


def escape_xml(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def write_cover_svg(slide, out_svg):
    parts = [svg_header(), svg_bg(slide["image"])]
    parts.append('<text x="74" y="89" class="chip">THAI WITH NINE</text>')
    parts.append(f'<text x="84" y="{PANEL_Y + 168}" class="title">{escape_xml(slide["heading"])}</text>')
    parts.append(f'<text x="84" y="{PANEL_Y + 252}" class="thai-title">{escape_xml(slide["thai"])}</text>')
    parts.append(f'<text x="84" y="{PANEL_Y + 322}" class="body">{escape_xml(slide["translit"])}</text>')
    y = PANEL_Y + 380
    for line in slide["breakdown"]:
        parts.append(f'<text x="84" y="{y}" class="body">{escape_xml(line)}</text>')
        y += 42
    parts.append(f'<text x="84" y="{y + 26}" class="example">{escape_xml(slide["example_thai"])}</text>')
    parts.append(f'<text x="84" y="{y + 68}" class="body">{escape_xml(slide["example_translit"])}</text>')
    parts.append(f'<text x="84" y="{y + 110}" class="body">{escape_xml(slide["example_english"])}</text>')
    parts.append("</svg>")
    out_svg.write_text("".join(parts), encoding="utf-8")


def write_pair_svg(slide, out_svg):
    parts = [svg_header(), svg_bg(slide["image"])]
    parts.append('<text x="74" y="89" class="chip">FAMILY MEMBERS</text>')
    parts.append(f'<text x="58" y="{PANEL_Y + 82}" class="heading">{escape_xml(slide["heading"])}</text>')
    parts.extend(pair_card_svg((52, PANEL_Y + 110, 520, H - 56), slide["left"], "left"))
    parts.extend(pair_card_svg((560, PANEL_Y + 110, 1028, H - 56), slide["right"], "right"))
    parts.append("</svg>")
    out_svg.write_text("".join(parts), encoding="utf-8")


def pair_card_svg(box, item, prefix):
    x1, y1, x2, y2 = box
    x = x1 + 28
    y = y1 + 54
    parts = [f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="28" fill="#fffaf4" stroke="#e6d7c7" stroke-width="2"/>']
    parts.append(svg_text_multiline(x, y, [item["english"]], "en", 36))
    y += 64
    parts.append(f'<text x="{x}" y="{y}" class="thai" id="{prefix}-thai">{escape_xml(item["thai"])}</text>')
    y += 54
    parts.append(svg_text_multiline(x, y, [item["translit"]], "translit", 32))
    y += 48
    for idx, line in enumerate(item["breakdown"]):
        parts.append(f'<text x="{x}" y="{y}" class="small" id="{prefix}-breakdown-{idx}">{escape_xml(line)}</text>')
        y += 34
    y += 14
    parts.append(svg_text_multiline(x, y, [item["example_thai"]], "example", 34))
    y += 42
    parts.append(svg_text_multiline(x, y, [item["example_translit"]], "small", 30))
    y += 38
    parts.append(svg_text_multiline(x, y, [item["example_english"]], "small", 30))
    return parts


def write_single_svg(slide, out_svg):
    parts = [svg_header(), svg_bg(slide["image"])]
    parts.append('<text x="74" y="89" class="chip">FAMILY MEMBERS</text>')
    parts.append(f'<text x="58" y="{PANEL_Y + 82}" class="heading">{escape_xml(slide["heading"])}</text>')
    x1, y1, x2, y2 = (74, PANEL_Y + 126, 1006, H - 64)
    parts.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="34" fill="#fffaf4" stroke="#e6d7c7" stroke-width="2"/>')
    x = x1 + 34
    y = y1 + 56
    parts.append(svg_text_multiline(x, y, [slide["english"]], "en", 40))
    y += 72
    parts.append(f'<text x="{x}" y="{y}" class="thai-large">{escape_xml(slide["thai"])}</text>')
    y += 66
    parts.append(svg_text_multiline(x, y, [slide["translit"]], "translit-large", 34))
    y += 52
    for idx, line in enumerate(slide["breakdown"]):
        parts.append(f'<text x="{x}" y="{y}" class="small-large" id="breakdown-{idx}">{escape_xml(line)}</text>')
        y += 38
    y += 22
    parts.append(svg_text_multiline(x, y, [slide["example_thai"]], "example-large", 36))
    y += 48
    parts.append(svg_text_multiline(x, y, [slide["example_translit"]], "body-small", 32))
    y += 42
    parts.append(svg_text_multiline(x, y, [slide["example_english"]], "body-small", 32))
    parts.append("</svg>")
    out_svg.write_text("".join(parts), encoding="utf-8")


def make_preview(files: Iterable[Path], out_path: Path):
    files = list(files)
    thumb_w, thumb_h = 216, 384
    cols = 3
    rows = math.ceil(len(files) / cols)
    margin = 20
    label_h = 32
    sheet = Image.new("RGB", (margin + cols * (thumb_w + margin), margin + rows * (thumb_h + label_h + margin)), "white")
    font = load_font(FONT_REG, 16)
    for idx, path in enumerate(files):
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
        ImageDraw.Draw(sheet).text((sx, sy + thumb_h + 6), path.stem[:24], font=font, fill="#333333")
    sheet.save(out_path, quality=92)


def export_copy_files(data):
    md_lines = ["# Family Members Carousel Copy", ""]
    csv_lines = [
        "slide,kind,left_or_single_english,left_or_single_thai,left_or_single_translit,left_or_single_breakdown,left_or_single_example_thai,left_or_single_example_translit,left_or_single_example_english,right_english,right_thai,right_translit,right_breakdown,right_example_thai,right_example_translit,right_example_english"
    ]
    for slide in data["slides"]:
        md_lines.append(f"## Slide {slide['index']}")
        md_lines.append("")
        md_lines.append(f"- Image: `{slide['image']}`")
        md_lines.append(f"- Kind: `{slide['kind']}`")
        if slide["kind"] == "cover":
            md_lines.append(f"- Heading: {slide['heading']}")
            md_lines.append(f"- Thai: {slide['thai']}")
            md_lines.append(f"- Transliteration: {slide['translit']}")
            md_lines.append(f"- Breakdown: {'; '.join(slide['breakdown'])}")
            md_lines.append(f"- Example Thai: {slide['example_thai']}")
            md_lines.append(f"- Example Transliteration: {slide['example_translit']}")
            md_lines.append(f"- Example English: {slide['example_english']}")
            csv_lines.append(
                ",".join([
                    str(slide["index"]),
                    slide["kind"],
                    quote_csv(slide["heading"]),
                    quote_csv(slide["thai"]),
                    quote_csv(slide["translit"]),
                    quote_csv("; ".join(slide["breakdown"])),
                    quote_csv(slide["example_thai"]),
                    quote_csv(slide["example_translit"]),
                    quote_csv(slide["example_english"]),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    ""
                ])
            )
        elif slide["kind"] == "single":
            md_lines.append(f"- English: {slide['english']}")
            md_lines.append(f"- Thai: {slide['thai']}")
            md_lines.append(f"- Transliteration: {slide['translit']}")
            md_lines.append(f"- Breakdown: {'; '.join(slide['breakdown'])}")
            md_lines.append(f"- Example Thai: {slide['example_thai']}")
            md_lines.append(f"- Example Transliteration: {slide['example_translit']}")
            md_lines.append(f"- Example English: {slide['example_english']}")
            csv_lines.append(
                ",".join([
                    str(slide["index"]),
                    slide["kind"],
                    quote_csv(slide["english"]),
                    quote_csv(slide["thai"]),
                    quote_csv(slide["translit"]),
                    quote_csv("; ".join(slide["breakdown"])),
                    quote_csv(slide["example_thai"]),
                    quote_csv(slide["example_translit"]),
                    quote_csv(slide["example_english"]),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    ""
                ])
            )
        else:
            md_lines.append(f"- Left: {slide['left']['english']} | {slide['left']['thai']} | {slide['left']['translit']}")
            md_lines.append(f"- Left breakdown: {'; '.join(slide['left']['breakdown'])}")
            md_lines.append(f"- Left example: {slide['left']['example_thai']} | {slide['left']['example_translit']} | {slide['left']['example_english']}")
            md_lines.append(f"- Right: {slide['right']['english']} | {slide['right']['thai']} | {slide['right']['translit']}")
            md_lines.append(f"- Right breakdown: {'; '.join(slide['right']['breakdown'])}")
            md_lines.append(f"- Right example: {slide['right']['example_thai']} | {slide['right']['example_translit']} | {slide['right']['example_english']}")
            csv_lines.append(
                ",".join([
                    str(slide["index"]),
                    slide["kind"],
                    quote_csv(slide["left"]["english"]),
                    quote_csv(slide["left"]["thai"]),
                    quote_csv(slide["left"]["translit"]),
                    quote_csv("; ".join(slide["left"]["breakdown"])),
                    quote_csv(slide["left"]["example_thai"]),
                    quote_csv(slide["left"]["example_translit"]),
                    quote_csv(slide["left"]["example_english"]),
                    quote_csv(slide["right"]["english"]),
                    quote_csv(slide["right"]["thai"]),
                    quote_csv(slide["right"]["translit"]),
                    quote_csv("; ".join(slide["right"]["breakdown"])),
                    quote_csv(slide["right"]["example_thai"]),
                    quote_csv(slide["right"]["example_translit"]),
                    quote_csv(slide["right"]["example_english"])
                ])
            )
        md_lines.append("")

    (ROOT / "copy-spec.md").write_text("\n".join(md_lines), encoding="utf-8")
    (ROOT / "copy-spec.csv").write_text("\n".join(csv_lines) + "\n", encoding="utf-8")


def quote_csv(value):
    text = str(value)
    if any(ch in text for ch in [",", '"', "\n"]):
        text = '"' + text.replace('"', '""') + '"'
    return text


def main():
    SVG_DIR.mkdir(exist_ok=True)
    PNG_DIR.mkdir(exist_ok=True)
    PREVIEW_DIR.mkdir(exist_ok=True)
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    export_copy_files(data)

    for slide in data["slides"]:
        out_png = PNG_DIR / f"{slide['index']:02d}.png"
        out_svg = SVG_DIR / f"{slide['index']:02d}.svg"
        if slide["kind"] == "cover":
            render_cover(slide, out_png, out_svg)
        elif slide["kind"] == "pair":
            render_pair(slide, out_png, out_svg)
        else:
            render_single(slide, out_png, out_svg)

    make_preview(sorted(PNG_DIR.glob("*.png")), PREVIEW_DIR / "contact-sheet.jpg")


if __name__ == "__main__":
    main()
