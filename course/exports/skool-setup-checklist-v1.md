# Skool Setup Checklist v1, Opening-Day Runbook

## Context

Thai with Nine ships on Skool.com as a 180-lesson Thai course (4 stages, 18 modules, A0 to B2). This document is the step-by-step runbook for what you (Nine) do inside Skool admin to wire the launch. It assumes you have admin access to a Skool community already provisioned. No code is involved. Every step is a click in the Skool UI.

Read this top to bottom once before starting. The order matters: classrooms first, then Learning Paths, then community feed, then per-lesson wiring, then pre-launch QA.

Reference docs you will pull from while doing this:

- [tracks.json](tracks.json), the 4 curated tracks (A Travel, B Living, C Conversation, D Reading Lab)
- [stages.json](stages.json), the 4 stages and their module ranges
- [skool-metadata.csv](skool-metadata.csv), per-lesson `skool_display_title` and tags for the top-20 lessons
- [community-prompts.csv](community-prompts.csv), per-lesson community discussion prompts
- [skool-self-select-v1.md](skool-self-select-v1.md), the placement landing page spec
- [skool-badges-v1.md](skool-badges-v1.md), the badge catalogue

W7 (per-lesson PDFs), W8 (Anki decks), and W9 (quizzes) are pipeline outputs you attach inside Skool. Their files live under `course/modules/M??/L???/`.

## 1. Classrooms

Skool calls them "Classrooms". You need exactly **two**.

### 1.1 Main classroom

- Name: "Thai with Nine, Main"
- Visibility: members-only
- Structure (Skool calls them Sections, then Modules, then Lessons; we use them as Stages, then Modules, then Lessons):
  - Section S1 Foundations: M01, M03 (M02 hidden by default)
  - Section S2 Survival Thai: M04, M05, M06
  - Section S3 Everyday Thai: M08, M09, M10, M11, M12 (M07 hidden by default)
  - Section S4 Functional Fluency: M13, M14, M15, M16, M17, M18
- Module visibility: M02 and M07 are the literacy modules. Hide them in the Main classroom by setting their visibility to "Reading Lab opt-ins only" via a member tag (see step 1.3 below).
- Drip: turn drip OFF. All lessons unlocked. Order is suggested, not gated. The "Suggested next" bumper card (step 4.4) provides the path.

### 1.2 Reading Lab classroom

- Name: "Thai with Nine, Reading Lab"
- Visibility: members-only, opt-in
- Structure: Section "Reading Lab" containing M02 (10 lessons) and M07 (10 lessons), in that order.
- Drip: OFF.
- Add a single "Welcome" page at the top explaining the Lab is for learners who want to read and write Thai script. Link out to the Main classroom for spoken-Thai learners.

### 1.3 Reading Lab opt-in tag

- Under Members, Custom Fields, add a boolean field `reading_lab_enrolled`.
- Default: false.
- Toggling true unhides M02 and M07 in the Main classroom (you set the visibility rule on those modules to "show if `reading_lab_enrolled` is true").
- Add a single button on the Main classroom landing page titled "Open Reading Lab" that flips this field and grants access to the Reading Lab classroom.

## 2. Learning Paths (the 4 curated tracks)

Skool's Learning Paths feature lets you pin ordered playlists of lessons inside a classroom without duplicating content. You create 4 paths, all pinned in the Main classroom. Do **not** create separate classrooms for tracks.

For each track, do this:

1. Open Main classroom, click "Learning Paths", click "New Path".
2. Set name and description per the table below.
3. Add lessons in the exact order from `tracks.json` -> `ordered_lesson_ids`.
4. Mark the final lesson_id as the capstone (Skool calls this a "Final Lesson" badge).
5. Pin the Path to the classroom sidebar.

