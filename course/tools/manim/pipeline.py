#!/usr/bin/env python3
"""
Manim lesson video pipeline — end-to-end orchestrator.

Takes a script-master.json + Nine's recording → final composited lesson video.

Pipeline steps:
  1. Ingest    → SlideSpec[] → qa_ingest + qa_content
  2. Transcribe → faster-whisper → TranscriptSegment[]
  3. Align     → 3-pass anchor matching → TimedSlide[] → qa_timing
  4. Generate  → Manim scene .py → fix_scene_timing → qa_layout
  5. Render    → transparent .mov
  6. Composite → final .mp4
  7. Report    → qa-report.json

Usage:
    python3 -m course.tools.manim.pipeline \\
        --lesson M01-L001 \\
        --recording recordings/M01-L001.mp4 \\
        [--timestamps M01-L001-timestamps.csv] \\
        [--skip-render] \\
        [--scene-file existing.py] \\
        [--strict-qa] \\
        [--output-dir out/lessons/M01-L001]
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import difflib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from .models import QAResult, SlideSpec, TimedEvent, TimedSlide, TranscriptSegment
from .ingest import ingest_lesson, slides_to_json
from .qa_ingest import run_ingest_qa
from .qa_transliteration import validate_translit
from .qa_timing import run_timing_qa
from .qa_layout import run_layout_qa
from .qa_content import run_content_qa
from .generate_scene import generate_scene

_HERE = Path(__file__).resolve().parent
_COURSE_DIR = _HERE.parent.parent       # course/
_REPO_ROOT = _COURSE_DIR.parent         # thai-nine/

# Animation lead time — text starts fade-in this many seconds before speech
# so it's fully visible when Nine begins speaking. Matches DUR_CARD_REVEAL
# in scene_base.py.
PRE_ROLL = 0.4


# ---------------------------------------------------------------------------
# Step 1: Ingest
# ---------------------------------------------------------------------------


def step_ingest(lesson_id: str) -> list[SlideSpec]:
    """Parse script-master.json into SlideSpec[]."""
    print(f"[1/7] Ingesting lesson {lesson_id}...")

    module = lesson_id.split("-")[0]  # M01
    lesson = lesson_id.split("-")[1]  # L001
    script_path = _COURSE_DIR / "modules" / module / lesson / f"{lesson_id}-script-master.json"

    if not script_path.exists():
        raise FileNotFoundError(f"Script not found: {script_path}")

    slides = ingest_lesson(script_path)
    print(f"  → {len(slides)} slides, {sum(len(s.lexemes) for s in slides)} lexemes")
    return slides


# ---------------------------------------------------------------------------
# Step 2: Transcribe
# ---------------------------------------------------------------------------


def step_transcribe(
    recording_path: Path,
    timestamps_csv: Path | None = None,
) -> tuple[list[TranscriptSegment], float]:
    """Transcribe recording with faster-whisper, or load manual timestamps.

    Returns (segments, duration_seconds).
    """
    print(f"[2/7] Processing audio: {recording_path}")

    # Get duration via ffprobe
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(recording_path)],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr[:300]}")

    duration = float(result.stdout.strip())
    print(f"  → Duration: {duration:.1f}s")

    # Option 1: Manual timestamps CSV
    if timestamps_csv and timestamps_csv.exists():
        print(f"  → Loading manual timestamps from {timestamps_csv.name}")
        segments = _load_manual_timestamps(timestamps_csv)
        print(f"  → {len(segments)} manual segments loaded")
        return segments, duration

    # Option 2: faster-whisper transcription
    # Use 'tiny' model — 39MB, loads in seconds, sufficient for alignment
    # (we're fuzzy-matching slide boundaries, not translating)
    try:
        import signal
        from faster_whisper import WhisperModel

        print("  → Loading faster-whisper model (small)...")
        model = WhisperModel("small", device="cpu", compute_type="int8",
                             cpu_threads=4)

        # Auto-detect language — lessons are spoken in English with Thai words.
        # Forcing "th" produces Thai-only output that can't match English speaker notes.
        print("  → Transcribing (auto-detect)...")
        segments_gen, info = model.transcribe(
            str(recording_path),
            word_timestamps=True,
        )

        segments: list[TranscriptSegment] = []
        for seg in segments_gen:
            text = seg.text.strip()
            if text:
                segments.append(TranscriptSegment(
                    start_sec=seg.start,
                    end_sec=max(seg.end, seg.start + 0.6),
                    text=text,
                ))

        print(f"  → {len(segments)} segments transcribed")
        return segments, info.duration

    except ImportError:
        print("  ⚠ faster-whisper not installed — using proportional fallback")
        print("    Install with: pip install faster-whisper")
        return [], duration
    except (OSError, RuntimeError) as e:
        print(f"  ⚠ faster-whisper failed: {e}")
        print("    Falling back to proportional alignment")
        return [], duration


def _load_manual_timestamps(csv_path: Path) -> list[TranscriptSegment]:
    """Load manual timestamps from CSV. Format: beat_index,start_sec,end_sec[,text]"""
    segments: list[TranscriptSegment] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            segments.append(TranscriptSegment(
                start_sec=float(row["start_sec"]),
                end_sec=float(row["end_sec"]),
                text=row.get("text", "").strip(),
            ))
    segments.sort(key=lambda s: s.start_sec)
    return segments


# ---------------------------------------------------------------------------
# Step 3: Align — 3-pass anchor matching + proportional fallback
# ---------------------------------------------------------------------------


def _normalize(text: str) -> str:
    """Normalize text for fuzzy matching — lowercase, strip punctuation."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _slide_match_text(slide: SlideSpec) -> str:
    """Build a searchable text from a slide's first speaker note.

    Use only the opening sentence — it's the anchor for when the speaker
    enters this slide. Concatenating all notes dilutes the match score
    (a 10-word segment vs 200-word blob = low ratio even if it's a hit).
    """
    # First non-empty speaker note line is the best anchor
    for note in slide.speaker_notes:
        if note and note.strip():
            return note.strip()
    # Fallback: lexeme Thai text
    parts = [lex.thai for lex in slide.lexemes if lex.thai]
    return " ".join(parts)


