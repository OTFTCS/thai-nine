# Handover: Thai Diagnostic Quiz Revival

**Date:** 2026-04-28
**Branch:** main (uncommitted)
**Plan file:** `~/.claude/plans/do-we-currently-have-eventual-wand.md`

## Goal

Ship a public, shareable Thai-level diagnostic quiz at `quiz.thaiwithnine.com/diagnostic/[token]` so prospective learners can take it before booking. The quiz revives an archived Next.js implementation, persists to Supabase Postgres, and keeps admin pages local-only via an env-flag 404 in production.

## What's done (Phases 1 to 4, code-complete)

The plan was reviewed by Codex and a second-opinion agent before implementation. Both flagged: wrong file paths, redundant Neon stack when Supabase was already in deps, broken security model on the public invite endpoint, and missing files in the restore list. All addressed in the final plan.

### Files written or modified

**Restored from `archive/decommissioned/quiz/` (verbatim except where noted):**
- `src/lib/quiz/assembler.ts`
- `src/lib/quiz/display.ts` (added `shouldShowAudioPromptThai` export)
- `src/lib/diagnostic/lesson-brief.ts` (em dashes stripped per style rule)
- `src/components/quizzes/quiz-audio-player.tsx` (added `showThai` prop)
- `src/components/quizzes/diagnostic-quiz-runner.tsx` (em dashes + checkmark emoji removed)
- `src/components/quizzes/diagnostic-admin-panel.tsx`
- `src/app/(marketing)/quiz/diagnostic/[token]/page.tsx` (emoji removed)
- `src/app/(marketing)/quiz/diagnostic/[token]/client.tsx`
- `src/app/api/diagnostic/invites/route.ts`
- `src/app/api/diagnostic/invites/[token]/route.ts` (response sanitised, see security below)
- `src/app/api/diagnostic/submissions/route.ts`

**New files:**
- `src/app/(marketing)/layout.tsx` (minimal pass-through, no Navbar/Footer)
- `src/app/admin/quizzes/diagnostic/page.tsx` (renders `DiagnosticAdminPanel`)
- `src/middleware.ts` (env-flag-based 404 on admin paths in production)
- `src/lib/supabase/admin.ts` (service-role client factory)
- `supabase/migrations/20260428120740_diagnostic_quiz.sql` (tables + indexes)

**Modified existing live files:**
- `src/lib/diagnostic/store.ts` (full rewrite: file-based JSON to async Supabase)
- `src/lib/quiz/persistence.ts` (added `loadDiagnosticAttempt`, `saveDiagnosticAttempt`, `clearDiagnosticAttempt`)
- `src/app/admin/quizzes/diagnostic/[token]/page.tsx` (added `await` to store calls now async)
- `src/app/admin/layout.tsx` (added "Diagnostic" nav entry)
- `src/types/diagnostic.ts` (added `"expired"` to `DiagnosticInviteStatus` union)

### Key design decisions made

1. **Supabase, not Neon.** Repo already had `@supabase/supabase-js` and `@supabase/ssr` in deps, plus `supabase/migrations/`. Adding Neon would have been a second backend.
2. **Token security:** `crypto.randomUUID()` only, no fallback. `expires_at` set to `now + 30 days`. `getInviteByToken` returns null for expired invites and lazily marks them.
3. **Public API surface is locked to three endpoints:** `GET /quiz/diagnostic/[token]` (page), `GET /api/diagnostic/invites/[token]` (sanitised: only `token`, `learnerName`, `status`), `POST /api/diagnostic/submissions`. Everything else 404s in production via middleware.
4. **Admin auth is "don't deploy admin to production".** The middleware returns 404 for `/admin/*`, `/api/admin/*`, and `/api/diagnostic/invites` (the list/create endpoint) when `IS_PUBLIC_DEPLOY=true`. Locally, admin works as before.
5. **Audio is deferred.** `public/audio/quizzes/{placement,tones,reader-tones}/` are empty (only `.gitkeep`). The runner falls back to Web Speech API. Native recordings are v1.1.

### Type check status

`npx tsc --noEmit` passes for every file touched in this session. Pre-existing errors remain in:
- `course/tools/*.ts` (40+ errors: `.ts` import extensions, `/s` regex flag, missing types in `course/tools/lib/types.ts`)
- `src/lib/curriculum/blueprint-loader.ts` and `src/lib/mission-control/lesson-review.ts` (missing exports `CurriculumBlueprint`, `CurriculumModule`, `CurriculumTrack` from `@/types/lesson`; missing fields `moduleId`, `moduleTitle`, `trackId`, `trackTitle`, `cefrBand`, `primaryOutcome` on `Lesson`)
- `src/app/api/mission-control/route.ts` (same missing curriculum types)

