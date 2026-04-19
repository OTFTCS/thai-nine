# Prompt — Visual Companion Script

Produce 25–40 cards aligned to spoken script.
Card schema:
- CARD_ID
- SECTION
- TIMING_CUE
- CARD_TYPE
- CONTENT
- ASSET_SOURCE (required for image cards)

Visual constraints:
- Mobile legibility
- Max 3 Thai lines/card
- Single focus per card

Asset sourcing rules (mandatory):
1. Use internet-sourced images first (royalty-free/reusable) when possible.
2. Prefer open-license stock, icon sets, and illustrations.
3. If image search is slow or blocked, use emoji/vector placeholders and proceed.
4. Do NOT use generated-image tools by default.
5. Only use generated images if explicitly approved for that lesson.

Output requirement for image cards:
- Include one `ASSET_SOURCE` line with either:
  - `url: <https://...>`
  - `local: <path>`
  - `placeholder: emoji/vector (reason)`
