#!/usr/bin/env python3
"""
generate_translit.py — Auto-generate PTM transliteration for YouTube scripts.

Reads a YouTube script JSON, fills in missing `translit` fields on vocab items
and lines using:
  1. Exact match against the course vocab-index.json (authoritative PTM forms)
  2. Substring matching for phrases built from known vocab
  3. IPA→PTM repair for any remaining IPA symbols (port of TS repairTransliteration)
  4. PTM policy validation on the result

Usage:
    # Fill in missing transliterations
    python3 youtube/tools/generate_translit.py \
        --script youtube/examples/YT-S01-E01.json \
        --output youtube/examples/YT-S01-E01.json

    # Dry run — show what would change
    python3 youtube/tools/generate_translit.py \
        --script youtube/examples/YT-S01-E01.json \
        --dry-run

    # Force regeneration of ALL transliterations (even existing ones)
    python3 youtube/tools/generate_translit.py \
        --script youtube/examples/YT-S01-E01.json \
        --output youtube/examples/YT-S01-E01.json \
        --force
"""

import argparse
import json
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field


# ── PTM policy constants (ported from transliteration-policy.ts) ──────────

PTM_FORBIDDEN_SYMBOLS = set("ʉəɯɤœɨɪʊɜɐɑɔɒæɲŋɕʑʔɡːˈˌᵊᶱᴴᴹᴸᴿ")

PTM_ALLOWED_CHARS_RE = re.compile(
    r"^[A-Za-z0-9àáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ\s\-''.,!?/:;()\[\]{}&+|•…\"]+$"
)

PTM_INLINE_TONE_RE = re.compile(r"[àáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ]")


# ── IPA→PTM repair (ported from transliteration-policy.ts) ───────────────

IPA_REPLACEMENTS = [
    # Order matters: longer sequences first
    (re.compile(r"tɕʰ"), "ch"),
    (re.compile(r"tɕ"), "j"),
    (re.compile(r"dʑ"), "j"),
    # Vowels — long forms before short
    (re.compile(r"ʉː"), "uu"),
    (re.compile(r"ʉ"), "uu"),
    (re.compile(r"ɯː"), "euu"),
    (re.compile(r"ɯ"), "eu"),
    (re.compile(r"ɤː"), "euu"),
    (re.compile(r"ɤ"), "eu"),
    (re.compile(r"ɔː"), "aaw"),
    (re.compile(r"ɔ"), "aw"),
    (re.compile(r"ɒ"), "aw"),
    (re.compile(r"ə"), "er"),
    (re.compile(r"œ"), "oe"),
    (re.compile(r"ɨ"), "eu"),
    (re.compile(r"ɪ"), "i"),
    (re.compile(r"ʊ"), "u"),
    (re.compile(r"æ"), "ae"),
    # Consonants
    (re.compile(r"ŋ"), "ng"),
    (re.compile(r"ɲ"), "y"),
    (re.compile(r"ɕ"), "ch"),
    (re.compile(r"ʑ"), "ch"),
    (re.compile(r"ʔ"), ""),
    (re.compile(r"ɡ"), "g"),
    # Length marker
    (re.compile(r"([A-Za-z])ː"), r"\1\1"),
    # Stress markers
    (re.compile(r"[ˈˌ]"), ""),
]


def repair_ipa_to_ptm(text: str) -> tuple[str, list[str], list[str]]:
    """
    Apply IPA→PTM character replacements.
    Returns (repaired_text, auto_fixes, manual_review_items).
    """
    auto_fixes = []
    manual_review = []
    result = text

    for pattern, replacement in IPA_REPLACEMENTS:
        if pattern.search(result):
            old = result
            result = pattern.sub(replacement, result)
            if result != old:
                note = f"Replaced '{pattern.pattern}' → '{replacement}'"
                auto_fixes.append(note)
                # Mark uncertain replacements
                if replacement in ("er", "ch", "") and pattern.pattern in ("ə", "ʑ", "ʔ"):
                    manual_review.append(f"{note} (verify manually)")

    # Normalize whitespace
    result = re.sub(r"\s{2,}", " ", result).strip()

    return result, auto_fixes, manual_review


