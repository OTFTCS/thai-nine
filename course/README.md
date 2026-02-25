# Course Pipeline (Immersion Thai with Nine)

Deterministic production tree for lessons and quizzes.

## Canonical paths
- Manifest: `course/manifest.yaml`
- Lessons: `course/modules/Mxx/Lyyy/`
- Placement quizzes: `course/quizzes/`
- Run log: `course/runlogs/latest.md`
- CLI: `course/tools/pipeline-cli.ts`

## Commands
```bash
npm run course:validate
npm run course:lint
node --experimental-strip-types course/tools/pipeline-cli.ts validate --lesson M01-L001
node --experimental-strip-types course/tools/pipeline-cli.ts set-status --lesson M01-L004 --state DRAFT
node --experimental-strip-types course/tools/pipeline-cli.ts touch-runlog --message "Drafted M01-L004 brief"
```

## Resumability
- Each lesson stores status in `status.json`.
- `READY_TO_RECORD` lessons must include full artifacts and pass validation.
