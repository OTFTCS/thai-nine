# Manim Lesson Scene Generation

You are generating a complete Manim scene file for a Thai language course lesson video.

## Output

A single Python file defining `class LessonOverlay(LessonScene)` with a `construct()` method that renders the entire lesson as a transparent overlay video.

## Base Class API

Import from `scene_base`:

```python
from scene_base import LessonScene
```

### Available Methods

| Method | Parameters | Total Time | Description |
|--------|-----------|------------|-------------|
| `show_opener(title, hook, objective, duration)` | str, str, str, float | `duration` | Lesson title + hook text + objective |
| `show_section_header(title, section_num, duration)` | str, int\|None, float | `duration` | Section heading with number badge |
| `show_focus_card(thai, translit, english, duration)` | str, str, str, float | `duration` | Single large triplet card |
| `show_contrast_board(items, duration)` | list[tuple], float | `duration` | 2-4 triplet cards in grid. items = [(thai, translit, english), ...] |
| `show_dialogue_line(speaker, thai, translit, english, duration)` | str, str, str, str, float | `duration` | Add one roleplay line (builds vertically) |
| `show_drill(instruction, pause_seconds, duration)` | str, int, float\|None | `duration` or `pause_seconds + 1` | Drill instruction + pause countdown |
| `show_recap_question(question, number, duration)` | str, int, float | `duration` | Recap question with number badge |
| `show_minimal_pair(thai_a, translit_a, english_a, thai_b, translit_b, english_b, duration)` | 6×str, float | `duration` | Side-by-side pronunciation comparison |
| `show_bullets(items, duration)` | list[str], float | `duration` | Vertical bullet list |
| `show_image(path, caption, duration)` | str, str, float | `duration` | Image with optional caption |
| `transition_wipe(duration)` | float | `duration` | Fade out all content (default 0.6s) |
| `clear_content(run_time)` | float | `run_time` | Clear all layers |

**Every method consumes exactly `duration` seconds of Manim time.** This is critical for audio sync.

### Timing Rules

1. Track `elapsed` time as a running counter
2. Before each visual event, calculate `wait_gap = event.start_sec - elapsed`
3. If `wait_gap > 0.01`, call `self.wait(wait_gap)` and update elapsed
4. Call the method with the correct `duration = event.end_sec - event.start_sec`
5. Update `elapsed += duration`

```python
# Pattern for each event:
wait_gap = {start_sec} - elapsed
if wait_gap > 0.01:
    self.wait(wait_gap)
    elapsed = {start_sec}
dur = {end_sec} - {start_sec}
self.show_focus_card("{thai}", "{translit}", "{english}", duration=dur)
elapsed += dur
```

### Slide Transitions

- Call `self.transition_wipe()` between sections (different slide IDs)
- Do NOT call transition_wipe between events within the same slide
- Transition wipe consumes ~0.6s — account for this in elapsed tracking

### Layout Mapping

| Slide Layout | Primary Method |
|-------------|----------------|
| focus-card | `show_focus_card()` for each lexeme, one at a time |
| contrast-board | `show_contrast_board()` for all items at once |
| dialogue-ladder | `show_dialogue_line()` for each line, building up |
| drill-stack | `show_drill()` for each drill in sequence |

### Drill Handling

For each drill in a slide:
1. Show the drill instruction with `show_drill(instruction, pause_seconds)`
2. The drill method handles the pause internally
3. After drills, continue with next lexeme or section

### Roleplay Handling

For roleplay slides:
1. Use `show_dialogue_line()` for each line
2. Lines build up vertically (the scene manages stacking)
3. Space lines ~4-5s apart for natural conversation pacing

### Recap Handling

For recap slides:
1. Use `show_recap_question()` for each question
2. Give ~8s per question (includes pause for learner to think)

### Pronunciation Handling

For pronunciation slides:
1. Show section header "Pronunciation Focus"
2. Use `show_minimal_pair()` for each pair
3. Optionally show bullets for mouth-map anchors

## Input Format

You receive a JSON array of `TimedSlide` objects:

```json
[
  {
    "slide": {
      "id": "M01-L001-s1",
      "role": "teaching",
      "title": "Your first Thai word: สวัสดี",
      "layout": "focus-card",
      "lexemes": [{"thai": "สวัสดี", "translit": "sà-wàt-dii", "english": "hello", ...}],
      "drills": [{"type": "listen-repeat", "instruction": "...", "pause_seconds": 3}],
      ...
    },
    "start_sec": 15.0,
    "end_sec": 47.0,
    "events": [
      {"type": "heading_show", "start_sec": 15.0, "end_sec": 17.0, "data": {}},
      {"type": "lexeme_reveal", "start_sec": 17.0, "end_sec": 25.0, "data": {"index": 0}},
      {"type": "drill_cue", "start_sec": 25.0, "end_sec": 33.0, "data": {"index": 0}},
      ...
    ]
  }
]
```

## Output Format

Output a complete Python file:

```python
from scene_base import LessonScene

class LessonOverlay(LessonScene):
    def construct(self):
        super().setup()
        elapsed = 0.0

        # === Slide: M01-L001-opener (0.0s - 15.0s) ===
        # ... events ...

        # === Slide: M01-L001-s1 (15.0s - 47.0s) ===
        self.transition_wipe()
        elapsed += 0.6
        # ... events ...
```

## Critical Rules

1. **Do not skip events.** Every event in the TimedSlide must produce a method call.
2. **Do not invent content.** Use only the Thai, transliteration, and English from the data.
3. **Track elapsed precisely.** Drift accumulates — always sync to event.start_sec via wait_gap.
4. **Use transition_wipe() between slides.** Not between events within a slide.
5. **Match duration exactly.** Each method call's duration = event.end_sec - event.start_sec.
6. **All Thai text must be in double quotes** and properly escaped if it contains quotes.
