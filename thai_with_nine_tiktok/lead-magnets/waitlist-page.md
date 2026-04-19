# Course Waitlist — MailerLite Setup & Page Copy

The Immersion Thai course waitlist mechanism, implemented inside MailerLite. **No second signup form for existing subscribers** — they join the waitlist with one click.

## How it works (the mechanism)

MailerLite supports **click-to-tag links**: any link in an email or landing page can automatically add a tag to the subscriber when they click it. This is what powers the "join the waitlist (one click)" CTA in the cheat sheet PDF and the welcome sequence emails.

The flow:

1. **Existing subscriber** clicks `{{WAITLIST_URL}}` in the PDF or an email.
2. **MailerLite intercepts the click**, identifies the subscriber by their tracking token, **adds the tag `course-waitlist` to their record**, then redirects them to the thank-you page (the copy below).
3. **Cold visitor** (someone who somehow hits the URL without being a subscriber — rare, e.g. a friend forwarded the PDF) sees a fallback signup form on the same page. They enter their email, the form submits, and MailerLite tags them as both a subscriber AND `course-waitlist` in one go.

## Setup in MailerLite

1. **Create a new landing page** in MailerLite called "Immersion Thai Course Waitlist".
2. The page has two states:
   - **Default state (cold visitor):** Headline + signup form with first-name + email + GDPR checkbox + privacy link. On submit → tag `course-waitlist`, send Email 1 of waitlist sequence (just an immediate confirmation), redirect to the same page in "thanks" state.
   - **"Thanks" state (after signup OR after click-to-tag):** Confirmation message, expectation-setting copy, link back to the latest free PDF.
3. **Create a click-to-tag link** in MailerLite's automation → "Add tag on click" trigger:
   - Tag to add: `course-waitlist`
   - Destination URL: the "thanks" state of the waitlist landing page
   - Use the generated link as `{{WAITLIST_URL}}` everywhere in the PDF and welcome sequence
4. **Make sure the welcome sequence skips re-onboarding** — if a subscriber clicks the waitlist link, they should NOT trigger the 5-email welcome sequence again. The `welcome_sent` tag check from the welcome sequence already handles this.

---

## Default state (cold visitor lands on the URL fresh)

### Headline

**The Immersion Thai Course is launching soon.**

### Subheadline

180 lessons. 18 modules. A0 to B2. Built around speaking Thai, not just memorising it.

### Body

I'm Nine. I've been teaching Thai 1:1 for years and I'm building the course I always wished existed:

- **Real-life situations first.** Each lesson teaches you what to actually say in a specific moment — ordering food, taking a taxi, meeting your partner's family — not abstract grammar in isolation.
- **40%+ production drills.** You spend more time speaking and producing Thai than reading or listening. That's how you actually get better.
- **Pronunciation in every lesson.** Tones, minimal pairs, the lot. From day one.
- **Comedic and direct.** I'll make you laugh while you learn. The weird literal English is half the fun.

The course is launching soon. **Join the waitlist** to get the launch announcement first, plus the early-bird discount.

### Form

| Field | Notes |
|---|---|
| First name | Optional |
| Email | Required |
| GDPR consent checkbox | Unticked by default. Text: "I agree to receive emails from Thai with Nine about the Immersion Thai course launch. I can unsubscribe anytime. [Read the privacy notice.]({{PRIVACY_URL}})" |
| Submit button | "Join the waitlist" |

On submit: tag `course-waitlist` + `welcome_sent` (skip the regular welcome sequence — they're here for the course, not the weekly PDFs) → redirect to "thanks" state.

---

## "Thanks" state (after signup or after click-to-tag)

### Headline

**You're on the list. ขอบคุณค่ะ.**

### Body

Nice. You'll be the first to hear when the Immersion Thai course launches — and waitlist members get the launch discount.

In the meantime:

- **If you got here from a free PDF**, that PDF is yours to keep. Save it, screenshot it, print it out.
- **If you haven't yet,** check out [this week's free Thai PDF]({{LANDING_PAGE_URL}}) — I send a new one out every Monday.
- **Got questions about the course?** Just reply to any email I send you. I read every reply.

— Nine

---

## Email 1 — Waitlist confirmation (cold visitor only)

**Trigger:** Form submitted on waitlist landing page (cold visitor flow only — existing subscribers who click-to-tag don't get this; they already know who Nine is).

**Subject:** You're on the Immersion Thai waitlist 🎉

**Preheader:** Here's what to expect next.

**Body:**

Hi {{FIRST_NAME}},

You're officially on the Immersion Thai course waitlist. Welcome.

Here's what'll happen next:

1. **Right now:** Nothing for a couple of weeks. The course is still being built and I don't want to spam you while you wait.
2. **About a week before launch:** I'll email you with the launch date, the price, and a preview of what's inside.
3. **Launch day:** You get the email first, with the early-bird discount link.

While you wait, here's a free PDF I made that pairs perfectly with what's coming in the course — the Thai Classifiers Cheat Sheet:

**[Download the cheat sheet →]({{PDF_DOWNLOAD_URL}})**

If you have any questions about the course at all — what it covers, how it's structured, who it's for, anything — just reply to this email. I read every reply.

Talk soon,

Nine

---

## Setup checklist

- [ ] Build the waitlist landing page in MailerLite (default + thanks states)
- [ ] Create the click-to-tag link in MailerLite automations
- [ ] Set up the cold-visitor confirmation email (Email 1 above)
- [ ] Add `welcome_sent` to the cold-visitor flow so they don't trigger the regular welcome sequence
- [ ] Test: click the waitlist link as an existing subscriber → confirm tag added, no welcome re-trigger, lands on "thanks" state
- [ ] Test: visit waitlist URL as a cold visitor → fill form → confirm tag added, Email 1 lands, no welcome re-trigger
- [ ] Replace `{{WAITLIST_URL}}` in `classifiers-cheat-sheet.md` and `welcome-sequence.md` with the click-to-tag link
- [ ] Replace `{{PRIVACY_URL}}` in this file and the consent text with the published privacy notice URL
