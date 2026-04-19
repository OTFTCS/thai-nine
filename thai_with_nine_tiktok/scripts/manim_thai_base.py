"""
Base Manim components for Thai TikTok overlay generation.

Provides reusable building blocks for 9:16 TikTok overlays with
Thai/transliteration/English text, visual effects, and a translucent
backdrop bar in the bottom 40% of the frame.

Usage:
    from manim_thai_base import (
        ThaiTikTokScene, ThaiTripletGroup, PerformGloss,
        RedXSlam, YourTurnCountdown,
    )
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Animation,
    Create,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Rectangle,
    RoundedRectangle,
    Scene,
    Text,
    VGroup,
    Write,
    config,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_PROJECT_ROOT = _HERE.parent  # thai_with_nine_tiktok/
_REPO_ROOT = _PROJECT_ROOT.parent  # thai-nine/

_STYLE_PATH = _PROJECT_ROOT / "config" / "manim-style.json"
_FONTS_DIR = _REPO_ROOT / "assets" / "fonts"

# ---------------------------------------------------------------------------
# Load style contract
# ---------------------------------------------------------------------------


def _load_style() -> dict:
    with open(_STYLE_PATH) as f:
        return json.load(f)


STYLE = _load_style()

# ---------------------------------------------------------------------------
# Register Sarabun fonts with Pango via manimpango
# ---------------------------------------------------------------------------

try:
    import manimpango

    for ttf in _FONTS_DIR.glob("Sarabun-*.ttf"):
        manimpango.register_font(str(ttf))
except Exception as _e:
    import warnings
    warnings.warn(f"Failed to register Sarabun fonts with manimpango: {_e}")

# ---------------------------------------------------------------------------
# Layout constants (Manim coordinate space, origin at center)
# Frame: height ~8 units (-4 to +4), width ~4.5 units for 9:16
# ---------------------------------------------------------------------------

# Manim default frame: height=8, width=14.22 (16:9).
# We override to 9:16 below.
FRAME_HEIGHT = 8.0
FRAME_WIDTH = FRAME_HEIGHT * (9 / 16)  # 4.5

# ---------------------------------------------------------------------------
# Configure Manim for 9:16 at module load time (before scene instantiation)
# ---------------------------------------------------------------------------

config.frame_height = FRAME_HEIGHT
config.frame_width = FRAME_WIDTH
config.pixel_height = STYLE["resolution"]["height"]  # 1920
config.pixel_width = STYLE["resolution"]["width"]  # 1080

# Zone boundaries (y-coordinates)
OVERLAY_TOP = FRAME_HEIGHT / 2 - FRAME_HEIGHT * 0.6  # top of bottom-40%
OVERLAY_BOTTOM = -FRAME_HEIGHT / 2
OVERLAY_CENTER_Y = (OVERLAY_TOP + OVERLAY_BOTTOM) / 2

# Sub-zones within the overlay for triplet + gloss layout
# Triplet sits in the upper portion, gloss in the lower
_OVERLAY_HEIGHT = OVERLAY_TOP - OVERLAY_BOTTOM  # 3.2 units
TRIPLET_CENTER_Y = OVERLAY_TOP - _OVERLAY_HEIGHT * 0.35  # upper area
GLOSS_CENTER_Y = OVERLAY_TOP - _OVERLAY_HEIGHT * 0.78   # lower area

# Camera zone
CAMERA_TOP = FRAME_HEIGHT / 2
CAMERA_BOTTOM = OVERLAY_TOP

# ---------------------------------------------------------------------------
# Colors (from style contract, light on dark for translucent bar)
# ---------------------------------------------------------------------------

COL_THAI = STYLE["colors"]["thai"]
COL_TRANSLIT = STYLE["colors"]["translit"]
COL_ENGLISH = STYLE["colors"]["english"]
COL_PERFORM_TEXT = STYLE["colors"]["performText"]
COL_PERFORM_BG = STYLE["colors"]["performBg"]
COL_ACCENT = STYLE["colors"]["accent"]
COL_WRONG = STYLE["colors"]["wrong"]
COL_CORRECT = STYLE["colors"]["correct"]
COL_CLASSIFIER = STYLE["colors"]["classifierHighlight"]
COL_COUNTDOWN = STYLE["colors"]["countdownText"]

BAR_COLOR = STYLE["translucentBar"]["color"]
BAR_OPACITY = STYLE["translucentBar"]["opacity"]

# Font sizes (from style contract — single source of truth)
SIZE_THAI = STYLE["fonts"]["thai"]["sizePt"]
SIZE_TRANSLIT = STYLE["fonts"]["translit"]["sizePt"]
SIZE_ENGLISH = STYLE["fonts"]["english"]["sizePt"]
SIZE_PERFORM = STYLE["fonts"]["perform"]["sizePt"]
SIZE_YOUR_TURN = STYLE["fonts"]["yourTurnHeader"]["sizePt"]
SIZE_COUNTDOWN = STYLE["fonts"]["countdownDigit"]["sizePt"]
SIZE_ENGLISH_SUB = STYLE["fonts"]["englishSubtitle"]["sizePt"]

# Spacing (from style contract)
_SP = STYLE["spacing"]
BUFF_TEXT_LINE = _SP["textLineBuff"]
PAD_TRIPLET_X = _SP["tripletPadX"]
PAD_TRIPLET_Y = _SP["tripletPadY"]
PAD_PERFORM_X = _SP["performPadX"]
PAD_PERFORM_Y = _SP["performPadY"]
BUBBLE_CORNER_RADIUS = _SP["bubbleCornerRadius"]
BUBBLE_OPACITY = _SP["bubbleOpacity"]

# Animation durations
DUR_TRIPLET = STYLE["animations"]["tripletRevealDurationSec"]
DUR_PERFORM = STYLE["animations"]["performBounceDurationSec"]
DUR_RED_X = STYLE["animations"]["redXSlamDurationSec"]
DUR_COUNTDOWN = STYLE["animations"]["countdownDigitDurationSec"]
DUR_TRANSITION = STYLE["animations"]["transitionWipeDurationSec"]
DUR_FADE_OUT = STYLE["animations"]["fadeOutDurationSec"]


# ---------------------------------------------------------------------------
# Helper: create a Text object with Sarabun
# ---------------------------------------------------------------------------


MAX_TEXT_WIDTH = FRAME_WIDTH * 0.85  # leave some padding


_RENDER_FONT_SIZE = 96  # Render large for clean SVG glyphs, then scale


def thai_text(
    text: str,
    *,
    font_size: float = 24,
    color: str = COL_THAI,
    font: str = "Sarabun",
    weight: str = "MEDIUM",
    max_width: float = MAX_TEXT_WIDTH,
) -> Text:
    """Create a Manim Text object configured for Thai rendering.

    Renders at a large internal size (96pt) for clean glyph spacing,
    then scales to the requested visual size. Automatically clamps
    width to max_width.
    """
    t = Text(
        text,
        font=font,
        font_size=_RENDER_FONT_SIZE,
        color=color,
        weight=weight,
    )
    # Scale from render size to requested visual size
    scale_factor = font_size / _RENDER_FONT_SIZE
    t.scale(scale_factor)
    # Clamp to max width
    if max_width and t.width > max_width:
        t.scale_to_fit_width(max_width)
    return t


# ---------------------------------------------------------------------------
# TranslucentBar
# ---------------------------------------------------------------------------


class TranslucentBar(Rectangle):
    """Semi-transparent dark rectangle spanning the bottom 40% of the frame."""

    def __init__(self, **kwargs):
        bar_height = OVERLAY_TOP - OVERLAY_BOTTOM
        super().__init__(
            width=FRAME_WIDTH + 0.2,  # slight bleed to avoid edge gaps
            height=bar_height,
            fill_color=BAR_COLOR,
            fill_opacity=BAR_OPACITY,
            stroke_width=0,
            **kwargs,
        )
        self.move_to([0, OVERLAY_CENTER_Y, 0])


# ---------------------------------------------------------------------------
# ThaiTripletGroup
# ---------------------------------------------------------------------------


class ThaiTripletGroup(VGroup):
    """Three-line text group: Thai (large) / translit (medium) / English (small).

    Has a rounded bubble background. Positioned in the upper overlay zone
    so a PerformGloss can sit below it.
    """

    def __init__(
        self,
        thai_str: str,
        translit_str: str,
        english_str: str,
        *,
        classifier_highlight: str | None = None,
        **kwargs,
    ):
        self.thai_line = thai_text(thai_str, font_size=SIZE_THAI, color=COL_THAI, weight="MEDIUM")
        self.translit_line = thai_text(
            translit_str, font_size=SIZE_TRANSLIT, color=COL_TRANSLIT, weight="NORMAL"
        )
        self.english_line = thai_text(
            english_str, font_size=SIZE_ENGLISH, color=COL_ENGLISH, weight="NORMAL"
        )

        # Stack text lines
        self._text_group = VGroup(
            self.thai_line, self.translit_line, self.english_line,
        )
        self._text_group.arrange(DOWN, buff=BUFF_TEXT_LINE)

        # Overflow guard — scale down if text group exceeds max width
        if self._text_group.width > MAX_TEXT_WIDTH:
            self._text_group.scale_to_fit_width(MAX_TEXT_WIDTH)

        # Bubble background
        self.bubble = RoundedRectangle(
            width=min(self._text_group.width + PAD_TRIPLET_X * 2, FRAME_WIDTH * 0.92),
            height=self._text_group.height + PAD_TRIPLET_Y * 2,
            corner_radius=BUBBLE_CORNER_RADIUS,
            fill_color="#1B2631",
            fill_opacity=BUBBLE_OPACITY,
            stroke_width=0,
        )
        self.bubble.move_to(self._text_group.get_center())

        super().__init__(self.bubble, self._text_group, **kwargs)
        self.move_to([0, TRIPLET_CENTER_Y, 0])

    def reveal_animation(self, run_time: float = DUR_TRIPLET) -> list[Animation]:
        """Return a list of animations that reveal the bubble then lines."""
        per_line = run_time / 3
        return [
            FadeIn(self.bubble, run_time=per_line * 0.5),
            FadeIn(self.thai_line, run_time=per_line),
            FadeIn(self.translit_line, run_time=per_line * 0.5),
            FadeIn(self.english_line, run_time=per_line * 0.5),
        ]


# ---------------------------------------------------------------------------
# PerformGloss
# ---------------------------------------------------------------------------


class PerformGloss(VGroup):
    """Large centered comedy text for [PERFORM] beats.

    Pill-shaped background in the lower overlay zone, below the triplet.
    """

    def __init__(self, text: str, **kwargs):
        self.label = thai_text(
            text,
            font_size=SIZE_PERFORM,
            color=COL_PERFORM_TEXT,
            font="Sarabun",
            weight="BOLD",
        )
        # Overflow guard
        if self.label.width > MAX_TEXT_WIDTH:
            self.label.scale_to_fit_width(MAX_TEXT_WIDTH)
        self.bg = RoundedRectangle(
            width=min(self.label.width + PAD_PERFORM_X * 2, FRAME_WIDTH * 0.92),
            height=self.label.height + PAD_PERFORM_Y * 2,
            corner_radius=BUBBLE_CORNER_RADIUS,
            fill_color=COL_PERFORM_BG,
            fill_opacity=BUBBLE_OPACITY,
            stroke_width=0,
        )
        super().__init__(self.bg, self.label, **kwargs)
        self.move_to([0, GLOSS_CENTER_Y, 0])

    def bounce_in(self, run_time: float = DUR_PERFORM) -> Animation:
        return GrowFromCenter(self, run_time=run_time)


# ---------------------------------------------------------------------------
# RedXSlam
# ---------------------------------------------------------------------------


class RedXSlam(VGroup):
    """Red X graphic that slams over content."""

    def __init__(self, scale: float = 2.0, **kwargs):
        line1 = Text("✕", font_size=60 * scale, color=COL_WRONG, weight="BOLD")
        super().__init__(line1, **kwargs)
        self.move_to([0, OVERLAY_CENTER_Y, 0])

    def slam_animation(self, run_time: float = DUR_RED_X) -> Animation:
        return GrowFromCenter(self, run_time=run_time)


# ---------------------------------------------------------------------------
# YourTurnCountdown
# ---------------------------------------------------------------------------


class YourTurnCountdown(VGroup):
    """'YOUR TURN' text with countdown digits."""

    def __init__(self, seconds: int = 3, **kwargs):
        self.seconds = seconds
        self.header = thai_text(
            "YOUR TURN",
            font_size=SIZE_YOUR_TURN,
            color=COL_COUNTDOWN,
            font="Sarabun",
            weight="BOLD",
        )
        super().__init__(self.header, **kwargs)
        self.move_to([0, OVERLAY_CENTER_Y, 0])

    def countdown_animations(self) -> list[tuple[Animation, float]]:
        """Return list of (animation, wait_time) pairs for the countdown."""
        anims = [(FadeIn(self.header, run_time=0.3), 0.5)]
        for i in range(self.seconds, 0, -1):
            digit = thai_text(
                str(i),
                font_size=SIZE_COUNTDOWN,
                color=COL_ACCENT,
                weight="BOLD",
            )
            digit.next_to(self.header, DOWN, buff=0.2)
            anims.append((FadeIn(digit, run_time=0.2), DUR_COUNTDOWN - 0.2))
            anims.append((FadeOut(digit, run_time=0.2), 0.0))
        return anims


# ---------------------------------------------------------------------------
# ThaiTikTokScene — base scene
# ---------------------------------------------------------------------------


class ThaiTikTokScene(Scene):
    """Base scene class configured for 9:16 transparent-background rendering.

    Tracks two overlay layers independently:
      - _triplet: Thai/translit/English bubble (upper zone, persists across perform beats)
      - _gloss:   PERFORM comedy text (lower zone)
      - _other:   English lines, YOUR TURN, etc. (use full overlay zone)

    Subclasses should override construct() and use the helper methods.
    """

    def setup(self):
        # Add persistent translucent bar
        self.bar = TranslucentBar()
        self.add(self.bar)

        # Track overlay layers independently
        self._triplet: VGroup | None = None
        self._gloss: VGroup | None = None
        self._other: VGroup | None = None

    def _clear_gloss(self, run_time: float = DUR_FADE_OUT):
        """Fade out just the gloss layer."""
        if self._gloss is not None:
            self.play(FadeOut(self._gloss, run_time=run_time))
            self._gloss = None

    def _clear_triplet(self, run_time: float = DUR_FADE_OUT):
        """Fade out just the triplet layer."""
        if self._triplet is not None:
            self.play(FadeOut(self._triplet, run_time=run_time))
            self._triplet = None

    def _clear_other(self, run_time: float = DUR_FADE_OUT):
        """Fade out the 'other' overlay (english lines, countdown, etc)."""
        if self._other is not None:
            self.play(FadeOut(self._other, run_time=run_time))
            self._other = None

    def clear_overlay(self, run_time: float = DUR_FADE_OUT) -> float:
        """Fade out ALL overlay content (triplet + gloss + other).

        Returns the actual time consumed (0 if nothing was on screen).
        """
        to_fade = []
        if self._triplet is not None:
            to_fade.append(FadeOut(self._triplet, run_time=run_time))
            self._triplet = None
        if self._gloss is not None:
            to_fade.append(FadeOut(self._gloss, run_time=run_time))
            self._gloss = None
        if self._other is not None:
            to_fade.append(FadeOut(self._other, run_time=run_time))
            self._other = None
        if to_fade:
            self.play(*to_fade)
            return run_time
        return 0.0

    def show_triplet(
        self,
        thai_str: str,
        translit_str: str,
        english_str: str,
        duration: float = 2.0,
        *,
        classifier_highlight: str | None = None,
    ):
        """Display a Thai/translit/English triplet in a bubble.

        Total Manim time consumed = exactly `duration` seconds.
        Fits clear + reveal + hold within that budget.
        """
        clear_time = self.clear_overlay()
        group = ThaiTripletGroup(
            thai_str, translit_str, english_str,
            classifier_highlight=classifier_highlight,
        )
        self._triplet = group
        for anim in group.reveal_animation():
            self.play(anim)
        remaining = duration - DUR_TRIPLET - clear_time
        if remaining > 0:
            self.wait(remaining)

    def show_perform(self, text: str, duration: float = 2.0):
        """Display a [PERFORM] gloss below the current triplet.

        Does NOT clear the triplet — both stay on screen together.
        Total Manim time consumed = exactly `duration` seconds.
        """
        clear_time = 0.0
        if self._gloss is not None:
            self._clear_gloss(run_time=0.15)
            clear_time += 0.15
        if self._other is not None:
            self._clear_other(run_time=0.15)
            clear_time = max(clear_time, 0.15)
        gloss = PerformGloss(text)
        self._gloss = gloss
        self.play(gloss.bounce_in())
        remaining = duration - DUR_PERFORM - clear_time
        if remaining > 0:
            self.wait(remaining)

    def show_red_x(self, duration: float = 1.0):
        """Slam a red X over the current content (does not clear triplet)."""
        x = RedXSlam()
        self.play(x.slam_animation())
        remaining = duration - DUR_RED_X - DUR_FADE_OUT
        if remaining > 0:
            self.wait(remaining)
        self.play(FadeOut(x, run_time=DUR_FADE_OUT))

    def show_your_turn(self, duration: float = 3.0):
        """Display YOUR TURN countdown, fitting within the given duration.

        Accepts duration (seconds) instead of a digit count.
        If duration is too short (< 0.5s), skips entirely.
        """
        if duration < 0.5:
            return
        self.clear_overlay()
        # Determine how many countdown digits fit
        digits = max(1, min(int(duration), 5))
        countdown = YourTurnCountdown(seconds=digits)
        self._other = countdown
        anim_time = 0.0
        for anim, wait in countdown.countdown_animations():
            self.play(anim)
            anim_time += anim.run_time
            if wait > 0 and anim_time + wait <= duration:
                self.wait(wait)
                anim_time += wait
        remaining = duration - anim_time
        if remaining > 0.01:
            self.wait(remaining)

    def show_english(self, text: str, duration: float = 2.0):
        """Display a plain English subtitle line.

        Total Manim time consumed = exactly `duration` seconds.
        Fits clear + fade-in + hold within that budget.
        """
        clear_time = self.clear_overlay()
        label = thai_text(text, font_size=SIZE_ENGLISH_SUB, color=COL_THAI, weight="BOLD")
        label.move_to([0, OVERLAY_CENTER_Y, 0])
        self._other = VGroup(label)
        self.play(FadeIn(label, run_time=0.3))
        remaining = duration - 0.3 - clear_time
        if remaining > 0:
            self.wait(remaining)
