# Skool Badges v1, Gamification Catalogue and Award Criteria

## Context

Thai with Nine ships on Skool.com as a 180-lesson Thai course (4 stages, 18 modules, A0 to B2). Skool has a built-in XP and levels system that rewards community engagement (posts, comments, likes), but it does not natively reward course progress (lesson complete, quiz pass, streak). This doc specifies a two-track gamification design: keep Skool's native XP for engagement, layer course badges on top for course progress.

This is a **document-only** spec for v1. Per the readiness review, automated badge awarding via the Skool admin API is RED-blocked (no confirmed API access yet). For launch, badges are awarded manually by Nine in a weekly batch. The API stubs in section 6 below are the v1.1 implementation plan, marked as deferred.

Reference docs:

- [tracks.json](tracks.json), the 4 curated tracks (capstones for the Track Capstone badge)
- [stages.json](stages.json), the 4 stages (for the Stage Graduate badge)
- [skool-setup-checklist-v1.md](skool-setup-checklist-v1.md), where badges plug into the Skool admin runbook

## 1. Two tracks, both visible

| Track | What rewards | Where it lives | Award mechanic |
|-------|--------------|----------------|----------------|
| A, Skool native XP | Posts, comments, likes, daily logins | Skool's built-in XP and Levels | Automatic, Skool platform |
| B, Course badges | Lesson and quiz progress, streaks, conversion actions | Skool member badges (admin-awarded) | Manual weekly batch in v1, API-automated in v1.1 |

Both tracks are visible on the learner's Skool profile. Skool already shows badges on the profile sidebar, so no UI work is needed.

## 2. Track A, Skool native XP (unchanged)

Engagement-only, drives the leaderboard. Keep Skool's defaults:

- Post: +1 XP
- Comment: +1 XP
- Receiving a like: +1 XP
- Daily login: +1 XP

Weekly leaderboard reset every Monday at 00:00 ICT. This is Skool's default if you set the community timezone to Bangkok.

We do **not** modify the XP schedule to reward lesson completion. The earlier plan's idea of awarding 10/20/30 XP for lesson/quiz/module is incompatible with Skool's engagement model and would be confusing. Course progress is rewarded with badges (track B), not XP.

## 3. Track B, Course badges (catalogue)

Six badge types, 28 individual badges in total (18 + 4 + 4 + 1 + 1 + 1 = 29 if you count Roleplay Submitter as a single recurring badge, which we do).

### 3.1 Module Graduate (x18)

| Field | Value |
|---|---|
| Name | "Module Graduate: M01" through "Module Graduate: M18" (18 distinct badges) |
| Criteria | Learner has marked all 10 lessons in M?? as complete, AND scored 80% on the module quiz. |
| Skool icon suggestion | A coloured shield (one colour per stage: S1 green, S2 yellow, S3 orange, S4 red). Use Skool's built-in shield icon and pick the matching colour. |
| Award cadence | Weekly batch, every Monday morning ICT. Eligible learners are awarded retroactively. |

### 3.2 Stage Graduate (x4)

| Field | Value |
|---|---|
| Name | "Stage Graduate: Foundations", "Stage Graduate: Survival Thai", "Stage Graduate: Everyday Thai", "Stage Graduate: Functional Fluency" |
| Criteria | Learner holds every Module Graduate badge for that stage's modules (per [stages.json](stages.json)) AND scored 80% on the stage capstone quiz. |
| Skool icon suggestion | A laurel wreath, same colour as the matching stage. |
| Award cadence | Weekly batch, same run as Module Graduate. |

### 3.3 Track Capstone (x4)

| Field | Value |
|---|---|
| Name | "Travel Thai Graduate", "Living in Thailand Graduate", "Conversation-only Graduate", "Reading Lab Graduate" |
| Criteria | Learner has marked the track's `capstone_lesson_id` complete (per [tracks.json](tracks.json): M09-L005, M15-L006, M18-L009, M07-L010) AND posted the required community post (see section 5, Conversion mechanic). |
| Skool icon suggestion | A medallion icon in the track's brand colour. |
| Award cadence | On detection, weekly batch. The community post is the gating signal; check the track's pinned thread in Wins. |

### 3.4 Streak-7

