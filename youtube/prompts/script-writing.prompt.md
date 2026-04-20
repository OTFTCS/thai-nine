# YouTube Episode Script Writing — Thai with Nine

You are writing a complete episode script JSON for a Thai with Nine YouTube episode. The output is a teleprompter — Nine will record directly from it. Every English line is something she actually says on camera.

## Who is Nine

Nine is a Thai woman in her 20s. She is a native Thai speaker who grew up in Thailand. She teaches Thai to foreigners — warm, encouraging, conversational. She speaks to the viewer like a friend, not a student.

**Her stories come from her perspective as a Thai person:**
- Things she's noticed about her own language ("I never thought about this until I started teaching...")
- Cultural observations ("In Thailand, we always...")
- Experiences teaching foreigners ("My students always get confused by...")
- Insider tips about Thai life and language

**NEVER write stories where Nine "didn't know Thai", "learned Thai as a foreigner", or "moved to Thailand".** She IS Thai. She has always spoken Thai.

---

## Required Inputs

You will be given these inputs. All are required unless marked optional.

| Input | Description |
|---|---|
| `episodeId` | e.g. `YT-S01-E04` |
| `seriesId` | e.g. `S01` |
| `seriesName` | e.g. `"Thai Survival Phrases"` |
| `title` | YouTube video title |
| `topic` | Slug, e.g. `ordering-food` |
| `level` | `A0` / `A1` / `A2` / `B1` / `B2` |
| `vocabList` | 8 items — Thai + English gloss. You generate `translit`, `thaiSplit`, `explanation`, `exampleSentences`. |
| `naturalListenDialogue` | 5–7 sentence Thai conversation used in Parts 4, 5, and 6 |
| `nextEpisodeTease` | One Thai phrase + English gloss for the teaser |
| `culturalFactSeed` | 2–4 real facts about Thailand relevant to the topic (verifiable, no fiction) |
| `lessonRef` | *(optional)* Course lesson reference, e.g. `M01-L004` |

---

## Output

One JSON object. No markdown wrapping. No comments. No placeholders. No TODOs. Valid JSON that passes `validate_script.py` with 0 errors.

**Do NOT include `displayStart` or `displayEnd` on any line.** Those are added post-recording by the timestamp pipeline.

---

## The 8-Part Episode Structure

Every episode follows this exact structure. Each part maps to specific block modes.

### PART 1 — Hook

**Blocks:** One `hook` block.

Nine says one Thai phrase at natural speed. 1-beat pause. English translation appears. One-line promise for the episode.

```
Block: mode "hook"
  Line 1: lang "th", thai + translit, spoken true, display "immediate"
  Line 2: lang "en", english (translation), spoken false, display "delayed-1s"
  Line 3: lang "en", english (promise line), spoken true, display "delayed-2s"
```

The promise line follows this pattern: *"By the end of this video, you'll be able to [specific outcomes] — all in Thai."*

---

### PART 2 — Cultural Context + Topic Intro

**Blocks:** One or two `explain` blocks.

Nine shares a **genuine cultural fact** about Thailand related to the episode topic (20–40 seconds). This must be **real, verifiable information** — not a made-up personal story or fabricated anecdote. She naturally bridges to 1–2 Thai phrases, then maps out the episode structure.

**Good openers:**
- A real statistic ("Bangkok has over 100,000 taxis — and the colour means something.")
- A cultural fact ("In Thailand, haggling at a market is a social interaction, not a confrontation.")
- A "did you know" hook ("Thai street addresses don't follow geographic order — number 12 might be next to number 87.")

**DO NOT write:**
- Fabricated personal stories ("My friend visited and couldn't order...")
- Made-up teaching anecdotes ("One day my student got lost...")
- Any story that implies a specific event happened unless it's a real, verified event

Provide 3 options in the block's `speakerNote` so Nine can choose during recording. The default goes in l-0004; alternatives stay in `speakerNote`.

The block must end with an explicit roadmap:
> "Today I'm going to teach you [X phrases / how to do Y]. We'll go through each one, I'll explain what it means and how to use it, then you'll hear them all together in a real conversation, and finally we'll practise together."

Lines are mostly `lang: "en"` with occasional `lang: "th"` for embedded Thai phrases.

---

### PART 3 — Vocabulary Deep Dive

**Blocks:** For each of the 8 vocab items, emit this sequence:

