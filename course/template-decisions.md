# Course Template Decisions Log

**What this is:** A reverse-chronological log of changes to the course lesson template (the stage-1 prompt at `course/prompts/agent-prompts/stage-1-script-generation.prompt.md`, the embedded `script-master.json` schema, and the multi-stage pipeline that consumes it).
**What it isn't:** Per-lesson notes, idea backlog, or a discussion thread.
**When to write an entry:** Whenever the template's logical structure changes (a new section type, a renamed field, a new pedagogy constraint), or the validator's rules change. Writing a new lesson that follows the existing template does NOT trigger an entry.

## How to use the prompt-feedback loop

1. Nine annotates eval-run scripts at `/admin/creator/eval/course/<run>/<lesson>` (per-section rating + comment + an overall).
2. Run `python3 scripts/aggregate_prompt_feedback.py --type course` to roll up new annotations into `course/notes/prompt-feedback-notes.md`.
3. Read the new section(s) at the top of that file; pay attention to recurring `rework` reasons across lessons.
4. Edit `course/prompts/agent-prompts/stage-1-script-generation.prompt.md` by hand to address the recurring issues. Don't rewrite sections nobody complained about.
5. Re-generate the affected lessons against the new prompt; eyeball the new outputs against the rework comments. (No automated course judge yet; eyeball comparison is the v1 pattern.)
6. If the prompt change improved things, commit the prompt edit and add a new entry below. If it didn't, `git checkout` the prompt and document the dead end as a one-liner here so we don't repeat it.

The aggregation script fails closed on prompt-SHA drift: if you've already edited the prompt before rolling up annotations made against the previous version, it refuses to run without `--force`. This is by design - it stops the loop from producing diffs that contradict half-applied state.

---

(No entries yet. The first entry should follow the format used in `youtube/template-decisions.md`: dated `## YYYY-MM-DD` heading, then `**Change:** ...`, `**Schema:** ...` (if applicable), `**Validator:** ...` (if applicable), `**Rationale:** ...`, `**Affects:** ...`, `**Decided by:** ...`.)
