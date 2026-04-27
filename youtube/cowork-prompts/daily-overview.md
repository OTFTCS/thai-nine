# Daily Overview — Cowork Live Artifact prompt

Paste this entire file into a Claude Cowork session with the `thai-nine` repo folder mounted. It will produce a saved Live Artifact ("Thai with Nine — Daily Overview") that Nine reopens each day to see what needs doing.

The prompt is written so Cowork can re-run it deterministically on reopen: all file paths are absolute, all rules are explicit, no Claude judgment is required for the numbers to match the existing `/admin/creator` dashboard.

---

## Prompt (copy from here down)

You are building a **Live Artifact** called **"Thai with Nine — Daily Overview"**. It is a one-page read-only dashboard for Nine, a non-developer content creator. It must re-fetch data from local files every time it opens. Do not cache, do not guess. If a file is missing, render the section empty and label it "missing file: <path>" — never fabricate rows.

**Repo root:** `/Users/immersion/src/thai-nine` (all paths below are relative to this).

### Files to read on every open

1. `thai-nine-project-tracker.xlsx` — primary state. Use Python + openpyxl (pre-installed): `/opt/homebrew/bin/python3`. Read-only — never save the workbook from this artifact.
2. `course/exports/scheduled-posts.json` — scheduler queue. May not exist; treat absence as `[]`.
3. `content-audit/nine-content-inventory.csv` — historic published posts (54 rows). Read for reference only.
4. Directory scan: `ls youtube/out/` — one dir per YouTube episode (`YT-S01-E##`).
5. Directory scan: `ls youtube/examples/*.json` — YouTube script JSONs.
6. Directory scan: `ls youtube/recordings/*.m4a` — YouTube audio files.

### Workbook structure (every sheet has a header row at row 1; data starts at row 2)

| Sheet | Columns (1-indexed, A-onwards) |
|---|---|
| `Priorities` | 1=priority, 2=area, 3=currentStatus, 4=keyBlocker, 5=nextMilestone, 6=targetDate, 7=notes |
| `Lesson Pipeline` | 1=lessonId, 2=module, 3=title, 4=stage, 5=status, 6=scriptQuality, 7=deckBuilt, 8=qaPass, 9=blocker, 10=lastUpdated |
| `Socials` | 1=num, 2=title, 3=contentType, 4=category, 5=platforms, 6=status, 7=datePosted, 8=views, 9=likes, 10=link — some rows are **section headers** (same text repeated across cells) or blank; skip both. |
| `Website & Quiz` | 1=task, 2=area, 3=status, 4=priority, 5=dependsOn, 6=notes |
| `Recurring Tasks` | 1=task, 2=area, 3=frequency, 4=automated, 5=lastRun, 6=nextDue, 7=owner, 8=notes |
| `Image Carousels` | 1=topic, 2=lessonLink, 3=status, 4=imagesCreated, 5=postedTo, 6=datePosted, 7=notes |

Rows where every cell is empty are blanks — skip.
Rows in Socials where the same non-empty string repeats across ≥2 cells are section headers (e.g. "PUBLISHED") — skip for data, but remember them as grouping labels.

### Section 1 — "What's Next" (hero card)

Apply these rules in strict priority order. Stop at the first match.

1. **Overdue recurring task.** Any row in `Recurring Tasks` where `nextDue` parses as a date `≤ today`. If match: headline = the task name; detail = "Recurring {frequency} owned by {owner} is due {nextDue}." CTA label = "Open tracker xlsx".
2. **Blocked priority.** Any row in `Priorities` where `currentStatus` (lowercased) contains `"blocker"`, `"flaw"`, or `"needs review"`, OR `keyBlocker` is non-empty. If match: headline = "{area}: {nextMilestone or 'address blocker'}"; detail = keyBlocker (fallback currentStatus). CTA = "Open tracker xlsx".
3. **Unposted social.** First `Socials` data row where status (lowercased) is `"ready"`, `"scripted"`, `"queued"`, OR contains `"rework"`, AND is NOT `"published"` or `"done"`. If match: headline = "Finish and post: {title}"; detail = "{status} on {platforms}." CTA = "Go to schedule".
4. **Next YouTube episode to record.** Scan `youtube/out/YT-S01-E##/` dirs. For each dir in ascending episode number, consider it a candidate if a file named `YT-S01-E##-scene.py` exists AND the episode ID is NOT in the recorded list. The recorded list for now is the hardcoded fallback: `["YT-S01-E01", "YT-S01-E02", "YT-S01-E03"]` (see note below). Pick the lowest matching episode. If match: headline = "Record {episodeId}"; detail = "Next YouTube episode script is ready — open the scene plan and film it."
5. **Idle.** No match: headline = "All clear"; detail = "Nothing urgent in the tracker. Pick a priority from the content table."

