# Immersion Thai with Nine — Content Style Guide

## Dual-purpose lessons
Every lesson is designed for two delivery modes:
1. **Self-paced online course** — learner watches the pre-recorded lesson at their own pace
2. **Live 1:1 teaching with Nine** — Nine uses the deck as a teaching guide in a private session

Scripts and decks must work for both. Use "You" (not "Learner") in roleplay labels so it feels like a direct conversation. Keep drills actionable whether the learner is alone or with a teacher.

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
- Max 5–7 new vocabulary items per lesson (A0); 8–10 for A2+.
- Max 2–3 new items per section before practice begins.
- At least 40% of drill moments must require learner production (speaking), not just recognition.
- Each new item must appear in 3+ varied contexts across the lesson.
- At least 1 drill format should appear twice with different content (task repetition with variation).
- Multi-word chunks (ไม่เป็นไร, ยินดีที่ได้รู้จัก) are taught as whole units first, then optionally decomposed.

## Thai pronunciation pedagogy

Pronunciation is embedded in every lesson, not isolated to dedicated modules.

### Principles
- Thai tones are the #1 challenge for Western learners. Every lesson is an opportunity to train the ear.
- Pronunciation is taught through minimal pairs, physical mouth descriptions, and repeated contrast — not just labeled.
- Tone errors correlate with Thai script competence; connecting sound to script accelerates both.

### Required: Pronunciation Beat (from M01-L002 onwards)
Every lesson includes a 60–90 second pronunciation micro-segment with:
- **Target sounds**: what contrast is being drilled this lesson
- **Minimal pairs**: at least 1 meaning-changing pair using lesson vocabulary where possible
- **Mouth-map anchor**: physical description of how to produce the sound
- **At least 1 pronunciation-focused drill** (minimal pair choice, tone echo, tone pattern, or aspiration contrast)

### Pronunciation progression
| Module range | Focus |
|---|---|
| M01–M02 | Individual sounds absent from English (aspirated vs unaspirated: ก/ข, ด/ท, บ/ป) |
| M02–M03 | Tone contrasts via meaning-changing minimal pairs (ไก่/ไข่, มา/ม้า, ใกล้/ไกล) |
| M04–M06 | Tone drills using lesson vocabulary; learner chooses correct tone |
| M07+ | Connected speech, rhythm, reduction patterns, natural speed |

### Good mouth-map anchors
- "Rising tone starts low and lifts up, like the end of a question in English"
- "Falling tone starts high and drops sharply, like saying 'No!' firmly"
- "kh has a puff of air, like 'k' in 'kite'. g has no air puff, like 'g' in 'go'"
- "The 'ng' sound at the start of a word — English has it at the end (si-ng) but not the start. Try starting from the 'ng' in 'singing'"

### Bad pronunciation teaching
- Labeling tones without modeling or contrasting them
- Listing tone rules without any practice
- Skipping pronunciation because "the lesson is about vocabulary"

## Linguistic quality rules
- Prefer spoken Thai used in Bangkok urban contexts unless noted.
- Flag register-sensitive forms (formal vs casual).
- Avoid textbook-literal translations when natural equivalents exist.

## Visual asset sourcing policy (cost control)
- **Default rule:** use internet-sourced images first (royalty-free / reusable) for PPTX lesson decks.
- Prioritize:
  1) Openverse
  2) Wikimedia Commons
  3) Existing local asset library
- **Do not** use generated-image tools unless explicitly approved for a specific lesson.
- `deck-source.json` and `asset-provenance.json` must record what each image is teaching and where it came from.
- If no suitable internet image is found quickly, fall back to a text-only or card-based PPTX layout and continue production.
- Stage 3 should also emit a Canva-first pack with locked `canva-backgrounds/slide-XX.png`, `canva-content.json`, and `canva-deck.pptx`.
- Canva exports must use `Sarabun` for Thai, transliteration, and English so mixed learner-facing lines stay in one stable family.
- On learner-facing beginner slides, visible Thai should render as `Thai (PTM transliteration)` while English support remains visible where helpful.
- Visible production notes such as recording cues or presenter-mode instructions must stay out of slide copy.
- Canva is a finishing surface only; spacing fixes discovered there must be copied back into the repo layout contract.

## Post-record captions (TikTok-style layer)
- Caption layer is produced **after** Nine records, not baked into lesson deck visuals.
- Workflow:
  1. Record Nine camera take.
  2. Run transcription or Whisper equivalent on the recorded take.
  3. Clean timestamps + wording.
  4. Burn TikTok-style captions as a separate post layer (bottom-safe area, high contrast, per-phrase timing).
- Keep this caption layer independent from PPTX teaching cards so graphics can be reused without re-authoring captions.

## Ready-to-record gate
A lesson can be marked `READY_TO_RECORD` only when:
1. `brief.md`, `script-master.json`, `script-spoken.md`, `script-visual.md`, `deck-source.json`, `deck.pptx`, `asset-provenance.json`, `pdf.md`, `quiz.json`, and required QA reports exist.
   Canva pack outputs should also exist for new stage-3 runs: `canva-content.json`, `canva-deck.pptx`, `canva-import-guide.md`, and `canva-backgrounds/slide-XX.png`.
2. Editorial, visual, and assessment QA reports all say `Result: PASS`.
3. `status.json` has `state=READY_TO_RECORD` and `validatedAt` timestamp.
4. `pipeline validate --lesson <id>` passes.