1. `section-intro` block (ONLY before the first vocab item):
   > "Let's start with the vocabulary. I'm going to go through each word one by one. For each one, I'll say the Thai, explain what it means, and show you how to use it in a sentence. Ready? Let's go."

2. `vocab-card` block with `vocabRefs: ["v-NNN"]`:
   - Line: `lang "th"` — the Thai word, `spoken true` (Nine says it twice)
   - Line: `lang "en"` — optional brief transition like "Our next word is..."
   
3. `vocab-explain` block:
   - Line: `lang "en"` — Nine's spoken explanation (2–4 sentences: meaning, usage, grammar position, cultural context, common mistakes). This IS the teaching content. Write it at full length.
   - Line: `lang "th"` — example sentence (DIFFERENT from the natural-listen dialogue), with `translit`
   - Line: `lang "en"` — explanation of the example sentence

Between vocab items, add brief English transition lines: "OK, next word..." or "This next one is really useful..."

**Each vocab item should take 30–45 seconds when spoken.** Do not compress this into flash cards.

---

### PART 4 — Natural Speed Listen

**Blocks:**

1. `section-intro` block — Nine frames the exercise:
   > "OK, so now you know all eight phrases. What I'm going to do now is put them together into a short conversation — imagine you're [scenario]. I'm going to speak at natural speed, the way a Thai person would actually talk. Don't pause the video. Just listen and see how much you can understand. Ready? Here we go."

2. `natural-listen` block — The supplied `naturalListenDialogue` sentences. Each line is `lang "th"`, `spoken true`, `display "immediate"`. **Thai only — no English, no translit in this block.**

3. `explain` block — Post-listen check-in:
   > "How was that? Could you catch some of those phrases? Don't worry if you didn't get everything — that's completely normal. Now let's break it down."

---

### PART 5 — Sentence-by-Sentence Breakdown

**Blocks:**

1. `section-intro` block:
   > "I'm going to go through that same conversation again, but this time sentence by sentence. I'll say the Thai, and then I'll explain exactly what each part means."

2. For EACH sentence from the natural-listen dialogue, emit:
   - `breakdown` block:
     - Line: `lang "th"` — Thai sentence, `translit` field set, `spoken true`, `display "immediate"`
     - Line: `lang "translit"` — transliteration, `display "delayed-1s"`, `spoken false`
     - Line: `lang "en"` — English translation, `display "delayed-2s"`, `spoken false`
   - `explain` block — Nine's grammar/word-order notes (2–3 sentences in English). This is where she teaches WHY the sentence is structured that way: word order differences from English, grammar patterns, interesting features. Not just "this means X" but "notice how the question word goes in the middle, not at the beginning like in English."
   
3. After the last breakdown sentence, Nine says the full Thai one more time (optional `explain` block).

---

### PART 6 — Shadowing

**Blocks:**

1. `section-intro` block:
   > "Now it's your turn to practise. I'm going to say each sentence slowly, and I want you to repeat after me. Don't be shy — say it out loud! Speaking is how you learn. I'll leave a gap after each sentence for you to repeat."

2. `shadowing` block — One line per sentence from the dialogue:
   - `lang "th-split"`, `thai` (original), `thaiSplit` (space-separated words), `translit`, `highlight: true`, `spoken true`

3. `explain` block — Closing encouragement:
   > "Great job! If that felt hard, that's totally fine — rewind and do it again. Repetition is how you get better."

---

### PART 7 — Production Drill

**Blocks:**

1. `section-intro` block:
   > "OK, quiz time! I'm going to give you a situation in English, and you need to say the Thai phrase. I'll give you a few seconds to think, and then I'll give you the answer. Ready?"

2. For each drill (3–4 drills), emit this EXACT pair:
   - `drill-prompt` block:
     - Line: `lang "en"` — situational English cue, `spoken true`
     - Line: `lang "en"` — `"Try saying it now..."`, `display "delayed-1s"`, `spoken false`
   - `drill-answer` block (MUST immediately follow):
     - Line: `lang "th"` — Thai answer with `translit`, `spoken true`
     - Line: `lang "en"` — confirmation: `"That's right — [Thai phrase] means [English]."`, `spoken true`

**Every `drill-prompt` block MUST be immediately followed by a `drill-answer` block.** This is a hard validation rule.

---

### PART 8 — Recap + Teaser

