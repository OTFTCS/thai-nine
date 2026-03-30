# Stage 1 — AI Lesson Brief + Script Generation

You are writing a full lesson for **Immersion Thai with Nine**.

This is not a TikTok script. It is a real teaching lesson for a learner who wants careful explanations, controlled progression, and practical Thai they can use immediately.

Each lesson serves two purposes:
1. **Self-paced online course** — the learner watches the pre-recorded lesson alone
2. **Live 1:1 teaching with Nine** — Nine uses the deck as a guide in a private session

Write scripts that work for both. Use "You" (not "Learner") in roleplay speaker labels so it feels like a direct conversation.

Write directly to the lesson directory:
- `brief.md`
- `script-master.json`
- `script-spoken.md`
- `script-visual.md`

## Core role

Act as:
- a Thai curriculum designer
- a private tutor planning a high-clarity lesson
- an instructional writer who can explain nuance, usage, and grammar simply without becoming academic

The lesson should feel like:
- warm
- practical
- spoken-first
- carefully scaffolded
- realistic for a learner studying with a Thai teacher

It should not feel like:
- a social media short
- a hype video
- a phrase dump
- a travel blog
- a grammar textbook chapter

## Source of truth

The curriculum identity comes from the blueprint row.

Use the blueprint row to determine:
- lesson id
- lesson title
- module title
- CEFR band
- primary and secondary outcomes
- quiz focus
- flashcard tags
- notes
- required review vocabulary

You may add supporting vocabulary, short chunks, and explanation language when genuinely needed to teach the lesson well, but do not drift away from the lesson objective.

## Required inputs

You will be given:
- the lesson id
- the full blueprint row for the target lesson
- `context.json`
- lesson research notes from the lesson directory when they already exist:
  - `scope-research.md`
  - `usage-research.md`
  - `visual-research.md`
  - `explanation-research.md`
- exemplar lesson files from previously produced lessons
- `course/transliteration-policy.md`
- `course/schemas/script-master.schema.json`
- `course/schemas/deck-source.schema.json`
- the current PPTX design system in `course/reference/design_system.py`

Treat these as binding:
- schema is binding
- transliteration policy is binding
- context review buckets are binding when they contain reusable prior material
- research notes are binding once they exist; if they do not exist yet, write them before or alongside stage-1 authoring and use them to lock scope, conceptual anchors, and visual simplification decisions
- `explanation-research.md` is binding only for the selected high-risk concepts it covers; use it to sharpen understanding, not to import another teacher's voice
- exemplars are style references, not content to copy

## Output contract

### 1. `brief.md`

Write a production brief that includes:
- lesson id and title
- module title and CEFR band
- target runtime
- primary objective
- secondary objective
- scenario or teaching frame
- must-teach outcomes
- core vocabulary and chunks in triplet form
- teaching constraints
- likely learner mistakes to watch for
- image and visual notes if helpful

### 2. `script-master.json`

This is the canonical source.

It must be valid against `script-master.schema.json`.

Requirements:
- keep `schemaVersion: 1`
- use the exact lesson id
- include the provided `context` object unchanged
- include `teachingFrame` with:
  - `targetRuntimeMin`
  - `targetRuntimeMax`
  - `openingHook`
  - `scenario`
  - `learnerTakeaway`
- include at least 4 sections
- each section must have:
  - `id`
  - `heading`
  - `purpose`
  - `spokenNarration`
  - `onScreenBullets`
  - `drills`
  - `languageFocus`
  - `visualPlan`
- each section must have at least 3 spoken narration lines
- each section must have at least 1 drill
- roleplay must have at least 6 lines
- recap must have at least 3 items
- policies must use the required enum values

For every `languageFocus` item:
- include `thai`
- include `translit`
- include `english`
- optionally include `notes`
- set `vocabId` to the placeholder `v-0000000000`

For every section `visualPlan`:
- choose one `leftPanelLayout` from:
  - `focus-card`
  - `contrast-board`
  - `dialogue-ladder`
  - `drill-stack`
  - `image-anchored`
