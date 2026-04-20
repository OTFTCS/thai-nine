#!/usr/bin/env python3
"""
validate_script.py — Validate a YouTube episode script against the schema
and run structural QA checks beyond what JSON Schema can enforce.

Usage:
    python3 youtube/tools/validate_script.py --script youtube/examples/YT-S01-E01.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from collections import Counter

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


SCHEMA_PATH = Path(__file__).parent.parent / "schemas" / "yt-script.schema.json"


class ValidationResult:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.info: list[str] = []

    def error(self, msg: str):
        self.errors.append(msg)

    def warn(self, msg: str):
        self.warnings.append(msg)

    def add_info(self, msg: str):
        self.info.append(msg)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        lines = []
        if self.errors:
            lines.append(f"\n❌ {len(self.errors)} ERROR(S):")
            for e in self.errors:
                lines.append(f"   • {e}")
        if self.warnings:
            lines.append(f"\n⚠️  {len(self.warnings)} WARNING(S):")
            for w in self.warnings:
                lines.append(f"   • {w}")
        if self.info:
            lines.append(f"\nℹ️  {len(self.info)} INFO:")
            for i in self.info:
                lines.append(f"   • {i}")
        if self.ok:
            lines.append("\n✅ Script is valid.")
        return "\n".join(lines)


def validate_schema(script: dict, result: ValidationResult):
    """Validate against JSON schema if jsonschema is installed."""
    if not HAS_JSONSCHEMA:
        result.warn("jsonschema not installed — skipping schema validation. pip install jsonschema")
        return

    if not SCHEMA_PATH.exists():
        result.error(f"Schema file not found: {SCHEMA_PATH}")
        return

    schema = json.loads(SCHEMA_PATH.read_text())
    validator = jsonschema.Draft202012Validator(schema)
    errors = list(validator.iter_errors(script))
    for err in errors:
        path = " → ".join(str(p) for p in err.absolute_path) or "(root)"
        result.error(f"Schema: {path}: {err.message}")


def validate_ids_unique(script: dict, result: ValidationResult):
    """Check all IDs are unique within their namespace."""
    # Vocab IDs
    vocab_ids = [v["id"] for v in script.get("vocab", [])]
    dupes = [vid for vid, count in Counter(vocab_ids).items() if count > 1]
    if dupes:
        result.error(f"Duplicate vocab IDs: {set(dupes)}")

    # Block IDs
    block_ids = [b["id"] for b in script.get("blocks", [])]
    dupes = [bid for bid, count in Counter(block_ids).items() if count > 1]
    if dupes:
        result.error(f"Duplicate block IDs: {set(dupes)}")

    # Line IDs (across all blocks)
    line_ids = []
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            line_ids.append(line["id"])
    dupes = [lid for lid, count in Counter(line_ids).items() if count > 1]
    if dupes:
        result.error(f"Duplicate line IDs: {set(dupes)}")

    # Image IDs
    img_ids = [i["id"] for i in script.get("imagePrompts", [])]
    dupes = [iid for iid, count in Counter(img_ids).items() if count > 1]
    if dupes:
        result.error(f"Duplicate image prompt IDs: {set(dupes)}")

    result.add_info(f"Totals: {len(vocab_ids)} vocab, {len(block_ids)} blocks, {len(line_ids)} lines, {len(img_ids)} images")


def validate_references(script: dict, result: ValidationResult):
    """Check all cross-references resolve."""
    vocab_ids = {v["id"] for v in script.get("vocab", [])}
    img_ids = {i["id"] for i in script.get("imagePrompts", [])}
    block_ids = {b["id"] for b in script.get("blocks", [])}

    for block in script.get("blocks", []):
        bid = block["id"]

        # Check imageRef
        if "imageRef" in block and block["imageRef"] not in img_ids:
            result.error(f"Block {bid}: imageRef '{block['imageRef']}' not found in imagePrompts")

        # Check vocabRefs
        for vref in block.get("vocabRefs", []):
            if vref not in vocab_ids:
                result.error(f"Block {bid}: vocabRef '{vref}' not found in vocab")

    # Check vocab imageRefs
    for v in script.get("vocab", []):
        if "imageRef" in v and v["imageRef"] not in img_ids:
            result.error(f"Vocab {v['id']}: imageRef '{v['imageRef']}' not found in imagePrompts")

    # Check clip markers reference valid blocks
    for clip in script.get("shortFormClips", []):
        if clip["startBlock"] not in block_ids:
            result.error(f"Clip {clip['id']}: startBlock '{clip['startBlock']}' not found")
        if clip["endBlock"] not in block_ids:
            result.error(f"Clip {clip['id']}: endBlock '{clip['endBlock']}' not found")


def validate_mode_requirements(script: dict, result: ValidationResult):
    """Check that each block's lines make sense for its mode."""
    for block in script.get("blocks", []):
        bid = block["id"]
        mode = block["mode"]
        lines = block.get("lines", [])

        if mode == "breakdown":
            # Breakdown blocks should have Thai lines with delayed translit and English
            thai_lines = [l for l in lines if l.get("lang") == "th"]
            translit_lines = [l for l in lines if l.get("lang") == "translit"]
            en_lines = [l for l in lines if l.get("lang") == "en"]
            if not thai_lines:
                result.error(f"Block {bid} (breakdown): no Thai lines found")
            if not translit_lines:
                result.warn(f"Block {bid} (breakdown): no transliteration lines — staged reveal won't work")
            if not en_lines:
                result.warn(f"Block {bid} (breakdown): no English lines — staged reveal won't work")

        elif mode == "vocab-card":
            if not block.get("vocabRefs"):
                result.warn(f"Block {bid} (vocab-card): no vocabRefs — which vocab item should appear?")

        elif mode == "natural-listen":
            # Should be Thai-only
            non_thai = [l for l in lines if l.get("lang") not in ("th", "th-split")]
            if non_thai:
                result.warn(f"Block {bid} (natural-listen): has non-Thai lines — should be Thai-only for comprehension test")

        elif mode == "drill-prompt":
            spoken_thai = [l for l in lines if l.get("lang") == "th" and l.get("spoken", True)]
            if spoken_thai:
                result.warn(f"Block {bid} (drill-prompt): contains spoken Thai — the prompt should be English only, answer comes in drill-answer block")

        elif mode == "shadowing":
            highlight_lines = [l for l in lines if l.get("highlight")]
            if not highlight_lines:
                result.warn(f"Block {bid} (shadowing): no highlight lines — karaoke tracking won't work")
            split_lines = [l for l in lines if l.get("thaiSplit")]
            if not split_lines:
                result.warn(f"Block {bid} (shadowing): no thaiSplit — split-word display won't work")