| Field | Value |
|---|---|
| Name | "7-Day Streak" |
| Criteria | Learner has completed at least one lesson on each of 7 consecutive days. Skool tracks daily logins; we extend it to "completed at least one lesson". |
| Skool icon suggestion | A flame, single colour. |
| Award cadence | On detection, daily batch. Important: this badge is what drives the day-8 retention DM (see section 4). Award on day 7, DM on day 8. |

### 3.5 Streak-30

| Field | Value |
|---|---|
| Name | "30-Day Streak" |
| Criteria | Same as Streak-7, extended to 30 consecutive days. |
| Skool icon suggestion | A flame on a pedestal, gold. |
| Award cadence | On detection, daily batch. |

### 3.6 Roleplay Submitter

| Field | Value |
|---|---|
| Name | "Roleplay Submitter" (badge stacks: 1, 5, 25, 100 submissions) |
| Criteria | Learner posts a roleplay audio response in any community category (Wins, Tone Clinic, Culture & Context). 1 submission = bronze, 5 = silver, 25 = gold, 100 = legend. |
| Skool icon suggestion | A microphone, recoloured per tier. |
| Award cadence | Weekly batch. Count audio attachments in the learner's posts since last batch. |

## 4. Day-8 retention DM (templates)

Every learner's 7th-day login earns them the Streak-7 badge. On day 8, send a templated DM via Skool's direct-message admin tool. The DM is keyed to the learner's `active_track` so the next-step suggestion lands on a relevant lesson.

In v1, you (Nine) send these manually each morning, copy-pasted from the templates below. In v1.1, a webhook fires the DM automatically (see section 6).

All four templates are <120 words, second-person, warm, no em dashes, no emojis. Replace `<learner_name>` with the Skool member's first name.

### 4.1 Track A, Travel

```
Hi <learner_name>,

You hit 7 days in a row. Congrats. That is the part most learners never get past.

Here is your nudge: post a 5-second voice memo in Tone Clinic saying ไปสนามบินค่ะ or ไปสนามบินครับ (to the airport, please). I will reply with a tone correction within 24 hours. It is the fastest way to lock in what you just learned.

If you are still planning your trip, the Travel Thai path has 5 more lessons to get you through hotels and taxis. Pick it up when you can.

See you on day 9.
Nine
```

### 4.2 Track B, Living

```
Hi <learner_name>,

7 days. You are past the cliff most people fall off at. Well done.

Here is what helps next: post a 5-second voice memo in Tone Clinic saying ขอน้ำเปล่าค่ะ or ขอน้ำเปล่าครับ (a bottle of water, please). I will reply with tone feedback. The voice memo loop is the single thing that separates learners who plateau from learners who keep going.

If you live in Thailand, the next lesson on your path covers daily routines. Small wins compound.

Talk soon.
Nine
```

### 4.3 Track C, Conversation

```
Hi <learner_name>,

Day 7. Most learners stop in week 2. You are still here, which means the streak is real.

Try this today: post a 5-second voice memo in Tone Clinic saying อันนี้คืออะไร (what is this?). I will reply with one tone fix and one chunk fix. The pattern of recording, posting, getting feedback, and trying again is how spoken Thai actually develops.

The Conversation path has plenty more for you. Keep the streak going one more day.

Nine
```

### 4.4 Track D, Reading

```
Hi <learner_name>,

7 days in. That is real. Reading Thai is the slow lane and you are still here.

Today, try this: post a photo of any Thai sign you see (a shop, a street name, a 7-Eleven banner) in Wins. Try to read it out loud first, then I will reply with the right reading. You will be surprised how much you can already pick out.

The Reading Lab keeps building. One more day.

Nine
```

## 5. Conversion mechanic (community post requirement at every module capstone)

Every module's recap lesson (the M??-L010 lesson) requires a community post to mark "Module Complete" inside Skool. This converts course progress into Skool engagement automatically, no reconciliation needed.

The post prompt is the `community_prompt` for that recap lesson in [community-prompts.csv](community-prompts.csv). Examples:

- M04-L010 prompt: "Record yourself ordering one dish and one drink in Thai and post the audio in Wins."
- M09-L010 prompt: "Post a screenshot of your Grab booking confirmation with the destination written in Thai script."

