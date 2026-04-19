"""
Base Manim components for Thai course lesson video rendering.

16:9 layout with content in left 2/3, right 1/3 reserved for Nine's camera.
Slide-based structure with animated elements: text builds, card reveals,
section transitions, drill pauses, and roleplay ladders.

Usage:
    from scene_base import (
        LessonScene, TripletCard, ContrastPair,
        DialogueLine, DrillCue, SectionHeader,
    )
"""

from __future__ import annotations

import json
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    ORIGIN,
    Animation,
    Create,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Line,
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
_TOOLS_DIR = _HERE.parent          # course/tools/
_COURSE_DIR = _TOOLS_DIR.parent    # course/
_REPO_ROOT = _COURSE_DIR.parent    # thai-nine/

_STYLE_PATH = _COURSE_DIR / "config" / "manim-lesson-style.json"
_FONTS_DIR = _REPO_ROOT / "assets" / "fonts"

# ---------------------------------------------------------------------------
# Load style contract
# ---------------------------------------------------------------------------


def _load_style() -> dict:
    with open(_STYLE_PATH) as f:
        return json.load(f)


STYLE = _load_style()

# ---------------------------------------------------------------------------
# Register Sarabun fonts
# ---------------------------------------------------------------------------

try:
    import manimpango

    for ttf in _FONTS_DIR.glob("Sarabun-*.ttf"):
        manimpango.register_font(str(ttf))
except Exception as _e:
    import warnings
    warnings.warn(f"Failed to register Sarabun fonts: {_e}")

# ---------------------------------------------------------------------------
# Layout constants (Manim coordinate space)
# Standard 16:9: frame_height=8, frame_width=14.22
# Content zone: left 2/3 (x from left edge to 2/3 mark)
# Camera zone: right 1/3 (reserved, not rendered)
# ---------------------------------------------------------------------------

FRAME_HEIGHT = 8.0
FRAME_WIDTH = FRAME_HEIGHT * (16 / 9)  # ~14.22

config.frame_height = FRAME_HEIGHT
config.frame_width = FRAME_WIDTH
config.pixel_height = STYLE["resolution"]["height"]  # 1080
config.pixel_width = STYLE["resolution"]["width"]     # 1920

# Content zone boundaries
CONTENT_FRAC = STYLE["layout"]["contentZone"]["rightFrac"]  # 0.6667
CONTENT_WIDTH = FRAME_WIDTH * CONTENT_FRAC  # ~9.48
CONTENT_LEFT = -FRAME_WIDTH / 2                              # -7.11
CONTENT_RIGHT = CONTENT_LEFT + CONTENT_WIDTH                 # ~2.37
CONTENT_CENTER_X = (CONTENT_LEFT + CONTENT_RIGHT) / 2        # ~-2.37

# Usable content area with padding
CONTENT_PADDING = 0.4
USABLE_WIDTH = CONTENT_WIDTH - CONTENT_PADDING * 2
USABLE_LEFT = CONTENT_LEFT + CONTENT_PADDING
USABLE_RIGHT = CONTENT_RIGHT - CONTENT_PADDING

# Vertical zones
TOP_MARGIN = FRAME_HEIGHT / 2 - 0.3      # ~3.7
BOTTOM_MARGIN = -FRAME_HEIGHT / 2 + 0.3  # ~-3.7
HEADER_Y = TOP_MARGIN - 0.4              # ~3.3
BODY_TOP_Y = HEADER_Y - 0.8             # ~2.5
BODY_CENTER_Y = 0.0

# Divider line position (between content and camera zones)
DIVIDER_X = CONTENT_RIGHT

# ---------------------------------------------------------------------------
# Colors (from style config)
# ---------------------------------------------------------------------------

COL_THAI = STYLE["colors"]["thai"]
COL_TRANSLIT = STYLE["colors"]["translit"]
COL_ENGLISH = STYLE["colors"]["english"]
COL_HEADING = STYLE["colors"]["heading"]
COL_ACCENT = STYLE["colors"]["accent"]
COL_WRONG = STYLE["colors"]["wrong"]
COL_CORRECT = STYLE["colors"]["correct"]
COL_DRILL = STYLE["colors"]["drillCue"]
COL_SPEAKER_YOU = STYLE["colors"]["speakerYou"]
COL_SPEAKER_OTHER = STYLE["colors"]["speakerOther"]

BG_COLOR = STYLE["background"]["color"]
CARD_COLOR = STYLE["background"]["cardColor"]
CARD_BORDER = STYLE["background"]["cardBorder"]