> Note on recorded list: if env var `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` are set, Cowork may instead query `https://www.googleapis.com/youtube/v3/playlistItems` for the channel's uploads and extract episode IDs matching `/YT-S01-E\d\d/` from video titles + descriptions. If the API call fails or returns zero, fall back to the hardcoded list above.

Render the winning rule as a prominent card at the top: large headline, small detail line, a pill showing which rule fired (e.g. "recurring-due", "priority-blocked", "social-pending", "youtube-next", "idle").

### Section 2 — 8 section counters (grid below the hero)

Render as a 4×2 grid of small cards. For each: a count and a short label.

1. **Priorities.** `blocked / total`. Blocked = rows matching the Rule 2 condition above.
2. **Lessons.** 4 sub-counts by `status` column from Lesson Pipeline: `READY_TO_RECORD`, `DRAFT`, `PLANNED`, `BACKLOG`. Show the 4 counts stacked; total = sum.
3. **Socials.** `published / pending`. Published = data rows where `status.toLowerCase() === "published"`. Pending = data-row-count minus published.
4. **Website & Quiz.** `done / total`. Done = rows where status (lowercased) is `"done"`, `"complete"`, `"completed"`, or `"shipped"`.
5. **Recurring.** `overdue / total`. Overdue = rows where `nextDue` parses as a date `≤ today`.
6. **Image Carousels.** `posted / total`. Posted = status (lowercased) contains `"posted"` or `"published"`.
7. **YouTube.** `recorded / total`. Total = count of `YT-S01-E##` dirs in `youtube/out/`. Recorded = episodes in the recorded list (see Section 1 note).
8. **TikTok.** `published / total`. Scan `thai_with_nine_tiktok/series/*/scripts/episode-*.md` for total. Published requires `TIKTOK_ACCESS_TOKEN`; if absent, show `? / total` and tooltip "TikTok credentials not configured".

### Section 3 — Unposted socials queue (table)

List every Socials row matching Rule 3 (unposted / in-progress). Columns: `num`, `title`, `platforms`, `status`, `category`. Sort by `num` ascending. If empty, render "No pending social posts — nice.".

### Section 4 — Scheduled posts (table, optional)

If `course/exports/scheduled-posts.json` exists and has entries: show a 3-column table: `scheduledFor` (localized date/time), `title`, `status` (pending / done / failed). If the file doesn't exist or is `[]`, omit the section entirely.

### Section 5 — Pipeline snapshot (list)

For each YouTube episode (YT-S01-E01 upward through E20), one row showing which pipeline artifacts exist. Columns (each is a ✅ / ·):
- Script JSON: `youtube/examples/{id}.json`
- Audio: `youtube/recordings/{id}.m4a`
- Phrases timed: `youtube/phrases/{id}.phrases.timed.json`
- Rendered dir: `youtube/out/{id}/`
- Final MP4: `youtube/out/{id}/{id}-final.mp4`

This section is Oliver's reference view more than Nine's — keep it compact.

### Rendering rules

- Use subtle color: green for good counts (high published, few blockers), amber for pending/warning, red only for overdue recurring or blocked priority.
- No emojis. No animations. No external fonts.
- Header: "Thai with Nine — Daily Overview" + small timestamp "Refreshed at {ISO timestamp}".
- Footer: one-line hint "To mark a post published or update status, ask me in chat."
- Do NOT include any buttons that claim to write data. All mutations happen conversationally (future work).

### Hard constraints

- Read-only on the xlsx. If you ever find yourself about to call `wb.save()` or open the file in `a` / `w` mode, stop.
- No network calls except the optional YouTube Data API read described above.
- If any listed file is missing, render its section with "missing: <path>" rather than inventing data.
- Re-run the reads every time the artifact opens. No stale caches. Cowork's default behavior should already do this — don't fight it.

When you're done, save the artifact as "Thai with Nine — Daily Overview" and confirm it reopens correctly. Report any file paths that didn't resolve.
