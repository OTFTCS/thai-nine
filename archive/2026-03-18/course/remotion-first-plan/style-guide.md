# Immersion Thai with Nine — Content Style Guide

## Voice & tone
- Nine sounds warm, practical, and encouraging.
- Explain in plain English, then model natural Thai.
- Keep each lesson focused: 1 primary objective.

## Script formatting
- Thai line format: `THAI | PTM-adapted transliteration | English`.
- Transliteration standard file: `/course/transliteration-ptm-vowels.json`.
- Spoken script markers:
  - `[THAI: ...]` Thai lines Nine says naturally.
  - `[PAUSE 3s]` / `[PAUSE 5s]` learner response window.
  - `[SCREEN: ...]` visual cue synchronized with spoken line.
- Keep sentence lines short for teleprompter readability.

## Tone notation policy (important)
- Do **not** use superscript tone letters (`ᴴ ᴹ ᴸ ᴿ` or `H/M/L/R` tags).
- Always mark tones inline in transliteration using diacritics on vowels.
  - Low: grave (`à`)
  - Falling: circumflex (`â`)
  - High: acute (`á`)
  - Rising: caron (`ǎ`)
  - Mid: unmarked (default)
- Examples: `mái`, `khâo`, `rót`, `gàao`.

## Consonant transliteration policy (PTM-consistent)
- Consonant mapping source file: `/course/transliteration-ptm-consonants.json`.
- Preserve key PTM contrasts:
  - `b` vs `bp`
  - `d` vs `dt`
  - `kh/ch/th/ph` for aspirated initials
- Final consonants must use canonical Thai final categories:
  - stop finals: `k`, `t`, `p`
  - sonorant finals: `ng`, `n`, `m`, `y`, `w`
- Do not improvise alternate spellings (e.g., avoid mixing `p`/`bp` or `d`/`dt` arbitrarily).

## Pedagogy rules
- Input progression: easy → practical → realistic.
- Reuse vocabulary in at least 3 different contexts per lesson.
- One micro-quiz per lesson (5–8 items).
- No unseen vocabulary in quiz.

## Linguistic quality rules
- Prefer spoken Thai used in Bangkok urban contexts unless noted.
- Flag register-sensitive forms (formal vs casual).
- Avoid textbook-literal translations when natural equivalents exist.

## Visual asset sourcing policy (cost control)
- **Default rule:** use internet-sourced images first (royalty-free / reusable) for Remotion visuals.
- Prioritize:
  1) Open-license stock/illustration/icon sources
  2) Emoji + simple vector UI elements
  3) Existing local asset library
- **Do not** use generated-image tools (e.g., Nano Banana Pro) unless explicitly approved for a specific lesson.
- Every visual script should include an `ASSET_SOURCE` note per image block (URL or local path).
- If no suitable internet image is found quickly, fall back to emoji/vector placeholders and continue production.

## Post-record captions (TikTok-style layer)
- Caption layer is produced **after** Nine records, not baked into lesson planning visuals.
- Workflow:
  1. Record Nine camera take.
  2. Run transcription (`npm run transcribe` in `thaiwith-nine-remotion`) or Whisper equivalent.
  3. Clean timestamps + wording.
  4. Burn TikTok-style captions as a separate post layer (bottom-safe area, high contrast, per-phrase timing).
- Keep this caption layer independent from Remotion teaching cards so graphics can be reused without re-authoring captions.

## Ready-to-record gate
A lesson can be marked `READY_TO_RECORD` only when:
1. `brief.md`, `script-spoken.md`, `script-visual.md`, `quiz.json`, `qa-checklist.md` exist.
2. `qa-checklist.md` has all required checks marked pass.
3. `status.json` has `state=READY_TO_RECORD` and `validatedAt` timestamp.
4. `pipeline validate --lesson <id>` passes.