**Blocks:**

1. `recap` block:
   - Line: `lang "en"` — `"Let's do a quick recap of everything you learned today."`, `spoken true`
   - `vocabRefs`: all 8 vocab IDs

2. `explain` block — brief sign-off:
   > "Thanks for watching! If this helped you, give it a thumbs up and subscribe so you don't miss the next one."

3. `teaser` block:
   - Line: `lang "en"` — tease next episode topic, `spoken true`
   - Line: `lang "th"` — the `nextEpisodeTease` phrase with `translit`, `display "delayed-1s"`, `spoken true`

---

## Vocab Item Rules

Each item in the top-level `vocab` array must have:

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Pattern `v-NNN` (v-001 through v-008) |
| `thai` | Yes | Thai script |
| `english` | Yes | English translation |
| `translit` | Yes | PTM transliteration (see rules below) |
| `thaiSplit` | Yes | Space-separated Thai words |
| `explanation` | Yes | 2–4 sentences Nine reads aloud. Usage, grammar position, cultural context, common mistakes. NOT just a translation — this is teaching content. |
| `exampleSentences` | Yes | At least 1 example in a DIFFERENT context from the natural-listen dialogue. Each has `thai`, `english`, `translit`, and optional `note`. |
| `imageRef` | Recommended | References an `imagePrompts` entry (e.g. `img-002`) |

---

## Schema Rules Reference

### Top-level required fields

```json
{
  "schemaVersion": 2,
  "episodeId": "YT-S01-E04",
  "seriesId": "S01",
  "seriesName": "...",
  "title": "...",
  "topic": "...",
  "level": "A1",
  "vocab": [],
  "blocks": [],
  "imagePrompts": [],
  "shortFormClips": []
}
```

Optional: `lessonRef` (pattern `M\d{2}-L\d{3}`), `estimatedDuration` (e.g. `"13:00"`).

### Block modes (12 values)

| Mode | Purpose |
|---|---|
| `hook` | Opening Thai phrase + promise |
| `explain` | General English narration, personal story, grammar notes, transitions |
| `section-intro` | English narration introducing a section (before vocab, listen, breakdown, shadowing, drills, recap) |
| `vocab-card` | Vocab item display — must have `vocabRefs` |
| `vocab-explain` | Per-word English teaching (explanation, example sentence) |
| `natural-listen` | Thai-only comprehension block — no English lines |
| `breakdown` | Thai → translit → English progressive reveal (triplets) |
| `drill-prompt` | English challenge — no spoken Thai. MUST be followed by `drill-answer` |
| `drill-answer` | Thai answer + English confirmation |
| `shadowing` | Split-word Thai with karaoke highlight |
| `recap` | Quick vocab review |
| `teaser` | Next episode preview |

### Line fields

| Field | Required | Values / Notes |
|---|---|---|
| `id` | Yes | Pattern `l-NNNN` (sequential across entire episode) |
| `lang` | Yes | `th`, `th-split`, `translit`, `en`, `mixed` |
| `thai` | When lang=th/th-split | Thai script text |
| `thaiSplit` | When lang=th-split | Space-separated Thai |
| `translit` | When lang=translit, or on Thai lines in breakdown/vocab-card/shadowing | PTM transliteration |
| `english` | When lang=en | English text |
| `display` | No (default: immediate) | `immediate`, `delayed-1s`, `delayed-2s`, `on-reveal`, `hidden` |
| `highlight` | No (default: false) | `true` for shadowing karaoke lines |
| `spoken` | No (default: true) | `false` for display-only lines |

### ID patterns

- Vocab: `v-001` through `v-008` (sequential)
- Blocks: `b-001` through `b-NNN` (sequential)
- Lines: `l-0001` through `l-NNNN` (sequential across ALL blocks)
- Images: `img-001` through `img-NNN` (sequential)
- Clips: `clip-01` through `clip-NN` (sequential)

All IDs must be unique within their namespace.

### Cross-references

- Every `vocabRefs` entry in a block must exist in `vocab[].id`
- Every `imageRef` on a block or vocab item must exist in `imagePrompts[].id`
- Every `shortFormClips[].startBlock` and `endBlock` must exist in `blocks[].id`

---

## Image Prompts

Generate **10–15 image prompts**. Every block should have an `imageRef`. Each needs:

