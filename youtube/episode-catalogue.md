# Thai with Nine — Episode Catalogue

## Vision

An ideal Thai with Nine standalone episode feels like spending 12 minutes with a patient, opinionated friend who happens to be a linguist. The viewer arrives knowing nothing about today's topic and leaves able to do one concrete thing in Thai — order food, explain a symptom, make a complaint — that they could not do before. Every minute either builds new capability or deepens something just taught. Nine's voice carries the whole thing — her angle, her dry observations, her care that the viewer actually gets it.

## Standalone + loosely progressive

- Each episode is fully watchable as a viewer's first.
- Later episodes may reference vocab from earlier episodes without re-teaching (e.g. by episode 20, basic numbers are assumed).
- The catalogue's `recommended_next` column points the viewer at a natural follow-up.

## Title-style buckets

Every episode is pre-assigned one of four title-style buckets. The final YouTube title is chosen at scripting time using the assigned bucket — this keeps thumbnails and titles varied across the channel rather than collapsing into one shape.

- **honest-confession** — starts from Nine's perspective ("I used to get this wrong too…"). Best for cultural / personal episodes.
- **upgrade-offer** — concrete capability the viewer leaves with. Avoids generic "how to X". Example shape: "Order Food in Thai Without Sounding Like a Tourist."
- **counter-intuitive** — challenges an assumption ("Tone marks aren't decoration — they're a 5-rule system"). Best for grammar episodes learners expect to be hard.
- **thai-first** — the Thai phrase IS the title (English gloss in thumbnail/description). Strongest brand signal.

## The 40-episode catalogue

Column definitions:

| Column | Definition |
|---|---|
| `#` | 1–40 (catalogue position, not production order) |
| `working_topic` | slug, lowercase-hyphen — internal handle, not the final title |
| `category` | one of: food / phrases / grammar / culture / conversation / health / accommodation / vocabulary / dialect / script-reading |
| `level` | A0 / A1 / A2 / B1 / B2 (CEFR-adjacent) |
| `title_bucket` | one of the 4 buckets above — drives the final title shape |
| `angle` | one sentence — the **felt promise** (what the viewer can DO by the end), not a topic description |
| `recommended_next` | `working_topic` of an episode that naturally builds on this one, OR `—` for a terminal node |
| `status` | recorded / written / queued / backlog |

