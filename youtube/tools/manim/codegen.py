"""Deterministic Manim scene code generator.

Reads a script JSON (with timestamps), builds an overlay list internally,
preprocesses it, and emits a valid Python scene file with direct
mode-to-method mapping and pure arithmetic elapsed tracking.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Overlay building from script JSON (replaces generate_subtitles.py)
# ---------------------------------------------------------------------------


def _get_display_text(line: dict) -> str:
    """Get the text to display for a given line, based on language."""
    lang = line.get("lang", "th")
    if lang == "th":
        return line.get("thai", "")
    elif lang == "th-split":
        return line.get("thaiSplit", line.get("thai", ""))
    elif lang == "translit":
        return line.get("translit", "")
    elif lang == "en":
        return line.get("english", "")
    elif lang == "mixed":
        parts = []
        if line.get("thai"):
            parts.append(line["thai"])
        if line.get("english"):
            parts.append(line["english"])
        return " — ".join(parts)
    return ""


def _get_style_for_mode_and_lang(mode: str, lang: str) -> str:
    """Map mode + language to an ASS/overlay style name."""
    if mode == "vocab-card":
        if lang in ("th", "th-split"):
            return "VocabThai"
        elif lang == "translit":
            return "VocabTranslit"
        else:
            return "VocabEnglish"
    elif mode == "natural-listen":
        if lang in ("th", "th-split"):
            return "ThaiCentre"
        else:
            return "EnglishCentre"
    elif mode == "drill-prompt":
        return "DrillPrompt"
    elif mode == "shadowing":
        if lang in ("th", "th-split"):
            return "ThaiSplit"
        elif lang == "translit":
            return "TranslitCentre"
        else:
            return "EnglishCentre"
    else:
        if lang in ("th", "th-split"):
            return "Thai"
        elif lang == "translit":
            return "Translit"
        else:
            return "English"


def build_overlays_from_script(script: dict) -> list[dict]:
    """Build a flat overlay list from a timestamped script JSON.

    Produces the same dict format that generate_subtitles.generate_overlay_json()
    used to produce, so _preprocess_overlays() and SceneCodegen work unchanged.
    """
    overlays: list[dict] = []

    for block in script.get("blocks", []):
        block_id = block["id"]
        mode = block.get("mode", "explain")

        for line in block.get("lines", []):
            display_start = line.get("displayStart")
            if display_start is None:
                continue

            display_end = line.get("displayEnd")
            if display_end is None:
                display_end = display_start + 5.0

            text = _get_display_text(line)
            if not text:
                continue

            lang = line.get("lang", "th")
            overlay: dict = {
                "lineId": line["id"],
                "blockId": block_id,
                "mode": mode,
                "lang": lang,
                "text": text,
                "displayStart": display_start,
                "displayEnd": display_end,
                "style": _get_style_for_mode_and_lang(mode, lang),
                "highlight": line.get("highlight", False),
                "fadeIn": line.get("display", "immediate") != "immediate",
            }
            overlays.append(overlay)

    return overlays


# ---------------------------------------------------------------------------
# Typed overlay representation
# ---------------------------------------------------------------------------

@dataclass
class CodegenOverlay:
    """Typed representation of a preprocessed overlay."""

    line_id: str
    block_id: str
    mode: str
    lang: str
    text: str
    display_start: float
    display_end: float
    style: str
    highlight: bool
    fade_in: bool
    manim_duration: float
    translit: str = ""
    english: str = ""
    skip_in_scene: bool = False
    example_text: str | None = None
    example_delay: float | None = None
    try_delay: float | None = None
    english_text: str | None = None
    english_delay: float | None = None


# ---------------------------------------------------------------------------
# String quoting helper
# ---------------------------------------------------------------------------

def _q(s: str) -> str:
    """Quote a string for Python source, handling embedded quotes."""
    escaped = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{escaped}"'


def _split_text_for_subtitle(text: str, max_chars: int = 42) -> list[str]:
    """Split long text into subtitle-sized chunks at natural boundaries.

    Splits at sentence boundaries first, then clause boundaries, then word-wraps.
    Returns list of chunks, each <= max_chars where possible.
    """
    import re

    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    # Split at sentence boundaries
    sentences = re.split(r"(?<=[.!?])\s+", text)

    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if not current:
            current = sentence
        elif len(current) + 1 + len(sentence) <= max_chars:
            current = current + " " + sentence
        else:
            chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)

    # Word-wrap any chunk still over limit
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
        else:
            # Try clause boundaries first (commas, em-dashes, conjunctions)
            parts = re.split(r"(?<=,)\s+|(?<=—)\s*|\s+(?=—)", chunk)
            sub_line = ""
            for part in parts:
                if sub_line and len(sub_line) + 1 + len(part) > max_chars:
                    result.append(sub_line)
                    sub_line = part
                else:
                    sub_line = (sub_line + " " + part).strip()
            if sub_line:
                # Final word-wrap if still over
                if len(sub_line) <= max_chars:
                    result.append(sub_line)
                else:
                    words = sub_line.split()
                    line = ""
                    for w in words:
                        if line and len(line) + 1 + len(w) > max_chars:
                            result.append(line)
                            line = w
                        else:
                            line = (line + " " + w).strip()
                    if line:
                        result.append(line)

    return result if result else [text]


# ---------------------------------------------------------------------------
# Scene codegen engine
# ---------------------------------------------------------------------------

# clear_overlay() consumes this much time (matches DUR_FADE_OUT in scene_base)
_CLEAR_OVERLAY_DURATION = 0.3


@dataclass
class PhraseChunk:
    """A phrase chunk from the phrases JSON."""
    chunk_id: str
    chunk_index: int
    block_ref: str
    lang: str
    text: str
    translit: str | None
    display_start: float | None = None
    trigger_card: dict | None = None


class SceneCodegen:
    """Generates a deterministic Manim scene file from preprocessed overlays."""

    def __init__(
        self,
        overlays: list[dict],
        *,
        script_data: dict | None = None,
        phrases: list[dict] | None = None,
    ):
        self._raw_overlays = overlays
        self._script = script_data or {}
        self._overlays: list[CodegenOverlay] = []
        self._phrase_chunks: list[PhraseChunk] = []
        self._lines: list[str] = []
        self._ind = "        "  # 8 spaces (inside construct method)

        # Parse phrase chunks if provided — only use timed chunks
        self._has_timed_phrases = False
        if phrases:
            timed_count = 0
            for p in phrases:
                if p.get("lang") == "silence":
                    continue
                pc = PhraseChunk(
                    chunk_id=p["chunkId"],
                    chunk_index=p.get("chunkIndex", 0),
                    block_ref=p.get("blockRef", ""),
                    lang=p.get("lang", "en"),
                    text=p.get("text", ""),
                    translit=p.get("translit"),
                    display_start=p.get("displayStart"),
                    trigger_card=p.get("triggerCard"),
                )
                self._phrase_chunks.append(pc)
                if pc.display_start is not None:
                    timed_count += 1
            self._has_timed_phrases = timed_count > 0

    def generate(self) -> str:
        """Generate the complete scene file as a string."""
        self._parse_overlays()
        self._validate_transliteration()
        self._emit_header()
        self._emit_class_open()
        self._emit_construct()
        self._emit_class_close()
        return "\n".join(self._lines)

    # --- Parsing ---

    def _parse_overlays(self) -> None:
        """Convert raw dicts to typed CodegenOverlay objects, filtering skips."""
        for ov in self._raw_overlays:
            if ov.get("skipInScene", False):
                continue
            # Overlays that were reduced to just a skip marker have no text
            if "text" not in ov:
                continue
            self._overlays.append(CodegenOverlay(
                line_id=ov["lineId"],
                block_id=ov["blockId"],
                mode=ov["mode"],
                lang=ov.get("lang", ""),
                text=ov["text"],
                display_start=ov["displayStart"],
                display_end=ov["displayEnd"],
                style=ov.get("style", ""),
                highlight=ov.get("highlight", False),
                fade_in=ov.get("fadeIn", False),
                manim_duration=ov["manimDuration"],
                translit=ov.get("translit", ""),
                english=ov.get("english", ""),
                skip_in_scene=False,
                example_text=ov.get("exampleText"),
                example_delay=ov.get("exampleDelay"),
                try_delay=ov.get("tryDelay"),
                english_text=ov.get("englishText"),
                english_delay=ov.get("englishDelay"),
            ))

    # --- Validation ---

    def _validate_transliteration(self) -> None:
        """Fail loudly if any Thai overlay lacks translit."""
        missing = []
        for ov in self._overlays:
            if ov.lang in ("th", "th-split") and not ov.translit:
                # Vocab cards and breakdowns need translit; standalone Thai lines also
                truncated = ov.text[:30] + ("..." if len(ov.text) > 30 else "")
                missing.append(f"{ov.line_id} ({truncated})")
        if missing:
            raise ValueError(
                f"Transliteration missing for {len(missing)} Thai overlay(s):\n"
                + "\n".join(f"  - {m}" for m in missing)
            )

    # --- Emission: file structure ---

    def _emit_header(self) -> None:
        self._lines.extend([
            '"""Auto-generated Manim scene — deterministic codegen."""',
            "",
            "from scene_base import YouTubeScene",
            "",
        ])

    def _emit_class_open(self) -> None:
        self._lines.extend([
            "",
            "class YouTubeOverlay(YouTubeScene):",
            '    """Auto-generated overlay scene."""',
            "",
            "    def construct(self):",
            "        self.setup()",
            "        elapsed = 0.0",
            "",
        ])

    def _emit_class_close(self) -> None:
        self._lines.append("")

    # --- Emission: construct body ---

    def _emit_construct(self) -> None:
        """Gate: phrase-driven or legacy construct."""
        if self._has_timed_phrases:
            self._emit_construct_from_phrases()
        else:
            self._emit_construct_legacy()

    # --- Phrase-driven construct (new) ---

    def _build_card_lookups(self) -> None:
        """Build lookup tables from the script JSON for card emission."""
        self._vocab_by_id: dict[str, dict] = {}
        self._block_mode: dict[str, str] = {}
        self._block_lines: dict[tuple[str, str], dict] = {}

        for v in self._script.get("vocab", []):
            self._vocab_by_id[v["id"]] = v

        for block in self._script.get("blocks", []):
            bid = block["id"]
            self._block_mode[bid] = block.get("mode", "explain")
            for line in block.get("lines", []):
                thai = line.get("thai", "")
                if thai:
                    self._block_lines[(bid, thai)] = line

    def _get_card_key(self, pc: PhraseChunk) -> str | None:
        """Return a dedup key for the card this phrase should trigger, or None."""
        # triggerCard always takes priority
        if pc.trigger_card:
            tc = pc.trigger_card
            return f"{tc['type']}:{tc.get('vocabId', tc.get('lineRef', ''))}"

        mode = self._block_mode.get(pc.block_ref, "explain")

        if pc.lang == "th":
            if mode == "breakdown":
                # Only trigger if text matches a script breakdown line
                if (pc.block_ref, pc.text) in self._block_lines:
                    return f"breakdown:{pc.text}"
            elif mode == "shadowing":
                if (pc.block_ref, pc.text) in self._block_lines:
                    return f"shadowing:{pc.text}"
            elif mode == "natural-listen":
                # Accumulate — each Thai phrase adds to the stack (unique key = no dedup)
                return f"accumulate:{pc.display_start}:{pc.text}"
            elif mode == "drill-answer":
                return f"drill-answer:{pc.text}"
            elif mode in ("hook", "explain", "teaser", "vocab-explain"):
                return f"{mode}-th:{pc.text}"

        if pc.lang == "en" and mode == "drill-prompt":
            return f"drill-prompt:{pc.text}"

        return None

    def _emit_card_for_phrase(self, pc: PhraseChunk, duration: float) -> None:
        """Emit a show_*() call for the card this phrase triggers."""
        ind = self._ind
        mode = self._block_mode.get(pc.block_ref, "explain")

        # Ensure minimum duration for card animations
        duration = max(duration, 0.5)

        # --- Vocab card ---
        if pc.trigger_card and pc.trigger_card.get("type") == "vocab-card":
            vocab_id = pc.trigger_card["vocabId"]
            vocab = self._vocab_by_id.get(vocab_id)
            if vocab:
                self._lines.extend([
                    f"{ind}self.show_vocab_card(",
                    f"{ind}    {_q(vocab['thai'])},",
                    f"{ind}    {_q(vocab['english'])},",
                    f"{ind}    {_q(vocab['translit'])},",
                    f"{ind}    duration={duration:.3f},",
                    f"{ind})",
                    f"{ind}elapsed += {duration:.3f}",
                    "",
                ])
                return

        # --- Breakdown triplet ---
        if mode == "breakdown":
            line = self._block_lines.get((pc.block_ref, pc.text))
            if line:
                translit = line.get("translit", "")
                english = line.get("english", "")
                translit_delay = min(0.5, duration * 0.25)
                english_delay = min(1.0, duration * 0.5)
                self._lines.extend([
                    f"{ind}self.show_breakdown_triplet(",
                    f"{ind}    {_q(pc.text)},",
                    f"{ind}    {_q(translit)},",
                    f"{ind}    {_q(english)},",
                    f"{ind}    duration={duration:.3f},",
                    f"{ind}    translit_delay={translit_delay:.2f},",
                    f"{ind}    english_delay={english_delay:.2f},",
                    f"{ind})",
                    f"{ind}elapsed += {duration:.3f}",
                    "",
                ])
                return

        # --- Shadowing line ---
        if mode == "shadowing":
            line = self._block_lines.get((pc.block_ref, pc.text))
            thai_split = line.get("thaiSplit", pc.text) if line else pc.text
            tr = f", translit={_q(pc.translit)}" if pc.translit else ""
            self._lines.extend([
                f"{ind}self.show_shadowing_line({_q(thai_split)}, duration={duration:.3f}, highlight=True{tr})",
                f"{ind}elapsed += {duration:.3f}",
                "",
            ])
            return

        # --- Natural listen (accumulate) ---
        if mode == "natural-listen":
            tr = f", translit={_q(pc.translit)}" if pc.translit else ""
            self._lines.extend([
                f"{ind}self.show_accumulate({_q(pc.text)}, duration={duration:.3f}{tr})",
                f"{ind}elapsed += {duration:.3f}",
                "",
            ])
            return

        # --- Drill prompt ---
        if mode == "drill-prompt":
            self._lines.extend([
                f"{ind}self.show_drill_prompt(",
                f"{ind}    {_q(pc.text)},",
                f"{ind}    duration={duration:.3f},",
                f"{ind})",
                f"{ind}elapsed += {duration:.3f}",
                "",
            ])
            return

        # --- Thai line (hook, explain, teaser, drill-answer) ---
        if pc.lang == "th":
            tr = f", translit={_q(pc.translit)}" if pc.translit else ""
            fade = ", fade_in=True" if mode == "teaser" else ""
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(pc.text)}, duration={duration:.3f}{fade}{tr})",
                f"{ind}elapsed += {duration:.3f}",
                "",
            ])
            return

        # --- Fallback: English line ---
        self._lines.extend([
            f"{ind}self.show_english_line({_q(pc.text)}, duration={duration:.3f})",
            f"{ind}elapsed += {duration:.3f}",
            "",
        ])

    def _find_gap_start(
        self, timed: list[PhraseChunk], block_id: str
    ) -> float | None:
        """Find timing position for a missing block based on script order."""
        script_block_ids = [b["id"] for b in self._script.get("blocks", [])]
        try:
            idx = script_block_ids.index(block_id)
        except ValueError:
            return None

        # Group phrases by block
        phrase_by_block: dict[str, list[PhraseChunk]] = {}
        for p in timed:
            phrase_by_block.setdefault(p.block_ref, []).append(p)

        # Find preceding block (in script order) that HAS phrases
        prev_end: float | None = None
        for i in range(idx - 1, -1, -1):
            bid = script_block_ids[i]
            if bid in phrase_by_block:
                prev_end = max(p.display_start for p in phrase_by_block[bid])
                break

        # Find following block (in script order) that HAS phrases
        next_start: float | None = None
        for i in range(idx + 1, len(script_block_ids)):
            bid = script_block_ids[i]
            if bid in phrase_by_block:
                next_start = min(p.display_start for p in phrase_by_block[bid])
                break

        if prev_end is not None:
            return prev_end + 0.5
        elif next_start is not None:
            return next_start - 2.0
        return None

    def _inject_silent_block_phrases(
        self, timed: list[PhraseChunk]
    ) -> list[PhraseChunk]:
        """Insert synthetic phrases for blocks that have no phrase chunks."""
        phrase_blocks = {pc.block_ref for pc in timed}

        for block in self._script.get("blocks", []):
            block_id = block["id"]
            if block_id in phrase_blocks:
                continue

            start_time = self._find_gap_start(timed, block_id)
            if start_time is None:
                continue

            lines = block.get("lines", [])
            if not lines:
                continue
            first_line = lines[0]

            synthetic = PhraseChunk(
                chunk_id=f"syn-{block_id}",
                chunk_index=-1,
                block_ref=block_id,
                lang=first_line.get("lang", "en"),
                text=first_line.get("english", first_line.get("thai", "")),
                translit=first_line.get("translit"),
                display_start=start_time,
                trigger_card=(
                    {"type": "drill-prompt"}
                    if block.get("mode") == "drill-prompt"
                    else None
                ),
            )
            timed.append(synthetic)

        return sorted(timed, key=lambda p: p.display_start)

    def _emit_construct_from_phrases(self) -> None:
        """Emit construct() body driven entirely by phrase timestamps.

        Every subtitle gets its own wait(). Cards trigger on card-key
        changes. No overlay batching, no dual timing systems.
        """
        self._build_card_lookups()
        ind = self._ind

        timed = sorted(
            [pc for pc in self._phrase_chunks if pc.display_start is not None],
            key=lambda p: p.display_start,
        )

        # Insert synthetic phrases for blocks with no phrase chunks
        timed = self._inject_silent_block_phrases(timed)

        current_block: str | None = None
        current_card_key: str | None = None

        for idx, pc in enumerate(timed):
            # --- Block transition ---
            if pc.block_ref != current_block:
                if current_block is not None:
                    self._emit_block_transition()
                mode = self._block_mode.get(pc.block_ref, "explain")
                self._lines.append(
                    f"{ind}# === Block: {pc.block_ref} ({mode}) ==="
                )
                current_block = pc.block_ref
                current_card_key = None  # reset card tracking per block

            # --- Sync to this phrase's displayStart ---
            self._lines.extend([
                f"{ind}# {pc.chunk_id}: {pc.text[:40]}",
                f"{ind}wait_gap = {pc.display_start:.3f} - elapsed",
                f"{ind}if wait_gap > 0.02:",
                f"{ind}    self.wait(wait_gap)",
                f"{ind}    elapsed += wait_gap",
                "",
            ])

            # --- Subtitle (always, before card) ---
            self._emit_phrase_subtitle(pc)

            # --- Compute Δt to next phrase ---
            if idx + 1 < len(timed):
                next_start = timed[idx + 1].display_start
            else:
                next_start = pc.display_start + 3.0
            delta_t = round(next_start - pc.display_start, 3)
            if delta_t < 0.02:
                delta_t = 0.1  # safety floor

            # --- Card logic ---
            new_card_key = self._get_card_key(pc)
            if new_card_key and new_card_key != current_card_key:
                # NEW card — show_*() consumes delta_t
                self._emit_card_for_phrase(pc, delta_t)
                current_card_key = new_card_key
            else:
                # Same card or no card — just wait (card persists on screen)
                self._lines.extend([
                    f"{ind}self.wait({delta_t:.3f})",
                    f"{ind}elapsed += {delta_t:.3f}",
                    "",
                ])

    # --- Legacy construct (overlay-driven, for episodes without phrases) ---

    def _emit_construct_legacy(self) -> None:
        """Emit the construct() body from overlays (original algorithm)."""
        current_block: str | None = None

        i = 0
        while i < len(self._overlays):
            ov = self._overlays[i]

            # Block transition
            if ov.block_id != current_block:
                if current_block is not None:
                    self._emit_block_transition()
                self._emit_block_comment(ov)
                current_block = ov.block_id

            # Sync elapsed to displayStart
            self._emit_wait_gap(ov)

            # Emit subtitle for spoken Thai lines
            if ov.lang in ("th", "th-split") and ov.translit and ov.mode not in ("vocab-card", "breakdown", "vocab-explain", "section-intro", "natural-listen"):
                self._emit_subtitle(ov)

            # Mode dispatch — returns number of overlays consumed
            consumed = self._emit_overlay(ov, i)
            i += consumed

    def _emit_wait_gap(self, ov: CodegenOverlay) -> None:
        """Emit wait to sync elapsed time to this overlay's displayStart."""
        ind = self._ind
        self._lines.extend([
            f"{ind}# Sync to {ov.display_start:.2f}s ({ov.line_id})",
            f"{ind}wait_gap = {ov.display_start:.2f} - elapsed",
            f"{ind}if wait_gap > 0.02:",
            f"{ind}    self.wait(wait_gap)",
            f"{ind}    elapsed += wait_gap",
            "",
        ])

    def _emit_subtitle(self, ov: CodegenOverlay) -> None:
        """Emit a set_subtitle call for spoken Thai lines (bottom strip, instant, no time consumed)."""
        ind = self._ind
        self._lines.extend([
            f'{ind}self.set_subtitle({_q(ov.text)}, lang="th", translit={_q(ov.translit)})',
        ])

    def _emit_phrase_subtitle(self, pc: PhraseChunk) -> None:
        """Emit a set_subtitle call from a phrase chunk (zero time consumed)."""
        ind = self._ind
        if pc.lang == "th" and pc.translit:
            self._lines.extend([
                f'{ind}self.set_subtitle({_q(pc.text)}, lang="th", translit={_q(pc.translit)})  # {pc.chunk_id}',
            ])
        elif pc.lang == "en":
            self._lines.extend([
                f'{ind}self.set_subtitle({_q(pc.text)}, lang="en")  # {pc.chunk_id}',
            ])
        elif pc.lang == "th":
            # Thai without translit — render but warn
            print(f"WARNING: Thai phrase {pc.chunk_id} missing translit: {pc.text[:30]}")
            self._lines.extend([
                f'{ind}self.set_subtitle({_q(pc.text)}, lang="th")  # {pc.chunk_id} — WARNING: no translit',
            ])

    def _emit_block_transition(self) -> None:
        """Emit snap_clear at block boundary (preserves subtitle layer)."""
        ind = self._ind
        self._lines.extend([
            f"{ind}# --- Block transition ---",
            f"{ind}self.snap_clear()",
            "",
        ])

    def _emit_block_comment(self, ov: CodegenOverlay) -> None:
        self._lines.append(
            f"{self._ind}# === Block: {ov.block_id} ({ov.mode}) ==="
        )

    # --- Mode dispatch ---

    def _emit_overlay(self, ov: CodegenOverlay, index: int) -> int:
        """Dispatch to mode-specific emitter. Returns overlays consumed."""
        dispatch = {
            "hook": self._emit_hook,
            "explain": self._emit_explain,
            "vocab-card": self._emit_vocab_card,
            "vocab-explain": self._emit_vocab_explain,
            "section-intro": self._emit_section_intro,
            "natural-listen": self._emit_natural_listen,
            "drill-prompt": self._emit_drill_prompt,
            "drill-answer": self._emit_drill_answer,
            "shadowing": self._emit_shadowing,
            "recap": self._emit_recap,
            "teaser": self._emit_teaser,
        }

        # Breakdown is special — needs index for triplet lookahead
        if ov.mode == "breakdown":
            return self._emit_breakdown(ov, index)

        emitter = dispatch.get(ov.mode, self._emit_fallback)
        return emitter(ov)

    # --- Mode emitters ---

    def _emit_hook(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        if ov.english_text and ov.english_delay is not None:
            parts = [
                f"{ind}self.show_stacked_pair(",
                f"{ind}    {_q(ov.text)},",
                f"{ind}    {_q(ov.english_text)},",
                f"{ind}    duration={ov.manim_duration},",
                f"{ind}    english_delay={ov.english_delay},",
            ]
            if ov.translit:
                parts.append(f"{ind}    translit={_q(ov.translit)},")
            parts.extend([
                f"{ind})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
            self._lines.extend(parts)
        elif ov.lang == "th":
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=False{tr})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        else:
            self._lines.extend([
                f"{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_explain(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        if ov.lang == "en":
            chunks = _split_text_for_subtitle(ov.text)
            if len(chunks) == 1:
                self._lines.extend([
                    f'{ind}self.show_subtitle({_q(chunks[0])}, duration={ov.manim_duration}, lang="en")',
                    f"{ind}elapsed += {ov.manim_duration}",
                    "",
                ])
            else:
                # First chunk fades in via show_subtitle, rest instant via set_subtitle
                per_chunk = ov.manim_duration / len(chunks)
                self._lines.extend([
                    f'{ind}self.show_subtitle({_q(chunks[0])}, duration={per_chunk:.3f}, lang="en")',
                    f"{ind}elapsed += {per_chunk:.3f}",
                ])
                for chunk in chunks[1:]:
                    self._lines.extend([
                        f'{ind}self.set_subtitle({_q(chunk)}, lang="en")',
                        f"{ind}self.wait({per_chunk:.3f})",
                        f"{ind}elapsed += {per_chunk:.3f}",
                    ])
                self._lines.append("")
        else:
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f'{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, pos="bottom"{tr})',
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_vocab_card(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        parts = [
            f"{ind}self.show_vocab_card(",
            f"{ind}    {_q(ov.text)},",
            f"{ind}    {_q(ov.english)},",
            f"{ind}    {_q(ov.translit)},",
            f"{ind}    duration={ov.manim_duration},",
        ]
        if ov.example_text:
            parts.append(f"{ind}    example={_q(ov.example_text)},")
            if ov.example_delay is not None:
                parts.append(f"{ind}    example_delay={ov.example_delay},")
        parts.extend([
            f"{ind})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        self._lines.extend(parts)
        return 1

    def _emit_natural_listen(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        tr = f", translit={_q(ov.translit)}" if ov.translit else ""
        self._lines.extend([
            f"{ind}self.show_accumulate({_q(ov.text)}, duration={ov.manim_duration}{tr})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        return 1

    def _emit_breakdown(self, ov: CodegenOverlay, index: int) -> int:
        """Consume triplets of th/translit/en for show_breakdown_triplet."""
        ind = self._ind

        # Check if next 2 overlays complete the triplet
        if (index + 2 < len(self._overlays)
                and self._overlays[index + 1].mode == "breakdown"
                and self._overlays[index + 2].mode == "breakdown"
                and self._overlays[index + 1].block_id == ov.block_id
                and self._overlays[index + 2].block_id == ov.block_id):

            th_ov = ov
            tr_ov = self._overlays[index + 1]
            en_ov = self._overlays[index + 2]

            # Use translit/english from the Thai overlay data if enriched,
            # otherwise fall back to the text of the translit/english overlays
            translit_text = th_ov.translit or tr_ov.text
            english_text = th_ov.english or en_ov.text

            # Compute delays from displayStart deltas
            translit_delay = round(tr_ov.display_start - th_ov.display_start, 2)
            english_delay = round(en_ov.display_start - th_ov.display_start, 2)

            # Ensure delays are positive and make sense
            translit_delay = max(0.3, translit_delay)
            english_delay = max(translit_delay + 0.3, english_delay)

            # Total duration = sum of all three overlay durations
            # (th.manimDuration covers th→tr gap, tr covers tr→en gap,
            # en covers en→next overlay gap)
            total_dur = round(
                th_ov.manim_duration + tr_ov.manim_duration + en_ov.manim_duration,
                2,
            )

            # Emit wait_gap for the 2nd and 3rd overlays (they're consumed here)
            # No — the wait_gap was already emitted for the Thai overlay,
            # and the triplet is one atomic show_breakdown_triplet call.

            self._lines.extend([
                f"{ind}self.show_breakdown_triplet(",
                f"{ind}    {_q(th_ov.text)},",
                f"{ind}    {_q(translit_text)},",
                f"{ind}    {_q(english_text)},",
                f"{ind}    duration={total_dur},",
                f"{ind}    translit_delay={translit_delay},",
                f"{ind}    english_delay={english_delay},",
                f"{ind})",
                f"{ind}elapsed += {total_dur}",
                "",
            ])
            return 3

        # Incomplete triplet — emit as standalone line
        if ov.lang == "th":
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}{tr})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        elif ov.lang == "translit":
            self._lines.extend([
                f"{ind}self.show_translit_line({_q(ov.text)}, duration={ov.manim_duration})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        else:
            self._lines.extend([
                f"{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_drill_prompt(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        parts = [
            f"{ind}self.show_drill_prompt(",
            f"{ind}    {_q(ov.text)},",
            f"{ind}    duration={ov.manim_duration},",
        ]
        if ov.try_delay is not None:
            parts.append(f"{ind}    try_delay={ov.try_delay},")
        parts.extend([
            f"{ind})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        self._lines.extend(parts)
        return 1

    def _emit_drill_answer(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        if ov.lang == "en":
            # English explanation (e.g., "That's right — ใกล้ไหม means 'is it near?'")
            # Render as subtitle chunks — Thai answer card from previous line stays visible
            chunks = _split_text_for_subtitle(ov.text)
            if len(chunks) == 1:
                self._lines.extend([
                    f'{ind}self.set_subtitle({_q(chunks[0])}, lang="en")',
                    f"{ind}self.wait({ov.manim_duration})",
                    f"{ind}elapsed += {ov.manim_duration}",
                    "",
                ])
            else:
                per = round(ov.manim_duration / len(chunks), 3)
                for chunk in chunks:
                    self._lines.extend([
                        f'{ind}self.set_subtitle({_q(chunk)}, lang="en")',
                        f"{ind}self.wait({per})",
                        f"{ind}elapsed += {per}",
                    ])
                self._lines.append("")
        else:
            # Thai answer — show as card with translit
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=False{tr})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_shadowing(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        tr = f", translit={_q(ov.translit)}" if ov.translit else ""
        self._lines.extend([
            f"{ind}self.show_shadowing_line({_q(ov.text)}, duration={ov.manim_duration}, highlight=True{tr})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        return 1

    def _emit_recap(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        self._lines.extend([
            f"{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        return 1

    def _emit_teaser(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        if ov.lang == "th":
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=True{tr})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        else:
            self._lines.extend([
                f"{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_vocab_explain(self, ov: CodegenOverlay) -> int:
        """Emit vocab-explain overlay.

        English lines: split into subtitle chunks (card zone keeps previous vocab card).
        Thai lines: show as card in card zone (subtitle guard is excluded for this mode).
        """
        ind = self._ind
        if ov.lang == "en":
            chunks = _split_text_for_subtitle(ov.text)
            if len(chunks) == 1:
                self._lines.extend([
                    f'{ind}self.set_subtitle({_q(chunks[0])}, lang="en")',
                    f"{ind}self.wait({ov.manim_duration})",
                    f"{ind}elapsed += {ov.manim_duration}",
                    "",
                ])
            else:
                per_chunk = ov.manim_duration / len(chunks)
                for chunk in chunks:
                    self._lines.extend([
                        f'{ind}self.set_subtitle({_q(chunk)}, lang="en")',
                        f"{ind}self.wait({per_chunk:.3f})",
                        f"{ind}elapsed += {per_chunk:.3f}",
                    ])
                self._lines.append("")
        else:
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f'{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, pos="bottom"{tr})',
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_section_intro(self, ov: CodegenOverlay) -> int:
        """Emit section-intro overlay.

        English narration as subtitle chunks. No card zone content.
        Thai lines (rare): show as card.
        """
        ind = self._ind
        if ov.lang == "en":
            chunks = _split_text_for_subtitle(ov.text)
            if len(chunks) == 1:
                self._lines.extend([
                    f'{ind}self.set_subtitle({_q(chunks[0])}, lang="en")',
                    f"{ind}self.wait({ov.manim_duration})",
                    f"{ind}elapsed += {ov.manim_duration}",
                    "",
                ])
            else:
                per_chunk = ov.manim_duration / len(chunks)
                for chunk in chunks:
                    self._lines.extend([
                        f'{ind}self.set_subtitle({_q(chunk)}, lang="en")',
                        f"{ind}self.wait({per_chunk:.3f})",
                        f"{ind}elapsed += {per_chunk:.3f}",
                    ])
                self._lines.append("")
        else:
            tr = f", translit={_q(ov.translit)}" if ov.translit else ""
            self._lines.extend([
                f'{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, pos="bottom"{tr})',
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        return 1

    def _emit_fallback(self, ov: CodegenOverlay) -> int:
        """Fallback for unrecognised modes — split long text into subtitle chunks."""
        ind = self._ind
        self._lines.append(f'{ind}# WARNING: unknown mode "{ov.mode}" for {ov.line_id}')
        chunks = _split_text_for_subtitle(ov.text)
        if len(chunks) == 1:
            self._lines.extend([
                f'{ind}self.set_subtitle({_q(chunks[0])}, lang="en")',
                f"{ind}self.wait({ov.manim_duration})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        else:
            per_chunk = ov.manim_duration / len(chunks)
            for chunk in chunks:
                self._lines.extend([
                    f'{ind}self.set_subtitle({_q(chunk)}, lang="en")',
                    f"{ind}self.wait({per_chunk:.3f})",
                    f"{ind}elapsed += {per_chunk:.3f}",
                ])
            self._lines.append("")
        return 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _apply_phrase_timestamps(overlays: list[dict], phrases: list[dict]) -> int:
    """Apply phrase timestamps to overlay displayStart/displayEnd.

    Thai phrase chunks with triggerCard map to card overlays in the script.
    Uses (blockId, Thai text) as the match key.

    Returns number of overlays updated.
    """
    # Build lookup from timed Thai phrase chunks
    # Key: (blockRef, text) → displayStart
    phrase_times: dict[tuple[str, str], float] = {}
    for p in phrases:
        if p.get("lang") == "th" and p.get("displayStart") is not None:
            key = (p.get("blockRef", ""), p.get("text", ""))
            # Only store the first occurrence per (block, text) pair
            if key not in phrase_times:
                phrase_times[key] = p["displayStart"]

    updated = 0
    for ov in overlays:
        if ov.get("lang") not in ("th", "th-split"):
            continue
        key = (ov["blockId"], ov["text"])
        if key in phrase_times:
            ov["displayStart"] = phrase_times[key]
            updated += 1

    # Now fix displayEnd values — set each to the next overlay's displayStart
    # (or displayStart + 5.0 for the last one)
    overlays.sort(key=lambda o: o["displayStart"])
    for i, ov in enumerate(overlays):
        if i + 1 < len(overlays):
            ov["displayEnd"] = overlays[i + 1]["displayStart"]
        else:
            ov["displayEnd"] = ov["displayStart"] + 5.0

    # Also update English/translit overlays that follow their Thai overlay
    # (delayed lines within the same block get pushed forward)
    by_block: dict[str, list[dict]] = {}
    for ov in overlays:
        by_block.setdefault(ov["blockId"], []).append(ov)

    for block_ovs in by_block.values():
        block_ovs.sort(key=lambda o: o["displayStart"])
        for i in range(1, len(block_ovs)):
            # If a non-Thai overlay has the same or earlier start than previous,
            # push it forward slightly
            if block_ovs[i]["displayStart"] <= block_ovs[i-1]["displayStart"]:
                block_ovs[i]["displayStart"] = block_ovs[i-1]["displayStart"] + 0.1

    return updated


def generate_scene_deterministic(
    output_path: Path,
    *,
    script_path: Path,
    phrases_path: Path | None = None,
) -> Path:
    """Generate a deterministic Manim scene file from a timestamped script.

    Two modes:
    - **Phrase-driven** (when timed phrases available): scene is generated
      entirely from phrase timestamps. No overlays needed.
    - **Legacy** (no phrases): builds overlays from script, preprocesses,
      then runs overlay-walking codegen.

    Returns path to the generated scene file.
    """
    script_data = json.loads(script_path.read_text(encoding="utf-8"))

    # Load phrase chunks if available
    phrases = None
    timed_count = 0
    if phrases_path and phrases_path.exists():
        phrases_data = json.loads(phrases_path.read_text(encoding="utf-8"))
        phrases = phrases_data.get("chunks", [])
        timed_count = sum(1 for p in phrases if p.get("displayStart") is not None)
        print(f"  → Loaded {len(phrases)} phrase chunks ({timed_count} timed)")

    if phrases and timed_count > 0:
        # --- Phrase-driven path: no overlays needed ---
        print("  → Using phrase-driven scene generation")
        codegen = SceneCodegen([], script_data=script_data, phrases=phrases)
    else:
        # --- Legacy overlay path ---
        from .generate_scene import _preprocess_overlays

        overlays = build_overlays_from_script(script_data)
        overlays_json = json.dumps(overlays, ensure_ascii=False, indent=2)
        processed_json = _preprocess_overlays(overlays_json, script_path=script_path)
        processed = json.loads(processed_json)
        codegen = SceneCodegen(processed, script_data=script_data)

    code = codegen.generate()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(code, encoding="utf-8")

    print(f"  ✓ Deterministic scene written to {output_path}")
    return output_path
