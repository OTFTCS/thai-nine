# Thai with Nine — 5-Email Welcome Sequence

**Triggered by:** First signup on any lead-magnet landing page.
**Skip condition:** Subscriber already has the `welcome_sent` tag (returning subscriber — only deliver the requested PDF, don't re-onboard).
**Total length:** 17 days from signup to graduation into weekly broadcast list.

> **Before loading into MailerLite:** Replace all `{{PLACEHOLDER}}` values throughout. Test the full sequence end-to-end with a personal email before going live.
>
> **Placeholders used:**
> - `{{FIRST_NAME}}` — MailerLite merge tag for first name (fall back to "there" if blank)
> - `{{PDF_DOWNLOAD_URL}}` — direct link to the PDF on the MailerLite landing page (set per-magnet via tag-conditional content, or use a generic "your downloads" page)
> - `{{WAITLIST_URL}}` — Immersion Thai course waitlist link. Use a MailerLite "click to add tag" link so existing subscribers join the waitlist with one click (no second form to fill out). The link adds the `course-waitlist` tag and lands on a "you're on the list" thank-you page.
> - `{{LANDING_PAGE_URL}}` — the MailerLite signup page URL (for the bridge email)
> - `{{WEEKLY_PDF_URL}}` — populated weekly with that week's new free PDF
>
> **No tutoring CTA in Phase 1.** Nine will add a custom booking system later. Until then, the only soft offer is the course waitlist.
>
> **Voice notes (from the brand voice doc):** Warm, practical, encouraging. Use "you" not "learner". Discover-by-doing tone — show, don't lecture. Comedic surprises welcome. Never use the word "newsletter."

---

## E1 — Immediate (within 5 minutes of signup)

**Trigger:** Form submitted.
**Tag added:** `welcome_sent`
**Goal:** Deliver the PDF as a backup (in case they closed the thank-you page). Add immediate utility with one fast-win tip so they feel value before they even open the PDF.

**Subject:** Your Thai cheat sheet (in case you closed the page)

**Preheader:** Plus one classifier tip you can use today.

**Body:**

Hi {{FIRST_NAME}},

Here's your free Thai classifiers cheat sheet — in case you closed the download page before saving it:

**[Download the PDF →]({{PDF_DOWNLOAD_URL}})**

Save this email so you can grab it again later.

---

**One thing to try today:**

When you order coffee in Thailand, the classifier is **แก้ว** (gâaeo) — "glass." So "two coffees" is *gaa-faae sǎawng gâaeo*, literally "coffee two glass." Notice the order: noun first, then number, then classifier. That backwards-feeling pattern is the same for almost every Thai noun.

Try it tomorrow — even just in your head when you're ordering — and the whole "Thai number system" thing starts to click.

— Nine

P.S. I made this PDF specifically because so many of you commented "this is the rule I always forget." If there's another Thai pattern you keep tripping over, hit reply and tell me. I read every reply.

---

## E2 — Day 2

**Trigger:** 2 days after E1.
**Goal:** Segment the list by level using **link clicks**, not replies. Each link tags the subscriber so future emails can be tailored.

**Subject:** Quick question — where are you at with Thai?

**Preheader:** Click the level that fits and I'll match what I send you.

**Body:**

Hi {{FIRST_NAME}},

Quick question so I can send you stuff that actually fits where you're at.

**Click the level that matches you best:**

→ **[I'm starting from zero]({{LANDING_PAGE_URL}}?level=beginner)** — never spoken Thai, can't read the script, want to know "where do I even start"

→ **[I know some Thai]({{LANDING_PAGE_URL}}?level=some-thai)** — can say a few phrases, recognise some words, but conversations still lose me

→ **[I'm conversational]({{LANDING_PAGE_URL}}?level=conversational)** — I can hold a basic chat, I want to sound more natural and tackle harder grammar

(Each link just takes you to a confirmation page. No form to fill in — your click tells me everything I need.)

I won't lump everyone into the same emails. Beginners get foundations, intermediate folks get the trickier patterns, conversational folks get the stuff that makes you sound less like a textbook.

— Nine

---

## E3 — Day 5

**Trigger:** 5 days after E1 (3 days after E2).
**Goal:** Soft pitch for the course waitlist, anchored in a student transformation story. No tutoring CTA (Nine doesn't have a booking system yet).

**Subject:** From "I can't even say hello" to ordering food in 3 weeks

**Preheader:** What changed for one of my students.

**Body:**

Hi {{FIRST_NAME}},

I want to tell you about a student I had earlier this year. She moved to Bangkok for work, knew zero Thai, and was eating at the same English-friendly café every day because she was scared to order anywhere else.

Three weeks in, she sent me a video of herself ordering *kǎao phàt gài* at a street stall — and not just "I want chicken rice," but with the right tone, the right classifier, and a "thank you" that didn't sound like a tourist phrasebook.

The thing that worked for her wasn't grammar drills. It was getting one specific real-life situation, learning the exact phrases for it, and then *using them within 24 hours*. Practice → mistake → fix → repeat. That's it.

That approach is exactly what I'm building into a structured course right now: **Immersion Thai**. 180 lessons across 18 modules, A0 to B2, with all the production drills and minimal pairs you need to actually *speak*, not just memorise. It's launching soon.

**[Join the waitlist (one click) →]({{WAITLIST_URL}}?utm_source=email&utm_medium=welcome&utm_campaign=e3-pitch)**

You'll be the first to hear when it goes live, and waitlist members get the launch discount.

If the structured-course thing isn't for you, no worries — you'll still get a free Thai PDF from me every week.

— Nine

---

## E4 — Day 10

**Trigger:** 10 days after E1.
**Goal:** Pure value, no pitch. Builds trust, sets expectation that emails from Nine are useful. Drawn from a high-engagement existing TikTok pattern (e.g. function-word teaching).

**Subject:** The Thai word that does the work of three English tenses

**Preheader:** It's only one syllable. And you'll use it every day.

**Body:**

Hi {{FIRST_NAME}},

Here's something nobody tells you about Thai when you start:

**Thai doesn't really have tenses.**

No past tense. No future tense. No "-ed" endings. No "will be" or "have been". It sounds impossible, but it works because Thai uses tiny little words to do the same job.

The MVP of those tiny words is **แล้ว** (*láaeo*).

It means "already" — but functionally, it's how Thais mark "this happened." Stick it after a verb and you've made the past tense.

| Thai | Translit | English |
|---|---|---|
| กินแล้ว | gin láaeo | I ate (already) |
| ไปแล้ว | bpai láaeo | I went / they left |
| รู้แล้ว | rúu láaeo | I know now / got it |
| เสร็จแล้ว | sèt láaeo | done / finished |

You'll hear *láaeo* literally hundreds of times a day in Thailand. Start using it after every verb you remember — even just to yourself — and your spoken Thai will instantly sound 30% more native.

(This is the same pattern I broke down in [this TikTok]({{LANDING_PAGE_URL}}) which somehow ended up with 33,000 views — turns out everyone's been confused by the same thing.)

— Nine

P.S. Next week's free PDF is on this exact topic — *láaeo* and the other little words that replace English tenses. Watch your inbox Monday.

---

## E5 — Day 17

**Trigger:** 17 days after E1.
**Goal:** Bridge the subscriber from the welcome sequence into the ongoing weekly broadcast list. Reinforce that emails from Nine are weekly, useful, and free.

**Subject:** Your weekly free Thai PDF — this week's is here

**Preheader:** From now on, look out for these every Monday.

**Body:**

Hi {{FIRST_NAME}},

You've been on my list for a couple of weeks now and I figured I'd be straight with you about what to expect from here.

**Every Monday I send out a new free Thai PDF.** One topic, one cheat sheet, no waffle. The kind of thing you'd screenshot and stick on your fridge.

Here's this week's:

**[Download this week's PDF →]({{WEEKLY_PDF_URL}})**

You don't have to do anything. It'll show up every Monday automatically. Some weeks it'll be vocabulary, some weeks it'll be a grammar pattern, some weeks it'll be a phrase pack for a specific situation. All of it free.

If you ever want to stop getting these, the unsubscribe link is at the bottom of every email — no hard feelings, no follow-up.

If a particular week's PDF is a banger and you want the whole structured path, the Immersion Thai course is launching soon. [Join the waitlist]({{WAITLIST_URL}}?utm_source=email&utm_medium=welcome&utm_campaign=e5-bridge) and you'll get the launch discount.

See you Monday.

— Nine

---

## After E5

Subscriber is now in the **weekly broadcast list**. They get one email every Monday with that week's new PDF + a link. The broadcast template lives separately (build when there's a second magnet to send out).

---

## Decision rules for this sequence

- **E1 open rate < 40%** → subject line is wrong. A/B test alternatives like "Your Thai cheat sheet 👋" or "{{FIRST_NAME}}, your free PDF".
- **E2 link-click rate < 15%** → segmentation question is too long or unclear. Trim ruthlessly.
- **E3 → waitlist click rate < 5%** → the story isn't landing or the offer is buried. Tighten the story, lead with the link.
- **E4 → unsubscribe spike** → you're sending too much, or E4's value isn't matching the level segment. Check segmentation tags from E2.
- **E5 → no engagement** → the weekly cadence promise isn't working. Consider switching to bi-weekly.

---

## Voice quality checklist (review before loading into MailerLite)

- [ ] Uses "you" not "learner" throughout
- [ ] No use of the word "newsletter"
- [ ] All Thai words have transliteration (PTM style, no superscript)
- [ ] All transliteration uses inline tone marks (mid tone unmarked)
- [ ] Waitlist CTA uses UTM params, not bare URL
- [ ] Unsubscribe link present in MailerLite footer (default)
- [ ] No PII in any UTM parameter
- [ ] Every link tested in a real browser before publishing
- [ ] Welcome sequence is single-trigger only (won't re-fire for returning subs with `welcome_sent` tag)
