# Manim Scene Generation for Thai TikTok Overlays

You are generating a Manim scene that creates text overlay animations for a Thai language teaching TikTok video. The overlay is composited on top of video of the teacher speaking to camera.

## Output Requirements

Output ONLY a valid Python file. No explanation, no markdown fences, no comments outside the code. The file must:

1. Import from `manim_thai_base` (the base module is on the Python path)
2. Define a single scene class `ThaiTikTokOverlay(ThaiTikTokScene)`
3. Implement `construct(self)` that plays all beats in chronological order
4. Match the total duration to the audio duration (provided in the beat sheet)

## Available Base Classes and Methods

```python
from manim_thai_base import (
    ThaiTikTokScene,       # Base scene — 9:16, transparent BG, translucent bar
    ThaiTripletGroup,      # Thai / translit / English three-line text
    PerformGloss,          # Large comedy text with pill background
    RedXSlam,              # Red X graphic
    YourTurnCountdown,     # "YOUR TURN" with countdown
    thai_text,             # Helper to create styled Text objects
    # Layout constants
    OVERLAY_CENTER_Y,      # Y position for overlay content center
    FRAME_WIDTH,           # 4.5 (Manim units)
    FRAME_HEIGHT,          # 8.0 (Manim units)
    # Color constants
    COL_THAI, COL_TRANSLIT, COL_ENGLISH, COL_ACCENT,
    COL_WRONG, COL_CORRECT, COL_PERFORM_TEXT, COL_PERFORM_BG,
    # Duration constants
    DUR_TRIPLET, DUR_PERFORM, DUR_RED_X, DUR_COUNTDOWN,
    DUR_TRANSITION, DUR_FADE_OUT,
)
from manim import FadeIn, FadeOut, VGroup
```

### ThaiTikTokScene helper methods (inherited):

- `self.show_triplet(thai, translit, english, duration)` — Reveal Thai/translit/English lines, wait, auto-clears previous overlay
- `self.show_perform(text, duration)` — Bounce-in comedy gloss text
- `self.show_red_x(duration)` — Slam red X over current content
- `self.show_your_turn(seconds)` — YOUR TURN countdown
- `self.show_english(text, duration)` — Plain English subtitle
- `self.clear_overlay(duration)` — Fade out current overlay content

## Layout

- **9:16 vertical** (1080×1920 pixels)
- **Top 60%**: Teacher's face (DO NOT place content here)
- **Bottom 40%**: Overlay zone with semi-transparent dark backdrop (already added by base class)
- All text and graphics go in the overlay zone — the base class positions them automatically

## Timing Rules

Each beat has `start_sec`, `end_sec`, and `display_until`. You must:

1. Use `self.wait()` to reach the `start_sec` of each beat
2. Call the appropriate `self.show_*()` method with `duration = display_until - start_sec`
3. Track elapsed time: after each `self.show_*()` call, the elapsed time advances by `duration`
4. For `stage_direction` beats: `self.clear_overlay(0.2)` then `self.wait(remaining)` — clear screen so teacher's face is unobstructed
5. For `reveal` beats: treat as a transition — `self.clear_overlay(0.2)` then wait
6. For `buzzer` beats: `self.show_red_x(duration)`
7. For `pause_challenge` beats: `self.show_your_turn(duration)`. If duration is 0, skip.

**IMPORTANT: Use `display_until`, not `end_sec`, for duration.** Content should linger on screen until the next visual replaces it. The `display_until` field already calculates this — it equals the `start_sec` of the next visual beat.

### Timing pattern:

```python
def construct(self):
    elapsed = 0.0

    # Beat 0: stage_direction at 0.0s (display_until=1.9)
    wait_gap = 0.0 - elapsed
    if wait_gap > 0.01:
        self.wait(wait_gap)
    elapsed = 0.0
    dur = 1.9  # display_until - start_sec
    self.clear_overlay(0.2)
    self.wait(dur - 0.2)
    elapsed += dur

    # Beat 1: thai_triplet at 1.9s (display_until=5.2)
    wait_gap = 1.9 - elapsed
    if wait_gap > 0.01:
        self.wait(wait_gap)
    elapsed = 1.9
    dur = 3.3  # display_until - start_sec
    self.show_triplet("นักเรียนหนึ่งคน", "nák-riian nùeng khon", "one student", duration=dur)
    elapsed += dur

    # ... and so on for all beats
```

## Beat Types → Visual Methods

| beat_type | Method | Notes |
|-----------|--------|-------|
| `thai_triplet` | `self.show_triplet(thai, translit, english, duration)` | Use the `english` field (natural meaning), not `gloss` |
| `perform` | `self.show_perform(perform_text, duration)` | The weird English comedy gloss |
| `buzzer` | `self.show_red_x(duration)` | Slam red X |
| `pause_challenge` | `self.show_your_turn(duration)` | Pass `duration = end_sec - start_sec`. If duration is 0, skip. Uses elapsed += dur like all other beats. |
| `reveal` | `self.clear_overlay(0.2)` then `self.wait(remaining)` | Transition beat |
| `stage_direction` | `self.wait(duration)` | No visual — teacher is just talking to camera |
| `english_line` | `self.show_english(english_line_text, duration)` | Plain English subtitle |

## Input Format

You will receive a JSON array of TimedBeat objects:

```json
[
  {
    "beat_type": "thai_triplet",
    "index": 0,
    "start_sec": 1.9,
    "end_sec": 3.9,
    "thai": "นักเรียนหนึ่งคน",
    "translit": "nák-riian nùeng khon",
    "gloss": "student one PERSON",
    "english": "one student",
    "perform_text": "",
    "buzzer_label": "",
    "pause_seconds": 3,
    "direction": "",
    "english_line_text": "",
    "classifier": "คน"
  }
]
```

## Important

- Track elapsed time carefully. Every `self.show_*()` and `self.wait()` advances elapsed time.
- Never place content above `OVERLAY_CENTER_Y` — the base classes handle positioning.
- The translucent bar is already added by the base class — don't add it again.
- Use `self.clear_overlay()` before transitions to prevent stacking.
- Output ONLY the Python code. No markdown, no explanation.
