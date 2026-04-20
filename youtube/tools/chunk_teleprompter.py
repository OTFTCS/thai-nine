"""Chunk teleprompter markdown into subtitle-sized phrases.

Parses a teleprompter .md file and splits it into phrase chunks
suitable for karaoke-style timestamping. Thai phrases are kept whole;
English text is split at sentence/clause boundaries targeting ≤42 chars.

Usage:
    python3 youtube/tools/chunk_teleprompter.py --episode YT-S01-E01
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path

# Thai Unicode range
_THAI_RE = re.compile(r"[\u0E00-\u0E7F]")
_STAGE_DIR_RE = re.compile(r"^\s*>\s*\*.*\*\s*$")
_STAGE_DIR_INLINE_RE = re.compile(r"\*\(.*?\)\*")
_SILENCE_RE = re.compile(r"\*\((\d+)-second\s+(pause|silence)\)\*", re.IGNORECASE)
_HEADER_RE = re.compile(r"^(#{1,4})\s+(.*)")
_DIVIDER_RE = re.compile(r"^---+\s*$")

# English clause split points (split AFTER these)
_CLAUSE_SPLIT_RE = re.compile(
    r"(?<=[.!?])\s+"  # sentence boundaries
    r"|(?<=,)\s+"      # commas
    r"|(?<=—)\s*"      # em-dashes
    r"|\s+(?=—)"       # before em-dashes
)

MAX_EN_CHARS = 30
MAX_TH_CHARS = 20

# Section header → blockRef mapping for YT-S01-E01
# This is episode-specific; future episodes will need their own mapping
# or we can auto-detect from script JSON block modes
SECTION_BLOCK_MAP = {
    "PART 1": "b-001",
    "HOOK": "b-001",
    "PART 2": "b-002",
    "PERSONAL STORY": "b-002",
    "TOPIC INTRO": "b-002",
    "PART 3": "b-003",
    "VOCABULARY": "b-003",
    "PART 4": "b-004",
    "NATURAL SPEED": "b-004",
    "PART 5": "b-005",
    "BREAKDOWN": "b-005",
    "PART 6": "b-012",
    "SHADOWING": "b-012",
    "PART 7": "b-006",
    "QUIZ": "b-006",
    "PRODUCTION DRILL": "b-006",
    "PART 8": "b-013",
    "RECAP": "b-013",
    "TEASER": "b-014",
}

# Vocab subsection headers → individual vocab blocks (for drill tracking)
VOCAB_SECTION_RE = re.compile(r"Vocab\s+(\d+)", re.IGNORECASE)
DRILL_SECTION_RE = re.compile(r"Drill\s+(\d+)", re.IGNORECASE)
SENTENCE_SECTION_RE = re.compile(r"Sentence\s+(\d+)", re.IGNORECASE)


def _is_thai(text: str) -> bool:
    """Check if text is predominantly Thai."""
    thai_chars = sum(1 for c in text if _THAI_RE.match(c))
    alpha_chars = sum(1 for c in text if unicodedata.category(c).startswith("L"))
    if alpha_chars == 0:
        return False
    return thai_chars / alpha_chars > 0.5


def _extract_thai_runs(text: str) -> list[str]:
    """Extract contiguous runs of Thai characters (+ spaces between Thai)."""
    runs = []
    # Find all Thai character sequences (allowing spaces between Thai chars)
    for m in re.finditer(r"[\u0E00-\u0E7F][\u0E00-\u0E7F\s]*[\u0E00-\u0E7F]|[\u0E00-\u0E7F]", text):
        runs.append(m.group().strip())
    return runs


def _split_mixed_line(text: str) -> list[tuple[str, str]]:
    """Split a line with mixed Thai/English into separate chunks.

    Handles cases like:
    - "สั่งอะไรดีคะ — what would you like to order?"
    - "So for example: ขอผัดไทยหนึ่งจานค่ะ — I'd like one Pad Thai"
    - "You hear สั่ง in the middle?"
    - Pure Thai or pure English

    Returns list of (text, lang) tuples.
    """
    thai_runs = _extract_thai_runs(text)

    # If no Thai at all, it's pure English
    if not thai_runs:
        return [(text, "en")]

    # If >50% of alpha chars are Thai, it's predominantly Thai
    if _is_thai(text) and not any(c.isascii() and c.isalpha() for c in text.replace(" ", "")):
        return [(text, "th")]

    # Mixed line — split into alternating Thai/English segments
    result: list[tuple[str, str]] = []
    remaining = text

    for thai_run in thai_runs:
        idx = remaining.find(thai_run)
        if idx < 0:
            continue

        # English text before this Thai run
        en_before = remaining[:idx].strip()
        # Clean up separator chars at the end of English
        en_before = re.sub(r"[\s—–\-:]+$", "", en_before).strip()
        if en_before:
            result.append((en_before, "en"))

        result.append((thai_run, "th"))
        remaining = remaining[idx + len(thai_run):]

    # English text after the last Thai run
    en_after = remaining.strip()
    en_after = re.sub(r"^[\s—–\-:,.]+", "", en_after).strip()
    if en_after:
        result.append((en_after, "en"))

    # Filter out punctuation-only segments (commas, periods, dashes between Thai runs)
    _PUNCT_ONLY_RE = re.compile(r"^[\s,.\-—–;:!?…\'\"]*$")
    result = [(t, l) for t, l in result if not (l == "en" and _PUNCT_ONLY_RE.match(t))]

    return result if result else [(text, "en")]


def _split_english(text: str, max_chars: int = MAX_EN_CHARS) -> list[str]:
    """Split English text into chunks of ≤max_chars.

    Tries sentence boundaries first, then clause boundaries.
    """
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    # Split at sentence boundaries first
    sentences = re.split(r"(?<=[.!?])\s+", text)

    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if not sentence.strip():
            continue

        if not current:
            if len(sentence) <= max_chars:
                current = sentence
            else:
                # Sentence itself is too long — split at clause boundaries
                clause_chunks = _split_at_clauses(sentence, max_chars)
                chunks.extend(clause_chunks[:-1])
                current = clause_chunks[-1] if clause_chunks else ""
        elif len(current) + 1 + len(sentence) <= max_chars:
            current = current + " " + sentence
        else:
            chunks.append(current)
            if len(sentence) <= max_chars:
                current = sentence
            else:
                clause_chunks = _split_at_clauses(sentence, max_chars)
                chunks.extend(clause_chunks[:-1])
                current = clause_chunks[-1] if clause_chunks else ""

    if current:
        chunks.append(current)

    return chunks


def _split_at_clauses(text: str, max_chars: int) -> list[str]:
    """Split a long sentence at clause boundaries (commas, dashes, conjunctions)."""
    # Find all clause boundary positions (split AFTER the boundary)
    split_points = []
    for m in re.finditer(r"(?:,\s+|\s+—\s*|\s*—\s+|\s+and\s+|\s+but\s+|\s+or\s+|\s+so\s+)", text):
        split_points.append(m.end())

    if not split_points:
        return _word_wrap(text, max_chars)

    # Build segments between split points
    boundaries = [0] + split_points + [len(text)]
    segments = []
    for i in range(len(boundaries) - 1):
        seg = text[boundaries[i]:boundaries[i + 1]].strip()
        if seg:
            segments.append(seg)

    if not segments:
        return _word_wrap(text, max_chars)

    # Accumulate segments into chunks that fit within max_chars
    chunks: list[str] = []
    current = ""

    for seg in segments:
        if not current:
            current = seg
        elif len(current) + 1 + len(seg) <= max_chars:
            current = current + " " + seg
        else:
            chunks.append(current)
            current = seg

    if current:
        chunks.append(current)

    # Word-wrap any chunk that's still too long
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
        else:
            result.extend(_word_wrap(chunk, max_chars))

    return result if result else _word_wrap(text, max_chars)


def _word_wrap(text: str, max_chars: int) -> list[str]:
    """Simple word-wrap as last resort."""
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for word in words:
        if current and current_len + 1 + len(word) > max_chars:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word)
        else:
            current.append(word)
            current_len += (1 if current_len > 0 else 0) + len(word)

    if current:
        chunks.append(" ".join(current))

    return chunks


def _resolve_block_ref(header_text: str, current_block: str) -> str:
    """Resolve a section header to a block reference."""
    upper = header_text.upper().strip()

    # Check direct mappings
    for key, block_id in SECTION_BLOCK_MAP.items():
        if key in upper:
            return block_id

    # Check for vocab subsections (stay in b-003)
    if VOCAB_SECTION_RE.search(header_text):
        return "b-003"

    # Check for drill subsections
    drill_match = DRILL_SECTION_RE.search(header_text)
    if drill_match:
        drill_num = int(drill_match.group(1))
        # Drills map to b-006/b-007, b-008/b-009, b-010/b-011
        return f"b-{5 + drill_num * 2:03d}"

    # Check for sentence subsections in breakdown
    if SENTENCE_SECTION_RE.search(header_text):
        return "b-005"

    return current_block


def chunk_teleprompter(
    teleprompter_path: Path,
    script_path: Path,
    output_path: Path,
) -> list[dict]:
    """Parse teleprompter markdown into subtitle phrase chunks.

    Args:
        teleprompter_path: Path to the teleprompter .md file
        script_path: Path to the episode script .json
        output_path: Path to write the phrases .json output

    Returns:
        List of phrase chunk dicts
    """
    script = json.loads(script_path.read_text(encoding="utf-8"))
    lines = teleprompter_path.read_text(encoding="utf-8").splitlines()

    # Build vocab lookup: thai text → vocab entry
    vocab_lookup: dict[str, dict] = {}
    for v in script.get("vocab", []):
        vocab_lookup[v["thai"]] = v

    # Build extended Thai phrases lookup for translit
    # Include all Thai text from all blocks
    thai_translit: dict[str, str] = {}
    for block in script.get("blocks", []):
        for line in block.get("lines", []):
            if line.get("thai") and line.get("translit"):
                thai_translit[line["thai"]] = line["translit"]
    for v in script.get("vocab", []):
        thai_translit[v["thai"]] = v["translit"]

    # Supplementary translit for common Thai words that appear in
    # teleprompter explanations but aren't standalone vocab items
    _SUPPLEMENTARY_TRANSLIT = {
        "ไม่": "mâi",
        "มาก": "mâak",
        "ค่ะ": "khâ",
        "ครับ": "khráp",
        "ผัดไทย": "phàt-thai",
        "หนึ่ง": "nùeng",
        "จาน": "jaan",
        "เก็บ": "gèp",
        "เงิน": "ngern",
        "ด้วย": "dûuay",
        "อะไร": "a-rai",
        "ดี": "dii",
        "แล้ว": "láaew",
        "เอา": "ao",
        "นะคะ": "ná khá",
        "สวัสดีค่ะ": "sà-wàt-dii khâ",
        "เผ็ดไหม": "phèt mǎi",
        "ขอข้าวผัดหนึ่งจานค่ะ": "khǎaw khâaw-phàt nùeng jaan khâ",
        "ขอส้มตำหนึ่งจานค่ะ": "khǎaw sôm-tam nùeng jaan khâ",
        "อยู่ที่ไหนคะ": "yùu thîi nǎi khá",
    }
    for k, v in _SUPPLEMENTARY_TRANSLIT.items():
        if k not in thai_translit:
            thai_translit[k] = v

    chunks: list[dict] = []
    current_block = "b-001"
    current_section = ""
    chunk_index = 0
    in_stage_direction = False

    for raw_line in lines:
        line = raw_line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip dividers
        if _DIVIDER_RE.match(line):
            continue

        # Handle headers — update block ref and section name
        header_match = _HEADER_RE.match(line)
        if header_match:
            header_text = header_match.group(2).strip()
            current_block = _resolve_block_ref(header_text, current_block)
            current_section = header_text
            continue

        # Skip stage directions (> *italic text*)
        if _STAGE_DIR_RE.match(raw_line):
            continue
        if line.startswith("> "):
            continue

        # Skip format metadata lines
        if line.startswith("**Format:**") or line.startswith("**Level:**"):
            continue

        # Handle silence markers
        silence_match = _SILENCE_RE.search(line)
        if silence_match:
            chunks.append({
                "chunkId": f"pc-{chunk_index:04d}",
                "chunkIndex": chunk_index,
                "blockRef": current_block,
                "sectionName": current_section,
                "type": "silence",
                "lang": "silence",
                "text": f"({silence_match.group(1)}-second pause)",
                "translit": None,
                "triggerCard": None,
            })
            chunk_index += 1
            continue

        # Strip inline stage directions but keep the rest
        cleaned = _STAGE_DIR_INLINE_RE.sub("", line).strip()
        if not cleaned:
            continue

        # Skip lines that are just stage direction remnants
        if cleaned.startswith("*(") and cleaned.endswith(")*"):
            continue

        # Split mixed Thai/English lines
        parts = _split_mixed_line(cleaned)

        for text, lang in parts:
            text = text.strip()
            if not text:
                continue

            if lang == "th":
                # Thai: keep as single chunk
                # Strip trailing punctuation for lookup (e.g. "สั่ง." → "สั่ง")
                text_clean = text.rstrip(".!?,;: ")
                translit = thai_translit.get(text_clean) or thai_translit.get(text)

                # Detect card triggers
                trigger_card = None
                if text_clean in vocab_lookup:
                    v = vocab_lookup[text_clean]
                    trigger_card = {
                        "type": "vocab-card",
                        "vocabId": v["id"],
                    }
                elif text in vocab_lookup:
                    v = vocab_lookup[text]
                    trigger_card = {
                        "type": "vocab-card",
                        "vocabId": v["id"],
                    }
                # Use the clean text (without trailing punctuation) for the chunk
                text = text_clean if text_clean else text

                chunks.append({
                    "chunkId": f"pc-{chunk_index:04d}",
                    "chunkIndex": chunk_index,
                    "blockRef": current_block,
                    "sectionName": current_section,
                    "lang": "th",
                    "text": text,
                    "translit": translit,
                    "triggerCard": trigger_card,
                })
                chunk_index += 1
            else:
                # English: split into subtitle-sized chunks
                en_chunks = _split_english(text, MAX_EN_CHARS)
                for ec in en_chunks:
                    ec = ec.strip()
                    if not ec:
                        continue
                    chunks.append({
                        "chunkId": f"pc-{chunk_index:04d}",
                        "chunkIndex": chunk_index,
                        "blockRef": current_block,
                        "sectionName": current_section,
                        "lang": "en",
                        "text": ec,
                        "translit": None,
                        "triggerCard": None,
                    })
                    chunk_index += 1

    # Post-processing: merge tiny English chunks into neighbours
    # Catches standalone punctuation AND tiny words like "or" between Thai chunks
    _TINY_RE = re.compile(r"^[\s,.\-—–;:!?…\'\"]{0,3}$")
    MIN_EN_CHARS = 4  # "or", "it." etc. are too short for subtitles
    merged_chunks: list[dict] = []
    for chunk in chunks:
        is_tiny_en = chunk["lang"] == "en" and (
            _TINY_RE.match(chunk["text"]) or len(chunk["text"]) <= MIN_EN_CHARS
        )
        if is_tiny_en:
            # Try to merge into previous English chunk
            if merged_chunks and merged_chunks[-1]["lang"] == "en":
                merged_chunks[-1]["text"] = (merged_chunks[-1]["text"] + " " + chunk["text"]).strip()
            # Otherwise just drop it (isolated punctuation/tiny word between Thai)
            continue
        merged_chunks.append(chunk)

    # Re-index chunks after merging
    for i, chunk in enumerate(merged_chunks):
        chunk["chunkId"] = f"pc-{i:04d}"
        chunk["chunkIndex"] = i
    chunks = merged_chunks

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "episodeId": script.get("episodeId", ""),
        "sourceFile": teleprompter_path.name,
        "totalChunks": len(chunks),
        "chunks": chunks,
    }
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # QA summary
    en_chunks = [c for c in chunks if c["lang"] == "en"]
    th_chunks = [c for c in chunks if c["lang"] == "th"]
    silence_chunks = [c for c in chunks if c["lang"] == "silence"]

    over_limit_en = [c for c in en_chunks if len(c["text"]) > MAX_EN_CHARS]
    over_limit_th = [c for c in th_chunks if len(c["text"]) > MAX_TH_CHARS]
    th_no_translit = [c for c in th_chunks if not c["translit"]]
    th_no_block = [c for c in chunks if not c["blockRef"]]
    tiny_chunks = [c for c in chunks if len(c["text"]) <= 3 and c["lang"] == "en"]

    print(f"\n{'='*60}")
    print(f"Phrase Chunker — {script.get('episodeId', '?')}")
    print(f"{'='*60}")
    print(f"Total chunks:    {len(chunks)}")
    print(f"  English:       {len(en_chunks)}")
    print(f"  Thai:          {len(th_chunks)}")
    print(f"  Silence:       {len(silence_chunks)}")
    print(f"Thai with card:  {sum(1 for c in th_chunks if c['triggerCard'])}")
    print()

    # QA checks
    issues = []
    if over_limit_en:
        issues.append(f"  ⚠ {len(over_limit_en)} English chunks exceed {MAX_EN_CHARS} chars")
        for c in over_limit_en[:3]:
            issues.append(f"    → [{c['chunkId']}] ({len(c['text'])} chars): {c['text'][:50]}...")
    if over_limit_th:
        issues.append(f"  ⚠ {len(over_limit_th)} Thai chunks exceed {MAX_TH_CHARS} chars")
        for c in over_limit_th[:3]:
            issues.append(f"    → [{c['chunkId']}] ({len(c['text'])} chars): {c['text']}")
    if th_no_translit:
        issues.append(f"  ⚠ {len(th_no_translit)} Thai chunks missing translit")
        for c in th_no_translit[:5]:
            issues.append(f"    → [{c['chunkId']}] {c['text']}")
    if th_no_block:
        issues.append(f"  ⚠ {len(th_no_block)} chunks missing blockRef")
    if tiny_chunks:
        issues.append(f"  ⚠ {len(tiny_chunks)} chunks ≤3 chars")
        for c in tiny_chunks[:5]:
            issues.append(f"    → [{c['chunkId']}] ({c['lang']}) \"{c['text']}\"")

    if issues:
        print("QA Issues:")
        for issue in issues:
            print(issue)
    else:
        print("QA: ✓ All checks passed")

    print(f"\nOutput: {output_path}")
    return chunks


def main():
    parser = argparse.ArgumentParser(description="Chunk teleprompter into subtitle phrases")
    parser.add_argument("--episode", required=True, help="Episode ID (e.g. YT-S01-E01)")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    episode = args.episode

    # Find teleprompter file — prefer highest version suffix (v2 > v1 > no version)
    teleprompter_candidates = sorted(root.glob(f"youtube/examples/{episode}-teleprompter*.md"))
    # Filter to .md only (exclude .pdf etc.) and pick highest version
    teleprompter_candidates = [
        p for p in teleprompter_candidates if p.suffix == ".md"
    ]
    if not teleprompter_candidates:
        raise FileNotFoundError(f"No teleprompter file found for {episode}")
    # Pick the one with highest version suffix (v2 > v1 > base)
    teleprompter_path = max(teleprompter_candidates, key=lambda p: p.stem)

    # Script JSON
    script_path = root / f"youtube/examples/{episode}.json"
    if not script_path.exists():
        raise FileNotFoundError(f"Script JSON not found: {script_path}")

    # Output path
    output_path = root / f"youtube/phrases/{episode}.phrases.json"

    print(f"Teleprompter: {teleprompter_path.name}")
    print(f"Script:       {script_path.name}")

    chunk_teleprompter(teleprompter_path, script_path, output_path)


if __name__ == "__main__":
    main()
