# Skool Self-Select v1, Launch Placement

## Context

Thai with Nine ships on Skool.com as a 180-lesson course (4 stages, 18 modules, A0 to B2). Earlier plans included a 15-question Typeform-style placement quiz. For launch, that is replaced with a single self-select page in the Skool Classroom builder. A calibrated placement quiz is deferred to v2 (see "Backlog" at the end of this doc).

This doc describes exactly what Nine builds in the Skool admin UI. No code, no external tooling. Everything here is a Skool-native classroom page.

## What this is

One landing page inside the Main classroom titled **"Where should you start?"**. Two questions, both answered with a click. Output: a recommended starting `lesson_id` and an `active_track` value that drives the "Suggested next" bumper card on every lesson page.

Sources of truth:

- Outcome bands derive from the 4 stages in [stages.json](stages.json).
- Tracks derive from [tracks.json](tracks.json).
- Top-20 standalone titles used in card copy come from [skool-metadata.csv](skool-metadata.csv).

## Page layout

The page has three sections, top to bottom: title block, outcome cards, track question. Below those, a single fallback line.

### Section 1, Title block

- H1: "Where should you start?"
- Sub: "Pick the line that sounds most like you. You can change tracks any time."

### Section 2, Outcome cards (4 cards in a 2x2 grid)

Each card is a Skool "Lesson Link" block pointing to the suggested start lesson. Card body uses Skool's rich text. Same heading style on all four. Use plain card art (Nine's brand palette), no flags or stereotyped imagery.

| Card | Heading | Body copy | Suggested start | Maps to stage |
|---|---|---|---|---|
| S1 | I'm new to Thai | You have not studied Thai before, or only know a few words. Start here and build the polite habits first. | M01-L001 | S1 Foundations |
| S2 | I know the basics | You can greet, count, order food, and survive a few exchanges. Tighten your tones and grow your vocabulary. | M04-L001 | S2 Survival Thai |
| S3 | I can survive | You handle daily life in Thai but stall on stories, plans, and explanations. Build narrative range. | M10-L001 | S3 Everyday Thai |
| S4 | I can chat | You hold a conversation but want polish, register, and B2 grammar. Sharpen the corners. | M13-L001 | S4 Functional Fluency |

Card click behaviour: the learner lands on the suggested lesson page. Skool's lesson URL is the only routing the platform supports. Each card is a direct link.

### Section 3, Track question

Heading: "What do you want to use Thai for?"

Sub: "Pick one. We use this to suggest the next lesson at the end of every video."

4 buttons in a single row. Each button writes a value to the learner's profile field `active_track` (set up in Skool admin under Members, Custom Fields). Skool stores this as a member tag.

| Button label | Value written to `active_track` | Track |
|---|---|---|
| Travel in Thailand | A | Travel Thai (12 lessons) |
| Live in Thailand | B | Living in Thailand (26 lessons) |
| Just chat | C | Conversation-only (30 lessons) |
| Read and write | D | Reading Lab (20 lessons) |

After the learner clicks a track button, redirect them to the corresponding Track Learning Path page. Skool's Learning Paths sidebar then takes over.

### Section 4, Fallback line

One sentence at the bottom in muted text: "Not sure? Start at lesson 1, [Hello and Basic Courtesy](https://skool.com/PLACEHOLDER/classroom/main/M01-L001). You can switch any time."

## Screenshots (placeholders)

Replace with real screenshots after the page is built.

- `course/exports/screenshots/self-select-page-full.png`, full page, desktop
- `course/exports/screenshots/self-select-cards-mobile.png`, outcome cards on mobile
- `course/exports/screenshots/active-track-question.png`, track buttons
- `course/exports/screenshots/learning-path-after-click.png`, landing page after clicking a track

## Implementation notes for Nine

This is **not** a code change. Build this in Skool admin:

1. Open Skool admin, Main classroom, Classroom builder.
2. Create a new module at the top of the classroom called "Start Here" (or pin an existing intro module).
3. Inside it, add one "About" page titled "Where should you start?" and paste the layout above using Skool's rich text + button blocks.
4. Under Members, Custom Fields, add a single-select field called `active_track` with options A, B, C, D.
5. Wire each track button as a Skool action that updates the field. If Skool's button blocks do not support custom field writes, use the next-best option: each button is a link to the Learning Path page, and the learner's track is inferred from which Learning Path they enrolled in. (Skool's Learning Path enrolment is itself a member tag.)
6. Set the page as the classroom's default landing page so new members land here on join.

## Routing logic, summary

```
new member joins
  -> lands on "Where should you start?" page
  -> clicks one outcome card
     -> arrives at suggested start lesson_id
  -> picks track
     -> tagged with active_track A/B/C/D
     -> bumper card on every lesson page reads active_track to suggest next lesson
```

## V2 backlog

A calibrated placement quiz (15 questions, weighted across tones, vocab, grammar, listening) was scoped in the original plan and is deferred. Build the self-select first, gather data on actual learner starting points for ~3 cohorts, then design the quiz against real failure patterns rather than guesses. See the W5 section of [the launch plan](../../../.claude/plans/nested-exploring-emerson.md) for full reasoning.
