# Transliteration Policy (PTM-Adapted, Hard-Enforced)

This repository enforces a single transliteration standard for all learner-facing artifacts.

## Canonical standard
- **Scheme:** PTM-adapted inline tones.
- **Required style:** inline tone diacritics on vowels (`à á â ǎ ...`), not superscripts.
- **Primary implementation:** `course/tools/lib/transliteration-policy.ts`

## Forbidden patterns (build blockers)
- IPA-like symbols (examples): `ʉ ə ɯ ɤ œ ɨ ɪ ʊ ŋ ɲ ɕ ʔ ː`
- Superscript tones: `ᴴ ᴹ ᴸ ᴿ`
- Caret tones: `^H ^M ^L ^R`
- Legacy trailing suffix tones: `wordH wordM wordL wordR`

## Allowed character class
Transliteration strings are restricted to PTM-compatible latin characters, inline tone marks, digits, spacing, and controlled punctuation (see exported `PTM_ALLOWED_CHARACTER_CLASS`).

## Where this is enforced
Hard validators cover:
- `script-master.json`
- `script-spoken.md`
- `script-visual.md`
- `remotion.json`
- `pdf-source.json`
- `pdf.md`
- `flashcards.json`
- `vocab-export.json`
- `quiz-item-bank.json`
- `quiz.json`
- lesson `context.json`
- global vocab exports/index
- `thaiwith-nine-remotion/src/data/*.json` (`phonetics`)

## Audit + repair command
Use:

```bash
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit --fix
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit --lesson M01-L001 --fix
```

Behavior:
- `translit-audit` → reports violations.
- `translit-audit --fix` → applies safe normalizations, reports manual-review items.

Deterministic exit codes:
- `0` = clean (or fully fixed with no remaining/manual items)
- `2` = transliteration drift still present and/or manual review required
- `1` = command/config error (for example no valid audit targets)

## CI / release gate behavior
- Stage 2 QA blocks on script transliteration violations.
- Stage 7 release gate blocks on any transliteration drift in lesson + remotion data artifacts.
