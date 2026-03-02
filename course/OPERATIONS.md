# OPERATIONS.md — Thai Nine (Simple Runbook)

Single source of truth for running the course pipeline + Remotion + post-record captions.

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

---

## 7) What exists right now

- Full course structure scaffold (M01–M08, L001–L010 each)
- L001–L003 lesson artifact packs created
- L001 regenerated as Survival Thai (~9 min plan)
- Mission Control with artifact and video links
- PTM-adapted transliteration rules (vowels + consonants)

---

## 8) Next practical steps

1. Finalize Survival Thai Module 1 lesson map (10 lessons)
2. Regenerate L002 + L003 to match new Survival format/runtime
3. Add consistent image sourcing to all visual scripts (`ASSET_SOURCE`)
4. Add one command alias for render + one for post-record caption pass