def _best_segment_match(
    slide_text: str,
    segments: list[TranscriptSegment],
    search_range: range,
) -> tuple[float, int]:
    """Find best matching segment for slide text within search_range.

    Uses substring containment + SequenceMatcher. The slide text (speaker note)
    is typically longer than a single Whisper segment, so we check if the segment
    text is a rough substring of the slide text — not a full ratio comparison,
    which penalises length mismatches.

    Returns (score, segment_index). Score 0.0 = no match.
    """
    norm_slide = _normalize(slide_text)
    if not norm_slide:
        return 0.0, -1

    best_score = 0.0
    best_idx = -1

    for si in search_range:
        seg = segments[si]
        norm_seg = _normalize(seg.text)
        if not norm_seg or len(norm_seg) < 10:
            continue

        # Score by how well the segment is contained within the slide text.
        # Use SequenceMatcher on the shorter string against a window of the
        # longer string to avoid length-mismatch penalty.
        if len(norm_seg) <= len(norm_slide):
            # Segment is shorter — check if it's a substring of slide text
            matcher = difflib.SequenceMatcher(None, norm_slide, norm_seg)
            # get_matching_blocks gives the longest common subsequences
            blocks = matcher.get_matching_blocks()
            matched_chars = sum(b.size for b in blocks)
            # Score = fraction of segment text that matched
            score = matched_chars / len(norm_seg) if norm_seg else 0.0
        else:
            # Segment longer than slide text (unusual) — standard ratio
            score = difflib.SequenceMatcher(None, norm_slide, norm_seg).ratio()

        if score > best_score + 0.03:
            best_score = score
            best_idx = si

    return best_score, best_idx


