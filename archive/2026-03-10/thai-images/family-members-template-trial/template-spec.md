# Family Members Template Trial

This folder is the phase-1 trial for the fixed Thai carousel format.

## Format

- Canvas: `1080x1350` (`4:5`)
- Templates:
  - `cover`
  - `teaching-pair`
  - `teaching-single`
- Visual system:
  - one fixed textured cover background
  - one fixed textured teaching background
  - one framed image slot near the top
  - fixed text slots below
  - no per-slide layout redesign

## Locked Text Order

Each teaching block always uses this order:

1. English
2. Thai
3. Transliteration
4. Breakdown with transliteration
5. Example Thai
6. Example transliteration
7. Example English

## Files

- `carousel-manifest.json`
  - source-of-truth slide manifest for the family-members trial
- `template-layout.json`
  - fixed coordinates, colors, and font sizes
- `template-assets/cover-background.png`
  - reusable cover background
- `template-assets/teaching-background.png`
  - reusable teaching background
- `copy-spec.md`
  - readable export of slide copy and prompts
- `copy-spec.csv`
  - tabular export of slide copy and prompts
- `transliteration-validation-report.json`
  - records the transliteration reference files used for validation
- `family-members-template-trial.pptx`
  - editable master deck
- `final-png/`
  - flat slide exports
- `preview/contact-sheet.jpg`
  - contact sheet for quick review

## Manifest Shape

Top-level fields:

- `title`
- `slug`
- `size`
- `providerDefaults`
- `slides`

Per slide:

- `index`
- `kind`
- `image`
- `image_prompt`
- `chip_text`
- `heading`

Cover-only fields:

- `thai`
- `translit`
- `breakdown`
- `example`

Pair slide fields:

- `items`
  - each item contains:
    - `english`
    - `thai`
    - `translit`
    - `breakdown`
    - `example`

Single slide fields:

- `item`
  - contains the same fields as a pair item

## Transliteration Enforcement

Validation is run before PPTX or PNG export.

Primary sources:

- `/Users/Shared/work/thai-nine/thai-transliteration-standard.md`
- `/Users/Shared/work/thai-nine/course/transliteration-policy.md`
- `/Users/Shared/work/thai-nine/src/lib/quiz/transliteration.ts`
- `/Users/Shared/work/thai-nine/course/transliteration-ptm-vowels.json`
- `/Users/Shared/work/thai-nine/course/transliteration-ptm-consonants.json`

Practical rule:

- exact repo-approved transliterations win when available
- runtime-allowed characters from `src/lib/quiz/transliteration.ts` take precedence over stale prose conflicts
- `คือ` is hard-pinned to `kheuu`
