# OPERATIONS.md — Thai Nine (Simple Runbook)

Single source of truth for running the course pipeline + Remotion + post-record captions.

For a compact lesson-production checklist, see `course/LESSON_PRODUCTION_SOP.md`.

---

## 1) Daily workflow (short version)

1. Pick lesson(s)
2. Generate/update content files
3. Validate
4. Render Remotion preview (optional before recording)
5. Record Nine
6. Add TikTok-style captions (post-record)
7. Mark status + log

---

## 2) Where things live

- Course manifest: `course/manifest.yaml`
- Lessons: `course/modules/Mxx/Lyyy/`
- Run log: `course/runlogs/latest.md`
- Pipeline CLI: `course/tools/pipeline-cli.ts`
- Transliteration rules:
  - `course/transliteration-ptm-vowels.json`
  - `course/transliteration-ptm-consonants.json`
  - `course/transliteration-policy.md` (hard gate + audit behavior)
- Mission Control dashboard: `http://localhost:3000/mission-control`

---

## 3) Core commands (copy/paste)

From repo root (`/Users/immersion/Thai Nine`):

```bash
npm run course:validate
npm run course:lint
npm run course:produce -- --next
npm run course:produce -- --lesson M01-L004
node --experimental-strip-types course/tools/pipeline-cli.ts fixup-vocabids --lesson M01-L004
node --experimental-strip-types course/tools/pipeline-cli.ts validate --lesson M01-L001
node --experimental-strip-types course/tools/pipeline-cli.ts set-status --lesson M01-L001 --state DRAFT
node --experimental-strip-types course/tools/pipeline-cli.ts touch-runlog --message "Updated M01-L001"
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit
node --experimental-strip-types course/tools/pipeline-cli.ts translit-audit --lesson M01-L001 --fix
```

State values currently supported:
- `DRAFT`
- `READY_TO_RECORD`
- `PLANNED`
- `BACKLOG`

Operational truth:
- Lesson order and naming come from `course/exports/full-thai-course-blueprint.csv`
- Runtime lesson state comes from each lesson `status.json`
- `course/manifest.yaml` is convenience metadata, not the production state source

Multi-agent lesson production:
1. Run `npm run course:produce -- --next` or pass an explicit lesson id.
2. The command runs stage 0, writes `codex-stage1-work-order.md`, and waits for stage 1 files if they do not exist yet.
3. Stage 1 must now include:
   - `teachingFrame` in `script-master.json`
   - `visualPlan` in every section
   - image search queries only where a real-world image genuinely helps the lesson
4. After stage 1 files are written, rerun the same command.
5. The command runs `fixup-vocabids`, QA, repair handoff if needed, then deterministic stages 3-7.
6. Stage 3 now derives Remotion scenes with a left teaching zone and right-third camera-safe zone.
7. On success it marks the lesson `READY_TO_RECORD` in `status.json`.

---

## 4) Remotion preview workflow

```bash
cd "thaiwith-nine-remotion"

# list compositions
npx remotion compositions src/index.ts --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# render lesson preview
npx remotion render src/index.ts Episode001-L001 out/episode001.mp4 --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Current outputs:
- `thaiwith-nine-remotion/out/episode001.mp4`
- `thaiwith-nine-remotion/out/episode002.mp4`

---

## 5) Caption workflow (post-record, TikTok style)

Important: captions are done **after** Nine records.

1. Record Nine camera take
2. Transcribe:
   ```bash
   cd "thaiwith-nine-remotion"
   npm run transcribe
   ```
3. Edit timestamps + wording
4. Burn captions as final layer (high contrast, bottom-safe area)

This keeps Remotion teaching visuals reusable across takes.

---

## 6) Visual asset policy (cost control)

Default rule: use internet-sourced reusable images first.

Priority order:
1. Open-license web images/icons
2. Existing local assets / emoji / vector placeholders
3. Generated images (only when explicitly approved)

Do not default to paid image generation.

For new lessons:
- every section must say whether the best support is a real image, an icon/diagram, or text-only
- the visual rationale must be explicit
- the right third of the 16:9 frame remains reserved for Nine's camera

---

## 7) What exists right now

- Full course structure scaffold (M01–M08, L001–L010 each)
- L001–L003 lesson artifact packs created
- L001 regenerated as Survival Thai (~9 min plan)
- Mission Control with artifact and video links
- PTM-adapted transliteration rules (vowels + consonants)

---

## 8) Next practical steps

1. Produce `M01-L004` through the new stage-1 packet and inspect QA feedback
2. Regenerate L002 + L003 to match the stronger teaching-frame and visual-plan standard if you want consistency across the first module
3. Add a real asset download/selection pass if you want the pipeline to fetch image files rather than just generate research-ready asset plans
4. Add one command alias for render + one for post-record caption pass
