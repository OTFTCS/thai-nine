#!/usr/bin/env python3
"""
judge_variant.py -- Score a YouTube episode variant against the 8-dimension rubric.

Reads judge.prompt.md, sends the variant JSON to Claude via `claude -p`, parses
the JSON score response, and writes a {variantId}-judge.json file.

Usage:
    python3 youtube/tools/judge_variant.py --variant youtube/scripts/YT-S01-E02/r1/r1-A.json
    python3 youtube/tools/judge_variant.py --variant <path> --out <output-path>
    python3 youtube/tools/judge_variant.py --batch youtube/scripts/YT-S01-E02/r1/
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
# Constants
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_YT_DIR = _HERE.parent              # youtube/
_REPO_ROOT = _YT_DIR.parent         # thai-nine/

JUDGE_PROMPT_PATH = _YT_DIR / "prompts" / "judge.prompt.md"

SCORE_KEYS: list[str] = [
    "hookQuality",
    "newItemLoad",
    "drillQuality",
    "breakdownClarity",
    "l1l2Ratio",
    "culturalAuthenticity",
    "pacingAndFlow",
    "pronunciationTeaching",
]

# Warn (but do not truncate) if input exceeds this many characters.
# 10_000 chars ~ 2500 tokens; typical script JSON is 15-25 KB.
WARN_CHARS = 40_000

LOG_PREFIX = "[judge]"


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {msg}", file=sys.stderr)


def log_warn(msg: str) -> None:
    print(f"{LOG_PREFIX} WARNING: {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------

def _call_claude(prompt_path: Path, user_content: str, attempt: int = 1) -> str:
    """Call `claude -p` with a system prompt file and return the raw stdout."""
    cmd = [
        "claude",
        "-p",
        "--output-format", "json",
        "--system-prompt-file", str(prompt_path),
    ]
    log(f"Calling claude -p (attempt {attempt}): system={prompt_path.name}, input_chars={len(user_content)}")
    result = subprocess.run(
        cmd,
        input=user_content,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log_warn(f"claude exited {result.returncode}: {result.stderr.strip()}")
    return result.stdout.strip()


def call_claude_with_retry(prompt_path: Path, user_content: str) -> tuple[str, bool]:
    """
    Call Claude up to 2 times.

    On first attempt, pass user_content as-is.
    If the response is not valid JSON, retry once with an explicit JSON-only instruction
    prepended to the user turn.

    Returns (raw_output, success). success=True means raw_output is valid JSON.
    """
    raw = _call_claude(prompt_path, user_content, attempt=1)

    # Try to extract JSON from output-format json wrapper if needed
    parsed_raw = _unwrap_claude_json_output(raw)

    if _is_json(parsed_raw):
        return parsed_raw, True

    log_warn("First attempt returned non-JSON. Retrying with explicit JSON-only instruction.")
    retry_content = (
        "IMPORTANT: Respond with JSON only. No preamble, no markdown fences, "
        "no trailing text. Start your response with { and end with }.\n\n"
        + user_content
    )
    raw2 = _call_claude(prompt_path, retry_content, attempt=2)
    parsed_raw2 = _unwrap_claude_json_output(raw2)

    if _is_json(parsed_raw2):
        return parsed_raw2, True

    return raw2, False


def _unwrap_claude_json_output(raw: str) -> str:
    """
    `claude -p --output-format json` wraps the response in a JSON envelope:
        {"type":"result","result":"...", ...}
    Extract the inner `result` string if present, otherwise return raw.
    """
    if not raw:
        return raw
    try:
        outer = json.loads(raw)
        if isinstance(outer, dict) and "result" in outer:
            return outer["result"].strip()
    except (json.JSONDecodeError, AttributeError):
        pass
    return raw


def _is_json(text: str) -> bool:
    try:
        json.loads(text)
        return True
    except (json.JSONDecodeError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Parsing and validation
# ---------------------------------------------------------------------------

def parse_judge_response(raw_json: str) -> dict[str, Any]:
    """
    Parse and validate the Claude judge response.

    Raises ValueError with a clear message if the structure is invalid.
    """
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Response is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")

    # Validate scores block
    scores = data.get("scores")
    if not isinstance(scores, dict):
        raise ValueError("Missing or invalid 'scores' key (must be an object)")

    for key in SCORE_KEYS:
        if key not in scores:
            raise ValueError(f"Missing score key: '{key}'")
        val = scores[key]
        if not isinstance(val, int) or val < 1 or val > 5:
            raise ValueError(
                f"Score '{key}' must be an integer 1-5, got {val!r}"
            )

    # Validate rationale block
    rationale = data.get("rationale")
    if not isinstance(rationale, dict):
        raise ValueError("Missing or invalid 'rationale' key (must be an object)")

    for key in SCORE_KEYS:
        if key not in rationale:
            raise ValueError(f"Missing rationale key: '{key}'")
        if not isinstance(rationale[key], str) or not rationale[key].strip():
            raise ValueError(f"Rationale for '{key}' must be a non-empty string")

    # Validate summary
    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Missing or empty 'summary' field")

    return data


# ---------------------------------------------------------------------------
# Output computation
# ---------------------------------------------------------------------------

def compute_metrics(scores: dict[str, int]) -> tuple[float, bool, bool]:
    """
    Compute average, passed, and lockEligible from a validated scores dict.

    passed       = avg >= 3.0 AND no dimension < 2
    lockEligible = avg >= 4.0 AND no dimension < 3
    """
    values = [scores[k] for k in SCORE_KEYS]
    average = round(sum(values) / len(values), 2)
    passed = average >= 3.0 and all(v >= 2 for v in values)
    lock_eligible = average >= 4.0 and all(v >= 3 for v in values)
    return average, passed, lock_eligible


def build_output(
    variant_path: Path,
    script: dict[str, Any],
    judge_data: dict[str, Any],
) -> dict[str, Any]:
    """Assemble the final judge output document."""
    scores = judge_data["scores"]
    average, passed, lock_eligible = compute_metrics(scores)

    variant_id = variant_path.stem           # e.g. r1-A
    episode_id = script.get("episodeId", "UNKNOWN")

    return {
        "variantId": variant_id,
        "episodeId": episode_id,
        "judgedAt": datetime.now(timezone.utc).isoformat(),
        "scores": scores,
        "rationale": judge_data["rationale"],
        "summary": judge_data["summary"],
        "average": average,
        "passed": passed,
        "lockEligible": lock_eligible,
    }


# ---------------------------------------------------------------------------
# Console table
# ---------------------------------------------------------------------------

def print_summary_table(output: dict[str, Any]) -> None:
    """Print a readable summary table to stdout."""
    scores = output["scores"]
    print(f"\nJudge results: {output['variantId']} ({output['episodeId']})")
    print(f"Judged at:     {output['judgedAt']}")
    print()
    print(f"  {'Dimension':<28}  {'Score':>5}")
    print(f"  {'-' * 28}  {'-----':>5}")
    labels = {
        "hookQuality":           "Hook quality",
        "newItemLoad":           "New-item load",
        "drillQuality":          "Drill quality and variety",
        "breakdownClarity":      "Breakdown clarity",
        "l1l2Ratio":             "L1/L2 ratio",
        "culturalAuthenticity":  "Cultural authenticity",
        "pacingAndFlow":         "Pacing and flow",
        "pronunciationTeaching": "Pronunciation teaching",
    }
    for key in SCORE_KEYS:
        print(f"  {labels[key]:<28}  {scores[key]:>5}")
    print(f"  {'-' * 28}  {'-----':>5}")
    print(f"  {'Average':<28}  {output['average']:>5.2f}")
    print()

    status_parts = []
    if output["lockEligible"]:
        status_parts.append("LOCK CANDIDATE (avg >= 4.0, no dim < 3)")
    elif output["passed"]:
        status_parts.append("PASS (avg >= 3.0, no dim < 2)")
    else:
        # Explain why it failed
        reasons: list[str] = []
        if output["average"] < 3.0:
            reasons.append(f"avg {output['average']:.2f} < 3.0")
        below_2 = [k for k in SCORE_KEYS if scores[k] < 2]
        if below_2:
            reasons.append(f"dim below 2: {', '.join(below_2)}")
        status_parts.append(f"NO PASS ({'; '.join(reasons)})")

    print(f"  Status: {status_parts[0]}")
    print()


# ---------------------------------------------------------------------------
# Core judge function
# ---------------------------------------------------------------------------

def judge_variant(
    variant_path: Path,
    out_path: Path | None = None,
) -> int:
    """
    Judge a single variant. Returns exit code (0=success, 1=failure).
    """
    if not variant_path.exists():
        log(f"ERROR: variant file not found: {variant_path}")
        return 1

    if not JUDGE_PROMPT_PATH.exists():
        log(f"ERROR: judge prompt not found: {JUDGE_PROMPT_PATH}")
        return 1

    # Load and serialise variant JSON
    try:
        script: dict[str, Any] = json.loads(variant_path.read_text())
    except json.JSONDecodeError as exc:
        log(f"ERROR: invalid JSON in variant file: {exc}")
        return 1

    user_content = json.dumps(script, ensure_ascii=False, indent=2)

    if len(user_content) > WARN_CHARS:
        log_warn(
            f"Input is {len(user_content)} chars ({len(user_content)//4} est. tokens). "
            "This is large but will not be truncated."
        )

    # Call Claude
    raw_output, success = call_claude_with_retry(JUDGE_PROMPT_PATH, user_content)

    if not success:
        # Save raw output for debugging
        raw_path = variant_path.parent / f"{variant_path.stem}-judge.raw.txt"
        raw_path.write_text(raw_output, encoding="utf-8")
        log(f"ERROR: Claude returned non-JSON after 2 attempts. Raw output saved to {raw_path}")
        return 1

    # Parse and validate
    try:
        judge_data = parse_judge_response(raw_output)
    except ValueError as exc:
        log(f"ERROR: Judge response validation failed: {exc}")
        raw_path = variant_path.parent / f"{variant_path.stem}-judge.raw.txt"
        raw_path.write_text(raw_output, encoding="utf-8")
        log(f"Raw output saved to {raw_path}")
        return 1

    # Build output document
    output = build_output(variant_path, script, judge_data)

    # Determine output path
    if out_path is None:
        out_path = variant_path.parent / f"{variant_path.stem}-judge.json"

    out_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    log(f"Judge output written to {out_path}")

    # Print summary table
    print_summary_table(output)

    return 0


# ---------------------------------------------------------------------------
# Batch mode
# ---------------------------------------------------------------------------

def judge_batch(batch_dir: Path) -> int:
    """Judge all *.json variant files in a directory (excludes *-judge.json)."""
    if not batch_dir.is_dir():
        log(f"ERROR: batch directory not found: {batch_dir}")
        return 1

    candidates = sorted(
        p for p in batch_dir.glob("*.json")
        if not p.stem.endswith("-judge")
    )

    if not candidates:
        log(f"No variant JSON files found in {batch_dir}")
        return 1

    log(f"Batch judging {len(candidates)} variant(s) in {batch_dir}")

    exit_codes: list[int] = []
    for path in candidates:
        log(f"--- Judging {path.name} ---")
        code = judge_variant(path)
        exit_codes.append(code)

    failed = sum(1 for c in exit_codes if c != 0)
    passed = len(exit_codes) - failed
    log(f"Batch complete: {passed} passed, {failed} failed out of {len(exit_codes)}")
    return 1 if failed else 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Score a YouTube episode variant against the 8-dimension rubric.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 youtube/tools/judge_variant.py --variant youtube/scripts/YT-S01-E02/r1/r1-A.json
  python3 youtube/tools/judge_variant.py --variant <path> --out <output-path>
  python3 youtube/tools/judge_variant.py --batch youtube/scripts/YT-S01-E02/r1/
""",
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--variant",
        type=Path,
        metavar="PATH",
        help="Path to a single variant JSON file to judge.",
    )
    group.add_argument(
        "--batch",
        type=Path,
        metavar="DIR",
        help="Judge all *.json variant files in a directory.",
    )

    parser.add_argument(
        "--out",
        type=Path,
        metavar="PATH",
        default=None,
        help="Output path for the judge JSON (single mode only). "
             "Default: <variant>-judge.json next to the variant file.",
    )

    args = parser.parse_args()

    if args.batch is not None:
        if args.out is not None:
            parser.error("--out cannot be used with --batch")
        code = judge_batch(args.batch)
    else:
        code = judge_variant(args.variant, args.out)

    sys.exit(code)


if __name__ == "__main__":
    main()
