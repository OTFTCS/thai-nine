# QA Report — M01-L001

Result: PASS

## Hard Gates
- Transliteration policy: PTM inline tone marks required; superscripts forbidden
- Triplet completeness for learner content
- Minimum 4 sections for non-legacy lessons
- Minimum 3 spoken narration lines per section for non-legacy lessons
- Drills per section
- Minimum 6 roleplay lines for non-legacy lessons
- No duplicate exact roleplay lines
- Clean roleplay turn-taking and yes/no answer logic
- Question-target lessons must contain a question-like roleplay turn
- Minimum 3 recap items
- Minimum 2 reused prior items when prior context exists
- Teaching frame with runtime, scenario, and learner takeaway
- Visual plan per section with explicit image decision and asset research
- Policy declaration

## Check Results
- ✅ tone-inline: All transliteration uses PTM inline tone marks; superscripts forbidden (All transliteration strings passed inline-tone checks)
- ✅ triplets: Thai/translit/English triplets are complete for learner-facing script content (Sections and on-screen bullets contain complete triplets)
- ✅ drills: Each section includes active drill (Each section has >=1 drill)
- ✅ section-count: Lesson contains at least 4 teaching sections (Legacy lesson exemption applied with 4 sections)
- ✅ section-depth: Each section includes at least 3 spoken narration lines (Legacy lesson exemption applied)
- ✅ roleplay: Scenario roleplay included and substantial (Roleplay contains 6 lines)
- ✅ roleplay-duplicates: Roleplay does not repeat exact lines (All roleplay lines are distinct)
- ✅ roleplay-turn-taking: Roleplay alternates speakers cleanly (Roleplay alternates speakers line by line)
- ✅ roleplay-answer-logic: Yes/no answer particles appear only after a nearby question or confirmation turn (Answer particles follow question-like turns when used)
- ✅ roleplay-question-target: Question-target lessons include at least one question-like roleplay turn (Roleplay includes a question-like turn)
- ✅ recap: Recap includes at least 3 review items (Recap contains 4 items)
- ✅ review-reuse: Lesson reuses at least 2 prior items when prior lesson context exists (No prior lessons available; review reuse check not required)
- ✅ teaching-frame: Lesson includes a clear teaching frame with runtime and learner takeaway (Legacy lesson exemption applied)
- ✅ visual-plan: Each section includes a left-panel visual plan and explicit image decision (Legacy lesson exemption applied)
- ✅ asset-research: Lesson provides at least one concrete image research query when visuals would help (Legacy lesson exemption applied)
- ✅ policy: Transliteration + image sourcing policies are declared (Policy object present with required enum values)

## Gate
Proceed to downstream stages.