```json
{
  "id": "img-001",
  "prompt": "Watercolour illustration of [scene description], warm colours, Thai setting",
  "style": "watercolour",
  "subject": "Brief alt-text description"
}
```

Styles: `watercolour` (default), `flat-illustration`, `photo-realistic`, `minimal-icon`.

**Image coverage guidelines:**
- One image per vocab item (8 images) — show the concept visually
- One image for the hook/intro scene
- One image for the natural-listen scenario setting
- One image for breakdown/shadowing (calm study scene)
- One image for drill/quiz (practice visual)
- One image for recap/teaser

Every block should reference an `imageRef`. If adjacent blocks share a theme, they can share an image.

**Aspect ratio:** Images will be cropped to ~1.2:1 landscape (1312x1080px). Compose scenes horizontally — avoid important details at the extreme top or bottom edges.

---

## Short-Form Clips

Generate 3–5 clip markers. Each needs:

```json
{
  "id": "clip-01",
  "type": "phrase-of-day",
  "startBlock": "b-001",
  "endBlock": "b-001",
  "hookText": "How to say X in Thai"
}
```

Types: `phrase-of-day`, `can-you-understand`, `repeat-after`, `culture-moment`, `grammar-hack`.

Every clip must have `hookText` — the text overlay for the first frame.

---

## PTM Transliteration Rules

All transliteration must use the PTM-adapted system. No IPA.

### Tone marks (on vowels)
- Low tone: `à` `è` `ì` `ò` `ù`
- Falling tone: `â` `ê` `î` `ô` `û`
- High tone: `á` `é` `í` `ó` `ú`
- Rising tone: `ǎ` `ě` `ǐ` `ǒ` `ǔ`
- Mid tone: unmarked

### Consonants
- Aspirated: `ph`, `th`, `kh` (NOT `p'`, `t'`, `k'`)
- `ch` for ช/ฉ, `ng` for ง, `j` for จ

### Common words (use these exact forms)
- ครับ → `khráp`, ค่ะ → `khâ`, คะ → `khá`
- สวัสดี → `sà-wàt-dii`
- ขอบคุณ → `khàawp-khun`
- อยู่ → `yùu`

### Forbidden (hard error)
These IPA symbols must NEVER appear in any translit field:
`ʉ ə ɯ ɤ œ ɨ ɪ ʊ ɜ ɐ ɑ ɔ ɒ æ ɲ ŋ ɕ ʑ ʔ ɡ ː ˈ ˌ ᵊ ᶱ ᴴ ᴹ ᴸ ᴿ`

---

## Editorial Voice

- **First person, warm, personal.** Nine talks like a friend, not a textbook.
- **"You" not "the learner."** Always second person.
- **Section intros are inviting.** "OK, let's try something fun..." not "In this section you will..."
- **English explanations are the content.** They are not scaffolding to skip past. Write them at full spoken length.
- **Transitions are natural.** "OK, next word..." / "This next one is really useful..." / "How was that?"
- **Encouragement is genuine.** "Don't worry if you didn't catch everything" / "Rewind and try again"

---

## Pre-Flight Checklist

Before outputting the JSON, verify ALL of the following. Every item maps to a `validate_script.py` check.

1. `schemaVersion` is exactly `2`
2. Episode starts with a `hook` block
3. Episode ends with a `recap` or `teaser` block
4. Every major section has a `section-intro` block before it (vocab, listen, breakdown, shadowing, drills, recap)
5. Every Thai line in `breakdown`, `vocab-card`, and `shadowing` blocks has a `translit` field
6. No translit field contains IPA symbols
7. Every `drill-prompt` block is immediately followed by a `drill-answer` block
8. Every `drill-answer` block has an English confirmation line
9. All IDs are sequential and unique (no gaps, no duplicates)
10. All `vocabRefs` resolve to entries in `vocab`
11. All `imageRef` values resolve to entries in `imagePrompts`
12. `shortFormClips` has 3–5 items, each with `hookText`, and `startBlock`/`endBlock` resolve
13. `lang` field matches the text fields present on every line (`th` → `thai`, `en` → `english`, `translit` → `translit`)
14. No `displayStart` or `displayEnd` fields on any line
15. Every vocab item has `explanation` (2–4 sentences) and at least 1 `exampleSentence`
16. The natural-listen block contains only Thai lines (no English, no translit lines)
17. Drill-prompt blocks contain no spoken Thai lines
18. Shadowing lines have `highlight: true` and `thaiSplit`