def validate_episode_structure(script: dict, result: ValidationResult):
    """Check the episode has a sensible overall structure."""
    blocks = script.get("blocks", [])
    modes = [b["mode"] for b in blocks]

    # Should start with a hook
    if modes and modes[0] != "hook":
        result.warn("Episode doesn't start with a 'hook' block")

    # Should end with recap or teaser
    if modes and modes[-1] not in ("recap", "teaser"):
        result.warn("Episode doesn't end with 'recap' or 'teaser' block")

    # Should have at least one drill
    if "drill-prompt" not in modes:
        result.warn("No production drill in this episode — 40%+ production drills is a pedagogy rule")

    # Drill prompts should be followed by drill answers
    for i, mode in enumerate(modes):
        if mode == "drill-prompt":
            if i + 1 >= len(modes) or modes[i + 1] != "drill-answer":
                result.error(f"Block {blocks[i]['id']} (drill-prompt) is not followed by a drill-answer block")

    # Count spoken lines
    total_spoken = 0
    thai_spoken = 0
    for block in blocks:
        for line in block.get("lines", []):
            if line.get("spoken", True):
                total_spoken += 1
                if line.get("lang") in ("th", "th-split"):
                    thai_spoken += 1

    result.add_info(f"Spoken lines: {total_spoken} total, {thai_spoken} Thai ({100*thai_spoken//max(total_spoken,1)}%)")

    # Should have natural-listen and breakdown
    if "natural-listen" not in modes:
        result.warn("No natural-listen block — viewer doesn't get a comprehension test")
    if "breakdown" not in modes:
        result.warn("No breakdown block — no sentence-by-sentence teaching")
    if "shadowing" not in modes:
        result.warn("No shadowing block — no repetition practice")


