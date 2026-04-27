#!/usr/bin/env python3
"""
synthesize_round.py -- Build round N+1 from round N's annotations and judge scores.

Reads all *-annotations.md and *-judge.json files for a given round, runs
consensus extraction across variants, builds a structured feedback digest, and
(unless --no-generate) invokes draft_variants.py to generate round N+1 variants.

Usage:
    python3 youtube/tools/synthesize_round.py --episode YT-S01-E02 --round 1
    python3 youtube/tools/synthesize_round.py --episode YT-S01-E02 --round 1 --no-generate
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_YT_DIR = _HERE.parent               # youtube/
_REPO_ROOT = _YT_DIR.parent          # thai-nine/

LOG_PREFIX = "[synthesize]"


# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {msg}", file=sys.stderr)


def warn(msg: str) -> None:
    print(f"{LOG_PREFIX} WARNING: {msg}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class ForcedChoiceAnswer(NamedTuple):
    part_num: int           # 1-based from "## PART N"
    part_name: str
    question: str
    answer: str             # normalised lowercase


class FrictionTag(NamedTuple):
    part_ref: str           # raw "part-N-X" string from tag
    tag_type: str           # "friction" or "like"
    text: str
    is_tagged: bool         # False = untagged free text, low priority


class VoiceRewrite(NamedTuple):
    dispreferred: str
    preferred: str


class VariantAnnotation(NamedTuple):
    variant_id: str
    forced_choices: list[ForcedChoiceAnswer]
    friction_tags: list[FrictionTag]
    voice_rewrites: list[VoiceRewrite]


class JudgeScore(NamedTuple):
    variant_id: str
    scores: dict[str, float]   # dimension -> score
    average: float
    passed: bool
    rationale: dict[str, str]
    summary: str


# ---------------------------------------------------------------------------
# Annotation parser
# ---------------------------------------------------------------------------

# Matches "## PART N -- Name" (N is one or more digits, Name is everything after)
_PART_HEADER_RE = re.compile(r"^##\s+PART\s+(\d+)\s*[--\-]+\s*(.+)$", re.IGNORECASE)

# Matches forced-choice lines: "- Question text (a / b / c): answer"
# The answer is everything after the final colon on the line.
_FORCED_CHOICE_RE = re.compile(r"^-\s+(.+?)\s*:\s*(.*)$")

# Matches tagged blockquote lines: "> [friction: part-N-X] free text"
_TAG_RE = re.compile(r"^>\s*\[(friction|like):\s*(part-[\w-]+)\]\s*(.*)", re.IGNORECASE)

# Untagged blockquote (no bracket tag) -- low-priority signal
_UNTAGGED_BLOCKQUOTE_RE = re.compile(r"^>\s+(?!\[)(.*)")

# Empty/template placeholders in Zone 3 voice rewrites or Zone 2 comment slots.
# Matches ellipsis-only content, blank-line markers, and form blanks like _____.
_PLACEHOLDER_RE = re.compile(r"^\s*[\.…_\-]+\s*$")


def _is_placeholder(text: str) -> bool:
    """Return True if text is empty, dots/ellipsis, or form blanks (`_____`, etc.)."""
    stripped = text.strip()
    return not stripped or bool(_PLACEHOLDER_RE.match(stripped))


def parse_annotations(path: Path, variant_id: str) -> VariantAnnotation:
    """Parse a three-zone annotations markdown file for one variant."""
    forced_choices: list[ForcedChoiceAnswer] = []
    friction_tags: list[FrictionTag] = []
    voice_rewrites: list[VoiceRewrite] = []

    if not path.exists():
        log(f"  No annotation file for {variant_id} -- treating as no comment")
        return VariantAnnotation(
            variant_id=variant_id,
            forced_choices=[],
            friction_tags=[],
            voice_rewrites=[],
        )

    lines = path.read_text(encoding="utf-8").splitlines()

    current_part_num = 0
    current_part_name = ""
    in_zone3 = False
    dispreferred_lines: list[str] = []
    preferred_lines: list[str] = []
    zone3_state = "none"  # "none" | "dispreferred" | "preferred"

    for raw_line in lines:
        line = raw_line.rstrip()

        # Detect part headers
        m = _PART_HEADER_RE.match(line)
        if m:
            # Flush any in-progress Zone 3 rewrite before changing part
            _flush_rewrite(dispreferred_lines, preferred_lines, voice_rewrites)
            dispreferred_lines = []
            preferred_lines = []
            zone3_state = "none"
            in_zone3 = False

            current_part_num = int(m.group(1))
            current_part_name = m.group(2).strip()
            continue

        # Detect Zone 3 transitions
        if line.strip().startswith("DISPREFERRED"):
            in_zone3 = True
            # Flush previous pair if any
            _flush_rewrite(dispreferred_lines, preferred_lines, voice_rewrites)
            dispreferred_lines = []
            preferred_lines = []
            zone3_state = "dispreferred"
            continue

        if line.strip().startswith("PREFERRED"):
            zone3_state = "preferred"
            continue

        if in_zone3:
            if zone3_state == "dispreferred":
                dispreferred_lines.append(line)
            elif zone3_state == "preferred":
                preferred_lines.append(line)
            # Skip Zone 3 lines from other parsing
            continue

        # Zone 1: forced-choice lines
        m = _FORCED_CHOICE_RE.match(line)
        if m and current_part_num > 0:
            question_text = m.group(1).strip()
            answer_raw = m.group(2).strip()
            # Skip template blanks
            if answer_raw and answer_raw not in ("_____", "___", ""):
                forced_choices.append(ForcedChoiceAnswer(
                    part_num=current_part_num,
                    part_name=current_part_name,
                    question=question_text,
                    answer=answer_raw.lower().strip(),
                ))
            continue

        # Zone 2: tagged blockquote
        m = _TAG_RE.match(line)
        if m:
            tag_type = m.group(1).lower()
            part_ref = m.group(2).strip()
            text = m.group(3).strip()
            # Skip empty template placeholders (e.g. "_____" left in scaffold)
            if _is_placeholder(text):
                continue
            friction_tags.append(FrictionTag(
                part_ref=part_ref,
                tag_type=tag_type,
                text=text,
                is_tagged=True,
            ))
            continue

        # Zone 2: untagged blockquote (low-priority)
        m = _UNTAGGED_BLOCKQUOTE_RE.match(line)
        if m:
            text = m.group(1).strip()
            if text and current_part_num > 0 and not _is_placeholder(text):
                part_ref = f"part-{current_part_num}"
                friction_tags.append(FrictionTag(
                    part_ref=part_ref,
                    tag_type="friction",
                    text=f"[LOW-PRIORITY/UNTAGGED] {text}",
                    is_tagged=False,
                ))
            continue

    # Flush final Zone 3 block
    _flush_rewrite(dispreferred_lines, preferred_lines, voice_rewrites)

    return VariantAnnotation(
        variant_id=variant_id,
        forced_choices=forced_choices,
        friction_tags=friction_tags,
        voice_rewrites=voice_rewrites,
    )


def _strip_quote_markers(lines: list[str]) -> str:
    """Strip triple-quote fence markers and placeholder lines, return joined content."""
    cleaned: list[str] = []
    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if s in ('"""', "'''", "```"):
            continue
        if _is_placeholder(s):
            continue
        cleaned.append(raw)
    return "\n".join(cleaned).strip()


def _flush_rewrite(
    dispreferred_lines: list[str],
    preferred_lines: list[str],
    out: list[VoiceRewrite],
) -> None:
    """Flush a dispreferred/preferred pair to out if both have real (non-placeholder) content."""
    dis = _strip_quote_markers(dispreferred_lines)
    pref = _strip_quote_markers(preferred_lines)
    if dis and pref:
        out.append(VoiceRewrite(dispreferred=dis, preferred=pref))


# ---------------------------------------------------------------------------
# Judge score loader
# ---------------------------------------------------------------------------

def load_judge_scores(path: Path, variant_id: str) -> JudgeScore | None:
    """Load judge JSON for a variant. Returns None with a warning if missing."""
    if not path.exists():
        warn(f"No judge file for {variant_id} at {path} -- skipping scores")
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        warn(f"Invalid JSON in {path}: {exc}")
        return None

    scores = data.get("scores", {})
    # Compute average from whatever dimensions are present
    numeric_scores = [v for v in scores.values() if isinstance(v, (int, float))]
    avg = round(sum(numeric_scores) / len(numeric_scores), 2) if numeric_scores else 0.0

    return JudgeScore(
        variant_id=variant_id,
        scores=scores,
        average=data.get("average", avg),
        passed=data.get("passed", False),
        rationale=data.get("rationale", {}),
        summary=data.get("summary", ""),
    )


# ---------------------------------------------------------------------------
# Consensus extraction
# ---------------------------------------------------------------------------

# Positive answers that indicate a part is "working" (saturated)
_POSITIVE_ANSWERS = frozenset({
    "yes", "about right", "appropriate", "good", "correct",
    "partial-positive", "mostly", "mostly yes",
})

# Negative answers that flag a part as needing mutation
_NEGATIVE_ANSWERS = frozenset({
    "no", "too easy", "too hard", "sort-of", "partial", "not quite",
    "incorrect", "missing", "poor", "weak",
})


def extract_consensus(
    annotations: list[VariantAnnotation],
    judge_scores: list[JudgeScore | None],
) -> dict:
    """
    Run consensus extraction across all variants.

    Returns a dict with:
        part_status:  {part_num -> {"status": "preserve"|"mutate"|"mixed", "signals": [...]}}
        friction_counts: {part_ref -> [FrictionTag, ...]} (tagged only, sorted by frequency)
        like_counts:  {part_ref -> [FrictionTag, ...]}
        low_priority: [FrictionTag, ...]
        voice_rewrites: [VoiceRewrite, ...]
        judge_averages: {dimension -> float}
        low_scoring_dimensions: [str, ...]  (avg < 3)
    """
    # -- Zone 1 forced-choice consensus --
    # Key: (part_num, question_text) -> list of answers
    fc_answers: dict[tuple[int, str], list[str]] = defaultdict(list)
    part_names: dict[int, str] = {}

    for ann in annotations:
        for fc in ann.forced_choices:
            key = (fc.part_num, fc.question)
            fc_answers[key].append(fc.answer)
            part_names[fc.part_num] = fc.part_name

    # Per part, derive status from majority of forced-choice signals
    part_signals: dict[int, list[str]] = defaultdict(list)  # part_num -> ["preserve"|"mutate"]

    for (part_num, question), answers in fc_answers.items():
        if not answers:
            continue
        modal_answer, modal_count = Counter(answers).most_common(1)[0]
        total = len(answers)
        consensus_strength = modal_count / total

        if consensus_strength >= 0.75:  # 3 of 4 agree
            if modal_answer in _POSITIVE_ANSWERS:
                part_signals[part_num].append("preserve")
                log(f"  Part {part_num}: Q='{question[:60]}' -> consensus POSITIVE ({modal_answer}, {modal_count}/{total})")
            elif modal_answer in _NEGATIVE_ANSWERS:
                part_signals[part_num].append("mutate")
                log(f"  Part {part_num}: Q='{question[:60]}' -> consensus NEGATIVE ({modal_answer}, {modal_count}/{total})")
            else:
                log(f"  Part {part_num}: Q='{question[:60]}' -> consensus NEUTRAL ({modal_answer}, {modal_count}/{total})")
        else:
            log(f"  Part {part_num}: Q='{question[:60]}' -> no consensus (top: {modal_answer}, {modal_count}/{total})")

    # -- Zone 2 tag counts --
    friction_by_part: dict[str, list[FrictionTag]] = defaultdict(list)
    like_by_part: dict[str, list[FrictionTag]] = defaultdict(list)
    low_priority: list[FrictionTag] = []

    for ann in annotations:
        for tag in ann.friction_tags:
            if not tag.is_tagged:
                low_priority.append(tag)
                continue
            if tag.tag_type == "friction":
                friction_by_part[tag.part_ref].append(tag)
            elif tag.tag_type == "like":
                like_by_part[tag.part_ref].append(tag)

    # Parts with 2+ friction tags from tagged comments -> mutation target
    # Nine's friction tag overrides judge score (anti-pattern rule 4)
    for part_ref, tags in friction_by_part.items():
        part_num_match = re.match(r"part-(\d+)", part_ref)
        if part_num_match and len(tags) >= 2:
            p = int(part_num_match.group(1))
            part_signals[p].append("mutate")
            log(f"  Part {p}: friction tag count {len(tags)} from tagged comments -> mutate signal")

    for part_ref, tags in like_by_part.items():
        part_num_match = re.match(r"part-(\d+)", part_ref)
        if part_num_match and len(tags) >= 2:
            p = int(part_num_match.group(1))
            part_signals[p].append("preserve")

    # -- Determine final part status --
    all_parts = set(part_names.keys()) | set(part_signals.keys())
    part_status: dict[int, dict] = {}

    for part_num in sorted(all_parts):
        signals = part_signals.get(part_num, [])
        name = part_names.get(part_num, "")
        mutate_count = signals.count("mutate")
        preserve_count = signals.count("preserve")

        if not signals:
            status = "mixed"
        elif mutate_count > preserve_count:
            status = "mutate"
        elif preserve_count > mutate_count:
            status = "preserve"
        else:
            status = "mixed"

        part_status[part_num] = {
            "name": name,
            "status": status,
            "mutate_signals": mutate_count,
            "preserve_signals": preserve_count,
            "raw_signals": signals,
        }

    # -- Judge dimension averages --
    dim_scores: dict[str, list[float]] = defaultdict(list)
    for js in judge_scores:
        if js is None:
            continue
        for dim, score in js.scores.items():
            if isinstance(score, (int, float)):
                dim_scores[dim].append(float(score))

    judge_averages = {
        dim: round(sum(vals) / len(vals), 2)
        for dim, vals in dim_scores.items()
        if vals
    }
    low_scoring_dims = [dim for dim, avg in judge_averages.items() if avg < 3.0]

    # -- Voice rewrites (all variants, deduplicated by dispreferred text) --
    seen_dis: set[str] = set()
    all_rewrites: list[VoiceRewrite] = []
    for ann in annotations:
        for rw in ann.voice_rewrites:
            key = rw.dispreferred[:80]
            if key not in seen_dis:
                seen_dis.add(key)
                all_rewrites.append(rw)

    return {
        "part_status": part_status,
        "friction_by_part": dict(friction_by_part),
        "like_by_part": dict(like_by_part),
        "low_priority": low_priority,
        "voice_rewrites": all_rewrites,
        "judge_averages": judge_averages,
        "low_scoring_dims": low_scoring_dims,
    }


# ---------------------------------------------------------------------------
# Digest builder
# ---------------------------------------------------------------------------

def build_digest(
    episode_id: str,
    round_num: int,
    annotations: list[VariantAnnotation],
    judge_scores: list[JudgeScore | None],
    consensus: dict,
) -> str:
    """Build the feedback-r{N}.md digest as a string."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    lines: list[str] = []

    lines.append(f"# Round {round_num} Feedback Digest -- {episode_id}")
    lines.append(f"")
    lines.append(f"Generated: {ts}")
    lines.append(f"")

    # -- Per-variant judge scores table --
    lines.append(f"## Per-Variant Judge Scores")
    lines.append(f"")
    present_scores = [js for js in judge_scores if js is not None]
    if present_scores:
        # Collect all dimension names
        all_dims: list[str] = []
        for js in present_scores:
            for d in js.scores:
                if d not in all_dims:
                    all_dims.append(d)
        header = "| Variant | " + " | ".join(all_dims) + " | Average | Passed |"
        sep = "| --- | " + " | ".join("---" for _ in all_dims) + " | --- | --- |"
        lines.append(header)
        lines.append(sep)
        for js in present_scores:
            score_cells = " | ".join(str(js.scores.get(d, "n/a")) for d in all_dims)
            passed_str = "yes" if js.passed else "no"
            lines.append(f"| {js.variant_id} | {score_cells} | {js.average} | {passed_str} |")
        lines.append(f"")
        if present_scores:
            lines.append(f"**Dimension averages across variants:**")
            for dim, avg in consensus["judge_averages"].items():
                flag = " <-- BELOW 3 - FLAG" if avg < 3.0 else ""
                lines.append(f"- {dim}: {avg}{flag}")
        if consensus["low_scoring_dims"]:
            lines.append(f"")
            lines.append(f"Low-scoring dimensions (avg < 3): {', '.join(consensus['low_scoring_dims'])}")
    else:
        lines.append(f"_No judge scores available for round {round_num}._")
    lines.append(f"")

    # -- Consensus signals per part --
    lines.append(f"## Consensus Signals per Part")
    lines.append(f"")
    part_status = consensus["part_status"]
    if part_status:
        for part_num in sorted(part_status.keys()):
            info = part_status[part_num]
            name = info["name"] or f"Part {part_num}"
            status = info["status"].upper()
            mutate = info["mutate_signals"]
            preserve = info["preserve_signals"]
            lines.append(f"### PART {part_num} -- {name}")
            lines.append(f"")
            lines.append(f"Status: **{status}** (mutate signals: {mutate}, preserve signals: {preserve})")
            lines.append(f"")
    else:
        lines.append(f"_No forced-choice annotations parsed._")
    lines.append(f"")

    # -- Friction tags ranked --
    lines.append(f"## Friction Tags (Ranked by Frequency)")
    lines.append(f"")
    friction_by_part = consensus["friction_by_part"]
    if friction_by_part:
        sorted_friction = sorted(friction_by_part.items(), key=lambda x: -len(x[1]))
        for part_ref, tags in sorted_friction:
            lines.append(f"### {part_ref} ({len(tags)} friction tag(s))")
            lines.append(f"")
            for tag in tags:
                lines.append(f"- [{tag.tag_type}: {tag.part_ref}] {tag.text}")
            lines.append(f"")
    else:
        lines.append(f"_No friction tags found._")
    lines.append(f"")

    # -- Like tags ranked --
    lines.append(f"## Like Tags (Ranked by Frequency)")
    lines.append(f"")
    like_by_part = consensus["like_by_part"]
    if like_by_part:
        sorted_likes = sorted(like_by_part.items(), key=lambda x: -len(x[1]))
        for part_ref, tags in sorted_likes:
            lines.append(f"### {part_ref} ({len(tags)} like tag(s))")
            lines.append(f"")
            for tag in tags:
                lines.append(f"- [{tag.tag_type}: {tag.part_ref}] {tag.text}")
            lines.append(f"")
    else:
        lines.append(f"_No like tags found._")
    lines.append(f"")

    # -- Low-priority untagged comments --
    low_priority = consensus["low_priority"]
    if low_priority:
        lines.append(f"## Low-Priority Signals (Untagged Free-Text)")
        lines.append(f"")
        lines.append(f"_These carry less weight than tagged comments._")
        lines.append(f"")
        for tag in low_priority:
            lines.append(f"- {tag.part_ref}: {tag.text}")
        lines.append(f"")

    # -- Nine's voice rewrites --
    lines.append(f"## Nine's Voice Rewrites (Few-Shot Examples)")
    lines.append(f"")
    rewrites = consensus["voice_rewrites"]
    if rewrites:
        for i, rw in enumerate(rewrites, 1):
            lines.append(f"### Rewrite {i}")
            lines.append(f"")
            lines.append(f"DISPREFERRED:")
            lines.append(f"")
            lines.append(rw.dispreferred)
            lines.append(f"")
            lines.append(f"PREFERRED:")
            lines.append(f"")
            lines.append(rw.preferred)
            lines.append(f"")
    else:
        lines.append(f"_No voice rewrites provided for round {round_num}._")
    lines.append(f"")

    # -- Regeneration instruction --
    lines.append(f"## Regeneration Instruction for Round {round_num + 1}")
    lines.append(f"")
    preserve_parts = [
        f"PART {pn} ({info['name']})"
        for pn, info in sorted(part_status.items())
        if info["status"] == "preserve"
    ]
    mutate_parts = [
        f"PART {pn} ({info['name']})"
        for pn, info in sorted(part_status.items())
        if info["status"] == "mutate"
    ]
    mixed_parts = [
        f"PART {pn} ({info['name']})"
        for pn, info in sorted(part_status.items())
        if info["status"] == "mixed"
    ]

    regen_lines: list[str] = []

    if preserve_parts:
        regen_lines.append(f"Preserve: {', '.join(preserve_parts)} (consensus satisfied).")
    if mutate_parts:
        regen_lines.append(f"Mutate: {', '.join(mutate_parts)} (friction or negative signals).")
    if mixed_parts:
        regen_lines.append(f"Mixed/unclear: {', '.join(mixed_parts)} (insufficient signal -- use judgment).")

    if consensus["low_scoring_dims"]:
        regen_lines.append(
            f"Low judge dimensions to address: {', '.join(consensus['low_scoring_dims'])}."
        )

    if rewrites:
        regen_lines.append(
            f"Apply Nine's voice rewrites as few-shot style examples in the new system prompt."
        )

    if regen_lines:
        lines.append(" ".join(regen_lines))
    else:
        lines.append(f"_No clear regeneration signals -- review annotations manually._")
    lines.append(f"")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def load_manifest(manifest_path: Path) -> dict:
    """Load manifest.json; error-exit if missing."""
    if not manifest_path.exists():
        print(f"Error: manifest not found at {manifest_path}", file=sys.stderr)
        print("Run draft_variants.py first to initialise the manifest.", file=sys.stderr)
        sys.exit(1)
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in manifest: {exc}", file=sys.stderr)
        sys.exit(1)


def find_round_entry(manifest: dict, round_num: int) -> dict | None:
    """Return the manifest entry for round_num, or None."""
    for entry in manifest.get("rounds", []):
        if entry.get("round") == round_num:
            return entry
    return None


# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Synthesize round N annotations into a feedback digest and generate round N+1"
    )
    parser.add_argument("--episode", required=True, help="Episode ID, e.g. YT-S01-E02")
    parser.add_argument("--round", required=True, type=int, help="Round number to synthesize (e.g. 1)")
    parser.add_argument(
        "--no-generate",
        action="store_true",
        help="Only emit the feedback digest; do not generate round N+1 variants",
    )
    args = parser.parse_args()

    episode_id: str = args.episode
    round_num: int = args.round

    scripts_dir = _YT_DIR / "scripts" / episode_id
    manifest_path = scripts_dir / "manifest.json"
    round_dir = scripts_dir / f"r{round_num}"
    digest_path = scripts_dir / f"feedback-r{round_num}.md"

    log(f"Episode: {episode_id}  Round: {round_num}")

    # -- 1. Load manifest --
    manifest = load_manifest(manifest_path)
    round_entry = find_round_entry(manifest, round_num)
    if round_entry is None:
        print(
            f"Error: round {round_num} not found in manifest. "
            f"Available rounds: {[e.get('round') for e in manifest.get('rounds', [])]}",
            file=sys.stderr,
        )
        sys.exit(1)

    variant_entries: list[dict] = round_entry.get("variants", [])
    if not variant_entries:
        print(f"Error: no variants listed in manifest for round {round_num}", file=sys.stderr)
        sys.exit(1)

    variant_ids: list[str] = [v["variantId"] for v in variant_entries]
    log(f"Variants in round {round_num}: {variant_ids}")

    # -- 2. Load artifacts for each variant --
    annotations: list[VariantAnnotation] = []
    judge_scores: list[JudgeScore | None] = []

    for vid in variant_ids:
        ann_path = round_dir / f"{vid}-annotations.md"
        judge_path = round_dir / f"{vid}-judge.json"

        log(f"  Loading {vid}")
        ann = parse_annotations(ann_path, vid)
        annotations.append(ann)

        js = load_judge_scores(judge_path, vid)
        judge_scores.append(js)

    # -- 3. Consensus extraction --
    log("Running consensus extraction...")
    consensus = extract_consensus(annotations, judge_scores)

    part_status = consensus["part_status"]
    mutate_part_nums = sorted(
        pn for pn, info in part_status.items() if info["status"] == "mutate"
    )
    preserve_part_nums = sorted(
        pn for pn, info in part_status.items() if info["status"] == "preserve"
    )

    log(f"  Parts to mutate: {mutate_part_nums}")
    log(f"  Parts to preserve: {preserve_part_nums}")
    if consensus["low_scoring_dims"]:
        log(f"  Low-scoring judge dimensions: {consensus['low_scoring_dims']}")

    # -- 4. Build feedback digest --
    log(f"Building feedback digest -> {digest_path}")
    digest_text = build_digest(
        episode_id=episode_id,
        round_num=round_num,
        annotations=annotations,
        judge_scores=judge_scores,
        consensus=consensus,
    )
    digest_path.write_text(digest_text, encoding="utf-8")
    log(f"  Wrote {len(digest_text)} bytes ({digest_text.count(chr(10))} lines)")

    # -- 5. Generate round N+1 (unless --no-generate) --
    if args.no_generate:
        log("--no-generate flag set; skipping round N+1 generation")
        print(f"\nFeedback digest written to: {digest_path}")
        return

    next_round = round_num + 1

    # Determine number of variants: 2 if 1-2 mutation targets, 3 if 3+
    num_variants = 2 if len(mutate_part_nums) <= 2 else 3
    log(f"Generating round {next_round} with {num_variants} variant(s)")
    log(f"  Mutation targets: parts {mutate_part_nums}")

    mutate_arg = ",".join(str(p) for p in mutate_part_nums) if mutate_part_nums else ""

    # Build subprocess command for draft_variants.py
    draft_variants_path = _HERE / "draft_variants.py"
    cmd = [
        sys.executable,
        str(draft_variants_path),
        "--episode", episode_id,
        "--round", str(next_round),
        "--num-variants", str(num_variants),
    ]
    if mutate_arg:
        cmd += ["--mutate-parts", mutate_arg]

    # TODO(draft_variants.py integration): draft_variants.py does not yet accept
    # a --feedback flag. Once it does, uncomment the following line:
    #   cmd += ["--feedback", str(digest_path)]
    # The intent is for draft_variants.py to prepend the feedback digest as a
    # "## Round N Feedback Digest" block to youtube/prompts/script-writing.prompt.md
    # when building the round N+1 system prompt, and to restrict Zone 1
    # forced-choice questions to mutation-target parts only (dropping saturated
    # questions). See: youtube/prompts/script-writing.prompt.md and the anti-patterns
    # section in the plan for the full intended behaviour.

    log(f"Invoking: {' '.join(cmd)}")

    if not draft_variants_path.exists():
        # draft_variants.py is being built by a separate agent.
        # Log what we would invoke so the workflow is clear, then update manifest.
        warn(
            f"draft_variants.py not found at {draft_variants_path}. "
            f"Skipping generation call -- run manually once draft_variants.py is available."
        )
        warn(f"Command that would have run: {' '.join(cmd)}")
    else:
        result = subprocess.run(cmd, check=False)
        if result.returncode != 0:
            warn(f"draft_variants.py exited with code {result.returncode}")
            print(f"\nFeedback digest written to: {digest_path}", file=sys.stderr)
            print(
                f"Round {next_round} generation FAILED. Fix the error above and re-run, "
                f"or use --no-generate and invoke draft_variants.py manually.",
                file=sys.stderr,
            )
            sys.exit(result.returncode)

    # -- 6. Update manifest --
    log(f"Updating manifest -> currentRound: {next_round}")
    manifest["currentRound"] = next_round

    # Add round N+1 entry if not already present
    existing_next = find_round_entry(manifest, next_round)
    if existing_next is None:
        # Variant IDs for round N+1 follow pattern r{N+1}-A, r{N+1}-B, [r{N+1}-C]
        variant_letters = "ABCDEFGHIJ"
        new_variant_ids = [
            f"r{next_round}-{variant_letters[i]}" for i in range(num_variants)
        ]
        manifest.setdefault("rounds", []).append({
            "round": next_round,
            "variants": new_variant_ids,
            "status": "pending",
            "mutateTargets": mutate_part_nums,
            "preserveTargets": preserve_part_nums,
            "feedbackDigest": f"feedback-r{round_num}.md",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    # Mark round N as synthesized
    if round_entry is not None:
        round_entry["status"] = "synthesized"
        round_entry["synthesizedAt"] = datetime.now(timezone.utc).isoformat()

    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"  Manifest updated")

    print(f"\nFeedback digest: {digest_path}")
    print(f"Round {next_round} queued in manifest.")
    if not draft_variants_path.exists():
        print(f"Next step: run draft_variants.py when available, or provide --no-generate to skip.")


if __name__ == "__main__":
    main()
