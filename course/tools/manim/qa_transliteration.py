"""PTM transliteration enforcement for the Manim pipeline.

Validates that transliteration strings use PTM-adapted inline tone marks
and do not contain forbidden IPA, superscript, or legacy tone notation.
"""

from __future__ import annotations

import re

# Forbidden IPA symbols (must never appear in PTM transliteration)
_FORBIDDEN_IPA = set("ʉəɯɤœɨɪʊŋɲɕʔː")

# Forbidden superscript tone letters
_FORBIDDEN_SUPERSCRIPT = set("ᴴᴹᴸᴿ")

# Legacy trailing tone patterns: wordH, wordM, wordL, wordR, wordF
_LEGACY_TONE_RE = re.compile(r"[a-z][HMLRF]\b")

# Caret tone patterns: ^H, ^M, ^L, ^R, ^F
_CARET_TONE_RE = re.compile(r"\^[HMLRF]")

# Allowed characters in PTM transliteration:
# Latin letters, inline tone diacritics on vowels, hyphens, spaces, apostrophes
_ALLOWED_RE = re.compile(
    r"^[a-zA-Z"
    r"àâáǎ"    # a with tones
    r"èêéě"    # e with tones
    r"ìîíǐ"    # i with tones
    r"òôóǒ"    # o with tones
    r"ùûúǔ"    # u with tones
    r"\-\s'."   # hyphen, space, apostrophe, period
    r"]+$"
)


def validate_translit(text: str) -> list[str]:
    """Validate a transliteration string against PTM rules.

    Returns a list of violation messages (empty = pass).
    """
    if not text or not text.strip():
        return ["Empty transliteration"]

    issues: list[str] = []

    # Check forbidden IPA
    found_ipa = _FORBIDDEN_IPA & set(text)
    if found_ipa:
        issues.append(f"Forbidden IPA symbols: {''.join(sorted(found_ipa))}")

    # Check forbidden superscripts
    found_super = _FORBIDDEN_SUPERSCRIPT & set(text)
    if found_super:
        issues.append(f"Forbidden superscript tone letters: {''.join(sorted(found_super))}")

    # Check legacy trailing tones
    legacy = _LEGACY_TONE_RE.findall(text)
    if legacy:
        issues.append(f"Legacy trailing tone notation: {', '.join(legacy)}")

    # Check caret tones
    caret = _CARET_TONE_RE.findall(text)
    if caret:
        issues.append(f"Caret tone notation: {', '.join(caret)}")

    # Check overall character validity
    if not _ALLOWED_RE.match(text):
        # Find the offending characters
        bad_chars = set()
        for ch in text:
            if not _ALLOWED_RE.match(ch):
                bad_chars.add(ch)
        if bad_chars:
            issues.append(f"Disallowed characters: {''.join(sorted(bad_chars))}")

    return issues
