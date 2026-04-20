#!/usr/bin/env python3
"""Fix double-tap off-by-one errors in phrase timestamp files.

Detects consecutive phrase pairs with gaps < THRESHOLD (default 0.5s),
which indicate a double-tap during karaoke timestamping. For each
double-tap, shifts all subsequent timestamps back by one position
so each phrase gets the timestamp that was actually meant for it.

Usage:
    python3 youtube/tools/fix_phrase_timestamps.py \
        --phrases youtube/phrases/YT-S01-E01.phrases.timed.json

    # Dry run (show what would change without writing):
    ... --dry-run

    # Custom threshold:
    ... --threshold 0.4
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def detect_double_taps(
    chunks: list[dict], threshold: float = 0.5
) -> list[int]:
    """Find indices where a double-tap occurred (gap < threshold).

    Only considers non-silence chunks with displayStart set.
    Returns indices into the FULL chunks list (not filtered).
    """
    # Build list of (full_index, displayStart) for timed non-silence chunks
    timed: list[tuple[int, float]] = []
    for i, c in enumerate(chunks):
        if c.get("lang") == "silence":
            continue
        ds = c.get("displayStart")
        if ds is not None:
            timed.append((i, ds))

    # Sort by displayStart (should already be sorted, but be safe)
    timed.sort(key=lambda x: x[1])

    # Find consecutive pairs with gap < threshold
    double_taps: list[int] = []
    for j in range(1, len(timed)):
        gap = timed[j][1] - timed[j - 1][1]
        if gap < threshold:
            full_idx = timed[j][0]
            double_taps.append(full_idx)
            chunk = chunks[full_idx]
            prev = chunks[timed[j - 1][0]]
            print(
                f"  ⚠ Double-tap at {chunk['chunkId']} "
                f"(gap={gap:.3f}s): "
                f'"{prev["text"][:30]}" → "{chunk["text"][:30]}"'
            )

    return double_taps


def apply_cumulative_shifts(
    chunks: list[dict], double_tap_indices: list[int]
) -> int:
    """Remove spurious double-tap timestamps and reassign.

    Each double-tap position has a spurious timestamp (tapped too fast).
    We remove those timestamps from the pool, then reassign the remaining
    good timestamps to chunks in order. The last N chunks get estimates.

    Returns number of chunks shifted.
    """
    # Build list of all timed non-silence chunk indices (in order)
    timed_indices: list[int] = []
    for i, c in enumerate(chunks):
        if c.get("lang") == "silence":
            continue
        if c.get("displayStart") is not None:
            timed_indices.append(i)

    # Convert double-tap full indices to positions in timed_indices
    timed_pos_set = {idx for idx in enumerate(timed_indices)}
    double_tap_positions: set[int] = set()
    for dt_idx in double_tap_indices:
        for pos, full_idx in enumerate(timed_indices):
            if full_idx == dt_idx:
                double_tap_positions.add(pos)
                break

    # Read all original timestamps, then REMOVE the spurious ones
    all_ts = [chunks[i]["displayStart"] for i in timed_indices]
    good_ts = [ts for pos, ts in enumerate(all_ts) if pos not in double_tap_positions]

    # Estimate timestamps for the tail (one per removed double-tap)
    for _ in double_tap_positions:
        last = good_ts[-1] if good_ts else 0.0
        good_ts.append(last + 2.0)

    # Reassign: chunks before the first double-tap keep their timestamps.
    # From the first double-tap onward, assign from the good_ts pool.
    first_affected = min(double_tap_positions)
    shifted = 0

    for pos in range(len(timed_indices)):
        if pos < first_affected:
            continue  # Unchanged

        # pos maps to good_ts[pos] (since we removed N entries and appended N)
        new_ts = good_ts[pos]
        old_ts = all_ts[pos]
        if abs(new_ts - old_ts) > 0.001:
            chunks[timed_indices[pos]]["displayStart"] = new_ts
            shifted += 1

    return shifted


def fix_timestamps(
    phrases_path: Path,
    *,
    threshold: float = 0.5,
    dry_run: bool = False,
) -> None:
    """Detect and fix double-tap errors in a phrases timed JSON file."""
    data = json.loads(phrases_path.read_text(encoding="utf-8"))
    chunks = data["chunks"]

    timed_count = sum(
        1
        for c in chunks
        if c.get("lang") != "silence" and c.get("displayStart") is not None
    )
    print(f"Loaded {len(chunks)} chunks ({timed_count} timed)")

    # Detect double-taps
    double_taps = detect_double_taps(chunks, threshold)

    if not double_taps:
        print("✓ No double-taps detected — timestamps look clean")
        return

    print(f"\nFound {len(double_taps)} double-tap(s)")

    if dry_run:
        print("\n[DRY RUN] Would fix the following:")
        for idx in double_taps:
            c = chunks[idx]
            print(f"  - Shift timestamps from {c['chunkId']} onward (+1)")
        print(f"  Total cumulative shift at end: +{len(double_taps)}")
        return

    # Backup original BEFORE any changes
    backup = phrases_path.with_suffix(".pre-fix.json")
    shutil.copy2(phrases_path, backup)
    print(f"\n  Backup saved: {backup.name}")

    # Apply all shifts simultaneously
    shifted = apply_cumulative_shifts(chunks, double_taps)
    print(f"  → Shifted {shifted} timestamps ({len(double_taps)} double-taps)")

    # Write corrected file
    data["chunks"] = chunks
    phrases_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"  ✓ Fixed timestamps in {phrases_path.name}")

    # Verify: re-detect to confirm no more double-taps
    data2 = json.loads(phrases_path.read_text(encoding="utf-8"))
    remaining = detect_double_taps(data2["chunks"], threshold)
    if remaining:
        print(f"\n  ⚠ {len(remaining)} double-tap(s) still remain after fix!")
    else:
        print("  ✓ Verification passed — no remaining double-taps")


def main():
    parser = argparse.ArgumentParser(
        description="Fix double-tap timestamp errors in phrase files",
    )
    parser.add_argument(
        "--phrases",
        required=True,
        help="Path to .phrases.timed.json file",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.5,
        help="Gap threshold for double-tap detection (default: 0.5s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing",
    )
    args = parser.parse_args()

    fix_timestamps(
        Path(args.phrases),
        threshold=args.threshold,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