Skool member tag `M??_capstone_posted` flips when the post lands. The Module Graduate badge (section 3.1) checks for this tag.

## 6. API stubs (v1.1, deferred)

All of section 6 is **deferred to v1.1**. Implement only when Skool admin API access is confirmed. For v1, every badge is admin-awarded manually in a weekly batch and every DM is sent manually.

### 6.1 Badge auto-award via Skool admin API (v1.1, pseudocode)

```
# v1.1, implement when Skool API access is confirmed
# Pseudocode only. Do NOT implement in v1.

for member in skool.list_members(community_id):
    progress = read_member_progress(member.id)  # lesson completions, quiz scores
    streaks = compute_streaks(member.id)
    posts = count_audio_posts(member.id, since=last_batch)

    for module_id in MODULES:
        if all_lessons_complete(progress, module_id) and quiz_passed(progress, module_id, 0.8):
            if not member.has_badge(f"module_graduate_{module_id}"):
                skool.award_badge(member.id, f"module_graduate_{module_id}")

    for stage_id in STAGES:
        if has_all_module_grad_badges(member, stage_id) and stage_capstone_passed(member, stage_id, 0.8):
            if not member.has_badge(f"stage_graduate_{stage_id}"):
                skool.award_badge(member.id, f"stage_graduate_{stage_id}")

    for track_id, capstone_lesson in TRACKS:
        if lesson_complete(progress, capstone_lesson) and member.has_tag(f"{track_id}_capstone_posted"):
            if not member.has_badge(f"track_capstone_{track_id}"):
                skool.award_badge(member.id, f"track_capstone_{track_id}")

    if streaks.current >= 7 and not member.has_badge("streak_7"):
        skool.award_badge(member.id, "streak_7")
        schedule_day_8_dm(member.id, member.active_track)

    if streaks.current >= 30 and not member.has_badge("streak_30"):
        skool.award_badge(member.id, "streak_30")

    if posts.audio >= 1 and not member.has_badge("roleplay_bronze"):
        skool.award_badge(member.id, "roleplay_bronze")
    # ... silver, gold, legend tiers
```

Run cadence: daily at 06:00 ICT (cron). Streak detection must be daily; module/stage/track can run weekly if API rate limits are tight.

### 6.2 Day-8 DM via webhook (v1.1, pseudocode)

```
# v1.1, implement when Skool webhook access is confirmed
# Pseudocode only. Do NOT implement in v1.

@webhook("badge_awarded")
def on_badge_awarded(event):
    if event.badge_id != "streak_7":
        return
    member = skool.get_member(event.member_id)
    track = member.custom_fields.get("active_track", "C")  # default Conversation
    template = load_template(f"day_8_dm_track_{track}.txt")
    body = template.replace("<learner_name>", member.first_name)
    skool.send_dm(member.id, from_admin="nine", body=body)
```

In v1, this is "every Monday morning, Nine looks at who got Streak-7 last week and sends each one the matching template manually". For 50 to 100 launch members this is tractable. Past 200 members the webhook becomes essential.

## 7. Manual award workflow for v1

Until v1.1 ships:

1. Every Monday morning, open Skool admin, Members tab.
2. For each member, check progress: lessons complete, quiz scores, audio posts since last Monday.
3. Compare against the criteria in section 3. Award the badges they qualify for via Skool's "Award Badge" admin action.
4. For anyone who hit Streak-7 last week (Skool surfaces this in the activity feed), send the appropriate day-8 template DM (section 4) using their `active_track` custom field.
5. Log who you awarded and DM'd in a weekly note (a single Skool admin post in a private "ops" thread is fine).

Estimated weekly time: ~30 minutes for 50 members, ~2 hours at 200 members. Past 200 members, prioritise the v1.1 API automation.

## 8. Backlog and v1.2+

- Auto-award via API (section 6.1), v1.1
- Day-8 DM webhook (section 6.2), v1.1
- XP-style points integration (if Skool ships per-lesson XP someday), v1.2
- Tone-quality badge (Tone Clinic peer + Nine vote scoring), v1.2
- Cohort badges (e.g. "Launch Cohort", awarded once on first 100 members), v1.2
- Leaderboard reset cadence customisation if weekly is too frequent: gather data first
