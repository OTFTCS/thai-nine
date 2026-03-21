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

## Human quick reference (script-writing)
Use this section when drafting scripts manually before running audit.

### Frequent words (approved forms)
- สวัสดี → `sà-wàt-dii`
- ขอบคุณ → `khàawp-khun`
- ขอโทษ → `khǎaw-thôot`
- ไม่เข้าใจ → `mâi khâo-jai`
- พูดช้าๆ ได้ไหม → `phûut cháa-cháa dâai mái`
- ครับ → `khráp`
- ค่ะ → `khâ`
- คะ → `khá`
- อยู่ → `yùu`
- บอกว่า → `bàawk wâa`
- หมอ → `mǎaw`
- รอ → `raaw`

### Common mistakes we keep seeing
- **Do not use IPA glyphs** in learner transliteration.
  - Wrong: `mɔ̌ɔ`
  - Right: `mǎaw`
- Keep PTM long-vowel spellings consistent (`aa`, `aaw`, `aao`, etc.) using canonical mappings.
- Do not mix systems in one file (for example PTM + IPA forms together).
- Keep polite particles exact (`khráp`, `khâ`, `khá`) and do not flatten tone marks.

### Pre-publish checklist (for writers)
Before submitting scripts/lesson artifacts:
1. Every learner-facing Thai line has a full `Thai | translit | English` triplet.
2. Transliteration uses inline tone marks only (no superscripts/caret/legacy suffix tones).
3. No IPA symbols appear anywhere in transliteration fields.
4. High-frequency words match approved forms in this file.
5. Run `translit-audit` and resolve all violations.

If unsure about any spelling, check:
- `course/transliteration-ptm-vowels.json`
- `course/transliteration-ptm-consonants.json`
- `course/tools/lib/transliteration-policy.ts`

## Where this is enforced
Hard validators cover:
- `script-master.json`
- `script-spoken.md`
- `script-visual.md`
- `deck-source.json`
- `pdf-source.json`
- `pdf.md`
- `flashcards.json`
- `vocab-export.json`
- `quiz-item-bank.json`
- `quiz.json`
- lesson `context.json`
- global vocab exports/index

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
- Stage 7 release gate blocks on any transliteration drift in lesson + deck artifacts.
