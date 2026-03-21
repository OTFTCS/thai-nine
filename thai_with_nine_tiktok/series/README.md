# TikTok Series Manifests

This directory holds standalone TikTok series plans that are separate from the Immersion Thai course.

Recommended structure:

- `series/<slug>/README.md` for the human-readable brief
- `series/<slug>/episodes.json` for structured episode metadata

Each `episodes.json` file should stay script-adjacent but not script-heavy. Treat it as the bridge between a content plan and a future JSON brief for `tiktok-cli.ts generate-script`.