def step_align(
    slides: list[SlideSpec],
    segments: list[TranscriptSegment],
    duration: float,
) -> list[TimedSlide]:
    """Align slides to audio timestamps.

    With segments: 3-pass anchor matching (Pearson/TikTok pattern).
    Without segments: proportional distribution by estimated_seconds.
    """
    print(f"[3/7] Aligning slides to audio...")

    if segments:
        timed = _align_with_anchors(slides, segments, duration)
    else:
        timed = _align_proportional(slides, duration)

    # Apply pre-roll compensation to visual events
    _apply_pre_roll(timed)

    print(f"  → {len(timed)} timed slides spanning {duration:.1f}s")
    return timed


def _align_with_anchors(
    slides: list[SlideSpec],
    segments: list[TranscriptSegment],
    duration: float,
) -> list[TimedSlide]:
    """3-pass anchor-based alignment.

    Pass 1: High-confidence anchors (score ≥ 0.5, lookahead 5)
    Pass 2: Gap-fill between anchors (score ≥ 0.2, constrained windows)
    Pass 3: Interpolate unmatched slides from neighbours
    """
    n_slides = len(slides)
    n_segs = len(segments)

    # Per-slide matching state
    matched_start: dict[int, float] = {}  # slide_idx -> audio_start
    matched_end: dict[int, float] = {}    # slide_idx -> audio_end
    matched_seg: dict[int, int] = {}      # slide_idx -> segment_idx

    # Build match text for each slide
    match_texts = [_slide_match_text(s) for s in slides]

    # --- Pass 1: High-confidence anchors ---
    seg_cursor = 0
    lookahead = max(5, n_segs // n_slides + 3)  # wide enough for long lessons

    for si, slide in enumerate(slides):
        # Pin opener at 0.0s — it's a title card with no spoken content
        if slide.role == "opener":
            matched_start[si] = 0.0
            matched_end[si] = min(slide.estimated_seconds, segments[0].start_sec if segments else 5.0)
            print(f"  Slide {si} ({slide.id}): pinned opener [0.0s]")
            continue

        text = match_texts[si]
        if not text.strip():
            continue

        # Search all remaining segments — dataset is small (~200 segs),
        # and a narrow window causes false positives when sections vary in length.
        search_end = n_segs
        score, seg_idx = _best_segment_match(text, segments, range(seg_cursor, search_end))

        if score >= 0.5 and seg_idx >= 0:
            matched_start[si] = segments[seg_idx].start_sec
            matched_end[si] = segments[seg_idx].end_sec
            matched_seg[si] = seg_idx
            seg_cursor = seg_idx + 1
            print(f"  Slide {si} ({slide.id}): anchor match ({score:.0%}) "
                  f"[{segments[seg_idx].start_sec:.1f}s]")

    anchor_indices = sorted(matched_start.keys())
    print(f"  Pass 1: {len(anchor_indices)} anchors from {n_slides} slides")

    # --- Pass 2: Gap-fill between anchors ---
    gap_filled = 0
    if len(anchor_indices) >= 2:
        for ai in range(len(anchor_indices) - 1):
            a1 = anchor_indices[ai]
            a2 = anchor_indices[ai + 1]

            gap_slides = [i for i in range(a1 + 1, a2) if i not in matched_start]
            if not gap_slides:
                continue

            seg_start = matched_seg[a1] + 1
            seg_end = matched_seg[a2]
            if seg_start >= seg_end:
                continue

            sub_cursor = seg_start
            for gi in gap_slides:
                text = match_texts[gi]
                if not text.strip():
                    continue

                search_end = min(sub_cursor + 4, seg_end)
                score, seg_idx = _best_segment_match(
                    text, segments, range(sub_cursor, search_end)
                )

                if score >= 0.2 and seg_idx >= 0:
                    matched_start[gi] = segments[seg_idx].start_sec
                    matched_end[gi] = segments[seg_idx].end_sec
                    matched_seg[gi] = seg_idx
                    sub_cursor = seg_idx + 1
                    gap_filled += 1

    print(f"  Pass 2: {gap_filled} gap-fills")

    # --- Pass 3: Interpolate unmatched slides ---
    _interpolate_slide_gaps(slides, matched_start, matched_end, duration)

    # --- Build TimedSlides ---
    timed: list[TimedSlide] = []
    for si, slide in enumerate(slides):
        start = matched_start[si]
        # End = next slide's start, or duration for last slide
        if si + 1 < n_slides:
            end = matched_start.get(si + 1, start + slide.estimated_seconds)
        else:
            end = duration

        events = _generate_sub_events(slide, start, end)
        timed.append(TimedSlide(
            slide=slide,
            start_sec=round(start, 3),
            end_sec=round(end, 3),
            events=events,
        ))

    return timed


def _interpolate_slide_gaps(
    slides: list[SlideSpec],
    matched_start: dict[int, float],
    matched_end: dict[int, float],
    duration: float,
) -> None:
    """Fill timestamps for unmatched slides by interpolating between matched neighbours."""
    n = len(slides)
    matched_indices = sorted(matched_start.keys())

    if not matched_indices:
        # No matches — spread evenly
        for i in range(n):
            matched_start[i] = (i / n) * duration
            matched_end[i] = matched_start[i] + (duration / n) * 0.8
        return

    # Fill before first match
    first = matched_indices[0]
    if first > 0:
        first_time = matched_start[first]
        for i in range(first):
            frac = i / first
            matched_start[i] = frac * first_time
            matched_end[i] = matched_start[i] + (first_time / first) * 0.8

    # Fill between matched slides
    for mi in range(len(matched_indices) - 1):
        a = matched_indices[mi]
        b = matched_indices[mi + 1]
        gap = b - a
        if gap <= 1:
            continue
        t_start = matched_end.get(a, matched_start[a] + 1.0)
        t_end = matched_start[b]
        for k in range(1, gap):
            frac = k / gap
            matched_start[a + k] = t_start + frac * (t_end - t_start)
            matched_end[a + k] = matched_start[a + k] + (t_end - t_start) / gap * 0.8

    # Fill after last match
    last = matched_indices[-1]
    if last < n - 1:
        remaining = n - last - 1
        t_start = matched_end.get(last, matched_start[last] + 1.0)
        t_remaining = duration - t_start
        for k in range(1, remaining + 1):
            frac = k / (remaining + 1)
            matched_start[last + k] = t_start + frac * t_remaining
            matched_end[last + k] = matched_start[last + k] + (t_remaining / (remaining + 1)) * 0.8

    unmatched = n - len(matched_indices)
    if unmatched:
        print(f"  Pass 3: {unmatched} slides interpolated")


def _align_proportional(
    slides: list[SlideSpec],
    duration: float,
) -> list[TimedSlide]:
    """Distribute slides proportionally by estimated_seconds (fallback)."""
    total_est = sum(s.estimated_seconds for s in slides)
    if total_est <= 0:
        total_est = len(slides) * 30.0

    timed: list[TimedSlide] = []
    current_sec = 0.0

    for slide in slides:
        frac = slide.estimated_seconds / total_est
        slide_duration = duration * frac
        end_sec = current_sec + slide_duration

        events = _generate_sub_events(slide, current_sec, end_sec)

        timed.append(TimedSlide(
            slide=slide,
            start_sec=round(current_sec, 3),
            end_sec=round(end_sec, 3),
            events=events,
        ))
        current_sec = end_sec

    return timed


def _apply_pre_roll(timed_slides: list[TimedSlide]) -> None:
    """Shift visual event starts earlier by PRE_ROLL to compensate for fade-in animation.

    Text starts its FadeIn animation 0.4s before Nine speaks, so it's fully
    visible by the time she begins.
    """
    _VISUAL_EVENTS = {
        "lexeme_reveal", "drill_cue", "roleplay_line",
        "recap_question", "minimal_pair", "bullet_show",
    }

    for ts in timed_slides:
        for i, event in enumerate(ts.events):
            if event.type not in _VISUAL_EVENTS:
                continue
            if event.start_sec <= PRE_ROLL:
                continue

            # Don't overlap with previous event's end
            if i > 0:
                prev_end = ts.events[i - 1].end_sec
            else:
                prev_end = ts.start_sec

            new_start = max(event.start_sec - PRE_ROLL, prev_end)
            event.start_sec = round(new_start, 3)


# ---------------------------------------------------------------------------
# Sub-event distribution (pause-aware, not hardcoded percentages)
# ---------------------------------------------------------------------------


def _generate_sub_events(slide: SlideSpec, start: float, end: float) -> list[TimedEvent]:
    """Distribute sub-events within a slide's time window.

    Uses pause-aware distribution: drills get their exact pause_seconds,
    remaining time is distributed evenly among other events.
    """
    events: list[TimedEvent] = []
    total_dur = end - start
    t = start

    if slide.role == "opener":
        # Brief title card — show for allocated time then auto-advance.
        # Opener is a flash, not a teaching moment.
        show_dur = min(total_dur, 5.0)
        events.append(TimedEvent(
            type="heading_show",
            start_sec=round(t, 3),
            end_sec=round(t + show_dur, 3),
            data={"title": slide.title, "hook": slide.hook_text, "objective": slide.objective_text},
        ))
        if total_dur > show_dur:
            events.append(TimedEvent(
                type="transition_wipe",
                start_sec=round(t + show_dur, 3),
                end_sec=round(end, 3),
                data={},
            ))
        return events

    # Section header: 2s or 15% of total, whichever is smaller
    header_dur = min(2.0, total_dur * 0.15)
    events.append(TimedEvent(
        type="heading_show",
        start_sec=round(t, 3),
        end_sec=round(t + header_dur, 3),
        data={"title": slide.title, "section_num": slide.section_num},
    ))
    t += header_dur
    remaining = end - t

    if slide.role == "teaching":
        # Pause-aware distribution:
        # 1. Drills get their exact pause_seconds + 1.0s overhead
        # 2. Remaining time goes to lexemes evenly
        drill_time_needed = sum(d.pause_seconds + 1.0 for d in slide.drills)

        # Clamp drill time if it exceeds available time
        if drill_time_needed > remaining * 0.8:
            drill_time_needed = remaining * 0.6

        lexeme_time = remaining - drill_time_needed

        # Lexeme events
        if slide.lexemes:
            per_lex = lexeme_time / len(slide.lexemes)
            for i, lex in enumerate(slide.lexemes):
                events.append(TimedEvent(
                    type="lexeme_reveal",
                    start_sec=round(t, 3),
                    end_sec=round(t + per_lex, 3),
                    data={"index": i, "thai": lex.thai, "translit": lex.translit, "english": lex.english},
                ))
                t += per_lex

        # Drill events — each gets its actual pause_seconds + overhead
        if slide.drills:
            # Distribute drill_time_needed proportionally to each drill's needs
            total_drill_need = sum(d.pause_seconds + 1.0 for d in slide.drills)
            for i, drill in enumerate(slide.drills):
                drill_frac = (drill.pause_seconds + 1.0) / total_drill_need if total_drill_need > 0 else 1.0 / len(slide.drills)
                drill_dur = drill_time_needed * drill_frac
                events.append(TimedEvent(
                    type="drill_cue",
                    start_sec=round(t, 3),
                    end_sec=round(t + drill_dur, 3),
                    data={"index": i, "instruction": drill.instruction, "pause_seconds": drill.pause_seconds},
                ))
                t += drill_dur

    elif slide.role == "roleplay" and slide.roleplay_lines:
        per_line = remaining / len(slide.roleplay_lines)
        for i, line in enumerate(slide.roleplay_lines):
            events.append(TimedEvent(
                type="roleplay_line",
                start_sec=round(t, 3),
                end_sec=round(t + per_line, 3),
                data={
                    "index": i,
                    "speaker": line.speaker,
                    "thai": line.thai,
                    "translit": line.translit,
                    "english": line.english,
                },
            ))
            t += per_line

    elif slide.role == "recap" and slide.recap_items:
        per_q = remaining / len(slide.recap_items)
        for i, question in enumerate(slide.recap_items):
            events.append(TimedEvent(
                type="recap_question",
                start_sec=round(t, 3),
                end_sec=round(t + per_q, 3),
                data={"index": i, "question": question},
            ))
            t += per_q

    elif slide.role == "pronunciation" and slide.minimal_pairs:
        bullet_time = remaining * 0.4
        pair_time = remaining * 0.6

        if slide.bullets:
            events.append(TimedEvent(
                type="bullet_show",
                start_sec=round(t, 3),
                end_sec=round(t + bullet_time, 3),
                data={"items": slide.bullets},
            ))
            t += bullet_time

        per_pair = pair_time / len(slide.minimal_pairs) if slide.minimal_pairs else pair_time
        for i, pair in enumerate(slide.minimal_pairs):
            events.append(TimedEvent(
                type="minimal_pair",
                start_sec=round(t, 3),
                end_sec=round(t + per_pair, 3),
                data={
                    "index": i,
                    "thai_a": pair.a.thai, "translit_a": pair.a.translit, "english_a": pair.a.english,
                    "thai_b": pair.b.thai, "translit_b": pair.b.translit, "english_b": pair.b.english,
                },
            ))
            t += per_pair

    return events


# ---------------------------------------------------------------------------
# Step 4: Generate scene
# ---------------------------------------------------------------------------


def step_generate(
    timed_slides: list[TimedSlide],
    output_dir: Path,
    lesson_id: str,
    scene_file: Path | None = None,
) -> Path:
    """Generate Manim scene file."""
    print(f"[4/7] Generating Manim scene...")

    timed_json = json.dumps(
        [dataclasses.asdict(ts) for ts in timed_slides],
        ensure_ascii=False,
        indent=2,
    )

    scene_path = output_dir / f"{lesson_id}-scene.py"
    scene_path = generate_scene(timed_json, scene_path, scene_file=scene_file)

    # Post-generation timing fix
    try:
        from .fix_scene_timing import fix_scene_timing
        code = scene_path.read_text(encoding="utf-8")
        fixed = fix_scene_timing(code, timed_slides)
        if fixed != code:
            scene_path.write_text(fixed, encoding="utf-8")
            print("  → Applied post-generation timing fix")
    except Exception as e:
        print(f"  ⚠ Post-generation timing fix skipped: {e}")

    return scene_path


# ---------------------------------------------------------------------------
# Step 5: Render
# ---------------------------------------------------------------------------


def step_render(scene_path: Path, output_dir: Path) -> Path:
    """Render Manim scene to transparent .mov."""
    print(f"[5/7] Rendering Manim scene...")

    # Ensure scene_base.py is accessible from the scene file's directory
    base_src = _HERE / "scene_base.py"
    base_link = scene_path.parent / "scene_base.py"
    if not base_link.exists() and base_src.exists():
        base_link.symlink_to(base_src)

    media_dir = output_dir / "media"

    cmd = [
        sys.executable, "-m", "manim", "render",
        str(scene_path),
        "LessonOverlay",
        "-t",
        "--resolution", "1080,1920",
        "--fps", "30",
        "--media_dir", str(media_dir),
    ]

    print(f"  → {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        stderr = result.stderr[:500] if result.stderr else ""
        raise RuntimeError(f"Manim render failed:\n{stderr}")

    mov_files = list(media_dir.rglob("*.mov"))
    if not mov_files:
        mov_files = list(media_dir.rglob("*.mp4"))
    if not mov_files:
        raise RuntimeError(f"No rendered video found in {media_dir}")

    output = mov_files[0]
    print(f"  → Rendered: {output}")
    return output


# ---------------------------------------------------------------------------
# Step 6: Composite
# ---------------------------------------------------------------------------


def step_composite(
    recording_path: Path,
    overlay_path: Path,
    output_path: Path,
) -> Path:
    """Composite: Manim content (left 2/3) + Nine's camera (right 1/3)."""
    print(f"[6/7] Compositing final video...")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Camera zone: right 1/3 of 1920×1080 = 640×1080.
    # The Manim overlay leaves this zone transparent.
    # Scale the camera to fill the zone, preserving aspect ratio and
    # cropping overflow (center-crop for landscape, top-crop for portrait).
    cam_w, cam_h = 640, 1080
    cam_x = 1920 - cam_w  # 1280

    cmd = [
        "ffmpeg", "-y",
        "-i", str(overlay_path),      # base: Manim content at 1920×1080
        "-i", str(recording_path),     # camera feed (portrait or landscape)
        "-filter_complex",
        # Scale camera to fill zone (may overflow one axis), then crop to fit.
        f"[1:v]scale={cam_w}:-2,crop={cam_w}:{cam_h}:0:0[cam];"
        f"[0:v][cam]overlay={cam_x}:0[out]",
        "-map", "[out]",
        "-map", "1:a:0?",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg composite failed: {result.stderr[:500]}")

    print(f"  → Final video: {output_path}")
    return output_path


# ---------------------------------------------------------------------------
# Step 7: QA Report
# ---------------------------------------------------------------------------


def step_report(
    qa_results: list[QAResult],
    lesson_id: str,
    output_dir: Path,
) -> Path:
    """Write QA report JSON."""
    print(f"[7/7] Writing QA report...")

    report = {
        "lesson": lesson_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gates": {},
        "overall": "PASS",
    }

    for qr in qa_results:
        report["gates"][qr.gate_name] = {
            "pass": qr.passed,
            "issues": qr.issues,
            "warnings": qr.warnings,
            **qr.metadata,
        }
        if not qr.passed:
            report["overall"] = "FAIL"

    report_path = output_dir / f"{lesson_id}-qa-report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  → Report: {report_path}")
    return report_path


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def run_pipeline(args: argparse.Namespace) -> Path:
    """Run the full pipeline."""
    lesson_id = args.lesson
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    strict = args.strict_qa
    qa_results: list[QAResult] = []

    # Step 1: Ingest
    slides = step_ingest(lesson_id)

    # QA gate: ingest
    ingest_qa = run_ingest_qa(slides)
    qa_results.append(ingest_qa)
    _report_gate(ingest_qa, strict)
    if not ingest_qa.passed:
        step_report(qa_results, lesson_id, output_dir)
        raise RuntimeError("Ingest QA failed — halting pipeline")

    # QA gate: content
    content_qa = run_content_qa(slides)
    qa_results.append(content_qa)
    _report_gate(content_qa, strict)
    if not content_qa.passed:
        step_report(qa_results, lesson_id, output_dir)
        raise RuntimeError("Content QA failed — halting pipeline")

    # Save slides JSON
    slides_json_path = output_dir / f"{lesson_id}-slides.json"
    slides_json_path.write_text(slides_to_json(slides), encoding="utf-8")

    timestamps_csv = Path(args.timestamps).resolve() if args.timestamps else None

    if args.recording:
        recording = Path(args.recording).resolve()
        if not recording.exists():
            raise FileNotFoundError(f"Recording not found: {recording}")

        # Step 2: Transcribe
        segments, duration = step_transcribe(recording, timestamps_csv)

        # Step 3: Align
        timed_slides = step_align(slides, segments, duration)
    else:
        # No recording — use estimated times
        print("[2/7] No recording — using estimated timing")
        print("[3/7] Proportional alignment from estimates")
        total_est = sum(s.estimated_seconds for s in slides)
        timed_slides = step_align(slides, [], total_est)
        duration = total_est

    # QA gate: timing
    timing_qa = run_timing_qa(timed_slides, duration if args.recording else None)
    qa_results.append(timing_qa)
    _report_gate(timing_qa, strict)
    if not timing_qa.passed:
        step_report(qa_results, lesson_id, output_dir)
        raise RuntimeError("Timing QA failed — halting pipeline")

    # Save timed slides
    timed_json_path = output_dir / f"{lesson_id}-timed-slides.json"
    timed_json = json.dumps(
        [dataclasses.asdict(ts) for ts in timed_slides],
        ensure_ascii=False,
        indent=2,
    )
    timed_json_path.write_text(timed_json, encoding="utf-8")

    # Step 4: Generate scene
    scene_file = Path(args.scene_file).resolve() if args.scene_file else None
    scene_path = step_generate(timed_slides, output_dir, lesson_id, scene_file)

    # QA gate: layout
    layout_qa = run_layout_qa(scene_path)
    qa_results.append(layout_qa)
    _report_gate(layout_qa, strict)

    if args.skip_render:
        print(f"\n✓ Stopped after scene generation (--skip-render)")
        step_report(qa_results, lesson_id, output_dir)
        return scene_path

    # Step 5: Render
    overlay_path = step_render(scene_path, output_dir)

    if not args.recording:
        print(f"\n✓ Rendered overlay (no recording to composite)")
        step_report(qa_results, lesson_id, output_dir)
        return overlay_path

    # Step 6: Composite
    recording = Path(args.recording).resolve()
    final_path = output_dir / f"{lesson_id}-lesson-video.mp4"
    step_composite(recording, overlay_path, final_path)

    # Step 7: Report
    step_report(qa_results, lesson_id, output_dir)

    print(f"\n✓ Pipeline complete: {final_path}")
    return final_path


def _report_gate(qa: QAResult, strict: bool):
    """Print QA gate results."""
    status = "✓ PASS" if qa.passed else "✗ FAIL"
    print(f"  QA [{qa.gate_name}]: {status}")

    for issue in qa.issues:
        print(f"    ✗ {issue}")
    for warning in qa.warnings:
        marker = "✗" if strict else "⚠"
        print(f"    {marker} {warning}")

    if strict and qa.warnings and qa.passed:
        qa.passed = False
        qa.issues.extend([f"[strict] {w}" for w in qa.warnings])


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Manim lesson video pipeline",
    )
    parser.add_argument(
        "--lesson", required=True,
        help="Lesson ID (e.g., M01-L001)",
    )
    parser.add_argument(
        "--recording", default=None,
        help="Path to Nine's recording (.mp4/.mov). Optional.",
    )
    parser.add_argument(
        "--timestamps", default=None,
        help="Path to manual timestamps CSV (beat_index,start_sec,end_sec,text).",
    )
    parser.add_argument(
        "--scene-file", default=None,
        help="Use existing Manim scene .py instead of generating",
    )
    parser.add_argument(
        "--skip-render", action="store_true",
        help="Stop after scene generation (don't render or composite)",
    )
    parser.add_argument(
        "--strict-qa", action="store_true",
        help="Treat QA warnings as failures",
    )
    parser.add_argument(
        "--output-dir", default="out/lessons",
        help="Output directory (default: out/lessons)",
    )

    args = parser.parse_args()
    run_pipeline(args)


if __name__ == "__main__":
    main()
