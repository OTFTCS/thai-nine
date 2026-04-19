# Canva Import Guide — M01-L002

## What stage 3 generated

- `M01-L002-canva-deck.pptx`
- `M01-L002-canva-content.json`
- `M01-L002-canva-import-guide.md`
- `canva-backgrounds/slide-XX.png`

## One-shot Canva workflow

1. Upload `Sarabun` to Canva Brand Kit.
2. Use `Sarabun` for Thai, transliteration, and English so mixed learner-facing lines stay in one font family.
3. Make sure the custom Thai font is available in Canva before importing the deck.
4. Import `M01-L002-canva-deck.pptx` into Canva only as a bootstrap copy.
5. Build or update a Canva master template from the same slide families listed below.
6. Treat the PNG backgrounds as locked geometry.
7. Change only text fields and image swaps in Canva.
8. Keep the inline learner-facing format as `Thai (PTM transliteration)` everywhere Thai appears.

## Font reliability rule

- This export writes Thai runs with `th-TH` language metadata and explicit `latin`, `ea`, and `cs` typefaces set to `Sarabun`.
- The deck theme also declares `Sarabun` for both Thai script and the default Latin theme font so mixed lines keep one professional reading style.
- If Canva still substitutes the font on the first import, apply `Sarabun` once with Canva's replace-all behavior inside the master template, then save that template as the stable Canva starting point.

## Slide families used in this lesson

- `opener`
- `objectives-list`
- `dual-card-shared-reply`
- `response-triad`
- `stacked-phrase-cards`
- `drill-rows`
- `roleplay-ladder`
- `recap-checklist`
- `closing`

## Roundtrip rule

- Canva is the finishing surface, not the source of truth.
- If you improve spacing or placement in Canva, copy that fix back into the repo layout contract before reusing it.
- Do not rely on “edit in Canva, download, and re-import” as the system.

## Production rule

- Do not use Canva AI slide generation for production layouts.
- It is fine for brainstorming copy, but final geometry should come from the repo export pack and master template.