- include `onScreenGoal`
- include at least 2 `teachingVisuals`
- include at least 1 `teacherCues`
- include `imageSupport` with:
  - `helpful`
  - `priority`
  - `rationale`
  - `searchQueries`
  - `sourceHints`
  - optional `aiFallbackPrompt`

Rules for `imageSupport`:
- if `helpful` is `true`, provide at least 1 concrete search query
- if `helpful` is `false`, explain why text-only or icon-led teaching is better
- prefer `sourceHints` such as `Pexels`, `Wikimedia Commons`, `The Noun Project`, `official signage`, or another specific realistic source
- only include `aiFallbackPrompt` when a generated image would genuinely teach better than a real-world image

Do not invent schema fields beyond what the provided schema allows.

### 3. `script-spoken.md`

Write a clean teacher-facing narration script that:
- follows the same structure as `script-master.json`
- is easy for Nine to read aloud
- includes Thai, transliteration, and English where needed
- sounds natural when spoken
- includes pacing and teaching cues only when genuinely helpful

### 4. `script-visual.md`

Write a visual script for the PPTX lesson deck.

The final lesson presentation is **16:9** and the **right third is reserved for Nine's camera / recording space**.

That means:
- all primary teaching visuals must fit comfortably in the left two-thirds
- do not plan dense full-width layouts
- prefer concise visual beats
- keep overlays readable and uncluttered
- use the visual script to support the spoken teaching, not duplicate it mechanically

For each section, include:
- the learning focus
- what appears on screen
- which Thai terms are highlighted
- which images, icons, or visual references would help
- whether a real-world image is genuinely useful
- how the visual stays inside the left teaching area without spilling into Nine's camera zone

## Pedagogy constraints

The lesson must teach, not just present.

For concrete beginner content, default to a translation-first, usage-first explanation style.

Start with:
- the clearest direct gloss that is still true
- one realistic usage line
- one likely beginner misuse only when it materially helps

Only escalate to a conceptual anchor or sourced explanation when the direct gloss would teach the wrong instinct or leave a real confusion unresolved.

If `explanation-research.md` exists:
- use it only for the selected high-risk concepts
- rewrite the final explanation into shorter house-style wording
- keep the lesson simpler and more direct than the source note
- never echo source phrasing closely

Include:
- what the form means
- when to use it
- what nuance it carries
- what mistakes English speakers are likely to make
- what changes in politeness, register, or rhythm matter

For grammar or function explanations:
- explain the pattern simply
- explain the job the pattern is doing
- explain at least one realistic usage context
- explain at least one likely misuse if relevant

For nuanced words:
- explain when a direct English gloss is insufficient
- explain how Thai usage differs from literal translation
- explain if something is softer, more formal, more casual, or more natural in context
- prefer the simplest true explanation that gets the learner to a usable next line

## Conceptual anchor pass

Before finalizing the lesson, identify up to 3 high-risk concepts that might need an internal model rather than a bare gloss.

Do not assume a conceptual anchor is needed.
Most concrete beginner lessons should remain mostly translation-first.

High-risk concepts commonly include:
- abstract grammar or function
- politeness particles or social softeners
- tones or pronunciation contrasts
- script logic
- cases where a direct English gloss would teach the wrong instinct

For each selected concept, include one concise conceptual anchor in the lesson.

Good conceptual anchor types:
- social-job framing
- sentence-frame or slot framing
- `not X, but more like Y` contrast
- sound or mouth map
- tiny situational analogy

Bad conceptual anchor types:
- decorative metaphor with no teaching payoff
- unsupported etymology
- mystical or pseudo-historical explanation
- false one-to-one English equivalence
- long side explanations that interrupt the lesson flow

Rules:
- if a direct translation-plus-usage explanation works cleanly, prefer that over a conceptual anchor
- keep conceptual anchors short, usually 1-2 spoken lines
- keep them spoken-first; they belong primarily in `spokenNarration`
- optionally reinforce them in `languageFocus[].notes` when that helps later QA or downstream reuse
- do not invent new schema fields for conceptual anchors
- if `explanation-research.md` exists, distill it into simpler house wording before it reaches the script
- make the limit of the comparison clear when needed, especially when the anchor could be mistaken for a literal translation
- do not force analogies into concrete vocabulary lessons unless they prevent a real beginner mistake or materially improve retention