def check_ptm_policy(text: str) -> list[str]:
    """Check a transliteration string for PTM policy violations."""
    issues = []
    if not text.strip():
        issues.append("empty transliteration")
        return issues

    # Check for forbidden IPA symbols
    found = [ch for ch in text if ch in PTM_FORBIDDEN_SYMBOLS]
    if found:
        issues.append(f"forbidden symbol(s): {', '.join(set(found))}")

    # Check character class
    if not PTM_ALLOWED_CHARS_RE.match(text):
        bad = [ch for ch in text if not PTM_ALLOWED_CHARS_RE.match(ch)]
        if bad:
            issues.append(f"non-PTM character(s): {', '.join(set(bad))}")

    return issues


# ── Vocab index loader ────────────────────────────────────────────────────

@dataclass
class VocabLookup:
    """Lookup table: Thai text → approved PTM transliteration."""
    exact: dict[str, str] = field(default_factory=dict)   # "ขอ" → "khǎaw"

    def add(self, thai: str, translit: str):
        """Add an exact Thai→translit mapping."""
        key = thai.strip()
        if key and translit.strip():
            self.exact[key] = translit.strip()

    def lookup(self, thai: str) -> str | None:
        """Exact match lookup."""
        return self.exact.get(thai.strip())

    def lookup_phrase(self, thai_phrase: str) -> str | None:
        """
        Try to transliterate a full phrase by matching known words.
        Uses greedy longest-match from left to right.
        """
        phrase = thai_phrase.strip()
        if not phrase:
            return None

        # First try exact match on the whole phrase
        exact = self.lookup(phrase)
        if exact:
            return exact

        # Build sorted keys by length (longest first) for greedy matching
        sorted_keys = sorted(self.exact.keys(), key=len, reverse=True)

        result_parts = []
        remaining = phrase

        while remaining:
            # Skip whitespace
            if remaining[0] == " ":
                remaining = remaining[1:]
                continue

            matched = False
            for key in sorted_keys:
                if remaining.startswith(key):
                    result_parts.append(self.exact[key])
                    remaining = remaining[len(key):]
                    matched = True
                    break

            if not matched:
                # Can't match this part — fail the whole phrase lookup
                return None

        return " ".join(result_parts) if result_parts else None


def load_vocab_index(repo_root: Path) -> VocabLookup:
    """Load the course vocab-index.json and transliteration-policy.md approved forms."""
    lookup = VocabLookup()

    # 1. Load vocab-index.json
    vocab_path = repo_root / "course" / "vocab" / "vocab-index.json"
    if vocab_path.exists():
        data = json.loads(vocab_path.read_text())
        for entry in data.get("entries", []):
            thai = entry.get("thai", "").replace("...", "").strip()
            translit = entry.get("translit", "").replace("...", "").strip()
            if thai and translit:
                lookup.add(thai, translit)
        print(f"  Loaded {len(lookup.exact)} entries from vocab-index.json")

    # 2. Load approved forms from transliteration-policy.md
    policy_path = repo_root / "course" / "transliteration-policy.md"
    if policy_path.exists():
        text = policy_path.read_text()
        # Parse lines like: - สวัสดี → `sà-wàt-dii`
        for match in re.finditer(r"-\s+(\S+)\s+→\s+`([^`]+)`", text):
            thai = match.group(1).strip()
            translit = match.group(2).strip()
            if thai and translit:
                lookup.add(thai, translit)
        print(f"  Total entries after policy additions: {len(lookup.exact)}")

    # 3. Add known corrections for common words not in the index
    # These are words that appear in YouTube scripts but may not be in the course vocab
    manual_corrections = {
        "อะไร": "a-rai",
        "ดี": "dii",
        "ที่ไหน": "thîi nǎi",
        "คะ": "khá",
        "ค่ะ": "khâ",
        "ครับ": "khráp",
        "นะ": "ná",
        "นะคะ": "ná khá",
        "ไหม": "mái",
        "มาก": "mâak",
        "ไม่": "mâi",
        "เอา": "ao",
        "แล้ว": "láaew",
        "ด้วย": "dûuay",
        "ที่": "thîi",
        "ไหน": "nǎi",
        "อยู่": "yùu",
        "จาน": "jaan",
        "หนึ่ง": "nùeng",
        "ผัดไทย": "phàt-thai",
        "เงิน": "ngern",
        "เก็บ": "gèp",
        "เก็บเงิน": "gèp ngern",
        "ขอ": "khǎaw",
        "สั่ง": "sàng",
        "เผ็ด": "phèt",
        "อร่อย": "a-ròoy",
        "อิ่ม": "ìm",
        "แนะนำ": "náe-nam",
        "พูด": "phûut",
        "ช้าๆ": "cháa-cháa",
        "ได้": "dâai",
        "คุณ": "khun",
        "อยาก": "yàak",
    }

    for thai, translit in manual_corrections.items():
        # Only add if not already in lookup (vocab-index takes precedence)
        if thai not in lookup.exact:
            lookup.add(thai, translit)

    print(f"  Total entries after manual corrections: {len(lookup.exact)}")
    return lookup


