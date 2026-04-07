---
name: youtube-transcript
description: >
  Use this skill when the user shares a YouTube URL (youtube.com/watch?v=, youtu.be/, youtube.com/shorts/),
  a YouTube video ID, or references a YouTube video they want to understand.
  Trigger phrases: "this video", "watch this", "what does this video say", "summarize this video",
  "insights from this video", or any message containing a YouTube link.
---

# YouTube Transcript Fetcher

Automatically fetch and analyze YouTube video transcripts when the user references a video.

## Workflow

1. **Extract the YouTube URL or video ID** from the user's message.

2. **Fetch the transcript** by running:
   ```bash
   python3 ~/.claude/skills/youtube-transcript/scripts/fetch_transcript.py "<URL_OR_ID>"
   ```
   Add `--timestamps` if the user wants time references.

3. **If the transcript is long** (over ~5000 words), focus on the most relevant sections based on the user's question. Read the full transcript but synthesize — do not dump the raw text back.

4. **Provide insights**, structured as:
   - **Summary** — 2-3 sentence overview of the video's content
   - **Key Insights** — Bulleted list of the most important points, ideas, or takeaways
   - **Notable Quotes** — Any particularly striking or quotable moments (with approximate timestamps if available)
   - If the user asked a specific question about the video, answer that directly instead of the generic format

5. **Error handling:**
   - If no transcript is available, inform the user that the video has no captions
   - If the video ID is invalid, ask the user to double-check the URL
