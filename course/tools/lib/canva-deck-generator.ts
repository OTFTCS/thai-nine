/**
 * canva-deck-generator.ts
 *
 * Reads a deck-source.json and canva-content.json to produce:
 *   1. A Canva presentation outline (for generate-design-structured)
 *   2. An edit-pass specification (for perform-editing-operations)
 *   3. A canva-design.json artifact recording the design ID and URL
 *
 * This replaces the PPTX render path (render_lesson_deck.py) with native
 * Canva generation via the MCP connector.
 *
 * Pipeline position: Stage 3 (deterministic deck build)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeckSourceSlide {
  id: string;
  role: string;
  title: string;
  estimatedSeconds: number;
  layout: string;
  speakerNotes: string[];
  textBlocks: DeckTextBlock[];
  thaiFocus: ThaiTriplet[];
  visualStrategy: {
    onScreenGoal: string;
    teachingVisuals: string[];
    teacherCues: string[];
    imageUsage: string;
    rationale: string;
  };
  assets: unknown[];
}

export interface DeckTextBlock {
  id: string;
  kind: string;
  heading?: string;
  lines: string[];
}

export interface ThaiTriplet {
  thai: string;
  translit: string;
  english: string;
}

export interface DeckSource {
  schemaVersion: number;
  lessonId: string;
  sourceScript: string;
  canvas: {
    width: number;
    height: number;
    leftTeachingFraction: number;
    rightCameraFraction: number;
    pipCameraWidth: number;
    pipCameraHeight: number;
    pipPosition: string;
    safeZoneLabel: string;
  };
  theme: {
    id: string;
    name: string;
    thaiFont: string;
    latinFont: string;
    backgroundColor: string;
    rightZoneTint: string;
    accentColors: string[];
  };
  slides: DeckSourceSlide[];
}

export interface CanvaContentSlide {
  id: string;
  title: string;
  layoutFamily: string;
  backgroundPath: string;
  elements: CanvaContentElement[];
}

export interface CanvaContentElement {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontName: string;
  fontSizePt: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: string;
  value: string;
  segments?: CanvaTextSegment[];
}

export interface CanvaTextSegment {
  text: string;
  fontName: string;
  fontSizePt: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface CanvaContent {
  schemaVersion: number;
  lessonId: string;
  sourceDeck: string;
  layoutContract: string;
  theme: {
    thaiFont: string;
    latinFont: string;
    backgroundColor: string;
    rightZoneTint: string;
    accentColors: string[];
  };
  slides: CanvaContentSlide[];
}

export interface CanvaDesignRecord {
  schemaVersion: 1;
  lessonId: string;
  designId: string;
  brandKitId: string | null;
  generatedAt: string;
  canvaUrl: string;
  slideCount: number;
  editPassApplied: boolean;
  sourceFiles: {
    deckSource: string;
    canvaContent: string;
  };
}

export interface PresentationOutline {
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a slide role to a human-readable Canva slide description for the
 * AI design generator.  We embed the teaching content directly so Canva
 * has enough context to create a useful layout.
 */
function slideRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    opener: "Title / Opener",
    objectives: "Learning Objectives",
    teaching: "Teaching Slide",
    pronunciation: "Pronunciation Focus",
    roleplay: "Roleplay Practice",
    recap: "Lesson Recap",
    closing: "Closing / Sign-off",
  };
  return labels[role] ?? "Content Slide";
}

/**
 * Format Thai triplets as a readable block for the slide description.
 */
function formatTriplets(triplets: ThaiTriplet[]): string {
  if (triplets.length === 0) return "";
  const lines = triplets.map(
    (t) => `• ${t.thai} (${t.translit}) — ${t.english}`
  );
  return `\nKey vocabulary:\n${lines.join("\n")}`;
}

/**
 * Format text blocks (objectives, practice drills, etc.) into readable text.
 */
function formatTextBlocks(blocks: DeckTextBlock[]): string {
  if (blocks.length === 0) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.heading) parts.push(`${block.heading}:`);
    for (const line of block.lines) {
      parts.push(`• ${line}`);
    }
  }
  return parts.join("\n");
}

/**
 * Flatten a canva-content element value into a single plain-text string,
 * suitable for use in Canva editing operations.
 */
export function flattenElementValue(element: CanvaContentElement): string {
  if (element.segments && element.segments.length > 0) {
    return element.segments.map((s) => s.text).join("");
  }
  return element.value;
}

// ---------------------------------------------------------------------------
// Image Strategy: Vocabulary-Driven Cartoon Illustrations
// ---------------------------------------------------------------------------

/**
 * Concrete, visualisable word categories. If a vocabulary item's English
 * gloss matches one of these patterns, we ask Canva to generate a small
 * cartoon illustration for it.  Abstract/grammatical items (particles,
 * pronouns, politeness markers, yes/no) get NO image.
 */
