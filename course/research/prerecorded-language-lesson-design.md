# Pre-Recorded Language Lesson Design Research

## Purpose

This note captures the lesson-design principles that should shape scripted Thai lessons for **Immersion Thai with Nine**.

The target format is:
- pre-recorded
- spoken tutorial style
- screen-supported
- beginner friendly
- interactive despite being asynchronous

These principles should inform:
- `brief.md`
- `script-master.json`
- `script-spoken.md`
- `script-visual.md`
- editorial QA

## Working conclusion

Pre-recorded language lessons work best when they are not treated as passive lecture videos.

The strongest structure is:
1. orient the learner to one communicative goal
2. model the target chunk clearly
3. make the learner notice one important feature
4. force a spoken response
5. force a choice or discrimination
6. move into controlled production
7. use a short realistic roleplay
8. finish with retrieval and recap

This repo should therefore prefer **teaching devices** over long explanation blocks.

## Research-backed design principles

### 1. Use short, purposeful teaching segments

Do not let a lesson become one long explanation block.

Each section should do one clear job:
- model
- explain
- practise
- apply

The evidence from multimedia-learning research supports signalling and concise, purpose-led segments. It does **not** support turning a lesson into dense uninterrupted exposition.

Implication for scripts:
- keep sections narrow
- keep one teaching target visually dominant
- avoid overloading one section with multiple new patterns

### 2. Use active viewing, not passive viewing

Research on video in language teaching consistently recommends pre-, while-, and post-viewing tasks rather than passive watching.

For this course, that means:
- before a model: set a small listening target
- during the model: make the learner notice one contrast
- after the model: force a response, choice, or recall

Implication for scripts:
- every section should contain a learner task, not just teacher explanation
- do not let “spoken narration” become a mini lecture with no response window

### 3. Use explicit teaching devices suited to pre-recorded lessons

Because the lesson is asynchronous, interaction has to be designed into the script.

Useful devices:
- `listen first, then repeat`
- `echo repetition`
- `pause and say it now`
- `choose the right form`
- `spot the difference`
- `which answer fits?`
- `substitute one slot`
- `look away and answer`
- `say the next line before I reveal it`

Implication for scripts:
- the teacher should explicitly cue pauses and response windows
- learners should be asked to speak out loud, not just watch

### 4. Move from recognition to production

Effective lesson flow is not:
- explain everything
- then show one roleplay

Effective flow is:
- model
- guided noticing
- controlled response
- substitution / transformation
- short production

Implication for scripts:
- drills should progress in difficulty
- roleplay should come after controlled practice, not replace it

### 5. Roleplays should be short, realistic, and function-driven

Research on communicative tasks and roleplay supports realistic short exchanges that require the target form to do a clear job.

In this course, a roleplay should:
- solve one small problem
- include a real trigger for each phrase
- reflect the exact lesson objective
- avoid phrase-checklist dialogue

Implication for scripts:
- roleplays should be built from the lesson target outward
- if a line exists only to force in vocabulary, remove or rewrite it

### 6. Retrieval and spaced reuse matter

Vocabulary and pattern retention improve when learners retrieve previously learned material and meet it again over time.

Implication for scripts:
- reuse prior material in a meaningful way
- include retrieval prompts, not only re-exposure
- recap should ask the learner to recall before the answer appears

### 7. Visual support should reduce load, not duplicate speech

Multimedia-learning research supports signalling, clean layout, and avoiding redundant overload.

Implication for scripts and visuals:
- show the key chunk, contrast, or decision point
- do not turn the screen into a full transcript wall
- keep the left panel simple enough that a learner can watch, listen, and answer

## Recommended lesson device sequence

Use this as the default shape for beginner prerecorded lessons.

### A. Hook and listening target
- one short situation
- one clear communicative problem
- one listening question

Example:
- “Listen once. Are we asking what this is, or where it is?”

### B. Clean model
- teacher models the target chunk once or twice
- no heavy explanation first

### C. Guided noticing
- learner notices one specific feature:
  - question word placement
  - politeness particle
  - contrast between two forms
  - location word versus object word

### D. Echo / call-and-response
- learner repeats the target chunk after a clear cue

### E. Discrimination / choice
- learner chooses between:
  - this / that
  - here / there
  - yes / no
  - what / where

### F. Controlled production
- substitution
- response building
- cue-to-line production

### G. Micro roleplay
- 6 to 10 lines
- realistic
- one practical objective

### H. Retrieval recap
- ask before revealing
- mix new and old material

## Minimum teaching-device expectations for this pipeline

Every new lesson should include:
- at least 1 `listen first` model moment
- at least 1 explicit repeat / echo moment
- at least 1 discrimination or choice task
- at least 1 substitution or response-building drill
- at least 1 pause-and-produce retrieval moment
- at least 1 realistic micro roleplay
- at least 1 recap that asks for recall, not just summary

These do not all need to be separate sections.
They do need to be clearly present in the lesson design.

## Specific implications for script writing

### `script-master.json`
- sections should describe teaching moves, not only content themes
- drills should reflect varied device types
- review reuse should include retrieval, not only mention

### `script-spoken.md`
- include explicit learner cues:
  - “listen first”
  - “now say it”
  - “pause and answer”
  - “choose one”
  - “look away and try”

### `script-visual.md`
- visuals should support:
  - one model
  - one contrast
  - one choice
  - one answer space
- avoid visuals that only decorate the narration

## Sources used

Primary or directly relevant sources reviewed:
- Richard Mayer, multimedia-learning guidance via the Science of Learning summary from the University of Queensland:
  - https://itali.uq.edu.au/article/2021/11/four-evidence-based-guidelines-effective-educational-videos
- Susan Stempleski, *Video in the ELT Classroom: The Role of the Teacher*:
  - https://www.cambridge.org/core/books/methodology-in-language-teaching/video-in-the-elt-classroom-the-role-of-the-teacher/370060DB88B6E5A015CFD67888752F83
- Rod Ellis et al., explicit instruction timing with task repetition:
  - https://www.cambridge.org/core/journals/language-teaching/article/when-and-how-to-teach-grammar-in-taskbased-language-teaching/4804B83AF1522F5F50D6B21B2AA2865F
- Joseph N. Foley et al., spacing effects in second-language vocabulary learning:
  - https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2016.00022/full
- Gaofeng Lin, repeated short video lecture study:
  - https://eric.ed.gov/?id=EJ1360949
- Roleplay and communicative use in language learning:
  - https://eric.ed.gov/?id=ED399789

## How to use this note

Before writing a new lesson:
- review the device sequence above
- ensure the blueprint outcome maps to concrete teaching moves
- make the lesson interactive on paper, not only informative

Before passing editorial QA:
- check whether the lesson would still teach if Nine recorded it exactly as written
- if the learner mostly watches and listens without being asked to do anything, the script is too passive
