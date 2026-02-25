# Implementation Notes & Assumptions

## Assumptions
1. MVP priority is Module 1 (`M01`) lessons 1–10, with full production artifacts for `L001`–`L003`.
2. Lessons are represented by deterministic IDs: `M{module:02d}-L{lesson:03d}`.
3. Canonical lesson path is: `/course/modules/Mxx/Lyyy/`.
4. `READY_TO_RECORD` means textual artifacts are complete and validated; it does **not** imply rendered video exists yet.
5. Placement quiz `v0` is diagnostic only (not scored for certification) and can evolve independently of lesson micro-quizzes.
6. Existing docs in repo are source references; pipeline artifacts in `/course` are treated as single source of production truth.

## Non-goals in this pass
- No Remotion render automation yet.
- No audio synthesis/export.
- No CMS publishing integration.