def validate_line_lang_consistency(script: dict, result: ValidationResult):
    """Check that each line's lang field matches the presence of language-specific fields."""
    lang_field_map = {
        "th": "thai",
        "th-split": "thai",  # th-split should have either thai or thaiSplit
        "en": "english",
        "translit": "translit",
    }
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            lang = line.get("lang", "")
            line_id = line.get("id", "?")

            if lang in lang_field_map:
                required_field = lang_field_map[lang]
                if not line.get(required_field):
                    # th-split can also use thaiSplit
                    if lang == "th-split" and line.get("thaiSplit"):
                        continue
                    result.error(
                        f"Line {line_id}: lang='{lang}' but no '{required_field}' field present"
                    )


def validate_thai_has_translit(script: dict, result: ValidationResult):
    """Check that ALL Thai lines have transliteration — every mode, no exceptions."""
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            if line.get("lang") in ("th", "th-split") and not line.get("translit"):
                result.warn(f"Line {line['id']} in {block['mode']} block {block['id']}: Thai line missing transliteration")


def validate_translit_policy(script: dict, result: ValidationResult):
    """Check all transliteration fields comply with PTM policy (no IPA symbols)."""
    import re

    PTM_FORBIDDEN = set("ʉəɯɤœɨɪʊɜɐɑɔɒæɲŋɕʑʔɡːˈˌᵊᶱᴴᴹᴸᴿ")

    def check_field(location: str, text: str):
        found = [ch for ch in text if ch in PTM_FORBIDDEN]
        if found:
            result.error(f"{location}: transliteration contains forbidden IPA symbol(s): {', '.join(set(found))} — run generate_translit.py to fix")

    # Check vocab
    for vocab in script.get("vocab", []):
        translit = vocab.get("translit", "")
        if translit:
            check_field(f"vocab {vocab['id']}", translit)

    # Check lines
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            translit = line.get("translit", "")
            if translit:
                check_field(f"line {line['id']} in block {block['id']}", translit)


def validate_short_form_clips(script: dict, result: ValidationResult):
    """Check short-form clip markers are sensible."""
    clips = script.get("shortFormClips", [])
    if not clips:
        result.warn("No shortFormClips defined — should plan 3-5 clips per episode")
        return

    if len(clips) < 3:
        result.warn(f"Only {len(clips)} short-form clips — aim for 3-5")

    # Check clip block ordering
    blocks = script.get("blocks", [])
    block_order = {b["id"]: i for i, b in enumerate(blocks)}
    for clip in clips:
        start_idx = block_order.get(clip["startBlock"])
        end_idx = block_order.get(clip["endBlock"])
        if start_idx is not None and end_idx is not None and start_idx > end_idx:
            result.error(f"Clip {clip['id']}: startBlock '{clip['startBlock']}' comes after endBlock '{clip['endBlock']}'")

        if not clip.get("hookText"):
            result.warn(f"Clip {clip['id']}: no hookText — every short needs a text hook in the first frame")


def main():
    parser = argparse.ArgumentParser(description="Validate a YouTube episode script")
    parser.add_argument("--script", required=True, help="Path to the episode JSON file")
    args = parser.parse_args()

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"Error: file not found: {script_path}")
        sys.exit(1)

    try:
        script = json.loads(script_path.read_text())
    except json.JSONDecodeError as e:
        print(f"Error: invalid JSON: {e}")
        sys.exit(1)

    result = ValidationResult()

    validate_schema(script, result)
    validate_ids_unique(script, result)
    validate_references(script, result)
    validate_line_lang_consistency(script, result)
    validate_mode_requirements(script, result)
    validate_episode_structure(script, result)
    validate_thai_has_translit(script, result)
    validate_translit_policy(script, result)
    validate_short_form_clips(script, result)

    print(f"\n📋 Validation: {script_path.name}")
    print(f"   Episode: {script.get('episodeId', '?')} — {script.get('title', '?')}")
    print(result.summary())

    sys.exit(0 if result.ok else 1)


if __name__ == "__main__":
    main()