# Animation durations
DUR_CARD_REVEAL = STYLE["animations"]["cardRevealSec"]
DUR_TEXT_FADE = STYLE["animations"]["textFadeInSec"]
DUR_SECTION_TRANSITION = STYLE["animations"]["sectionTransitionSec"]
DUR_HIGHLIGHT = STYLE["animations"]["highlightPulseSec"]
DUR_DRILL_CUE = STYLE["animations"]["drillPauseCueSec"]

# ---------------------------------------------------------------------------
# Text helper (same approach as TikTok pipeline — render large, scale down)
# ---------------------------------------------------------------------------

_RENDER_FONT_SIZE = 96


def lesson_text(
    text: str,
    *,
    font_size: float = 24,
    color: str = COL_THAI,
    font: str = "Sarabun",
    weight: str = "MEDIUM",
    max_width: float | None = None,
) -> Text:
    """Create a Text object with Sarabun, rendered at 96pt and scaled down.

    This avoids the Pango kerning bug (#2844) with Thai diacritics.
    """
    if max_width is None:
        max_width = USABLE_WIDTH

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
# TripletCard — white card with Thai/translit/English
# ---------------------------------------------------------------------------


class TripletCard(VGroup):
    """White rounded card with Thai (large) / translit (medium) / English (small).

    Features:
    - Accent-colored left border strip
    - Auto-sizes to content
    - Max width = usable content zone
    """

    def __init__(
        self,
        thai: str,
        translit: str,
        english: str,
        *,
        accent_color: str = COL_ACCENT,
        **kwargs,
    ):
        self.thai_line = lesson_text(thai, font_size=44, color=COL_THAI, weight="MEDIUM")
        self.translit_line = lesson_text(translit, font_size=26, color=COL_TRANSLIT, weight="NORMAL")
        self.english_line = lesson_text(english, font_size=22, color=COL_ENGLISH, weight="NORMAL")

        self._text_group = VGroup(
            self.thai_line, self.translit_line, self.english_line
        ).arrange(DOWN, buff=0.12, aligned_edge=LEFT)

        pad_x, pad_y = 0.5, 0.35
        card_width = min(self._text_group.width + pad_x * 2 + 0.1, USABLE_WIDTH)
        card_height = self._text_group.height + pad_y * 2

        # Card background
        self.card_bg = RoundedRectangle(
            width=card_width,
            height=card_height,
            corner_radius=0.1,
            fill_color=CARD_COLOR,
            fill_opacity=1.0,
            stroke_color=CARD_BORDER,
            stroke_width=1.5,
        )

        # Accent left strip
        self.accent_strip = Rectangle(
            width=0.06,
            height=card_height - 0.1,
            fill_color=accent_color,
            fill_opacity=1.0,
            stroke_width=0,
        )
        self.accent_strip.next_to(self.card_bg, LEFT, buff=0).shift(RIGHT * 0.08)

        # Position text inside card
        self._text_group.move_to(self.card_bg.get_center()).shift(RIGHT * 0.05)

        super().__init__(self.card_bg, self.accent_strip, self._text_group, **kwargs)


class ContrastPair(VGroup):
    """Two TripletCards side by side for comparison."""

    def __init__(
        self,
        card_a: TripletCard,
        card_b: TripletCard,
        **kwargs,
    ):
        vs_label = lesson_text("vs", font_size=16, color=COL_ENGLISH, weight="NORMAL")
        super().__init__(card_a, vs_label, card_b, **kwargs)
        self.arrange(RIGHT, buff=0.4)


# ---------------------------------------------------------------------------
# DialogueLine — speaker label + triplet for roleplay
# ---------------------------------------------------------------------------


class DialogueLine(VGroup):
    """A single roleplay line: speaker label + Thai/translit/English."""

    def __init__(
        self,
        speaker: str,
        thai: str,
        translit: str,
        english: str,
        **kwargs,
    ):
        is_you = speaker.lower() == "you"
        speaker_color = COL_SPEAKER_YOU if is_you else COL_SPEAKER_OTHER

        self.speaker_label = lesson_text(
            speaker + ":",
            font_size=18,
            color=speaker_color,
            weight="BOLD",
        )
        self.thai_text = lesson_text(thai, font_size=30, color=COL_THAI, weight="MEDIUM")
        self.translit_text = lesson_text(translit, font_size=18, color=COL_TRANSLIT, weight="NORMAL")
        self.english_text = lesson_text(english, font_size=18, color=COL_ENGLISH, weight="NORMAL")

        line_group = VGroup(
            self.thai_text, self.translit_text, self.english_text
        ).arrange(DOWN, buff=0.08, aligned_edge=LEFT)

        super().__init__(self.speaker_label, line_group, **kwargs)
        self.arrange(RIGHT, buff=0.25, aligned_edge=UP)