## Pre-recorded lesson design

This lesson is delivered as a **pre-recorded online tutorial**.

That means the script must create interaction deliberately.
Do not write a passive lecture with occasional phrase lists.

Use the lesson to create a rhythm of:
- model
- notice
- repeat
- choose
- produce
- roleplay
- retrieve

The learner should be asked to do things out loud even though the lesson is asynchronous.

Useful teacher cues include:
- `listen first`
- `say it with me`
- `your turn`
- `pause and answer`
- `choose the right one`
- `look away and try`
- `say the next line before I show it`

These cues do not need to appear mechanically in every paragraph, but the lesson should clearly create response windows.

## Section design

Use a progressive teaching flow.

Across the lesson, the learner should move through:
- notice
- understand
- repeat
- substitute
- answer
- produce

Each section should feel purposeful. Good section shapes include:
- setup / meaning
- pattern explanation
- controlled practice
- applied mini-scenario

Do not make all sections feel identical.

## Pronunciation beat (required from M01-L002 onwards)

Every lesson must include a **dedicated pronunciation micro-segment** (60–90 seconds) that trains the learner's ear and mouth, not just their vocabulary.

Include a `pronunciationFocus` object in the script-master.json with:
- `targetSounds`: what sound contrast or tone pattern is being trained this lesson
- `minimalPairs`: at least 1 meaning-changing pair (e.g., ไก่/ไข่, มา/ม้า/หมา, ใกล้/ไกล)
- `mouthMapAnchor`: a physical description of how to produce the sound ("rising tone starts low and lifts up, like asking a question in English")
- `tonePattern` (optional): which tone is being drilled

Pronunciation focus progression across the course:
- **M01–M02**: Individual sounds that don't exist in English (aspirated vs unaspirated: ก/ข, ด/ท, บ/ป)
- **M02–M03**: Tone contrasts via meaning-changing minimal pairs
- **M04–M06**: Tone drills using that lesson's vocabulary (hear two, choose correct one)
- **M07+**: Connected speech, rhythm, reduction patterns

At least 1 drill per lesson must be a pronunciation drill. Good pronunciation drill types:
- **Minimal pair choice**: "Which word means X? Option A or Option B?" (tests tone discrimination)
- **Tone echo**: Model → learner repeats → model again for self-check
- **Tone pattern drill**: 3–4 words with the same tone, then one intruder with a different tone
- **Aspiration contrast**: Hear two words, identify which has the air puff

Do not skip pronunciation. Thai tones are the #1 challenge for Western learners, and every lesson is an opportunity to train the ear.

## Cognitive load and vocabulary scope

The blueprint defines WHAT to teach. You define HOW to scaffold it.

Rules:
- **Teach ALL vocabulary from `new_vocab_core` and `new_chunks_core` in the blueprint.** Never skip or deprioritize blueprint vocabulary.
- **Scaffold by splitting across sections** — max 5–6 new items per section before practice begins
- Each new item must appear in **3+ varied contexts** within the lesson (explanation, drill, roleplay, recap — not just its own section)
- **95% comprehensibility rule**: within any given section, only the items being taught in that section should be genuinely new; the rest should be known or just introduced

If the blueprint has many items (e.g., numbers 0-10 = 11 words), split them across 2-3 teaching sections (e.g., 0-5 in section 1, 6-10 in section 2, chunks in section 3). Do not cap the total — the blueprint is the source of truth.

## Pushed output requirements

The learner must produce language, not just recognize it. At least 40% of drill moments should require the learner to speak, not just choose.

Every lesson must include:
- at least **1 substitution drill** (swap one slot in a frame: "Say 'I want ___' with the next food item")
- at least **1 response-building drill** (learner constructs a response from a cue)
- at least **1 pause-and-produce moment** where the learner says the line BEFORE hearing the answer
- roleplay must include at least **2 turns where the learner could reasonably produce the next line** (mark these with a teacher cue like "your turn" or "say the next line before I show it")

## Input flood and recycling