const VISUALISABLE_PATTERNS = [
  // Animals
  /\b(cat|dog|bird|fish|elephant|snake|monkey|horse|chicken|duck|pig|cow|buffalo|ant|bee|mouse|rabbit|tiger|bear|frog|turtle|shrimp|crab|squid)\b/i,
  // Food & drink
  /\b(rice|water|food|coffee|tea|beer|fruit|mango|banana|papaya|soup|noodle|egg|milk|juice|sugar|salt|chilli|curry|cake|bread|ice cream|coconut)\b/i,
  // Body & people
  /\b(hand|head|eye|mouth|ear|nose|foot|leg|arm|face|hair|heart|tooth|finger|body|baby|child|man|woman|boy|girl|mother|father|family|teacher|doctor|friend)\b/i,
  // Actions (concrete / physical)
  /\b(run|walk|eat|drink|sleep|sit|stand|swim|jump|dance|cook|drive|fly|read|write|sing|cry|laugh|fight|kick|throw|catch|push|pull|cut|wash|open|close|buy|sell|give|take)\b/i,
  // Objects & things
  /\b(house|car|bus|boat|tree|flower|book|phone|table|chair|door|window|bag|shoe|hat|shirt|clock|key|money|rain|sun|moon|star|fire|mountain|river|sea|road|bridge|market|temple|school|hospital)\b/i,
  // Colours & weather
  /\b(red|blue|green|yellow|white|black|hot|cold|rain|cloud|wind|snow)\b/i,
];

/**
 * Slide roles that should NEVER get an image — keep them text-only and clean.
 */
const NO_IMAGE_ROLES = new Set([
  "opener",
  "objectives",
  "recap",
  "closing",
]);

/**
 * Examines a slide's vocabulary (thaiFocus triplets) and decides whether
 * the slide should include a small cartoon illustration.
 *
 * Returns a Canva AI directive string.
 */
function buildVocabImageDirective(slide: DeckSourceSlide): string {
  const noImageBase =
    "Use a clean, solid-colour background. Do NOT add any images, illustrations, stock photos, textures, or background patterns.";

  // Structural slides never get images
  if (NO_IMAGE_ROLES.has(slide.role)) return noImageBase;

  // Check each vocabulary item for something concrete and visualisable
  const visualisable: string[] = [];
  for (const triplet of slide.thaiFocus) {
    const eng = triplet.english;
    for (const pattern of VISUALISABLE_PATTERNS) {
      const match = eng.match(pattern);
      if (match) {
        visualisable.push(match[0].toLowerCase());
        break; // one match per triplet is enough
      }
    }
  }

  if (visualisable.length === 0) return noImageBase;

  // Pick at most 2 words to illustrate — keep it simple
  const subjects = [...new Set(visualisable)].slice(0, 2);
  const subjectStr = subjects.join(" and ");

  return (
    `Include a small, simple cartoon-style illustration of "${subjectStr}" on the left side of the slide. ` +
    `The illustration should be flat/minimal style, with no text or labels inside the image. ` +
    `Use a clean solid-colour background for the rest of the slide. ` +
    `Do NOT add stock photos, textures, or background patterns.`
  );
}

// ---------------------------------------------------------------------------
// Core: Build Canva Presentation Outline
// ---------------------------------------------------------------------------

/**
 * Convert a deck-source.json into a Canva presentation outline array.
 * Each slide becomes a { title, description } object.
 *
 * The descriptions are deliberately rich — they tell Canva's AI exactly
 * what content to place, what layout style to use, and that the right
 * third must stay clear for a camera overlay.
 */
export function buildPresentationOutline(
  deckSource: DeckSource,
  config: CanvaPipelineConfig = DEFAULT_CANVA_CONFIG,
): PresentationOutline[] {
  const thaiFont = config.thaiFontFamily;
  const latinFont = config.latinFontFamily;
  return deckSource.slides.map((slide) => {
    const roleLabel = slideRoleLabel(slide.role);
    const tripletBlock = formatTriplets(slide.thaiFocus);
    const textBlock = formatTextBlocks(slide.textBlocks);
    const speakerNotesSummary = slide.speakerNotes.slice(0, 2).join(" ");

    const descParts: string[] = [
      `[${roleLabel}] ${slide.visualStrategy.onScreenGoal}`,
    ];

    if (textBlock) descParts.push(textBlock);
    if (tripletBlock) descParts.push(tripletBlock);

    // Image strategy: simple cartoon vocab illustrations only — not every slide
    const vocabImageDirective = buildVocabImageDirective(slide);

    descParts.push(
      `\nLayout: ${slide.layout}. Use ${thaiFont} for all Thai and transliteration text. Use ${latinFont} for English text.`
    );
    descParts.push(vocabImageDirective);
    descParts.push(
      `IMPORTANT: Keep the right third of the slide completely empty — it is reserved for a camera overlay (PiP zone).`
    );

    if (speakerNotesSummary) {
      descParts.push(`\nSpeaker notes: ${speakerNotesSummary}`);
    }

    return {
      title: slide.title,
      description: descParts.join("\n"),
    };
  });
}