# ── Script processing ─────────────────────────────────────────────────────

@dataclass
class TranslitChange:
    """Record of a transliteration change made."""
    location: str       # e.g. "vocab v-005" or "line l-0016"
    thai: str
    old_translit: str
    new_translit: str
    source: str         # "lookup", "repair", "manual"
    issues: list[str] = field(default_factory=list)


def generate_translit_for_text(
    thai: str,
    existing_translit: str | None,
    lookup: VocabLookup,
    force: bool = False,
) -> tuple[str | None, str]:
    """
    Generate or fix PTM transliteration for a Thai text.

    Returns (new_translit_or_None, source).
    source is one of: "lookup", "repair", "kept", "skip", "manual-needed"
    """
    if not thai or not thai.strip():
        return None, "skip"

    # If there's an existing translit and we're not forcing, check if it's clean
    if existing_translit and not force:
        policy_issues = check_ptm_policy(existing_translit)
        if not policy_issues:
            return existing_translit, "kept"

    # Strategy 1: Exact lookup
    from_lookup = lookup.lookup(thai.strip())
    if from_lookup:
        return from_lookup, "lookup"

    # Strategy 2: Phrase decomposition lookup
    from_phrase = lookup.lookup_phrase(thai.strip())
    if from_phrase:
        return from_phrase, "lookup-phrase"

    # Strategy 3: If existing translit has IPA, try repair
    if existing_translit:
        has_ipa = any(ch in PTM_FORBIDDEN_SYMBOLS for ch in existing_translit)
        if has_ipa:
            repaired, fixes, manual = repair_ipa_to_ptm(existing_translit)
            remaining_issues = check_ptm_policy(repaired)
            if not remaining_issues:
                return repaired, "repair"
            else:
                # Repair helped but still has issues
                return repaired, "repair-partial"

    # Strategy 4: Keep existing if it exists, flag for manual review
    if existing_translit:
        return existing_translit, "manual-needed"

    return None, "manual-needed"


def build_translit_map_from_script(script: dict) -> dict[str, str]:
    """
    Build a map of old_translit → thai_text from the script itself,
    so translit-only lines can find their Thai source.
    """
    translit_to_thai: dict[str, str] = {}

    # Collect from vocab
    for vocab in script.get("vocab", []):
        thai = vocab.get("thai", "")
        translit = vocab.get("translit", "")
        if thai and translit:
            translit_to_thai[translit] = thai

    # Collect from lines that have both thai and translit
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            thai = line.get("thai", "")
            translit = line.get("translit", "")
            if thai and translit:
                translit_to_thai[translit] = thai

    return translit_to_thai


