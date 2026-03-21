# Regression Matrix

Use this file to score fresh skill-led outputs against the current approved lesson packs.

## Scoring rule

Mark each category as:

- `PASS` when the lesson is usable as-is or only needs tiny cosmetic nudges
- `REPAIR` when the issue should be fixed by changing the skill, prompt, QA, or layout contract
- `N/A` when the category genuinely does not apply

## Current regression pair

| Lesson | Baseline reference | Lesson shape | Expected explanation research trigger | Current focus |
| --- | --- | --- | --- | --- |
| `M01-L002` | `course/modules/M01/L002/` | Name, pronoun, and country self-introduction | Probably none unless a direct gloss proves misleading | Keep explanations direct; confirm fresh PPTX and Canva output |
| `M01-L003` | `course/modules/M01/L003/` | Pronouns, identity, `คือ`, and `ใคร` | Only if identity framing still needs support after local research | Balance clarity with simplicity; confirm fresh PPTX and Canva output |

## Shared scorecard

| Category | `M01-L002` | `M01-L003` | Notes |
| --- | --- | --- | --- |
| Scope fidelity | baseline approved | baseline approved | Refresh on new runs |
| Pedagogy clarity | baseline approved | baseline approved | Re-check against updated house style |
| Translation-first fit | review on fresh run | review on fresh run | Concrete lessons should stay direct unless a concept clearly needs more |
| Explanation research trigger quality | review on fresh run | review on fresh run | Research should be rare and justified |
| Roleplay and drill discipline | baseline approved | baseline approved | Re-check for taught-language boundaries |
| QA cleanliness | baseline approved | baseline approved | Fresh runs should stay clean |
| PPTX deck readiness | legacy baseline | legacy baseline | Fresh runs must satisfy current pipeline |
| Canva import stability | not yet measured | not yet measured | Capture real import findings in each run |
| Thai font correctness | not yet measured | not yet measured | Use `Sarabun` in Canva path |
| Manual cleanup still required | baseline reference only | baseline reference only | Goal is tiny cosmetic nudges only |
