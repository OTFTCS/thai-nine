# Thai Course Production Pipeline v1

## Goal
Build a repeatable, semi-automated pipeline to produce high-quality Thai lessons fast, while keeping Nine’s human delivery central.

## Current state
- Vision is clear: automate script + visuals; keep live speech/human presence.
- Tooling exists (Remotion-capable project present).
- Need production system + quality gates.

---

## Production system (single lesson)

1. **Lesson brief generation**
   - Input: lesson objective, target level, vocabulary set, scenario
   - Output: one-page lesson brief

2. **Script draft generation (AI)**
   - Output A: Nine’s spoken script
   - Output B: visual companion script (Thai text, glosses, examples)

3. **Editorial pass (human)**
   - Tighten naturalness, cultural appropriateness, pacing
   - Ensure no awkward/unnatural Thai examples

4. **Asset generation (AI + templates)**
   - On-screen text cards
   - Example sentence cards
   - Mini dialogue cards
   - Quiz slides

5. **Record Nine’s delivery**
   - Camera framing + clean audio
   - Read from approved script only

6. **Remotion assembly**
   - Left/right split layout (Nine + dynamic lesson visuals)
   - Timing sync with speech beats

7. **Quiz packaging**
   - Add lesson quiz JSON/MD + answer key

8. **QA + publish prep**
   - Pedagogy QA
   - Language QA
   - Video QA
   - Export + metadata

---

## File/folder convention (proposed)

```text
Thai Nine/
  course/
    curriculum/
      module-01/
        lesson-01/
          lesson-brief.md
          script-spoken-v1.md
          script-visual-v1.md
          vocab-list.json
          quiz-v1.json
          qa-checklist.md
          exports/
            lesson-01-v1.mp4
```

---

## Standard templates (must-have)

1. `lesson-brief-template.md`
2. `spoken-script-template.md`
3. `visual-script-template.md`
4. `quiz-template.json`
5. `qa-template.md`

---

## QA gates (hard)

### Language QA
- Thai examples natural and contextually valid
- English gloss clear but not misleading
- Pronunciation prompts consistent

### Teaching QA
- One main objective per lesson
- Examples progress from easy → realistic
- Practice opportunities included

### Video QA
- Text legible on mobile
- Timing synced with speech
- No visual clutter
- Audio clean and balanced

### Release QA
- Title, description, tags, CTA complete
- Quiz attached
- Next-lesson recommendation linked

---

## Throughput target (realistic)
- **Pilot cadence:** 2 lessons/week finished end-to-end
- **After stabilization:** 3–4 lessons/week

---

## Automation boundary (important)
Automate:
- brief generation
- draft scripting
- on-screen text assets
- quiz draft
- render assembly templates

Keep human-controlled:
- final Thai correctness
- Nine’s spoken delivery
- final editorial tone

---

## Acceptance criteria
- 3 lessons produced with same pipeline and minimal process changes
- QA checklists completed for all 3
- Avg production time/lesson reduced by week 3

---

## Risks / unknowns
- AI-generated Thai can sound textbook/unnatural without strong editorial pass
- Remotion timing may become bottleneck if templates are not standardized
- Inconsistent naming/folders can break automation quickly
