# W6 Vocab + Chunk Inserts — Deferred

## Why this is a TBD

The approved plan's W6 step references 50 vocab items + 11 chunks from an "R2 audit" and names specific placements (e.g. M08-L006 ← BTS/MRT/วิน/Grab, M12-L004 ← เซเว่น + hospital + post office). When applied against the current v2 CSV, the named target lessons do not yet teach the assumed scenarios:

| Plan insert | Assumed target scenario | Current v2 row scenario | Gap |
|---|---|---|---|
| BTS / MRT / วิน / Grab bundle → M08-L006 | Bangkok transit modes | Clothing sizes (เสื้อ/กางเกง/รองเท้า/ไซซ์) | Whole-lesson re-scope |
| เซเว่น culture note + hospital + post office → M12-L004 | Small-business errands | Phone etiquette (โทรกลับ / ฝากข้อความ) | Whole-lesson re-scope |
| เห็น → M04-L001 | Natural first occurrence | Numbers / money (สิบ / ยี่สิบ / ร้อย) | Orthogonal topic |
| สบายดีไหม → M01-L002 | Greeting check-in | Names / countries | Belongs in M01-L001 |
| 4 motion verbs (นั่ง / ยืน / เดิน / วิ่ง) → M05-L003 | Motion | Daily routines (ตื่น / อาบน้ำ / ทำงาน) | Compatible extension |
| Particle trio (อ่ะ / งับ / จ้ะ) → M07-L008 | Signs + announcements | Signs + announcements | Compatible, but particles belong in M06-L009 Discourse Particles |
| Kin terms ลุง / ป้า / ยาย → M03-L008 | Classifiers + family overflow | Classifiers only | Compatible extension; M03-L007 must also pick up the kin-term core itself (W2b) |
| เช็คบิล / คิดเงินด้วย / ไม่เผ็ด → M04-L007 | Paying the bill | Ordering drinks (ขอ / เอา / น้ำ / ชา) | Compatible extension; aligns with the top-20 retitle |

## What this means

Some inserts are compatible (M03-L008 kin overflow, M04-L007 payment chunks, M05-L003 motion verbs, M06-L009 particles). Others require an upstream scenario re-shape of the displaced lesson (M08-L006 transit, M12-L004 errands) before vocab can land cleanly. The plan assumed a post-W2b state where W2a shells had already triggered scenario migration in neighbouring rows. That migration is a W2b deliverable, not W2a.

## What to do next

- **Do NOT author fabricated vocab into mismatched rows.** That would be R2-audit theatre.
- **Co-working session with Nine** (~1 hour) to walk through the v2 CSV module by module and confirm which lessons get re-scoped vs which stay. Output: an authoritative `w6-inserts-v2.csv` with `lesson_id, thai, english, placement_type (new_vocab / new_chunk / review_vocab), confirmed_by_nine (y/n)`.
- **Then** run `course/tools/apply-w6-inserts.ts` (to be written) that reads `w6-inserts-v2.csv` and patches the blueprint row-by-row, writing a `W6-insert:` note trail in each modified row.
- **Then** re-run `npm run course:validate` and dedup annotator.

## Compatible inserts safe to author now (if desired, with Nine's nod)

These four are scenario-compatible with current rows and can land without re-scope:

1. **M03-L008** — append kin-term overflow: `ลุง = uncle (father's older brother / any middle-aged man); ป้า = aunt (mother's older sister / any middle-aged woman); ยาย = maternal grandmother / elderly woman; ตา = maternal grandfather / elderly man` into `new_vocab_core`. Update notes: `W6-insert: kin-term overflow from M03-L007`.
2. **M04-L007** — append payment chunks: `เช็คบิล = check / bill please; คิดเงินด้วย = please calculate / settle up; ไม่เผ็ด = not spicy` into `new_chunks_core`. Aligns with the "How to Pay the Bill in Thai" top-20 retitle.
3. **M05-L003** — append motion-verb bundle: `นั่ง = sit; ยืน = stand; เดิน = walk; วิ่ง = run` into `new_vocab_core` (or move to `review_vocab_required` if they surface in M04). Compatible with daily-routine framing.
4. **M06-L009** — replace old repair vocab (already being displaced by the W2a shell) with the discourse-particle core in W2b. No W6 insert needed; the particle trio in the plan is already the W2a shell content.

## Scope boundary

W6 was sized for "50 vocab items + 11 chunks" in the plan. After reality-check against the v2 CSV, the confirmed insert footprint is ~12–15 items across 3–4 rows. The remaining "50" figure assumed an R2 audit document that is not in the repo. Treat the plan's W6 line as aspirational until Nine surfaces the source, or close it out with the 4 compatible inserts above.

## Status

Deferred pending Nine review. Does not block the Step 9 smoke test (loader does not gate on vocab content) or W7–W10 lever work. Unblocks cleanly once the co-working session produces `w6-inserts-v2.csv`.
