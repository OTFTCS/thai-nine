# Thai Classifier TikTok Series

This series is intentionally separate from the Immersion Thai course. The goal is standalone TikTok performance: fast hooks, tight teaching, strong contrast, and no filler.

## Core rules

- Every episode must work if it is the first classifier video the viewer sees.
- Standard runtime target is 70-100 seconds.
- The overview opener can run 110-140 seconds.
- No video should exceed 180 seconds.
- No explanation stretch should run more than 10 seconds without a concrete example.
- End every episode with one transfer check using a noun that was not used in the opening example.

## Wave 1 classifiers

- อัน
- คน
- ตัว
- ใบ
- เล่ม
- คัน
- เครื่อง
- ลูก
- ชิ้น
- แก้ว
- ขวด

## Wave 2 reserve

- หลัง
- คู่
- ห้อง
- ฉบับ
- ครั้ง
- ชุด

## Implementation notes

- Use the `overview` runtime profile for episode 1.
- Use the `short` runtime profile for episodes 2-7.
- Keep the first two seconds punchy: start on the mistake, mismatch, or contrast.
- Skip greetings, branding intros, and any line that explains the obvious before the viewer has seen an example.
- Episode 1 must open on bad direct-translation attempts, correct them fast, and explain classifiers in counting, demonstrative phrases, and descriptive phrases.
- Episode 1 does not need to preview all 11 classifiers. Use the time for more incorrect-vs-correct examples instead.
- Every Thai example should show a literal word-for-word gloss on screen as well as the natural meaning.
- Use the strange literal gloss as a memory hook, not just as a translation note.
- Episode 3 is a standalone `อัน` episode. Do not bundle `อัน` with `คน` and `ตัว`.
- The structured production map lives in `episodes.json`.
- First-pass spoken scripts live as plain text files in `scripts/`.

## Deliverables in this folder

- `episodes.json` - structured episode map
- `scripts/*.txt` - first-pass spoken scripts with on-screen beats
