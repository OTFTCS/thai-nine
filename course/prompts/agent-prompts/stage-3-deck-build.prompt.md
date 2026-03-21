# Stage 3 — PPTX Deck Build

Generate the stage-3 deck artifacts from `script-master.json`.

Required outputs:
- `deck-source.json`
- `deck.pptx`
- `asset-provenance.json`

Rules:
- expand the lesson into a deterministic recording deck
- preserve the fixed right-third camera-safe zone
- embed locally downloaded real images only when `visualPlan.imageSupport.helpful === true`
- fall back to text-only or card-based layouts when no acceptable image is found
- keep `asset-provenance.json` aligned with the slide asset ids in `deck-source.json`
