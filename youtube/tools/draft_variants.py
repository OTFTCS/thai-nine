#!/usr/bin/env python3
"""
draft_variants.py -- Generate 4 script variants for a YouTube episode along 3 axes.

Axes:
  Hook style    : situation/curiosity (baseline) vs problem/pain
  Drill type    : anticipation-pause (baseline) vs substitution
  Example level : simple (baseline) vs rich + idiomatic

Usage:
    python3 youtube/tools/draft_variants.py --episode YT-S01-E02 --round 1
    python3 youtube/tools/draft_variants.py --episode YT-S01-E03 --round 1 --new --level A2 --topic refusing-politely
    python3 youtube/tools/draft_variants.py --episode YT-S01-E02 --round 2 --mutate-parts 2,7
    python3 youtube/tools/draft_variants.py --episode YT-S01-E02 --round 1 --force
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_YT_DIR = _HERE.parent
_REPO_ROOT = _YT_DIR.parent

_SCRIPTS_DIR = _YT_DIR / "scripts"
_EXAMPLES_DIR = _YT_DIR / "examples"
_PROMPTS_DIR = _YT_DIR / "prompts"

_BASE_PROMPT_PATH = _PROMPTS_DIR / "script-writing.prompt.md"

PREFIX = "[draft-variants]"


def err(msg: str) -> None:
    print(f"{PREFIX} ERROR: {msg}", file=sys.stderr)


def info(msg: str) -> None:
    print(f"{PREFIX} {msg}")


# ---------------------------------------------------------------------------
# Variant definitions
# ---------------------------------------------------------------------------

VARIANTS: list[dict[str, Any]] = [
    {
        "variantId": "A",
        "axes": {
            "hookStyle": "situation",
            "drillType": "anticipation",
            "exampleSentences": "simple",
        },
        "label": "Baseline",
        "override": None,  # no override -- pure baseline
    },
    {
        "variantId": "B",
        "axes": {
            "hookStyle": "problem/pain",
            "drillType": "anticipation",
            "exampleSentences": "simple",
        },
        "label": "Problem/pain hook",
        "override": (
            "## VARIANT OVERRIDE: Hook style (problem/pain)\n\n"
            "For this draft, replace the situation/curiosity hook with a problem/pain hook. "
            "Cold-open the script with a 2-sentence vignette where the viewer is in the moment, "
            "stuck, then deliver the promise. "
            "Skip the cultural-fact opener in PART 2; jump straight into dialogue framing. "
            "Example structure: viewer is stranded, the need is immediate, Nine names what will fix it."
        ),
    },
    {
        "variantId": "C",
        "axes": {
            "hookStyle": "situation",
            "drillType": "substitution",
            "exampleSentences": "simple",
        },
        "label": "Substitution drills",
        "override": (
            "## VARIANT OVERRIDE: Drill type (substitution)\n\n"
            "For this draft, replace ALL anticipation-pause drills in PART 7 with substitution drills. "
            "Each drill shows a model sentence on screen. "
            "Nine reads the full sentence aloud. "
            "Then she says: 'Now swap [SLOT] for [ALTERNATIVE] -- go.' "
            "She pauses for the viewer, then gives the target answer. "
            "Slots to swap should cycle across the vocab items covered in this episode. "
            "Every substitution drill must name the slot explicitly in Nine's English cue. "
            "Do not mix anticipation-pause and substitution in PART 7 of this variant."
        ),
    },
    {
        "variantId": "D",
        "axes": {
            "hookStyle": "situation",
            "drillType": "anticipation",
            "exampleSentences": "rich + idiomatic",
        },
        "label": "Rich example sentences",
        "override": (
            "## VARIANT OVERRIDE: Example sentence richness\n\n"
            "For this draft, all example sentences attached to vocab items must be longer, "
            "more idiomatic, and culturally textured. "
            "Each example should: (1) use at least one second-clause framing or cultural annotation, "
            "(2) include a note field explaining the cultural or pragmatic context of that sentence, "
            "(3) feel like something a real Thai person would say in an everyday situation. "
            "The vocab list itself is FIXED -- do not change Thai, translit, or english gloss on any vocab item. "
            "Only the exampleSentences arrays and breakdown sample sentences vary. "
            "Simple pattern-drill examples are NOT acceptable for this variant."
        ),
    },
]


# ---------------------------------------------------------------------------
# Part definitions for annotation scaffold
# ---------------------------------------------------------------------------

PARTS: list[dict[str, Any]] = [
    {
        "number": 1,
        "name": "Hook + Promise",
        "questions": [
            "Did the hook clearly promise what the viewer will be able to DO by the end? (yes / partial / no): _____",
            "Did the opening 15 seconds feel like Nine's voice, not a generic explainer? (yes / sort-of / no): _____",
            "Was the hook specific to this episode's topic, not generic? (yes / partial / no): _____",
        ],
        "friction_tags": ["part-1-hook", "part-1-promise"],
    },
    {
        "number": 2,
        "name": "Cultural Frame / Explain",
        "questions": [
            "Was the cultural fact real and verifiable, not fabricated? (yes / probably / no): _____",
            "Did the cultural frame connect naturally to the vocab being taught? (yes / loosely / no): _____",
            "Did Nine speak from insider perspective (Thai person) not tourist perspective? (yes / sort-of / no): _____",
        ],
        "friction_tags": ["part-2-culture", "part-2-bridge"],
    },
    {
        "number": 3,
        "name": "Vocab Cards",
        "questions": [
            "Were example sentences natural, not pattern-drill placeholders? (yes / sort-of / no): _____",
            "Did each vocab explanation cover usage context beyond the dictionary meaning? (yes / partial / no): _____",
            "Was the vocab load appropriate for the stated CEFR level? (too many / about right / too few): _____",
        ],
        "friction_tags": ["part-3-vocab", "part-3-examples"],
    },
    {
        "number": 4,
        "name": "Natural Listen",
        "questions": [
            "Was the dialogue Thai-only with no English translation shown? (yes / no): _____",
            "Did the dialogue use all or most of the vocab items introduced in PART 3? (yes / most / few): _____",
            "Was the comprehension test realistic -- could a viewer who just learned these words parse it? (yes / borderline / no): _____",
        ],
        "friction_tags": ["part-4-dialogue", "part-4-pace"],
    },
    {
        "number": 5,
        "name": "Breakdown",
        "questions": [
            "Did the breakdown explain WHY each grammar point works, not just WHAT it is? (yes / partial / no): _____",
            "Were the sample sentences in the breakdown distinct from the vocab-card examples? (yes / some overlap / mostly same): _____",
            "Was each breakdown segment appropriately short -- under 30 seconds per item? (yes / mostly / no): _____",
        ],
        "friction_tags": ["part-5-grammar", "part-5-samples"],
    },
    {
        "number": 6,
        "name": "Shadowing",
        "questions": [
            "Did the shadowing block have highlight lines for karaoke tracking? (yes / no): _____",
            "Was the shadowing paced correctly -- not so fast the viewer can't follow? (yes / borderline / too fast): _____",
            "Did Nine give a clear instruction before each shadowing pass? (yes / partial / no): _____",
        ],
        "friction_tags": ["part-6-pacing", "part-6-instruction"],
    },
    {
        "number": 7,
        "name": "Production Drills",
        "questions": [
            "Did the drills require genuine production, not just repetition? (yes / sort-of / no): _____",
            "Was the difficulty appropriate for someone who just heard these vocab items? (too easy / about right / too hard): _____",
            "Did each drill follow the prompt-then-pause-then-answer pattern correctly? (yes / partial / no): _____",
        ],
        "friction_tags": ["part-7-drills", "part-7-difficulty"],
    },
    {
        "number": 8,
        "name": "Recap + Teaser",
        "questions": [
            "Did the recap name every vocab item explicitly? (yes / most / no): _____",
            "Was the teaser Thai phrase genuinely useful and not contrived? (yes / borderline / no): _____",
            "Did the closing feel like Nine, not a generic 'thanks for watching'? (yes / sort-of / no): _____",
        ],
        "friction_tags": ["part-8-recap", "part-8-teaser"],
    },
]


# ---------------------------------------------------------------------------
# Annotation scaffold builder
# ---------------------------------------------------------------------------

def build_annotation_scaffold(
    variant_id: str,
    episode_id: str,
    round_num: int,
    mutate_parts: list[int] | None,
) -> str:
    """Return the full text of the annotation markdown file."""
    lines: list[str] = []
    lines.append(f"# Variant {variant_id} annotations -- {episode_id} Round {round_num}\n")
    lines.append(
        "> Annotate this variant in three zones per part. "
        "Zone 1 = forced-choice answers (fill in the blank). "
        "Zone 2 = tagged comments using `[friction: part-N-X]` or `[like: part-N-X]` blockquotes. "
        "Zone 3 = optional voice rewrite.\n"
    )
    lines.append("---\n")

    all_parts = mutate_parts is None
    active_parts = set(mutate_parts) if mutate_parts else None

    for part in PARTS:
        n = part["number"]
        lines.append(f"## PART {n} -- {part['name']}\n")

        # Zone 1: only emit questions for active parts
        show_questions = all_parts or (active_parts is not None and n in active_parts)
        lines.append("### Zone 1: Forced-choice\n")
        if show_questions:
            for q in part["questions"]:
                lines.append(f"- {q}")
        else:
            lines.append("- *(Saturated -- all variants scored well here in a prior round. Skip unless you notice a regression.)*")
        lines.append("")

        # Zone 2: tagged comments
        lines.append("### Zone 2: Comments\n")
        for tag in part["friction_tags"]:
            lines.append(f"> [friction: {tag}] _____")
            lines.append(f"> [like: {tag}] _____")
        lines.append("")

        # Zone 3: voice rewrite
        lines.append("### Zone 3: Voice rewrite (optional)\n")
        lines.append("DISPREFERRED (generated):")
        lines.append('"""\n...\n"""')
        lines.append("")
        lines.append("PREFERRED (Nine's rewrite):")
        lines.append('"""\n...\n"""')
        lines.append("")
        lines.append("---\n")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(base_prompt: str, variant: dict[str, Any], round_num: int) -> str:
    """Prepend the axis-override block to the base prompt."""
    override = variant.get("override")
    if not override:
        return base_prompt

    variant_id = variant["variantId"]
    header = (
        f"## VARIANT OVERRIDE (Round {round_num}, Variant V-{variant_id}): "
        f"{variant['label']}\n\n"
        f"{override}\n\n"
        "---\n\n"
    )
    return header + base_prompt


# ---------------------------------------------------------------------------
# Claude subprocess call (stubbed -- smoke test separately)
# ---------------------------------------------------------------------------

def call_claude(
    system_prompt: str,
    user_turn: str,
    output_path: Path,
) -> tuple[bool, str]:
    """
    Call `claude -p --output-format json` via subprocess.

    Returns (success, error_message).

    TODO: Enable this call when smoke-testing end-to-end.
    For now the subprocess is assembled but gated behind a dry-run
    so the file can be imported and tested without a live Claude CLI.
    """
    # Write the system prompt to a temp file so we can use --system-prompt-file.
    # The prompt is ~21K chars; CLI argv works on macOS but file path is more
    # robust across platforms.
    import tempfile
    sys_prompt_file = tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    )
    sys_prompt_file.write(system_prompt)
    sys_prompt_file.close()

    cmd = [
        "claude",
        "-p",
        "--output-format", "json",
        "--tools", "",  # disable tool use; force one-shot text generation
        "--disable-slash-commands",
        "--model", "sonnet",
        "--effort", "low",  # disable extended thinking; we just need text generation
        "--system-prompt-file", sys_prompt_file.name,
        user_turn,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
        )
    except FileNotFoundError:
        Path(sys_prompt_file.name).unlink(missing_ok=True)
        return False, "claude CLI not found in PATH -- install with: npm install -g @anthropic-ai/claude-code"
    except subprocess.TimeoutExpired:
        Path(sys_prompt_file.name).unlink(missing_ok=True)
        return False, "claude CLI timed out after 900 seconds"
    finally:
        Path(sys_prompt_file.name).unlink(missing_ok=True)

    if result.returncode != 0:
        return False, f"claude CLI exited {result.returncode}: {result.stderr.strip()}"

    # Parse the JSON envelope and extract the script JSON from the content
    try:
        envelope = json.loads(result.stdout)
    except json.JSONDecodeError:
        # Fallback: try to extract a JSON object from raw stdout
        raw = result.stdout.strip()
        script_json = _extract_json_object(raw)
        if script_json is None:
            return False, f"Could not parse Claude output as JSON. Raw (first 200 chars): {raw[:200]}"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(script_json, indent=2, ensure_ascii=False), encoding="utf-8")
        return True, ""

    # claude -p --output-format json wraps the response
    content = envelope.get("result") or envelope.get("content") or envelope
    if isinstance(content, str):
        script_json = _extract_json_object(content)
        if script_json is None:
            return False, f"Content field is not JSON. First 200 chars: {content[:200]}"
    elif isinstance(content, dict):
        script_json = content
    else:
        return False, f"Unexpected content type: {type(content)}"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(script_json, indent=2, ensure_ascii=False), encoding="utf-8")
    return True, ""


def _extract_json_object(text: str) -> dict | None:
    """Extract a JSON object from text. Handles raw JSON, markdown code fences, and prose+JSON mixes."""
    text = text.strip()
    if not text:
        return None
    # Try raw parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract a fenced ```json...``` or ```...``` block
    import re
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass
    # Try to find the first balanced `{...}` block in the text
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                candidate = text[start:i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    return None
    return None


# ---------------------------------------------------------------------------
# Validate via subprocess
# ---------------------------------------------------------------------------

def run_validator(script_path: Path) -> tuple[bool, str]:
    """Run validate_script.py on a variant JSON. Returns (passed, output)."""
    validator = _HERE / "validate_script.py"
    if not validator.exists():
        return False, f"validate_script.py not found at {validator}"

    result = subprocess.run(
        [sys.executable, str(validator), "--script", str(script_path)],
        capture_output=True,
        text=True,
    )
    output = result.stdout + result.stderr
    return result.returncode == 0, output


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def load_manifest(manifest_path: Path, episode_id: str) -> dict[str, Any]:
    if manifest_path.exists():
        try:
            return json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            err(f"Could not parse existing manifest at {manifest_path} -- starting fresh")
    return {
        "episodeId": episode_id,
        "currentRound": 0,
        "converged": False,
        "chosenVariant": None,
        "rounds": [],
    }


def save_manifest(manifest_path: Path, manifest: dict[str, Any]) -> None:
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def find_round_entry(manifest: dict[str, Any], round_num: int) -> dict[str, Any] | None:
    for entry in manifest.get("rounds", []):
        if entry.get("round") == round_num:
            return entry
    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate variant scripts for a YouTube episode refinement round."
    )
    parser.add_argument("--episode", required=True, help="Episode ID, e.g. YT-S01-E02")
    parser.add_argument("--round", type=int, required=True, help="Round number (1, 2, ...)")
    parser.add_argument(
        "--new",
        action="store_true",
        help="Episode does not have an existing examples JSON; use --level and --topic instead.",
    )
    parser.add_argument("--level", help="CEFR level for new episodes, e.g. A2")
    parser.add_argument("--topic", help="Topic slug for new episodes, e.g. refusing-politely")
    parser.add_argument(
        "--mutate-parts",
        help="Comma-separated part numbers to focus annotation questions on, e.g. 2,7",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing round entry in the manifest.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build prompts and scaffolds but do NOT call the Claude CLI.",
    )
    args = parser.parse_args()

    episode_id: str = args.episode
    round_num: int = args.round

    # Parse mutate-parts
    mutate_parts: list[int] | None = None
    if args.mutate_parts:
        try:
            mutate_parts = [int(p.strip()) for p in args.mutate_parts.split(",")]
        except ValueError:
            err(f"--mutate-parts must be comma-separated integers, got: {args.mutate_parts}")
            sys.exit(1)

    # Resolve episode directory
    episode_dir = _SCRIPTS_DIR / episode_id
    manifest_path = episode_dir / "manifest.json"
    round_dir = episode_dir / f"r{round_num}"

    manifest = load_manifest(manifest_path, episode_id)

    # Idempotency guard
    existing_round = find_round_entry(manifest, round_num)
    if existing_round and not args.force:
        err(
            f"Round {round_num} already exists in manifest for {episode_id}. "
            "Use --force to overwrite."
        )
        sys.exit(1)

    # Load base prompt
    if not _BASE_PROMPT_PATH.exists():
        err(f"Base prompt not found: {_BASE_PROMPT_PATH}")
        sys.exit(1)
    base_prompt = _BASE_PROMPT_PATH.read_text(encoding="utf-8")

    # Resolve episode metadata for the user turn
    if args.new:
        if not args.level or not args.topic:
            err("--new requires both --level and --topic")
            sys.exit(1)
        episode_meta: dict[str, Any] = {
            "episodeId": episode_id,
            "level": args.level,
            "topic": args.topic,
        }
        info(f"New episode: {episode_id} | level={args.level} | topic={args.topic}")
    else:
        example_path = _EXAMPLES_DIR / f"{episode_id}.json"
        if not example_path.exists():
            err(
                f"Example script not found at {example_path}. "
                "Use --new --level <level> --topic <topic> for a fresh episode."
            )
            sys.exit(1)
        try:
            existing_script = json.loads(example_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            err(f"Could not parse {example_path}: {exc}")
            sys.exit(1)
        episode_meta = {
            "episodeId": episode_id,
            "level": existing_script.get("level", ""),
            "topic": existing_script.get("topic", ""),
            "lessonRef": existing_script.get("lessonRef", ""),
            "desiredOutcome": existing_script.get("desiredOutcome", ""),
        }
        info(f"Existing episode: {episode_id} | level={episode_meta['level']} | topic={episode_meta['topic']}")

    # Build user turn (shared across all variants).
    # Strong directives: do not read files, do not reproduce existing scripts,
    # generate fresh content matching the system prompt + variant override.
    user_turn = (
        "Generate a complete YouTube episode script JSON for the episode metadata below.\n\n"
        "CRITICAL CONSTRAINTS:\n"
        "1. Do NOT read any files from disk. Do NOT use Read, Bash, Grep, or any other tool.\n"
        "2. Do NOT reproduce or copy any existing episode you may have seen. Generate FRESH content.\n"
        "3. Output ONLY a single JSON object. No markdown code fences, no prose preamble, no comments.\n"
        "4. The JSON must match the schema and variant axis settings described in the system prompt above.\n"
        "5. The vocab list should match what would be taught at this CEFR level for this topic.\n\n"
        f"Episode metadata:\n{json.dumps(episode_meta, indent=2, ensure_ascii=False)}\n\n"
        "Begin the JSON now. First character must be `{`."
    )

    round_dir.mkdir(parents=True, exist_ok=True)

    round_entry: dict[str, Any] = {
        "round": round_num,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "mutatedParts": mutate_parts if mutate_parts else list(range(1, 9)),
        "variants": [],
    }

    info(f"Generating {len(VARIANTS)} variants for {episode_id} Round {round_num}...")
    if args.dry_run:
        info("DRY RUN -- Claude CLI will not be called.")

    for variant in VARIANTS:
        variant_letter = variant["variantId"]
        full_variant_id = f"r{round_num}-{variant_letter}"
        variant_path = round_dir / f"{full_variant_id}.json"
        annotation_path = round_dir / f"{full_variant_id}-annotations.md"

        info(f"  Variant {full_variant_id}: {variant['label']}")

        # Build system prompt for this variant
        system_prompt = build_system_prompt(base_prompt, variant, round_num)

        if args.dry_run:
            info(f"    [DRY RUN] Would write to: {variant_path.relative_to(_REPO_ROOT)}")
            info(f"    System prompt length: {len(system_prompt)} chars")
            validation_passed = False
            validation_note = "dry-run"
        else:
            # Call Claude
            info(f"    Calling claude CLI...")
            success, error_msg = call_claude(system_prompt, user_turn, variant_path)
            if not success:
                err(f"    Claude call failed for {full_variant_id}: {error_msg}")
                validation_passed = False
                validation_note = f"generation-failed: {error_msg}"
            else:
                info(f"    Written: {variant_path.name}")
                # Validate
                info(f"    Validating...")
                validation_passed, validation_output = run_validator(variant_path)
                if validation_passed:
                    info(f"    Validation: PASSED")
                    validation_note = "passed"
                else:
                    info(f"    Validation: FAILED")
                    # Print truncated output so the user can see what went wrong
                    for line in validation_output.splitlines()[:20]:
                        info(f"      {line}")
                    validation_note = "failed"

        # Write annotation scaffold
        scaffold = build_annotation_scaffold(
            full_variant_id, episode_id, round_num, mutate_parts
        )
        annotation_path.write_text(scaffold, encoding="utf-8")
        info(f"    Annotation scaffold: {annotation_path.name}")

        round_entry["variants"].append({
            "variantId": full_variant_id,
            "axes": variant["axes"],
            "path": f"r{round_num}/{full_variant_id}.json",
            "validationPassed": validation_passed,
            "annotationPath": f"r{round_num}/{full_variant_id}-annotations.md",
        })

    # Update manifest
    if existing_round and args.force:
        manifest["rounds"] = [
            r for r in manifest.get("rounds", []) if r.get("round") != round_num
        ]
    manifest.setdefault("rounds", []).append(round_entry)
    manifest["currentRound"] = round_num
    save_manifest(manifest_path, manifest)
    info(f"Manifest updated: {manifest_path.relative_to(_REPO_ROOT)}")

    if args.dry_run:
        info(f"\nDry run complete. Re-run without --dry-run to call Claude.")
    else:
        passed = sum(1 for v in round_entry["variants"] if v["validationPassed"])
        total = len(round_entry["variants"])
        info(f"\nDone. {passed}/{total} variants passed validation.")
        info(f"Annotations ready in: {round_dir.relative_to(_REPO_ROOT)}/")


if __name__ == "__main__":
    main()
