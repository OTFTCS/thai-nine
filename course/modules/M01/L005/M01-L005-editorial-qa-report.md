# Editorial QA Report — M01-L005

Result: PASS

## Checks
- Roleplay realism: PASS — the scene now has a coherent school-reception flow: polite attention-getter, object question, bathroom location question, room confirmation, and a natural thank-you/no-problem close.
- Pragmatic phrase use: PASS — `ขอโทษ`, `ใช่`, `ขอบคุณ`, and `ไม่เป็นไร` each appear with a sensible conversational trigger.
- Teaching clarity: PASS — the lesson explains both question words clearly, highlights the question-word-at-the-end pattern, and gives a simple practical explanation of `อยู่` without turning it into a heavy grammar lecture.
- Drill usefulness: PASS — the drills move from pointing and short answers into subject swaps and role swaps instead of repeating the same prompt mechanically.
- Review integration: PASS — the lesson reuses `นี่คือ...`, `คุณ`, `เขา`, and the digits from `M01-L004` in a way that supports the new objective rather than distracting from it.

## Edits made
- Removed the standalone learner-facing triplet for `คุณ` because it cannot satisfy the current inline-tone transliteration policy on its own.
- Tightened section 3 so `คุณ` stays inside full useful chunks such as `คุณอยู่ที่ไหน`.
- Repaired the answer to `นี่อะไรคะ` so it reuses the earlier review frame `นี่คือ...` instead of introducing a bare-noun answer.
- Updated the matching lines in `script-master.json`, `script-spoken.md`, and `script-visual.md` so the lesson pack stays aligned.

## Remaining concerns
- None.