# ---------------------------------------------------------------------------
# DrillCue — instruction text + countdown for pauses
# ---------------------------------------------------------------------------


class DrillCue(VGroup):
    """Drill instruction with visual pause cue."""

    def __init__(self, instruction: str, pause_seconds: int = 5, **kwargs):
        self.instruction_text = lesson_text(
            instruction,
            font_size=22,
            color=COL_DRILL,
            weight="MEDIUM",
            max_width=USABLE_WIDTH * 0.9,
        )
        self.pause_label = lesson_text(
            f"⏸ {pause_seconds}s",
            font_size=26,
            color=COL_ACCENT,
            weight="BOLD",
        )
        super().__init__(self.instruction_text, self.pause_label, **kwargs)
        self.arrange(DOWN, buff=0.25)


# ---------------------------------------------------------------------------
# SectionHeader — accent bar + number + title
# ---------------------------------------------------------------------------


class SectionHeader(VGroup):
    """Section header with accent-colored number badge and title."""

    def __init__(self, title: str, section_num: int | None = None, **kwargs):
        elements = []

        if section_num is not None:
            badge = RoundedRectangle(
                width=0.7,
                height=0.55,
                corner_radius=0.08,
                fill_color=COL_ACCENT,
                fill_opacity=1.0,
                stroke_width=0,
            )
            num_text = lesson_text(
                str(section_num),
                font_size=22,
                color="#FFFFFF",
                weight="BOLD",
            )
            num_text.move_to(badge.get_center())
            badge_group = VGroup(badge, num_text)
            elements.append(badge_group)

        title_text = lesson_text(
            title,
            font_size=28,
            color=COL_HEADING,
            weight="BOLD",
            max_width=USABLE_WIDTH - 1.0,
        )
        elements.append(title_text)

        # Underline
        underline = Line(
            start=[USABLE_LEFT, 0, 0],
            end=[USABLE_RIGHT, 0, 0],
            stroke_color=COL_ACCENT,
            stroke_width=1.5,
            stroke_opacity=0.4,
        )
        elements.append(underline)

        super().__init__(*elements, **kwargs)
        self.arrange(RIGHT, buff=0.15, aligned_edge=DOWN)
        # Re-position underline below
        underline.next_to(self.submobjects[0], DOWN, buff=0.08)
        underline.set_x(CONTENT_CENTER_X)


# ---------------------------------------------------------------------------
# RecapQuestion — question text for recall
# ---------------------------------------------------------------------------


class RecapQuestion(VGroup):
    """A recap question with number badge."""

    def __init__(self, question: str, number: int, **kwargs):
        badge = lesson_text(
            f"Q{number}",
            font_size=22,
            color=COL_ACCENT,
            weight="BOLD",
        )
        q_text = lesson_text(
            question,
            font_size=24,
            color=COL_THAI,
            weight="NORMAL",
            max_width=USABLE_WIDTH - 1.0,
        )
        super().__init__(badge, q_text, **kwargs)
        self.arrange(RIGHT, buff=0.15, aligned_edge=UP)


# ---------------------------------------------------------------------------
# LessonScene — base scene for 16:9 course lesson rendering
# ---------------------------------------------------------------------------