| Path name | Description (use this verbatim) | Source | Capstone |
|---|---|---|---|
| Travel Thai | 12 lessons that get you from "I just landed" to "I can book a hotel and tell a taxi where to go". A0 to A2. | tracks.json track A | M09-L005 |
| Living in Thailand | 26 lessons for residents and long-stay learners. Banking, healthcare, rental, neighbours, daily life. A0 to B1. | tracks.json track B | M15-L006 |
| Conversation-only | 30 lessons focused on speaking and listening. Skip reading and writing entirely. A0 to B2. | tracks.json track C | M18-L009 |
| Reading Lab | 20 lessons (M02 + M07) for learners who want to read Thai script and write by hand. A0 to A2. | tracks.json track D | M07-L010 |

After creating the 4 paths, confirm the path lesson ordering matches `ordered_lesson_ids` exactly. Skool does not validate this for you.

## 3. Drip and "Suggested next" bumper

- Drip is OFF, confirmed in step 1.1. Every lesson is open from day 1.
- The "Suggested next" mechanic is a card you paste into every lesson's lesson page (see step 4.4). It reads `active_track` from the learner's profile and links to the next lesson in that track.
- For learners with no `active_track` set, the bumper falls back to "Next lesson in this module" (the linear M0X-L00Y+1 default that Skool shows natively).

## 4. Community feed categories

Open the Community feed. Create 5 categories, in this order:

| Category | Purpose | Pinned post |
|---|---|---|
| Wins | Learners post achievements (recorded a real Thai conversation, ordered food in Thai, passed a capstone). | "How to post a win" + example video |
| Questions | Anything pedagogy or grammar. Nine and senior learners answer. | "Before you ask" FAQ |
| Tone Clinic | Learners post a 5-second voice memo, Nine and peers correct tones. | "How Tone Clinic works" + sample audio |
| Culture & Context | Stories, register, social norms. Lower-pressure, higher-warmth. | "Welcome to Culture & Context" |
| Live Sessions | Schedules and recordings of group calls and 1:1 office hours. | Calendar block |

Set posting permissions so every member can post in all 5. Pin the "How to post a win" example to Wins for the first 30 days.

## 5. Live 1:1 upsell surfaces

The Skool way to surface upsells is via lesson-page CTA blocks. Build one reusable CTA block called "Book 1:1 with Nine" (a button + 2-line blurb + Calendly link). Drop it on the following lesson pages:

- Every capstone end-card (4 capstones: M09-L005, M15-L006, M18-L009, M07-L010).
- After 3 failed attempts on any module quiz (Skool fires a member tag `quiz_3x_fail_M??`; you set up an automation to surface the CTA when that tag is present).
- Below every Tone Clinic post template (paste the CTA in the post template footer).
- After every track capstone, both inside the lesson page and in the post-completion DM.

Where Skool's automation rules cannot conditionally render a CTA on a lesson page, fall back to "always visible at bottom of capstone lesson pages". Better to over-show on capstones than under-show.

## 6. Per-lesson wiring (do this for all 180 lessons)

For each lesson page in Skool, attach 3 things and write 1.

### 6.1 Attach the one-pager PDF (W7 output)

- File location: `course/modules/M??/L???/docs/M??-L???-onepager.pdf`
- Skool: open the lesson, click "Add Document", upload the PDF, label it "Lesson one-pager (download and print)".

### 6.2 Set the quiz (W9 output)

- File location: `course/modules/M??/L???/quiz/M??-L???-quiz.csv` (Skool quiz import format).
- Skool: open the lesson, click "Add Quiz", import the CSV.
- Per-lesson quiz: 5 questions, unlimited retakes, no gate.
- Module final lesson: also import the module quiz CSV (`M??/quiz/M??-MODULE-quiz.csv`), 20 questions, 80% gate, 3 attempts then 24h cooldown.
- Stage final lesson: also import the stage capstone quiz (30 questions, gated).

### 6.3 Set the discussion prompt (this doc + community-prompts.csv)

- Open the lesson, scroll to the lesson discussion area, paste the `community_prompt` from `community-prompts.csv` for that `lesson_id`.
- For lessons where the prompt is empty, leave the discussion area blank for now. Top-20 lessons are populated; the rest will be AI-drafted and Nine-reviewed.

