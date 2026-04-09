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


# ---------------------------------------------------------------------------
# Scene codegen engine
# ---------------------------------------------------------------------------

# clear_overlay() consumes this much time (matches DUR_FADE_OUT in scene_base)
_CLEAR_OVERLAY_DURATION = 0.3


class SceneCodegen:
    """Generates a deterministic Manim scene file from preprocessed overlays."""

    def __init__(
        self,
        overlays: list[dict],
        *,
        script_data: dict | None = None,
    ):
        self._raw_overlays = overlays
        self._script = script_data or {}
        self._overlays: list[CodegenOverlay] = []
        self._lines: list[str] = []
        self._ind = "        "  # 8 spaces (inside construct method)

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
        """Emit the construct() body: iterate overlays, grouped by block."""
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

    def _emit_block_transition(self) -> None:
        """Emit clear_overlay at block boundary."""
        ind = self._ind
        self._lines.extend([
            f"{ind}# --- Block transition ---",
            f"{ind}elapsed += self.clear_overlay(run_time={_CLEAR_OVERLAY_DURATION})",
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
            self._lines.extend([
                f"{ind}self.show_stacked_pair(",
                f"{ind}    {_q(ov.text)},",
                f"{ind}    {_q(ov.english_text)},",
                f"{ind}    duration={ov.manim_duration},",
                f"{ind}    english_delay={ov.english_delay},",
                f"{ind})",
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        elif ov.lang == "th":
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=False)",
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
            self._lines.extend([
                f'{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration}, pos="bottom")',
                f"{ind}elapsed += {ov.manim_duration}",
                "",
            ])
        else:
            self._lines.extend([
                f'{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, pos="bottom")',
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
        self._lines.extend([
            f"{ind}self.show_accumulate({_q(ov.text)}, duration={ov.manim_duration})",
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
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration})",
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
        self._lines.extend([
            f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=False)",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        return 1

    def _emit_shadowing(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        self._lines.extend([
            f"{ind}self.show_shadowing_line({_q(ov.text)}, duration={ov.manim_duration}, highlight=True)",
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
            self._lines.extend([
                f"{ind}self.show_thai_line({_q(ov.text)}, duration={ov.manim_duration}, fade_in=True)",
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

    def _emit_fallback(self, ov: CodegenOverlay) -> int:
        ind = self._ind
        self._lines.extend([
            f'{ind}# WARNING: unknown mode "{ov.mode}" for {ov.line_id}',
            f"{ind}self.show_english_line({_q(ov.text)}, duration={ov.manim_duration})",
            f"{ind}elapsed += {ov.manim_duration}",
            "",
        ])
        return 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_scene_deterministic(
    output_path: Path,
    *,
    script_path: Path,
) -> Path:
    """Generate a deterministic Manim scene file from a timestamped script.

    1. Build overlays from script JSON (replaces generate_subtitles.py)
    2. Preprocess overlays (reuses existing _preprocess_overlays)
    3. Run SceneCodegen
    4. Write to output_path

    Returns path to the generated scene file.
    """
    from .generate_scene import _preprocess_overlays

    script_data = json.loads(script_path.read_text(encoding="utf-8"))
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