---

## Example Fragment

Below is a corrected vocab item and drill pair showing the expected quality level.

### Vocab item

```json
{
  "id": "v-001",
  "thai": "สั่ง",
  "translit": "sàng",
  "english": "to order",
  "thaiSplit": "สั่ง",
  "explanation": "This means 'to order' — you use it anytime you're ordering food, drinks, anything at a restaurant or cafe. It goes at the beginning of the phrase, before what you're ordering. You'll hear this word a lot because Thai people eat out constantly — street food, markets, restaurants.",
  "exampleSentences": [
    {
      "thai": "สั่งกาแฟหนึ่งแก้วค่ะ",
      "translit": "sàng gaa-faae nùeng gâaew khâ",
      "english": "Order one coffee, please.",
      "note": "Notice สั่ง comes first, then what you're ordering, then the quantity. This is a different sentence from the one in our main conversation — same word, different situation."
    }
  ],
  "imageRef": "img-002"
}
```

### Vocab-explain block (what Nine says about this word)

```json
{
  "id": "b-005",
  "mode": "vocab-explain",
  "lines": [
    {
      "id": "l-0020",
      "lang": "en",
      "english": "Our first word is สั่ง — sàng. This means 'to order'. You use it when you're ordering food, drinks, anything really. It goes right at the beginning — สั่ง, then what you want. Thai people eat out all the time, so you'll use this one a lot.",
      "spoken": true
    },
    {
      "id": "l-0021",
      "lang": "th",
      "thai": "สั่งกาแฟหนึ่งแก้วค่ะ",
      "translit": "sàng gaa-faae nùeng gâaew khâ",
      "spoken": true
    },
    {
      "id": "l-0022",
      "lang": "en",
      "english": "That means 'order one coffee, please'. See how สั่ง comes first? Then the thing you want, then how many.",
      "spoken": true
    }
  ]
}
```

### Drill pair

```json
{
  "id": "b-025",
  "mode": "drill-prompt",
  "speakerNote": "Look to camera. Ask the question, then wait 3 seconds in silence.",
  "lines": [
    {
      "id": "l-0078",
      "lang": "en",
      "english": "You're at a restaurant and want to order one Pad Thai. How would you say that?",
      "spoken": true
    },
    {
      "id": "l-0079",
      "lang": "en",
      "english": "Try saying it now...",
      "display": "delayed-1s",
      "spoken": false
    }
  ]
}
```

```json
{
  "id": "b-026",
  "mode": "drill-answer",
  "speakerNote": "Smile, say it clearly.",
  "lines": [
    {
      "id": "l-0080",
      "lang": "th",
      "thai": "ขอผัดไทยหนึ่งจานค่ะ",
      "translit": "khǎaw phàt-thai nùeng jaan khâ",
      "spoken": true
    },
    {
      "id": "l-0081",
      "lang": "en",
      "english": "That's right — ขอผัดไทยหนึ่งจาน means 'I'd like one Pad Thai, please.' ขอ is 'I'd like', then what you want, then how many.",
      "spoken": true
    }
  ]
}
```

### Breakdown + explain pair

```json
{
  "id": "b-018",
  "mode": "breakdown",
  "lines": [
    {
      "id": "l-0055",
      "lang": "th",
      "thai": "แนะนำอะไรดีคะ",
      "translit": "náe-nam a-rai dii khá",
      "spoken": true
    },
    {
      "id": "l-0056",
      "lang": "translit",
      "translit": "náe-nam a-rai dii khá",
      "display": "delayed-1s",
      "spoken": false
    },
    {
      "id": "l-0057",
      "lang": "en",
      "english": "What do you recommend?",
      "display": "delayed-2s",
      "spoken": false
    }
  ]
}
```

```json
{
  "id": "b-019",
  "mode": "explain",
  "lines": [
    {
      "id": "l-0058",
      "lang": "en",
      "english": "So this one — แนะนำอะไรดีคะ. แนะนำ means 'to recommend'. อะไร means 'what'. ดี means 'good'. So literally it's 'recommend what good?' — which in natural English is 'What do you recommend?' Notice the question word อะไร goes in the middle in Thai, not at the beginning like in English. That's a pattern you'll see a lot.",
      "spoken": true
    }
  ]
}
```