// ---------------------------------------------------------------------------
// Core: Build Edit-Pass Specification
// ---------------------------------------------------------------------------

/**
 * After Canva generates a design, the edit pass ensures all Thai text is
 * pixel-perfect.  This function returns a per-slide list of text values
 * that should be present, derived from canva-content.json.
 *
 * The caller uses these to drive `perform-editing-operations`.
 */
export interface SlideEditSpec {
  slideIndex: number; // 1-based page index
  canvaSlideId: string;
  layoutFamily: string;
  elements: ElementEditSpec[];
}

export interface ElementEditSpec {
  elementId: string;
  expectedText: string;
  formatting: {
    bold: boolean;
    italic: boolean;
    color: string;
    fontSizePt: number;
    align: string;
  };
  /** If segments exist, this is a mixed-format element (Thai + translit). */
  hasSegments: boolean;
}

export function buildEditPassSpec(
  canvaContent: CanvaContent
): SlideEditSpec[] {
  return canvaContent.slides.map((slide, index) => ({
    slideIndex: index + 1,
    canvaSlideId: slide.id,
    layoutFamily: slide.layoutFamily,
    elements: slide.elements.map((el) => ({
      elementId: el.id,
      expectedText: flattenElementValue(el),
      formatting: {
        bold: el.bold,
        italic: el.italic,
        color: el.color,
        fontSizePt: el.fontSizePt,
        align: el.align,
      },
      hasSegments: !!(el.segments && el.segments.length > 0),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Core: Build canva-design.json Record
// ---------------------------------------------------------------------------

export function buildCanvaDesignRecord(params: {
  lessonId: string;
  designId: string;
  brandKitId: string | null;
  canvaUrl: string;
  slideCount: number;
  editPassApplied: boolean;
  deckSourceFile: string;
  canvaContentFile: string;
}): CanvaDesignRecord {
  return {
    schemaVersion: 1,
    lessonId: params.lessonId,
    designId: params.designId,
    brandKitId: params.brandKitId,
    generatedAt: new Date().toISOString(),
    canvaUrl: params.canvaUrl,
    slideCount: params.slideCount,
    editPassApplied: params.editPassApplied,
    sourceFiles: {
      deckSource: params.deckSourceFile,
      canvaContent: params.canvaContentFile,
    },
  };
}

// ---------------------------------------------------------------------------
// Pipeline Config
// ---------------------------------------------------------------------------

/**
 * Canva pipeline configuration.  Stored in the repo so the pipeline
 * knows which brand kit to apply and what style to request.
 *
 * Loaded from `course/canva-pipeline-config.json`.
 */
export interface CanvaPipelineConfig {
  brandKitId: string | null;
  defaultStyle: string;
  defaultAudience: string;
  /** Canva folder ID to organise generated decks */
  targetFolderId: string | null;
  /** Font for Thai and transliteration text */
  thaiFontFamily: string;
  /** Font for English/Latin text */
  latinFontFamily: string;
  /** Custom teaching assets (tone diagrams, etc.) keyed by slug */
  teachingAssets: Record<string, { url: string; description: string }>;
}

export const DEFAULT_CANVA_CONFIG: CanvaPipelineConfig = {
  brandKitId: null,
  defaultStyle: "educational",
  defaultAudience: "educational",
  targetFolderId: null,
  thaiFontFamily: "Noto Sans Thai Looped",
  latinFontFamily: "Sarabun",
  teachingAssets: {},
};

// ---------------------------------------------------------------------------
// Summary / Topic Helpers
// ---------------------------------------------------------------------------

/**
 * Build a short (<150 char) topic string for the Canva generate call.
 */
export function buildTopic(deckSource: DeckSource): string {
  const title = deckSource.slides[0]?.title ?? deckSource.lessonId;
  const topic = `${deckSource.lessonId}: ${title} — Thai language lesson`;
  return topic.length > 150 ? topic.slice(0, 147) + "..." : topic;
}

/**
 * Build length hint from slide count.
 */
export function buildLengthHint(deckSource: DeckSource): string {
  const count = deckSource.slides.length;
  if (count <= 5) return `${count} slides`;
  if (count <= 15) return `${count} slides`;
  return `${count} slides`;
}