Each new vocabulary item or pattern must appear in multiple contexts across the lesson, not just in its teaching section.

Rules:
- Each target form must appear in the `spokenNarration` of at least **2 different sections** (not just its own)
- Target forms should appear naturally across: explanation examples, drill prompts, roleplay lines, AND recap items
- Prior vocabulary from `context.json` review buckets should be woven into drills and roleplay, not forced as a separate checklist

## Task repetition with variation

At least one drill format should appear **twice in the lesson with different content** (e.g., substitution drill in section 2 with greetings, same format in section 4 with questions). This builds automaticity through repetition with variation.

The roleplay should echo a drill pattern from earlier — the roleplay "tests" what a drill "trained."

## Lexical chunks

When a `languageFocus` item is a multi-word chunk (e.g., ไม่เป็นไร, ยินดีที่ได้รู้จัก, ขอโทษครับ), set `"type": "chunk"` on the item.

Teach chunks as whole units first. The learner should hear, repeat, and use the chunk before (optionally) decomposing it into parts. Do not default to word-by-word translation for chunks.

## Explicit individual word introduction (MANDATORY)

Every new word from the blueprint MUST be explicitly introduced as an individual item BEFORE it appears in any chunk, sentence, or drill. No exceptions.

The introduction for each word must include:
1. The word shown alone on screen (Thai + transliteration + English) as its own triplet card
2. A spoken "listen first" or "repeat after me" moment in the narration
3. One simple usage example or context sentence

Only AFTER a word has been individually introduced can it appear in:
- chunks (e.g., นี่คือ... can only appear after both นี่ and คือ have been taught individually)
- drills that combine multiple new words
- roleplay lines
- sentences in narration

**Section structure for new vocabulary:**
- First: introduce 2-3 new words individually (each gets its own triplet card and narration moment)
- Then: combine the just-introduced words into a chunk or pattern
- Then: drill the chunk with substitution or response-building
- Max 3 new standalone words per section + 1 chunk that combines them

If a section would need more than 3 new words, split it into two sections.

**Example of correct structure:**
- Section 1: Teach นี่ (this) and คือ (is) individually → then teach the chunk นี่คือ... (this is...)
- Section 2: Teach ใคร (who) individually → then teach the chunk เขาคือใคร (who is he/she?) — because เขา and คือ were already taught

**Example of WRONG structure:**
- Section 1: Show นี่คือ... as a chunk without first teaching นี่ and คือ as standalone words

## Required teaching devices

Every lesson must include all of the following somewhere in the script:
- at least 1 `listen first` model moment before explanation
- at least 1 explicit repeat / echo / call-and-response cycle
- at least 1 discrimination or choice task
- at least 1 substitution or response-building drill
- at least 1 pause-and-produce retrieval moment
- at least 1 realistic micro-roleplay
- at least 1 recap that asks the learner to recall before the answer is shown

These devices should be distributed naturally across the lesson.
Do not dump them all into one section.

## Drill design

Drills should be active and specific.

Good drills:
- listen and repeat
- listen once before repeating
- minimal-pair or contrast choice
- spot-the-right-answer
- substitution
- choose the right form
- response building
- short cue-to-line production
- pause-and-produce
- recall-before-reveal
- mini role-play turns

Bad drills:
- vague review prompts
- generic “practice this”
- repeated phrase lists without transformation
- long explanation followed by no learner action

## Teaching the content, not about the content

Every section's `languageFocus` must contain NEW items from the blueprint. Do not fill sections with review vocabulary as the primary focus items. Review vocab goes into drills, roleplay, and narration naturally — not into `languageFocus` as filler.

Each section must teach the actual words and patterns with listen → repeat → use in context.

Do NOT spend teaching sections on:
- pronunciation theory or sound-shape analysis (that belongs in the pronunciation beat only)
- linguistic observations about the language (“notice the shapes”, “this is a clipped sound”)
- meta-commentary about the vocabulary (“these words are borrowed from English”)

DO spend teaching sections on:
- modeling the words clearly
- having the learner repeat and use them in mini-scenarios
- building from simple to complex (single words → phrases → short exchanges)

If the lesson has a dedicated pronunciation beat section, other sections should NOT also focus on pronunciation. Each section teaches different content.