def process_script(
    script: dict,
    lookup: VocabLookup,
    force: bool = False,
) -> tuple[dict, list[TranslitChange]]:
    """
    Process a YouTube script JSON, filling in/fixing transliterations.
    Returns (modified_script, list_of_changes).
    """
    changes: list[TranslitChange] = []

    # Build a reverse map so translit-only lines can find their Thai source
    translit_to_thai = build_translit_map_from_script(script)

    # 1. Process vocab items
    for vocab in script.get("vocab", []):
        thai = vocab.get("thai", "")
        old_translit = vocab.get("translit")

        new_translit, source = generate_translit_for_text(
            thai, old_translit, lookup, force
        )

        if new_translit and new_translit != old_translit:
            change = TranslitChange(
                location=f"vocab {vocab.get('id', '?')}",
                thai=thai,
                old_translit=old_translit or "(empty)",
                new_translit=new_translit,
                source=source,
                issues=check_ptm_policy(new_translit),
            )
            changes.append(change)
            vocab["translit"] = new_translit
        elif new_translit is None and old_translit is None:
            changes.append(TranslitChange(
                location=f"vocab {vocab.get('id', '?')}",
                thai=thai,
                old_translit="(empty)",
                new_translit="(empty)",
                source="manual-needed",
                issues=["no transliteration available"],
            ))

    # 2. Process block lines
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            thai = line.get("thai", "")
            old_translit = line.get("translit")
            lang = line.get("lang", "")

            # Only process lines that have Thai text or are translit-only lines
            if lang == "en":
                continue

            if lang == "translit" and old_translit:
                # Translit-only line — find the Thai source text
                thai_source = translit_to_thai.get(old_translit, "")
                has_ipa = any(ch in PTM_FORBIDDEN_SYMBOLS for ch in old_translit)

                if thai_source and (has_ipa or force):
                    # We know the Thai — use lookup to get correct translit
                    new_translit, source = generate_translit_for_text(
                        thai_source, old_translit, lookup, force=True
                    )
                    if new_translit and new_translit != old_translit:
                        changes.append(TranslitChange(
                            location=f"line {line.get('id', '?')}",
                            thai=f"(from: {thai_source})",
                            old_translit=old_translit,
                            new_translit=new_translit,
                            source=source,
                            issues=check_ptm_policy(new_translit),
                        ))
                        line["translit"] = new_translit
                elif has_ipa or force:
                    # No Thai source — fall back to repair
                    repaired, _, _ = repair_ipa_to_ptm(old_translit)
                    if repaired != old_translit:
                        changes.append(TranslitChange(
                            location=f"line {line.get('id', '?')}",
                            thai="(translit-only, no Thai source)",
                            old_translit=old_translit,
                            new_translit=repaired,
                            source="repair",
                            issues=check_ptm_policy(repaired),
                        ))
                        line["translit"] = repaired
                continue

            if not thai:
                continue

            new_translit, source = generate_translit_for_text(
                thai, old_translit, lookup, force
            )

            if new_translit and new_translit != old_translit:
                change = TranslitChange(
                    location=f"line {line.get('id', '?')}",
                    thai=thai,
                    old_translit=old_translit or "(empty)",
                    new_translit=new_translit,
                    source=source,
                    issues=check_ptm_policy(new_translit),
                )
                changes.append(change)
                line["translit"] = new_translit

    return script, changes


# ── CLI ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Auto-generate PTM transliteration for YouTube scripts"
    )
    parser.add_argument("--script", required=True, help="Path to episode script JSON")
    parser.add_argument("--output", help="Path for output JSON (omit for dry-run)")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: .)")
    parser.add_argument("--force", action="store_true",
                        help="Regenerate ALL transliterations, even valid ones")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show changes without writing output")
    args = parser.parse_args()

    repo_root = Path(args.repo_root)
    script_path = Path(args.script)

    if not script_path.exists():
        print(f"Error: script not found: {script_path}")
        sys.exit(1)

    print("Loading vocab lookup...")
    lookup = load_vocab_index(repo_root)

    print(f"\nProcessing: {script_path}")
    script = json.loads(script_path.read_text())

    modified, changes = process_script(script, lookup, force=args.force)

    # Report
    print(f"\n{'─' * 60}")
    print(f"Transliteration generation report")
    print(f"{'─' * 60}")

    if not changes:
        print("No changes needed — all transliterations are clean.")
        sys.exit(0)

    # Group by source
    by_source: dict[str, list[TranslitChange]] = {}
    for c in changes:
        by_source.setdefault(c.source, []).append(c)

    for source, items in sorted(by_source.items()):
        print(f"\n[{source}] — {len(items)} change(s):")
        for c in items:
            marker = "⚠️ " if c.issues else "✅"
            print(f"  {marker} {c.location}: {c.thai}")
            print(f"       old: {c.old_translit}")
            print(f"       new: {c.new_translit}")
            if c.issues:
                for issue in c.issues:
                    print(f"       ⚠️  {issue}")

    # Summary
    total = len(changes)
    clean = sum(1 for c in changes if not c.issues)
    needs_review = sum(1 for c in changes if c.issues)
    print(f"\n{'─' * 60}")
    print(f"Total changes: {total}  |  Clean: {clean}  |  Needs review: {needs_review}")
    print(f"{'─' * 60}")

    # Write output
    if args.dry_run or not args.output:
        print("\nDry run — no files written.")
        sys.exit(2 if needs_review > 0 else 0)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(modified, indent=2, ensure_ascii=False))
    print(f"\nWritten: {output_path}")

    sys.exit(2 if needs_review > 0 else 0)


if __name__ == "__main__":
    main()
