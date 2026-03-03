# Immersion Thai Transliteration Standard (Canonical)

This is the canonical transliteration policy for quiz content in this repo.

## Rules

1. Thai script is always shown.
2. Transliteration is always shown.
3. Use the project's chosen romanization style consistently (e.g. `jer-gan gii moong`).
4. Tone diacritics are allowed where they are part of this style, but are not mandatory on every phrase.
5. Avoid mixed transliteration styles within the same bank.

## Why this exists

Tone is meaning in Thai. If transliteration omits tone marks, learners build incorrect pronunciation and listening models.

## Enforcement

Question banks are validated by `src/lib/quiz/transliteration.ts` at import time.
If a transliteration string is missing or not Latin-script transliteration, the app throws so invalid content cannot ship silently.