These will block `next build` in CI on Vercel. Not introduced by this session.

## What's NOT done (Phases 5 + 6)

Both phases require cloud credentials and decisions only Oliver can make.

### Phase 5: Deploy

- Supabase project provisioning (or reuse of an existing one)
- Apply migration `20260428120740_diagnostic_quiz.sql` to the remote Supabase
- Set Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `IS_PUBLIC_DEPLOY=true`
- First Vercel deploy (Hobby plan)
- Add custom domain `quiz.thaiwithnine.com` via CNAME

### Phase 6: End-to-end test

- Create invite locally, copy production link, take the quiz on a phone, confirm submission lands in Supabase, lesson-brief renders in local admin
- Verify `/admin/*`, `/api/admin/*`, `/api/diagnostic/invites` all return 404 from production URL
- Verify `/api/diagnostic/invites/[token]` returns only sanitised fields
- Confirm submission persists across a Vercel redeploy

## Open questions for Oliver

These need answers before the next session can proceed.

1. **Supabase project:** Does a project already exist for thai-nine? Run `supabase projects list` or check the Supabase dashboard. If yes, what's the project ref? If no, the next session will provision a new one (free tier, Singapore or Frankfurt region depending on where most learners live).

2. **Pre-existing build errors in `course/tools/*` and `src/lib/curriculum/*`.** These will block Vercel CI. Three options:
   - (a) Fix them before deploy (could be a half-day of work; some are real type drift that needs a proper fix)
   - (b) Exclude `course/tools/` from the Next.js tsconfig and patch the curriculum errors minimally
   - (c) Add a Vercel build override that skips type checking (`next build --no-type-check` or set `typescript.ignoreBuildErrors: true` in `next.config.js`); fastest path to unblock but hides real errors going forward
   
   Which?

3. **Custom domain:** is `quiz.thaiwithnine.com` the right subdomain, or somewhere else? And which DNS provider hosts `thaiwithnine.com`?

4. **Vercel plan:** Plan starts on Hobby. If learners pay for lessons via this funnel, Vercel may flag the deployment as commercial and require Pro at $20/month. The current plan keeps the quiz page itself commercially neutral (no booking CTAs, no Calendly, no payment links on `/quiz/diagnostic/[token]`). Is that acceptable as the v1 posture, or do you want to start on Pro to avoid any risk of suspension?

5. **Audio recordings:** v1 ships with Web Speech API fallback (browser TTS reads the Thai). Quality varies by device. Do you want to defer real recordings to v1.1, or schedule a recording session before the public link goes out? Question bank is 107 placement questions; not all need audio (only the ones with `audioSrc` set, which is roughly all of them).

6. **GDPR / consent:** schema includes a `consent_given_at` column but the quiz UI does not yet show a consent checkbox. Add one before sharing the link publicly? Suggested copy: "I agree that my answers will be stored so my Thai teacher can review them. Data will be deleted on request."

7. **Any commits expected this session?** Nothing has been committed yet. The 14 file changes are all uncommitted on `main`. The repo had 30+ uncommitted deletions from the prior decommission already; the quiz revival on top of that is a sensible single commit, or split into two (restore + Supabase) for clarity.

## Suggested kickoff prompt for the next Claude Code session

```
Continue the Thai diagnostic quiz revival. Status: Phases 1-4 are code-complete
(see docs/handovers/2026-04-28-diagnostic-quiz-revival.md). Phases 5 (deploy) and
6 (E2E test) remain.

Answers to open questions:
1. Supabase project: <answer>
2. Pre-existing build errors: <option a/b/c>
3. Custom domain: <answer>
4. Vercel plan: <Hobby/Pro>
5. Audio: <defer to v1.1 / record now>
6. Consent UX: <add now / defer>
7. Commit strategy: <single / split>

Plan file: ~/.claude/plans/do-we-currently-have-eventual-wand.md
Verify state with: git status; npx tsc --noEmit | grep -v "^course/" | grep -v "curriculum"
```

## Reference

- Plan: `~/.claude/plans/do-we-currently-have-eventual-wand.md`
- Codex review: persisted in `~/.claude/projects/-Users-olivertopping-src-thai-nine/f45f39dd-8d24-4645-aa45-b184bb78193e/tool-results/b6r847yp2.txt`
- This handover: `docs/handovers/2026-04-28-diagnostic-quiz-revival.md`
