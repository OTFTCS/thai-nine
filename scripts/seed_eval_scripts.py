#!/usr/bin/env python3
"""One-off backfill: insert creator_eval_scripts rows for every script in the
named eval run directories. Used to bootstrap the feedback UI for runs that
were generated before the run-claude.ts pinning code existed.

The pinning code captures prompt_sha at generation time going forward; this
script captures whatever the prompt SHA is right now, which is fine for the
2026-04-26 eval set because those prompts haven't been edited since.

Usage:
    python3 scripts/seed_eval_scripts.py \
        --type course --run 2026-04-26-prompt-eval \
        --prompt-path course/prompts/agent-prompts/stage-1-script-generation.prompt.md

    python3 scripts/seed_eval_scripts.py \
        --type youtube --run 2026-04-26-prompt-eval \
        --prompt-path youtube/prompts/script-writing.prompt.md
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _supabase_rest import insert  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent

STUB_BYTE_THRESHOLD = 200

SUFFIX_BY_TYPE = {
    "youtube": ".json",
    "course": ".script.md",
}


def git_sha_for_path(prompt_path: str) -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", f"HEAD:{prompt_path}"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return ""
        return result.stdout.strip()
    except Exception:
        return ""


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--type", choices=("youtube", "course"), required=True)
    p.add_argument("--run", required=True, help="eval run directory name")
    p.add_argument(
        "--prompt-path",
        required=True,
        help="repo-relative path to the prompt that produced these scripts",
    )
    p.add_argument(
        "--include-stubs",
        action="store_true",
        help="Also seed scripts under the 200-byte stub threshold (default: skip)",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    suffix = SUFFIX_BY_TYPE[args.type]
    run_dir = REPO_ROOT / args.type / "experiments" / args.run
    if not run_dir.is_dir():
        print(f"ERROR: run dir not found: {run_dir}", file=sys.stderr)
        return 2

    prompt_full = REPO_ROOT / args.prompt_path
    if not prompt_full.is_file():
        print(f"ERROR: prompt file not found: {prompt_full}", file=sys.stderr)
        return 2

    prompt_sha = git_sha_for_path(args.prompt_path)
    if not prompt_sha:
        print(
            f"WARN: could not resolve git SHA for {args.prompt_path}; "
            "seeding with empty prompt_sha (the file is not tracked or not committed).",
            file=sys.stderr,
        )

    inserted = 0
    skipped_stub = 0
    for entry in sorted(run_dir.iterdir()):
        if not entry.is_file():
            continue
        if not entry.name.endswith(suffix):
            continue
        if entry.name.startswith("_"):
            continue
        script_id = entry.name[: -len(suffix)]
        size = entry.stat().st_size
        if not args.include_stubs and size < STUB_BYTE_THRESHOLD:
            print(f"SKIP {script_id} (stub, {size} bytes)")
            skipped_stub += 1
            continue

        generated_at = datetime.fromtimestamp(entry.stat().st_mtime, tz=timezone.utc).isoformat()
        row = {
            "script_type": args.type,
            "eval_run_id": args.run,
            "script_id": script_id,
            "prompt_path": args.prompt_path,
            "prompt_sha": prompt_sha,
            "generated_at": generated_at,
        }
        try:
            insert(
                "creator_eval_scripts",
                row,
                on_conflict="script_type,eval_run_id,script_id",
            )
            print(f"OK   {script_id}")
            inserted += 1
        except Exception as e:
            print(f"FAIL {script_id}: {e}", file=sys.stderr)

    print(f"\nSeeded {inserted} scripts. Skipped {skipped_stub} stub(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