### 6.4 Add the "Suggested next" bumper card

Paste this template at the bottom of every lesson page:

```
Up next for you
Travel Thai: <next lesson_id in track A from this point>
Living in Thailand: <next lesson_id in track B from this point>
Conversation-only: <next lesson_id in track C from this point>
Reading Lab: <next lesson_id in track D from this point>
Linear next: <next M0X-L00Y+1>
```

Skool does not template per-learner content on lesson pages; show all five lines and the learner picks. Where Skool ships per-learner page personalisation, swap to a single line based on `active_track`.

## 7. Module-level wiring (do this for all 18 modules)

### 7.1 Attach the Anki deck (W8 output)

- File location: `course/modules/M??/flashcards/M??.apkg`
- Skool: open the **module's final lesson** (M??-L010 for most modules), click "Add Document", upload the .apkg.
- Label it: "Module M?? flashcards (Anki deck, ~100 cards)".
- In the module description, add: "Download the deck and use Anki for spaced review."

### 7.2 Module quiz

Already covered in 6.2 (attached to the module's final lesson).

## 8. Pre-launch QA checklist

Before you open the doors, fully wire **5 lessons** end-to-end and click through them as a fresh test member. The 5 lessons:

1. **M01-L001** Hello and Basic Courtesy. Tests: greetings module, S1 stage, top-20 standalone, no prereqs.
2. **M04-L002** Ordering Food. Tests: Travel + Living tracks, top-20 standalone, mid-S2 module quiz.
3. **M07-L009** Read and Say. Tests: Reading Lab classroom, capstone behaviour, hidden module visibility flip.
4. **M13-L004** Relative Clauses with ที่. Tests: B2 grammar, Conversation track, S4 stage.
5. **M18-L009** B2 Capstone Conversation. Tests: final capstone, all 4 tracks converge, 1:1 upsell CTA, badge award.

For each of the 5 lessons, confirm:

- [ ] Lesson page loads and the video plays
- [ ] One-pager PDF downloads and prints A5 cleanly
- [ ] Quiz imports correctly, 5 questions visible, retakes work
- [ ] Module quiz (if final lesson) imports with 80% gate
- [ ] Discussion prompt is pasted and clickable to reply
- [ ] "Suggested next" bumper shows all 4 track suggestions
- [ ] If capstone, the 1:1 upsell CTA is visible at the bottom
- [ ] If module final, the .apkg deck is attached and downloads
- [ ] If literacy module, hidden by default and unhides on Reading Lab opt-in
- [ ] Self-select page (see [skool-self-select-v1.md](skool-self-select-v1.md)) routes a fresh member to the right starting lesson and tags `active_track` correctly

When all 50 boxes (5 lessons x 10 checks) are ticked, you are launch-ready. Open registration.

## 9. Day-1 monitoring

For the first 7 days post-launch, check these once a day:

- Self-select page click-through. If 4 outcome cards aren't roughly balanced (e.g. 90% click S1), the band copy needs sharpening.
- Track distribution. If one track is 80% of choices, fine; if zero learners pick a track, copy is unclear or the audience is mono-shaped.
- Module quiz pass rates on M01 and M04. If <50% pass on M01, the quiz is mis-scoped, not the learner.
- Tone Clinic post count. If zero on day 7, seed posts yourself.

## 10. Things this doc does not cover

- Badge auto-award scripts: see [skool-badges-v1.md](skool-badges-v1.md). The launch ships with manual weekly batch-award by you. The API automation is v1.1.
- Day-8 retention DM: also in [skool-badges-v1.md](skool-badges-v1.md). Templates are ready; sending is manual until v1.1.
- Calibrated placement quiz: deferred, see backlog at the end of [skool-self-select-v1.md](skool-self-select-v1.md).
- Live class scheduling cadence: out of scope. Coordinate with Nine separately.
