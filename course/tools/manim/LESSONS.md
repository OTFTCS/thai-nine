# Manim Lesson Pipeline — Lessons Learned

## 2026-03-31: First production run (M01-L001)

### 1. `types.py` naming conflict
Never name a module `types.py` in a Python package — it shadows the stdlib `types` module and causes cryptic `ImportError` on Python 3.14. Renamed to `models.py`. **Convention: use `models.py` for dataclasses/types.**

### 2. Missing `__main__.py`
Any package invoked with `python3 -m package.name` needs a `__main__.py` entry point. Without it, the process starts silently and produces no output. Created one immediately.

### 3. Whisper model sizing and language detection
`WhisperModel("medium", ...)` downloads ~1.4GB on first run with no progress indication — machine pegged at 100% CPU across 6 zombie processes. But `tiny` model (39MB) produces too poor transcription for matching. **Fix: use `small` model (244MB) — good balance of speed and quality. Also: auto-detect language, don't force `"th"` — lessons are spoken in English with Thai words. Forcing Thai produces Thai-only output that can't match English speaker notes.**

### 4. Proportional timing is not production-viable
For lessons >2 min, distributing time by `estimated_seconds` ratios produces visibly wrong slide transitions. The estimates (6s per narration line) are too crude. **Real alignment (Whisper or manual timestamps) is required for anything beyond a test render.**

### 5. Opener slide needs special timing
Title cards should be brief (3-5s), not proportionally allocated like teaching slides. The opener had no special handling and lingered for 22s while the speaker was already teaching. **Fixed: opener estimate reduced to 5s with auto-advance transition.**

### 6. Portrait recording + landscape composite
The recording was shot in portrait (1080x1920, phone camera) but the composite assumed landscape hstack. Result: black middle strip and squished content. First fix (PiP crop to 605x454) cut the speaker in half. **Correct fix: camera fills the right 1/3 zone (640x1080) that Manim leaves transparent — preserves portrait framing.**

### 7. Fuzzy matching: length mismatch kills SequenceMatcher.ratio()
The original `_slide_match_text` concatenated ALL speaker notes into one 200-word blob. A 10-word Whisper segment matching against it scored 0.35 (below 0.5 threshold) even when it was a perfect match for the opening sentence. **Fix: match only the first speaker note line (the section's opening sentence) and use containment-based scoring (fraction of segment chars found in slide text) instead of full-string ratio.**

### 8. Narrow search window causes false positives
Original lookahead of 5 segments meant later slides could only match nearby segments — producing false anchors (e.g., recap matching at 73s instead of 435s). Long sections (100+ segments between slides) need wider search. **Fix: search all remaining segments. Dataset is small (~240 segs for 8-min lesson), so cost is negligible.**

### 9. Opener must be pinned, not matched
The opener slide has no spoken content — it's a title card shown before speech starts. Trying to fuzzy-match it against transcript segments produces false matches deep into the video. **Fix: pin opener at 0.0s, end at first segment's start_sec. Skip matching entirely.**

### 10. scene_base.py symlink needed for Manim render
Generated scene files import `from scene_base import LessonScene` but Manim runs from the scene file's directory. Without a symlink to the actual `scene_base.py`, render fails with `ModuleNotFoundError`. **Fix: `step_render` creates symlink automatically.**