| # | working_topic | category | level | title_bucket | angle | recommended_next | status |
|---|---|---|---|---|---|---|---|
| 1 | ordering-food | food | A0 | upgrade-offer | Order any Thai dish — politely, with the right spice level — in your first week | shopping-at-a-market | recorded |
| 2 | asking-directions | phrases | A0 | upgrade-offer | Ask "where is X?" anywhere in Thailand and understand the answer's first three words | asking-for-help-politely | recorded |
| 3 | taking-taxi | phrases | A0 | upgrade-offer | Get into a taxi/Grab and reach your destination without the driver switching to English | money-paying-splitting | recorded |
| 4 | shopping-at-a-market | food | A1 | upgrade-offer | Buy fruit, snacks and cheap clothes at a Thai market — bargain, weigh, and pay in Thai | spice-levels-food-requests | written |
| 5 | first-day-phrases | phrases | A0 | thai-first | Survive your first 24 hours with 10 phrases (hello / thanks / sorry / yes / no / where / how much / water / toilet / help) | thai-greetings-and-wai | queued |
| 6 | script-reading-basics | script-reading | A0 | counter-intuitive | Read your first 5 Thai signs by the end of the video — the alphabet isn't as scary as it looks | 5-thai-sounds | queued |
| 7 | 5-thai-sounds | grammar | A0 | counter-intuitive | Stop mangling 5 Thai sounds (อึ / ง / dt / bp / final stops) that English speakers always butcher | thai-tones-explained | queued |
| 8 | thai-tones-explained | grammar | A0 | counter-intuitive | Tone marks aren't decoration — they're a 5-rule system you can learn in one sitting | politeness-particles | queued |
| 9 | thai-numbers-1-10 | vocabulary | A0 | upgrade-offer | Say any price, any phone number, and any time on a clock face by the end of the video | telling-clock-time | queued |
| 10 | politeness-particles | grammar | A1 | counter-intuitive | ค่ะ / ครับ aren't optional — when to use them, when to drop them, and what dropping them signals | no-articles-no-plurals | queued |
| 11 | no-articles-no-plurals | grammar | A1 | counter-intuitive | Why Thai has no "the," no "a," no plurals — and why this makes Thai easier than you feared | yes-no-questions-with-mai | queued |
| 12 | thai-greetings-and-wai | culture | A1 | honest-confession | When to wai, when to nod, and when foreigners get this wrong (Nine's pet peeves) | weather-and-seasons | queued |
| 13 | weather-and-seasons | conversation | A1 | upgrade-offer | Talk about Thailand's three seasons (hot / hotter / wet) and complain about the weather like a local | small-talk-with-thais | queued |
| 14 | spice-levels-food-requests | food | A1 | upgrade-offer | Order food at exactly your spice level — and convince the cook you actually mean it | thai-coffee-culture | queued |
| 15 | thai-coffee-culture | culture | A1 | honest-confession | Order Thai coffee the way Thais do — and stop accidentally getting a glass of condensed milk | street-food-classics | queued |
| 16 | street-food-classics | food | A1 | thai-first | 10 street-food dishes you can name, point to, and order — with the right vibe | thai-family-vocab | queued |
| 17 | asking-for-help-politely | phrases | A1 | upgrade-offer | Ask a stranger for help in Thai without sounding like a tourist or a robot | refusing-politely | queued |
| 18 | money-paying-splitting | phrases | A1 | upgrade-offer | Pay, split the bill, and round the tip in Thai — restaurants, taxis, and 7-11 | thai-loanwords | queued |
| 19 | thai-family-vocab | culture | A1 | counter-intuitive | Thai family words encode age and gender — meet พี่ / น้อง / ลุง / ป้า and why English breaks here | dating-and-relationships | queued |
| 20 | small-talk-with-thais | conversation | A1 | upgrade-offer | Survive a 5-minute Thai small-talk loop — what they ask, what they expect, what to deflect | thai-coffee-culture | queued |
| 21 | food-allergies | health | A2 | upgrade-offer | Tell any Thai cook "I'm allergic to X" and have them actually believe you | at-the-pharmacy | queued |
| 22 | thai-time-expressions | vocabulary | A2 | counter-intuitive | Yesterday / today / tomorrow / next week — Thai's time map without verb tenses | classifiers-and-quantities | queued |
| 23 | telling-clock-time | vocabulary | A2 | counter-intuitive | Thai tells time in 6-hour chunks — ตี / โมง / บ่าย / ทุ่ม — and it isn't as weird as it sounds | thai-time-expressions | queued |
| 24 | negation-with-mai | grammar | A2 | counter-intuitive | ไม่ does the work of "don't / no / not" — one word, three English jobs | refusing-politely | queued |
| 25 | yes-no-questions-with-mai | grammar | A2 | counter-intuitive | Thai yes/no questions don't need "do" — just add ไหม at the end | negation-with-mai | queued |
| 26 | refusing-politely | phrases | A2 | honest-confession | Saying "no" the Thai way (ไม่เป็นไร, ไม่สะดวก) without losing face — yours or theirs | asking-permission | queued |
| 27 | asking-permission | grammar | A2 | upgrade-offer | ขอ + verb — the one move that lets you ask for almost anything in Thai politely | renting-apartment-in-thai | queued |
| 28 | thai-loanwords | vocabulary | A2 | counter-intuitive | Thai borrows English words and bends them — once you spot the rules, your vocab triples overnight | news-and-podcast-thai | queued |
| 29 | at-the-pharmacy | health | A2 | upgrade-offer | Walk into a Thai pharmacy with a symptom and walk out with the right thing | body-and-feelings | queued |
| 30 | body-and-feelings | health | A2 | upgrade-offer | Tell a Thai doctor or friend exactly where it hurts and how it feels | thai-massage-vocab | queued |
| 31 | renting-apartment-in-thai | accommodation | B1 | upgrade-offer | Tour, negotiate, and sign a Thai apartment — the words landlords actually use | thai-festivals | queued |
| 32 | classifiers-and-quantities | vocabulary | B1 | counter-intuitive | Thai classifiers (ขวด / ชิ้น / ใบ) — the one grammar feature that makes Thai feel Thai | royal-and-formal-thai | queued |
| 33 | thai-massage-vocab | vocabulary | B1 | thai-first | Direct your massage therapist precisely — pressure, pain points, areas, and "เบาๆ พอแล้ว" | — | queued |
| 34 | thai-festivals | culture | B1 | honest-confession | Songkran, Loy Krathong, and the festivals Westerners are mostly getting wrong | thai-nicknames | queued |
| 35 | thai-nicknames | culture | B1 | honest-confession | Why every Thai person is called "Bird" or "Beer" — and how nicknames actually work | thai-humour-and-jokes | queued |
| 36 | dating-and-relationships | conversation | B1 | honest-confession | Date talk in Thai — กิ๊ก / แฟน / จีบ — and why Thai dating vocab has no English equivalent | thai-humour-and-jokes | queued |
| 37 | thai-humour-and-jokes | culture | B2 | honest-confession | What actually makes Thais laugh — wordplay, tonal puns, and the humour you can't translate | royal-and-formal-thai | queued |
| 38 | royal-and-formal-thai | culture | B2 | counter-intuitive | When you'll meet royal/formal Thai (palace, news, funerals) and how to recognise it instantly | news-and-podcast-thai | queued |
| 39 | news-and-podcast-thai | conversation | B2 | upgrade-offer | The leap from learner-Thai to news/podcast Thai — vocab patterns, register, rate of speech | business-and-professional-thai | queued |
| 40 | business-and-professional-thai | conversation | B2 | upgrade-offer | Email phrases, meeting register, and how to be polite at work without sounding stiff | — | queued |

### Distribution snapshot

**Level (target → actual):** A0 6–8 → 8 · A1 10–12 → 12 · A2 10–12 → 10 · B1 6–8 → 6 · B2 4–6 → 4

**Category (target → actual):** food 4–5 → 4 · phrases 5–6 → 6 · grammar 5–7 max → 7 · culture 5–7 → 7 · conversation 4–5 → 5 · health 2–3 → 3 · vocabulary 4–5 → 6 · accommodation/script-reading/dialect (other) 3–4 → 2

**Title bucket:** upgrade-offer 17 · counter-intuitive 13 · honest-confession 7 · thai-first 3

**Terminal nodes (`recommended_next: —`):** 2 (#33 thai-massage-vocab, #40 business-and-professional-thai). Limit is 3.

Known minor imbalances: vocabulary is one over the soft target and the "other" bucket is one under. Both are acceptable for v1; revisit when adding to the catalogue (record any change in `template-decisions.md`).

## Naming convention

`working_topic` is a lowercase-hyphen slug, used in filenames and references throughout the pipeline (script JSON, recordings, image folders, timeline JSON). It is not the YouTube title. The final title is chosen at scripting time using the row's assigned `title_bucket` and Nine's voice for that episode.
