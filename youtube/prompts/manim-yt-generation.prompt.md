# YouTube Manim Scene Generation

You are generating a complete Manim scene file for a Thai with Nine YouTube episode.

## Output

A single Python file defining `class YouTubeOverlay(YouTubeScene)` with a `construct()` method that renders all text overlays as a transparent video.

## Base Class API

Import from `scene_base`:

```python
from scene_base import YouTubeScene
```

### Available Methods

| Method | Parameters | Total Time | Description |
|--------|-----------|------------|-------------|
| `show_thai_line(text, duration, *, fade_in, style, pos)` | str, float, bool, str, str | `duration` | Single Thai text line. Clears all layers first. |
| `show_english_line(text, duration, *, fade_in, pos)` | str, float, bool, str | `duration` | Single English text line. Clears all layers first. |
| `show_translit_line(text, duration, *, fade_in, pos)` | str, float, bool, str | `duration` | Single transliteration line. Clears all layers first. |
| `show_breakdown_triplet(thai, translit, english, duration, *, translit_delay, english_delay)` | str, str, str, float, float, float | `duration` | Progressive reveal: Thai → translit → English |
| `show_vocab_card(thai, english, translit, duration, *, example, example_delay)` | str, str, str, float, str\|None, float | `duration` | Large vocab card. Clears all layers first. |
| `show_drill_prompt(question, duration, *, try_delay)` | str, float, float | `duration` | Drill card with "Try saying it now..." |
| `show_shadowing_line(text_split, duration, *, highlight)` | str, float, bool | `duration` | Space-separated Thai words. Clears all layers first. |
| `show_accumulate(text, duration, *, style)` | str, float, str | `duration` | Add line to accumulating stack. Does NOT clear. |
| `show_stacked_pair(thai, english, duration, *, fade_in_english, english_delay)` | str, str, float, bool, float | `duration` | Thai + English stacked pair |
| `clear_overlay(run_time)` | float | `run_time` (or 0 if empty) | Fade out all layers. Returns time consumed. |

**Every method consumes exactly `duration` seconds of Manim time.**

### Timing Rules

1. Track `elapsed` time as a running counter starting at 0.0
2. Before each overlay, calculate `wait_gap = overlay.displayStart - elapsed`
3. If `wait_gap > 0.01`, call `self.wait(wait_gap)` and update elapsed
4. **Use `manimDuration` for the method's duration** — pre-computed, never use `displayEnd - displayStart`
5. Update `elapsed += duration`

```python
# Pattern for each overlay:
wait_gap = {displayStart} - elapsed
if wait_gap > 0.01:
    self.wait(wait_gap)
    elapsed = {displayStart}
dur = {manimDuration}
self.show_thai_line("{text}", duration=dur)
elapsed += dur
```

### Block Transitions

- Call `self.clear_overlay()` when `blockId` changes
- Account for time: `elapsed += self.clear_overlay()`
- Add a `# === Block: {blockId} ({mode}) ===` comment before each new block

## Skipped Overlays

**Overlays with `"skipInScene": true` must be completely ignored.** Do not generate any code for them. They have been merged into other overlays during preprocessing.

## Mode → Method Mapping

### hook
If the overlay has `englishText` and `englishDelay`, use `show_stacked_pair()`:
```python
dur = {manimDuration}
self.show_stacked_pair("{text}", "{englishText}", duration=dur, fade_in_english=True, english_delay={englishDelay})
```
Otherwise, use `show_thai_line()` or `show_english_line()`.

### explain
Use `show_english_line()` for English, `show_thai_line()` for Thai. All use `pos="bottom"`.

### vocab-card
Use `show_vocab_card()` with `translit` and `english` from the overlay fields:
```python
dur = {manimDuration}
self.show_vocab_card("{text}", "{english}", "{translit}", duration=dur, example="{exampleText}", example_delay={exampleDelay})
```
- If `exampleText` is present, pass it as the `example` parameter
- If `exampleDelay` is present, pass it as `example_delay`
- If no `exampleText`, pass `example=None`
- Always use `translit` and `english` from the overlay data

### natural-listen
Use `show_accumulate()` for each line. Lines stack without clearing.

### breakdown
Group consecutive overlays in sets of 3 (Thai → translit → English). Collapse into one `show_breakdown_triplet()` call. Use the Thai overlay's `manimDuration`. Use `translit` and `english` from the overlay data if available, otherwise use the text from the translit and English overlays.

### drill-prompt
Use `show_drill_prompt()`. If `tryDelay` is present, pass it as `try_delay`:
```python
dur = {manimDuration}
self.show_drill_prompt("{text}", duration=dur, try_delay={tryDelay})
```

### drill-answer
Use `show_thai_line()` with `fade_in=False`.

### shadowing
Use `show_shadowing_line()` with the text. Each call replaces the previous.

### recap
Use `show_english_line()`.

### teaser
`show_english_line()` for English, `show_thai_line()` with `fade_in=True` for Thai.

## Input Format

```json
[
  {
    "lineId": "l-0001",
    "blockId": "b-001",
    "mode": "hook",
    "lang": "th",
    "text": "สั่งอะไรดีคะ",
    "displayStart": 0.94,
    "displayEnd": 41.92,
    "manimDuration": 37.98,
    "style": "Thai",
    "fadeIn": false,
    "translit": "sàng a-rai dii khá",
    "englishText": "What would you like to order?",
    "englishDelay": 1.0
  },
  {
    "lineId": "l-0002",
    "skipInScene": true
  },
  {
    "lineId": "l-0007",
    "blockId": "b-003",
    "mode": "vocab-card",
    "lang": "th",
    "text": "สั่ง",
    "displayStart": 105.12,
    "manimDuration": 75.98,
    "translit": "sàng",
    "english": "to order",
    "exampleText": "คุณอยากสั่งอะไร",
    "exampleDelay": 8.24
  }
]
```

Key fields:
- **`manimDuration`**: Always use this for duration. Pre-computed.
- **`skipInScene`**: Skip these overlays entirely.
- **`translit`**, **`english`**: Use for vocab cards and breakdown triplets.
- **`exampleText`**, **`exampleDelay`**: Vocab card example sentence.
- **`englishText`**, **`englishDelay`**: Hook stacked pair English text.
- **`tryDelay`**: Drill prompt "Try saying it now..." delay.

## Critical Rules

1. **Skip `skipInScene: true` overlays.** Generate no code for them.
2. **Do not invent content.** Use text, translit, english from the overlay data.
3. **Track elapsed precisely.** Always sync to displayStart via wait_gap.
4. **Add `# === Block:` comments.** Required for the timing fixer.
5. **Use `manimDuration` for duration.** Never compute from displayEnd - displayStart.
6. **Call clear_overlay() between blocks.** Account for its time in elapsed.
7. **For breakdown mode,** group sets of 3 overlays (th, translit, en) into one show_breakdown_triplet() call.
8. **For natural-listen mode,** use show_accumulate() — do NOT clear between lines within the block.
