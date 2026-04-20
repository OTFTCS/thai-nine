"""
Base Manim components for Thai with Nine YouTube video rendering.

Split-frame layout: Nine's 9:16 PiP fills right side (608x1080),
watercolour image fills left zone (1312x1080). Cards and subtitles
render over the left zone only. Transparent background — FFmpeg
composites image video + PiP + audio.

Usage:
    from scene_base import YouTubeScene, yt_text
"""

from __future__ import annotations

import json
from pathlib import Path

from manim import (
    DOWN,
    RIGHT,
    ORIGIN,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Rectangle,
    RoundedRectangle,
    Scene,
    Text,
    VGroup,
    config,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_TOOLS_DIR = _HERE.parent           # youtube/tools/
_YT_DIR = _TOOLS_DIR.parent         # youtube/
_REPO_ROOT = _YT_DIR.parent         # thai-nine/

_STYLE_PATH = _YT_DIR / "config" / "manim-yt-style.json"
_FONTS_DIR = _REPO_ROOT / "assets" / "fonts"

# ---------------------------------------------------------------------------
# Load style contract
# ---------------------------------------------------------------------------


def _load_style() -> dict:
    with open(_STYLE_PATH) as f:
        return json.load(f)


STYLE = _load_style()

# ---------------------------------------------------------------------------
# Register Sarabun fonts with Pango
# ---------------------------------------------------------------------------

try:
    import manimpango

    for ttf in _FONTS_DIR.glob("Sarabun-*.ttf"):
        manimpango.register_font(str(ttf))
except Exception as _e:
    import warnings
    warnings.warn(f"Failed to register Sarabun fonts: {_e}")

# ---------------------------------------------------------------------------
# Layout constants (Manim coordinate space, origin at center)
# ---------------------------------------------------------------------------

FRAME_HEIGHT = 8.0
FRAME_WIDTH = FRAME_HEIGHT * (16 / 9)  # ~14.22

config.frame_height = FRAME_HEIGHT
config.frame_width = FRAME_WIDTH
config.pixel_height = STYLE["resolution"]["height"]  # 1080
config.pixel_width = STYLE["resolution"]["width"]     # 1920

# Left zone (everything left of Nine's 9:16 PiP)
_LEFT_ZONE_PX = STYLE["layout"]["leftZone"]["widthPx"]  # 1312
LEFT_ZONE_WIDTH = _LEFT_ZONE_PX / config.pixel_width * FRAME_WIDTH  # ~9.72
LEFT_ZONE_CENTER_X = (_LEFT_ZONE_PX / 2) / config.pixel_width * FRAME_WIDTH - FRAME_WIDTH / 2  # ~-2.26

# Bottom overlay zone (bottom 30% of frame)
OVERLAY_FRAC = STYLE["layout"]["overlayZone"]["bottomFracFromTop"]  # 0.30
OVERLAY_HEIGHT = FRAME_HEIGHT * OVERLAY_FRAC  # ~2.4
OVERLAY_BOTTOM = -FRAME_HEIGHT / 2            # -4.0
OVERLAY_TOP = OVERLAY_BOTTOM + OVERLAY_HEIGHT  # ~-1.6
OVERLAY_CENTER_Y = (OVERLAY_TOP + OVERLAY_BOTTOM) / 2  # ~-2.8

# Centre zone (for natural-listen, shadowing)
CENTER_Y = 0.0

# Card zone (centre of left zone for teaching cards)
_CARD_CFG = STYLE["layout"]["cardZone"]
CARD_ZONE_Y = FRAME_HEIGHT * (0.5 - _CARD_CFG["yFrac"])  # 0.0 when yFrac=0.5
CARD_MAX_WIDTH_FRAC = _CARD_CFG["maxWidthFrac"]  # 0.75

# Subtitle zone (bottom strip, spans left zone only)
_SUB_CFG = STYLE["layout"]["subtitleZone"]
SUBTITLE_FRAC = _SUB_CFG["bottomFrac"]  # 0.078
SUBTITLE_HEIGHT = FRAME_HEIGHT * SUBTITLE_FRAC  # ~0.624
SUBTITLE_BOTTOM = -FRAME_HEIGHT / 2  # -4.0
SUBTITLE_TOP = SUBTITLE_BOTTOM + SUBTITLE_HEIGHT  # ~-3.376
SUBTITLE_CENTER_Y = (SUBTITLE_TOP + SUBTITLE_BOTTOM) / 2  # ~-3.688
SUBTITLE_BAR_OPACITY = _SUB_CFG["barOpacity"]  # 0.55

# PiP zone (Nine's 9:16 video, right side — composited by FFmpeg, not Manim)
_PIP_CFG = STYLE["layout"]["pip"]
PIP_ENABLED = _PIP_CFG["enabled"]

# Card and subtitle X offset — centred over left zone
CARD_X_OFFSET = LEFT_ZONE_CENTER_X  # ~-2.26
SUBTITLE_X_OFFSET = LEFT_ZONE_CENTER_X  # ~-2.26

# Text width — constrained to left zone
TEXT_WIDTH_FRAC = STYLE["layout"]["textWidthFrac"]  # 0.85
MAX_TEXT_WIDTH = LEFT_ZONE_WIDTH * TEXT_WIDTH_FRAC  # ~8.26



def effective_text_width() -> float:
    """Return max text width (constrained to left zone)."""
    return MAX_TEXT_WIDTH

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------

COL_THAI = STYLE["colors"]["thai"]
COL_THAI_CENTRE = STYLE["colors"]["thaiCentre"]
COL_VOCAB_THAI = STYLE["colors"]["vocabThai"]
COL_TRANSLIT = STYLE["colors"]["translit"]
COL_ENGLISH = STYLE["colors"]["english"]
COL_DRILL = STYLE["colors"]["drillPrompt"]
COL_THAI_SPLIT = STYLE["colors"]["thaiSplit"]
COL_HIGHLIGHT = STYLE["colors"]["highlight"]

CARD_BG = STYLE["colors"]["cardBg"]
CARD_OPACITY = STYLE["colors"]["cardBgOpacity"]

BAR_COLOR = STYLE["translucentBar"]["color"]
BAR_OPACITY = STYLE["translucentBar"]["opacity"]

# Font sizes
SIZE_THAI = STYLE["fonts"]["thai"]["sizePt"]
SIZE_THAI_CENTRE = STYLE["fonts"]["thaiCentre"]["sizePt"]
SIZE_VOCAB_THAI = STYLE["fonts"]["vocabThai"]["sizePt"]
SIZE_TRANSLIT = STYLE["fonts"]["translit"]["sizePt"]
SIZE_ENGLISH = STYLE["fonts"]["english"]["sizePt"]
SIZE_DRILL = STYLE["fonts"]["drillPrompt"]["sizePt"]
SIZE_THAI_SPLIT = STYLE["fonts"]["thaiSplit"]["sizePt"]
SIZE_SUBTITLE = STYLE["fonts"]["subtitle"]["sizePt"]

# Spacing
_SP = STYLE["spacing"]
BUFF_TEXT_LINE = _SP["textLineBuff"]
CARD_PAD_X = _SP["cardPadX"]
CARD_PAD_Y = _SP["cardPadY"]
CARD_CORNER_RADIUS = _SP["cardCornerRadius"]

# Card-safe text width: text must fit inside card background with padding
CARD_CONTENT_MAX_WIDTH = MAX_TEXT_WIDTH - CARD_PAD_X * 2  # ~7.06


def card_text_width() -> float:
    """Return max text width for content inside a TextCard (accounts for padding)."""
    return CARD_CONTENT_MAX_WIDTH


# Animation durations
DUR_FADE_IN = STYLE["animations"]["fadeInSec"]
DUR_FADE_OUT = STYLE["animations"]["fadeOutSec"]
DUR_CARD_REVEAL = STYLE["animations"]["cardRevealSec"]
DUR_BREAKDOWN_DELAY = STYLE["animations"]["breakdownDelaySec"]
DUR_DRILL_TRY = STYLE["animations"]["drillTrySec"]
DUR_TRANSITION = STYLE["animations"]["transitionSec"]


# ---------------------------------------------------------------------------
# Text helper — render at 96pt, scale down (Thai diacritic kerning fix)
# ---------------------------------------------------------------------------

_RENDER_FONT_SIZE = 96


def yt_text(
    text: str,
    *,
    font_size: float = 24,
    color: str = COL_THAI,
    font: str = "Sarabun",
    weight: str = "MEDIUM",
    max_width: float | None = None,
) -> Text:
    """Create a Text object with Sarabun, rendered at 96pt and scaled down.

    Avoids Pango kerning bug #2844 with Thai diacritics.
    """
    if max_width is None:
        max_width = MAX_TEXT_WIDTH

    t = Text(
        text,
        font=font,
        font_size=_RENDER_FONT_SIZE,
        color=color,
        weight=weight,
    )
    scale_factor = font_size / _RENDER_FONT_SIZE
    t.scale(scale_factor)
    if max_width and t.width > max_width:
        t.scale_to_fit_width(max_width)
    return t


# ---------------------------------------------------------------------------
# TranslucentBar — dark backdrop for bottom text zone
# ---------------------------------------------------------------------------


class TranslucentBar(Rectangle):
    """Semi-transparent dark rectangle spanning the bottom overlay zone."""

    def __init__(self, **kwargs):
        super().__init__(
            width=FRAME_WIDTH + 0.2,
            height=OVERLAY_HEIGHT + 0.1,
            fill_color=BAR_COLOR,
            fill_opacity=BAR_OPACITY,
            stroke_width=0,
            **kwargs,
        )
        self.move_to([0, OVERLAY_CENTER_Y, 0])


# ---------------------------------------------------------------------------
# SubtitleBar — dark backdrop for bottom subtitle zone
# ---------------------------------------------------------------------------


class SubtitleBar(Rectangle):
    """Semi-transparent dark rectangle for the bottom subtitle strip (left zone only)."""

    def __init__(self, **kwargs):
        super().__init__(
            width=LEFT_ZONE_WIDTH + 0.2,
            height=SUBTITLE_HEIGHT + 0.1,
            fill_color=BAR_COLOR,
            fill_opacity=SUBTITLE_BAR_OPACITY,
            stroke_width=0,
            **kwargs,
        )
        self.move_to([LEFT_ZONE_CENTER_X, SUBTITLE_CENTER_Y, 0])


# ---------------------------------------------------------------------------
# TextCard — rounded card with dark background
# ---------------------------------------------------------------------------


class TextCard(VGroup):
    """Dark rounded card wrapping text content."""

    def __init__(self, content: VGroup, **kwargs):
        # Card always wraps its content with padding — never narrower than content
        card_width = content.width + CARD_PAD_X * 2
        card_height = content.height + CARD_PAD_Y * 2

        self.bg = RoundedRectangle(
            width=card_width,
            height=card_height,
            corner_radius=CARD_CORNER_RADIUS,
            fill_color=CARD_BG,
            fill_opacity=CARD_OPACITY,
            stroke_width=0,
        )
        content.move_to(self.bg.get_center())
        super().__init__(self.bg, content, **kwargs)


# ---------------------------------------------------------------------------
# YouTubeScene — base scene for 16:9 YouTube overlay
# ---------------------------------------------------------------------------


class YouTubeScene(Scene):
    """Base scene for YouTube 16:9 transparent-background rendering.

    Three independent overlay layers:
      - _primary:   main text (Thai line, vocab card, drill prompt)
      - _secondary: supporting text (English, translit, accumulating lines)
      - _accent:    highlights, karaoke indicators

    All show_* methods consume exactly `duration` seconds of Manim time.
    """

    def setup(self):
        self.bar = TranslucentBar()
        self.add(self.bar)

        self.subtitle_bar = SubtitleBar()
        self.add(self.subtitle_bar)

        self._primary: VGroup | None = None
        self._secondary: VGroup | None = None
        self._accent: VGroup | None = None
        self._subtitle: VGroup | None = None
        self._accum_stack: list[VGroup] = []

    # --- Clear methods ---

    def _clear_layer(self, attr: str, run_time: float = DUR_FADE_OUT):
        obj = getattr(self, attr)
        if obj is not None:
            self.play(FadeOut(obj, run_time=run_time))
            setattr(self, attr, None)

    def clear_overlay(self, run_time: float = DUR_FADE_OUT) -> float:
        """Fade out all overlay layers. Returns time consumed (0 if empty)."""
        to_fade = []
        for attr in ("_primary", "_secondary", "_accent", "_subtitle"):
            obj = getattr(self, attr)
            if obj is not None:
                to_fade.append(FadeOut(obj, run_time=run_time))
                setattr(self, attr, None)
        self._accum_stack.clear()
        if to_fade:
            self.play(*to_fade)
            return run_time
        return 0.0

    def snap_clear(self):
        """Instantly remove card zone content (no animation, 0 time).

        Does NOT clear the subtitle layer — subtitles persist independently
        until explicitly cleared or replaced by set_subtitle/clear_overlay.
        """
        for attr in ("_primary", "_secondary", "_accent"):
            obj = getattr(self, attr)
            if obj is not None:
                self.remove(obj)
                setattr(self, attr, None)
        self._accum_stack.clear()

    def _set_layer(self, attr: str, obj):
        """Set a layer, removing any existing content first (instant, 0 time)."""
        old = getattr(self, attr)
        if old is not None:
            self.remove(old)
        setattr(self, attr, obj)

    # --- show_thai_line ---

    def show_thai_line(
        self,
        text: str,
        duration: float,
        *,
        fade_in: bool = False,
        style: str = "Thai",
        pos: str = "bottom",
        translit: str | None = None,
    ):
        """Display a single Thai text line, optionally with transliteration below.

        Consumes exactly `duration` seconds.
        """
        self.snap_clear()
        size = SIZE_THAI_CENTRE if style == "ThaiCentre" else SIZE_THAI
        color = COL_THAI
        weight = "MEDIUM"

        _cw = card_text_width()
        label = yt_text(text, font_size=size, color=color, weight=weight, max_width=_cw)
        y = CENTER_Y if pos == "centre" else CARD_ZONE_Y

        if translit:
            tr_label = yt_text(translit, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL", max_width=_cw)
            content = VGroup(label, tr_label)
            content.arrange(DOWN, buff=0.15)
        else:
            content = VGroup(label)

        card = TextCard(content)
        card.move_to([CARD_X_OFFSET, y, 0])
        self._set_layer("_primary", card)

        anim_time = DUR_FADE_IN if fade_in else 0.05
        if fade_in:
            self.play(FadeIn(card, run_time=anim_time))
        else:
            self.add(card)
            self.wait(anim_time)

        remaining = duration - anim_time
        if remaining > 0:
            self.wait(remaining)

    # --- show_english_line ---

    def show_english_line(
        self,
        text: str,
        duration: float,
        *,
        fade_in: bool = False,
        pos: str = "bottom",
    ):
        """Display a single English text line.

        Consumes exactly `duration` seconds.
        """
        self.snap_clear()
        label = yt_text(text, font_size=SIZE_ENGLISH, color=COL_ENGLISH, weight="NORMAL")
        y = CENTER_Y - 0.5 if pos == "centre" else CARD_ZONE_Y - 0.5
        label.move_to([CARD_X_OFFSET, y, 0])

        group = VGroup(label)
        self._set_layer("_secondary", group)

        anim_time = DUR_FADE_IN if fade_in else 0.05
        if fade_in:
            self.play(FadeIn(group, run_time=anim_time))
        else:
            self.add(group)
            self.wait(anim_time)

        remaining = duration - anim_time
        if remaining > 0:
            self.wait(remaining)

    # --- show_translit_line ---

    def show_translit_line(
        self,
        text: str,
        duration: float,
        *,
        fade_in: bool = False,
        pos: str = "bottom",
    ):
        """Display a single transliteration line.

        Consumes exactly `duration` seconds.
        """
        self.snap_clear()
        label = yt_text(text, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL")
        y = CARD_ZONE_Y if pos == "centre" else CARD_ZONE_Y - 0.1
        label.move_to([CARD_X_OFFSET, y, 0])

        group = VGroup(label)
        self._set_layer("_accent", group)

        anim_time = DUR_FADE_IN if fade_in else 0.05
        if fade_in:
            self.play(FadeIn(group, run_time=anim_time))
        else:
            self.add(group)
            self.wait(anim_time)

        remaining = duration - anim_time
        if remaining > 0:
            self.wait(remaining)

    # --- show_breakdown_triplet ---

    def show_breakdown_triplet(
        self,
        thai: str,
        translit: str,
        english: str,
        duration: float,
        *,
        translit_delay: float = 1.0,
        english_delay: float = 2.0,
    ):
        """Thai + translit appear together, English fades in after delay.

        translit_delay is accepted but ignored (kept for call-site compat).
        Consumes exactly `duration` seconds.
        """
        _cw = card_text_width()
        thai_label = yt_text(thai, font_size=SIZE_THAI, color=COL_THAI, weight="MEDIUM", max_width=_cw)
        translit_label = yt_text(translit, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL", max_width=_cw)
        english_label = yt_text(english, font_size=SIZE_ENGLISH, color=COL_ENGLISH, weight="NORMAL", max_width=_cw)

        stack = VGroup(thai_label, translit_label, english_label)
        stack.arrange(DOWN, buff=BUFF_TEXT_LINE)

        card = TextCard(stack)
        card.move_to([CARD_X_OFFSET, CARD_ZONE_Y, 0])

        # Thai + translit visible immediately; English hidden until delay
        english_label.set_opacity(0)

        self._set_layer("_primary", card)
        self.add(card)

        elapsed = 0.05
        self.wait(0.05)

        # Wait for english delay
        wait_for_english = english_delay - elapsed
        if wait_for_english > 0:
            self.wait(wait_for_english)
            elapsed += wait_for_english

        # Fade in english
        self.play(FadeIn(english_label), run_time=DUR_FADE_IN)
        elapsed += DUR_FADE_IN

        remaining = duration - elapsed
        if remaining > 0:
            self.wait(remaining)

    # --- show_vocab_card ---

    def show_vocab_card(
        self,
        thai: str,
        english: str,
        translit: str,
        duration: float,
        *,
        example: str | None = None,
        example_delay: float = 8.0,
    ):
        """Display a vocab card: large Thai keyword with english/translit.

        Optionally shows an example sentence after a delay.
        Consumes exactly `duration` seconds.
        """
        self.snap_clear()
        _cw = card_text_width()
        thai_label = yt_text(thai, font_size=SIZE_VOCAB_THAI, color=COL_VOCAB_THAI, weight="BOLD", max_width=_cw)
        translit_label = yt_text(translit, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL", max_width=_cw)
        english_label = yt_text(english, font_size=SIZE_ENGLISH, color=COL_ENGLISH, weight="NORMAL", max_width=_cw)

        stack = VGroup(thai_label, translit_label, english_label)
        stack.arrange(DOWN, buff=BUFF_TEXT_LINE)

        card = TextCard(stack)
        card.move_to([CARD_X_OFFSET, CARD_ZONE_Y + 0.3, 0])

        self._set_layer("_primary", card)
        self.play(GrowFromCenter(card, run_time=DUR_CARD_REVEAL))
        elapsed = DUR_CARD_REVEAL

        if example and example_delay < duration:
            wait_for_example = example_delay - elapsed
            if wait_for_example > 0:
                self.wait(wait_for_example)
                elapsed += wait_for_example

            ex_label = yt_text(example, font_size=SIZE_THAI, color=COL_THAI, weight="NORMAL", max_width=_cw)
            ex_label.move_to([CARD_X_OFFSET, CARD_ZONE_Y - 1.0, 0])
            ex_group = VGroup(ex_label)
            self._set_layer("_secondary", ex_group)
            self.play(FadeIn(ex_group, run_time=DUR_FADE_IN))
            elapsed += DUR_FADE_IN

        remaining = duration - elapsed
        if remaining > 0:
            self.wait(remaining)

    # --- show_drill_prompt ---

    def show_drill_prompt(
        self,
        question: str,
        duration: float,
        *,
        try_delay: float = 1.0,
    ):
        """Display a drill challenge card.

        Shows question, then "Try saying it now..." after delay.
        Consumes exactly `duration` seconds.
        """
        q_label = yt_text(question, font_size=SIZE_DRILL, color=COL_DRILL, weight="BOLD", max_width=card_text_width())

        card = TextCard(VGroup(q_label))
        card.move_to([CARD_X_OFFSET, CARD_ZONE_Y + 0.3, 0])

        self._set_layer("_primary", card)
        self.play(FadeIn(card, run_time=DUR_FADE_IN))
        elapsed = DUR_FADE_IN

        if try_delay < duration:
            wait = try_delay - elapsed
            if wait > 0:
                self.wait(wait)
                elapsed += wait

            try_label = yt_text(
                "Try saying it now...",
                font_size=SIZE_ENGLISH,
                color=COL_ENGLISH,
                weight="NORMAL",
            )
            try_label.move_to([CARD_X_OFFSET, CARD_ZONE_Y - 0.5, 0])
            try_group = VGroup(try_label)
            self._set_layer("_secondary", try_group)
            self.play(FadeIn(try_group, run_time=DUR_FADE_IN))
            elapsed += DUR_FADE_IN

        remaining = duration - elapsed
        if remaining > 0:
            self.wait(remaining)

    # --- show_shadowing_line ---

    def show_shadowing_line(
        self,
        text_split: str,
        duration: float,
        *,
        highlight: bool = True,
        translit: str | None = None,
    ):
        """Display space-separated Thai words for karaoke-style shadowing.

        If highlight=True, words light up sequentially.
        Optionally shows transliteration as a static line below.
        Consumes exactly `duration` seconds.
        """
        words = text_split.split()
        if not words:
            self.wait(duration)
            return

        word_mobjects = []
        for w in words:
            m = yt_text(w, font_size=SIZE_THAI_SPLIT, color=COL_THAI_SPLIT, weight="MEDIUM")
            word_mobjects.append(m)

        word_row = VGroup(*word_mobjects).arrange(RIGHT, buff=0.3)
        if word_row.width > effective_text_width():
            word_row.scale_to_fit_width(effective_text_width())

        if translit:
            tr_label = yt_text(translit, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL")
            group = VGroup(word_row, tr_label).arrange(DOWN, buff=0.25)
        else:
            group = word_row

        group.move_to([CARD_X_OFFSET, CENTER_Y, 0])

        # Snap clear previous and add new
        self.snap_clear()
        self._set_layer("_primary", group)
        self.add(group)

        if highlight and len(words) > 1:
            # Set all dim initially
            for m in word_mobjects:
                m.set_color(COL_ENGLISH)  # dim
            # Highlight each word in sequence
            per_word = max(0.1, (duration - 0.1) / len(words))
            for i, m in enumerate(word_mobjects):
                m.set_color(COL_HIGHLIGHT)
                if i > 0:
                    word_mobjects[i - 1].set_color(COL_THAI_SPLIT)  # un-highlight previous
                self.wait(per_word)
        else:
            self.wait(duration)

    # --- show_accumulate ---

    def show_accumulate(
        self,
        text: str,
        duration: float,
        *,
        style: str = "ThaiCentre",
        translit: str | None = None,
    ):
        """Add a line to an accumulating stack (natural-listen mode).

        Does NOT clear previous lines — they stay on screen.
        Consumes exactly `duration` seconds.
        """
        size = SIZE_THAI_CENTRE if style == "ThaiCentre" else SIZE_THAI
        color = COL_THAI

        if translit:
            thai_label = yt_text(text, font_size=size, color=color, weight="MEDIUM")
            tr_label = yt_text(translit, font_size=SIZE_TRANSLIT * 0.9, color=COL_TRANSLIT, weight="NORMAL")
            label = VGroup(thai_label, tr_label)
            label.arrange(DOWN, buff=0.08)
        else:
            label = yt_text(text, font_size=size, color=color, weight="MEDIUM")
        self._accum_stack.append(label)

        # Rebuild the accumulation group
        stack = VGroup(*self._accum_stack)
        stack.arrange(DOWN, buff=0.25)
        stack.move_to([CARD_X_OFFSET, CENTER_Y, 0])

        # Overflow guard — scale down if too tall
        max_height = FRAME_HEIGHT * 0.6
        if stack.height > max_height:
            stack.scale_to_fit_height(max_height)

        # Remove all old accumulated labels individually from scene
        for old_label in self._accum_stack[:-1]:
            self.remove(old_label)
        self._set_layer("_secondary", stack)

        # Add the rebuilt stack (Manim tracks each mobject by identity)
        self.add(stack)
        # Fade in just the new line
        label.set_opacity(0)
        self.play(FadeIn(label, run_time=DUR_FADE_IN))

        remaining = duration - DUR_FADE_IN
        if remaining > 0:
            self.wait(remaining)

    # --- show_stacked_pair ---

    def show_stacked_pair(
        self,
        thai: str,
        english: str,
        duration: float,
        *,
        fade_in_english: bool = True,
        english_delay: float = 1.0,
        translit: str | None = None,
    ):
        """Thai line on top, transliteration below, English line below that (hook mode).

        Thai snaps in, English fades in after delay.
        Consumes exactly `duration` seconds.
        """
        _cw = card_text_width()
        thai_label = yt_text(thai, font_size=SIZE_THAI_CENTRE, color=COL_THAI, weight="MEDIUM", max_width=_cw)
        english_label = yt_text(english, font_size=SIZE_ENGLISH, color=COL_ENGLISH, weight="NORMAL", max_width=_cw)

        if translit:
            tr_label = yt_text(translit, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL", max_width=_cw)
            stack = VGroup(thai_label, tr_label, english_label)
        else:
            stack = VGroup(thai_label, english_label)
        stack.arrange(DOWN, buff=0.3)

        card = TextCard(stack)
        card.move_to([CARD_X_OFFSET, CARD_ZONE_Y, 0])

        # Initially hide english
        english_label.set_opacity(0)

        self._set_layer("_primary", card)
        self.add(card)
        elapsed = 0.05
        self.wait(0.05)

        if fade_in_english:
            wait = english_delay - elapsed
            if wait > 0:
                self.wait(wait)
                elapsed += wait
            self.play(english_label.animate.set_opacity(1), run_time=DUR_FADE_IN)
            elapsed += DUR_FADE_IN

        remaining = duration - elapsed
        if remaining > 0:
            self.wait(remaining)

    # --- set_subtitle (instant, no time consumed) ---

    def set_subtitle(
        self,
        text: str,
        *,
        lang: str = "th",
        translit: str | None = None,
    ):
        """Set the subtitle strip content instantly. Consumes 0 seconds.

        Use this alongside card calls — the card handles the timing,
        this just updates what's shown in the bottom subtitle strip.
        """
        _sub_max = effective_text_width()
        if lang == "th" and translit:
            thai_label = yt_text(
                text, font_size=SIZE_SUBTITLE, color=COL_THAI, weight="MEDIUM",
                max_width=_sub_max,
            )
            tr_label = yt_text(
                translit, font_size=SIZE_SUBTITLE * 0.8, color=COL_TRANSLIT,
                weight="NORMAL", max_width=_sub_max,
            )
            content = VGroup(thai_label, tr_label)
            content.arrange(DOWN, buff=0.08)
        else:
            color = COL_ENGLISH if lang == "en" else COL_THAI
            label = yt_text(
                text, font_size=SIZE_SUBTITLE, color=color, weight="NORMAL",
                max_width=_sub_max,
            )
            content = VGroup(label)

        content.move_to([SUBTITLE_X_OFFSET, SUBTITLE_CENTER_Y, 0])

        old = self._subtitle
        if old is not None:
            self.remove(old)
        self._subtitle = content
        self.add(content)

    # --- show_subtitle ---

    def show_subtitle(
        self,
        text: str,
        duration: float,
        *,
        lang: str = "en",
        translit: str | None = None,
        fade_in: bool = True,
    ):
        """Display a running subtitle in the bottom strip.

        Independent of card zone overlays (_primary/_secondary/_accent).
        For lang="th" with translit, shows Thai + translit stacked.
        Consumes exactly `duration` seconds.
        """
        _sub_max = effective_text_width()
        if lang == "th" and translit:
            thai_label = yt_text(
                text, font_size=SIZE_SUBTITLE, color=COL_THAI, weight="MEDIUM",
                max_width=_sub_max,
            )
            tr_label = yt_text(
                translit, font_size=SIZE_SUBTITLE * 0.8, color=COL_TRANSLIT,
                weight="NORMAL", max_width=_sub_max,
            )
            content = VGroup(thai_label, tr_label)
            content.arrange(DOWN, buff=0.08)
        else:
            color = COL_ENGLISH if lang == "en" else COL_THAI
            label = yt_text(
                text, font_size=SIZE_SUBTITLE, color=color, weight="NORMAL",
                max_width=_sub_max,
            )
            content = VGroup(label)

        content.move_to([SUBTITLE_X_OFFSET, SUBTITLE_CENTER_Y, 0])

        # Remove old subtitle without animation
        old = self._subtitle
        if old is not None:
            self.remove(old)
        self._subtitle = content

        anim_time = DUR_FADE_IN if fade_in else 0.05
        if fade_in:
            self.play(FadeIn(content, run_time=anim_time))
        else:
            self.add(content)
            self.wait(anim_time)

        remaining = duration - anim_time
        if remaining > 0:
            self.wait(remaining)

    # --- clear_subtitle ---

    def clear_subtitle(self, run_time: float = DUR_FADE_OUT) -> float:
        """Fade out just the subtitle layer. Returns time consumed."""
        if self._subtitle is not None:
            self.play(FadeOut(self._subtitle, run_time=run_time))
            self._subtitle = None
            return run_time
        return 0.0