## Recap format

Recap items must be **short retrieval prompts**, not reference cards.

Rules:
- Max 15 words per bullet
- Ask a question or give a recall challenge — do not restate the content
- No full Thai + transliteration listings in recap — the learner should recall from memory
- Max 5 items

Good recap examples:
- “Count 0 to 5 in Thai. Go.”
- “How do you ask 'what number?' เบอร์อะไร.”
- “Say 'I am 8 years old' in Thai.”

Bad recap examples:
- “Look away and count from zero to ten: ศูนย์ (sǔun), หนึ่ง (nùeng), สอง (sǎawng)...” (too long, restates everything)
- “ขอบคุณ (khàawp-khun) means thank you and ขอโทษ (khǎaw-thôot) means sorry” (reference card, not retrieval)

## Review integration

When `context.json` contains prior lessons or review bucket samples:
- reuse at least 2 prior items if they fit naturally
- weave them into explanation, drills, or roleplay
- do not force irrelevant review content

When there are no prior lessons:
- do not fake prior review

## Roleplay requirements

Roleplay must be realistic and teach something.

Requirements:
- minimum 6 lines
- plausible real-life exchange
- must reflect the lesson objective
- should show at least one meaningful contrast, choice, or response pattern
- should sound like natural spoken Thai for the level
- should include at least one point where the learner could reasonably pause and say the next line before the answer appears
- use `"You"` as the speaker label for the learner's lines (not "Learner" — keeps the 1:1 feel)
- use a simple role name for the other speaker (e.g., "Staff", "New person", "Waiter") — no long descriptions

For pre-recorded teaching:
- roleplay should be staged as teachable beats, not just performed once at full speed
- earlier sections should prepare the exact lines or decisions the roleplay needs
- the roleplay should solve one small communicative problem

## Transliteration rules

Use PTM-adapted inline tone marks only.

Hard rules:
- no superscript tone letters
- no alternate transliteration systems mixed in
- no missing tone marks where policy requires them
- no “close enough” romanization drift

All learner-facing Thai content must have complete triplets where required.

## Visual and image guidance

Only request images when they genuinely help learning.

Prefer:
- internet-sourced real-world images
- icons
- diagrams
- simple visual anchors

Use AI-generated imagery only when it is clearly helpful and a real-world image would not teach the concept well enough.

Good reasons for images:
- concrete objects
- places
- food
- clothing
- directional layouts
- comparisons where seeing the concept helps memory

Weak reasons for images:
- abstract filler
- decorative background mood
- images that repeat what the text already explains perfectly

If a conceptual anchor is used:
- keep it spoken-first by default
- only place it on screen when a small contrast, slot frame, or simple diagram clearly reduces cognitive load
- do not turn the analogy into decorative metaphor art

## PPTX-safe visual planning

The teaching visuals are eventually converted into deterministic `deck-source.json` and `deck.pptx`.

Your section visual plans should therefore already be suitable for:
- a 1920x1080 canvas
- left 66.67% teaching area
- right 33.33% camera area
- short, legible overlays
- one supporting visual anchor per slide, not a crowded collage

Good visual layouts:
- `focus-card` for one phrase or one contrast set
- `contrast-board` for A/B distinctions
- `dialogue-ladder` for roleplay turn-taking
- `drill-stack` for controlled practice prompts
- `image-anchored` when a real-world image clearly supports memory or meaning

Bad visual planning:
- full-width slides that assume no camera box
- dense bullet walls
- decorative stock-photo backgrounds with no teaching role
- asking for images without saying what they teach

## Quality bar

The finished lesson should be good enough that:
- Nine can record from it without rewriting everything
- the learner can follow the logic from explanation to practice
- downstream flashcards and quiz generation have clean source material
- the lesson feels like one coherent teaching session

## File-writing rules

Write the files directly.

Do not:
- output commentary instead of files
- ask for permission
- leave TODOs
- leave malformed JSON
- leave placeholder prose outside the required files

The lesson must be ready for:
- `fixup-vocabids`
- stage 2 QA
- stage 3-7 deterministic artifact generation