class LessonScene(Scene):
    """Base scene configured for 16:9 course lesson overlay.

    Renders content in the left 2/3. Right 1/3 is transparent
    (Nine's camera composited via ffmpeg).

    Subclasses override construct() and use the helper methods.
    """

    def setup(self):
        # Light background for content zone only
        self.content_bg = Rectangle(
            width=CONTENT_WIDTH,
            height=FRAME_HEIGHT,
            fill_color=BG_COLOR,
            fill_opacity=1.0,
            stroke_width=0,
        )
        self.content_bg.move_to([CONTENT_CENTER_X, 0, 0])
        self.add(self.content_bg)

        # Subtle divider between content and camera
        self.divider = Line(
            start=[DIVIDER_X, FRAME_HEIGHT / 2, 0],
            end=[DIVIDER_X, -FRAME_HEIGHT / 2, 0],
            stroke_color=CARD_BORDER,
            stroke_width=2,
            stroke_opacity=0.5,
        )
        self.add(self.divider)

        # Active overlay groups
        self._header: VGroup | None = None
        self._body: VGroup | None = None
        self._drill: VGroup | None = None

    # --- Clear methods ---

    def _clear_layer(self, attr: str, run_time: float = DUR_TEXT_FADE):
        obj = getattr(self, attr)
        if obj is not None:
            self.play(FadeOut(obj, run_time=run_time))
            setattr(self, attr, None)

    def clear_content(self, run_time: float = DUR_TEXT_FADE) -> float:
        """Fade out all content layers. Returns time consumed."""
        to_fade = []
        for attr in ("_header", "_body", "_drill"):
            obj = getattr(self, attr)
            if obj is not None:
                to_fade.append(FadeOut(obj, run_time=run_time))
                setattr(self, attr, None)
        if to_fade:
            self.play(*to_fade)
            return run_time
        return 0.0

    # --- Section header ---

    def show_section_header(self, title: str, section_num: int | None = None, duration: float = 2.0):
        """Animate a section header at the top of the content zone."""
        clear_time = 0.0
        if self._header is not None:
            self._clear_layer("_header")
            clear_time = DUR_TEXT_FADE

        header = SectionHeader(title, section_num)
        header.move_to([CONTENT_CENTER_X, HEADER_Y, 0])
        self._header = header
        self.play(FadeIn(header, run_time=DUR_TEXT_FADE))
        remaining = duration - DUR_TEXT_FADE - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Focus card (single large triplet) ---

    def show_focus_card(self, thai: str, translit: str, english: str, duration: float = 5.0):
        """Display a single large triplet card centered in body zone."""
        clear_time = self.clear_content()
        card = TripletCard(thai, translit, english)
        card.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
        self._body = card
        self.play(FadeIn(card, run_time=DUR_CARD_REVEAL))
        remaining = duration - DUR_CARD_REVEAL - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Contrast board (2+ cards side by side) ---

    def show_contrast_board(self, items: list[tuple[str, str, str]], duration: float = 8.0):
        """Display 2-4 triplet cards arranged in a grid.

        items: list of (thai, translit, english) tuples.
        """
        clear_time = self.clear_content()
        cards = [TripletCard(t, tr, e) for t, tr, e in items]

        if len(cards) <= 2:
            group = VGroup(*cards).arrange(RIGHT, buff=0.3)
        else:
            # 2x2 grid for 3-4 cards
            rows = []
            for i in range(0, len(cards), 2):
                row = VGroup(*cards[i:i+2]).arrange(RIGHT, buff=0.3)
                rows.append(row)
            group = VGroup(*rows).arrange(DOWN, buff=0.3)

        group.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
        # Scale down if too wide
        if group.width > USABLE_WIDTH:
            group.scale_to_fit_width(USABLE_WIDTH)
        self._body = group
        self.play(FadeIn(group, run_time=DUR_CARD_REVEAL))
        remaining = duration - DUR_CARD_REVEAL - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Dialogue ladder (roleplay) ---

    def show_dialogue_line(self, speaker: str, thai: str, translit: str, english: str, duration: float = 4.0):
        """Add a dialogue line to the ladder, building line-by-line."""
        line = DialogueLine(speaker, thai, translit, english)

        if self._body is None:
            self._body = VGroup(line)
            line.move_to([CONTENT_CENTER_X, BODY_TOP_Y - 0.5, 0])
        else:
            self._body.add(line)
            self._body.arrange(DOWN, buff=0.25, aligned_edge=LEFT)
            self._body.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
            # Scale if too tall
            if self._body.height > FRAME_HEIGHT - 2.0:
                self._body.scale_to_fit_height(FRAME_HEIGHT - 2.0)

        self.play(FadeIn(line, run_time=DUR_TEXT_FADE))
        remaining = duration - DUR_TEXT_FADE
        if remaining > 0:
            self.wait(remaining)

    # --- Drill cue + pause ---

    def show_drill(self, instruction: str, pause_seconds: int = 5, duration: float | None = None):
        """Show drill instruction, then hold for pause duration."""
        if self._drill is not None:
            self._clear_layer("_drill")

        cue = DrillCue(instruction, pause_seconds)
        cue.move_to([CONTENT_CENTER_X, BOTTOM_MARGIN + 1.0, 0])
        self._drill = cue
        self.play(FadeIn(cue, run_time=DUR_DRILL_CUE))

        total_dur = duration if duration is not None else (pause_seconds + 1.0)
        remaining = total_dur - DUR_DRILL_CUE
        if remaining > 0:
            self.wait(remaining)

        self.play(FadeOut(cue, run_time=DUR_TEXT_FADE))
        self._drill = None

    # --- Recap question ---

    def show_recap_question(self, question: str, number: int, duration: float = 8.0):
        """Display a recap question with pause for learner response."""
        clear_time = self.clear_content()
        rq = RecapQuestion(question, number)
        rq.move_to([CONTENT_CENTER_X, BODY_CENTER_Y + 0.5, 0])
        self._body = rq
        self.play(FadeIn(rq, run_time=DUR_TEXT_FADE))
        remaining = duration - DUR_TEXT_FADE - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Minimal pair ---

    def show_minimal_pair(
        self,
        thai_a: str, translit_a: str, english_a: str,
        thai_b: str, translit_b: str, english_b: str,
        duration: float = 6.0,
    ):
        """Display two items side by side for pronunciation comparison."""
        clear_time = self.clear_content()
        card_a = TripletCard(thai_a, translit_a, english_a, accent_color=COL_ACCENT)
        card_b = TripletCard(thai_b, translit_b, english_b, accent_color=COL_WRONG)
        pair = ContrastPair(card_a, card_b)
        pair.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
        if pair.width > USABLE_WIDTH:
            pair.scale_to_fit_width(USABLE_WIDTH)
        self._body = pair
        self.play(FadeIn(pair, run_time=DUR_CARD_REVEAL))
        remaining = duration - DUR_CARD_REVEAL - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Image ---

    def show_image(self, path: str, caption: str = "", duration: float = 4.0):
        """Display an image in the content zone with optional caption."""
        from manim import ImageMobject
        clear_time = self.clear_content()

        img = ImageMobject(path)
        max_w = USABLE_WIDTH * 0.8
        max_h = (FRAME_HEIGHT - 3.0) * 0.6
        if img.width > max_w:
            img.scale_to_fit_width(max_w)
        if img.height > max_h:
            img.scale_to_fit_height(max_h)

        if caption:
            cap = lesson_text(caption, font_size=12, color=COL_ENGLISH)
            group = VGroup(img, cap).arrange(DOWN, buff=0.15)
            group.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
            self._body = group
        else:
            img.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
            self._body = VGroup(img)

        self.play(FadeIn(self._body, run_time=DUR_TEXT_FADE))
        remaining = duration - DUR_TEXT_FADE - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Transitions ---

    def transition_wipe(self, duration: float = DUR_SECTION_TRANSITION):
        """Clean transition: fade out all content."""
        self.clear_content(run_time=duration * 0.6)
        remaining = duration * 0.4
        if remaining > 0:
            self.wait(remaining)

    # --- Bullet list ---

    def show_bullets(self, items: list[str], duration: float = 5.0):
        """Display a vertical list of text bullets."""
        clear_time = self.clear_content()
        bullet_texts = []
        for item in items:
            bt = lesson_text(
                f"• {item}",
                font_size=22,
                color=COL_THAI,
                weight="NORMAL",
                max_width=USABLE_WIDTH - 0.5,
            )
            bullet_texts.append(bt)

        group = VGroup(*bullet_texts).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
        group.move_to([CONTENT_CENTER_X, BODY_CENTER_Y, 0])
        if group.height > FRAME_HEIGHT - 2.5:
            group.scale_to_fit_height(FRAME_HEIGHT - 2.5)
        self._body = group
        self.play(FadeIn(group, run_time=DUR_TEXT_FADE))
        remaining = duration - DUR_TEXT_FADE - clear_time
        if remaining > 0:
            self.wait(remaining)

    # --- Opener ---

    def show_opener(self, title: str, hook: str = "", objective: str = "", duration: float = 10.0):
        """Display lesson title, hook, and objective."""
        title_text = lesson_text(title, font_size=44, color=COL_HEADING, weight="BOLD")
        elements = [title_text]

        if hook:
            hook_text = lesson_text(
                hook, font_size=22, color=COL_THAI, weight="NORMAL",
                max_width=USABLE_WIDTH * 0.85,
            )
            elements.append(hook_text)

        if objective:
            obj_text = lesson_text(
                objective, font_size=18, color=COL_ENGLISH, weight="NORMAL",
                max_width=USABLE_WIDTH * 0.85,
            )
            elements.append(obj_text)

        group = VGroup(*elements).arrange(DOWN, buff=0.4)
        group.move_to([CONTENT_CENTER_X, BODY_CENTER_Y + 0.5, 0])
        self._body = group
        self.play(FadeIn(group, run_time=DUR_CARD_REVEAL * 2))
        remaining = duration - DUR_CARD_REVEAL * 2
        if remaining > 0:
            self.wait(remaining)
