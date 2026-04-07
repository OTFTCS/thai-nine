#!/usr/bin/env node
/**
 * stage3-canva.ts
 *
 * Canva-native Stage 3: Generates a lesson deck directly in Canva.
 *
 * Replaces the PPTX path (render_lesson_deck.py) with:
 *   1. Build presentation outline from deck-source.json
 *   2. Generate Canva design via MCP (generate-design-structured)
 *   3. Run edit pass to inject exact Thai text from canva-content.json
 *   4. Write canva-design.json artifact
 *
 * Usage (called by pipeline-cli.ts):
 *   node --experimental-strip-types course/tools/stage3-canva.ts \
 *     --repo-root /path/to/repo --lesson M01-L001
 *
 * MCP Dependency:
 *   This script is designed to be called by the Cowork agent which has
 *   access to the Canva MCP tools.  It outputs a structured JSON action
 *   plan that the agent executes via the Canva MCP connector.
 *
 *   The script itself does NOT call Canva directly — it prepares the
 *   exact payloads and writes them to files that the orchestrating agent
 *   reads and executes.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildPresentationOutline,
  buildEditPassSpec,
  buildCanvaDesignRecord,
  buildTopic,
  buildLengthHint,
  type DeckSource,
  type CanvaContent,
  type CanvaPipelineConfig,
  DEFAULT_CANVA_CONFIG,
} from "./lib/canva-deck-generator.ts";
import { readJson, writeJson, writeText, lessonPath, resolveLessonArtifactPath } from "./lib/fs.ts";

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1] ?? null;
}

const root = resolve(getArg("--repo-root") ?? process.cwd());
const lessonId = getArg("--lesson");

if (!lessonId) {
  console.error("Usage: stage3-canva.ts --lesson M01-L001 [--repo-root .]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Resolve Paths
// ---------------------------------------------------------------------------

const lessonDir = lessonPath(root, lessonId);
if (!existsSync(lessonDir)) {
  console.error(`Lesson directory not found: ${lessonDir}`);
  process.exit(1);
}

function resolveLessonFile(baseName: string): string {
  return resolveLessonArtifactPath(root, lessonId!, baseName);
}

const deckSourcePath = resolveLessonFile("deck-source.json");
const canvaContentPath = resolveLessonFile("canva-content.json");
const canvaConfigPath = join(root, "course", "canva-pipeline-config.json");

if (!existsSync(deckSourcePath)) {
  console.error(`deck-source.json not found at: ${deckSourcePath}`);
  console.error("Run the legacy Stage 3 first to generate deck-source.json and canva-content.json,");
  console.error("or ensure Stages 0-2 have completed.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load Inputs
// ---------------------------------------------------------------------------

const deckSource = readJson<DeckSource>(deckSourcePath);
const canvaContent = existsSync(canvaContentPath)
  ? readJson<CanvaContent>(canvaContentPath)
  : null;

const canvaConfig: CanvaPipelineConfig = existsSync(canvaConfigPath)
  ? readJson<CanvaPipelineConfig>(canvaConfigPath)
  : DEFAULT_CANVA_CONFIG;

// ---------------------------------------------------------------------------
// Step 1: Build Presentation Outline
// ---------------------------------------------------------------------------

const outline = buildPresentationOutline(deckSource, canvaConfig);
const topic = buildTopic(deckSource);
const lengthHint = buildLengthHint(deckSource);

console.log(`[stage3-canva] ${lessonId}: ${outline.length} slides prepared`);
console.log(`[stage3-canva] Topic: ${topic}`);
console.log(`[stage3-canva] Length: ${lengthHint}`);

// ---------------------------------------------------------------------------
// Step 2: Write Action Plan (for Cowork agent to execute)
// ---------------------------------------------------------------------------

/**
 * The action plan is a JSON file that describes exactly what MCP calls
 * the orchestrating agent should make.  This keeps the pipeline
 * deterministic — the TypeScript code controls WHAT to generate,
 * while the agent handles the Canva API calls.
 */
interface CanvaActionPlan {
  schemaVersion: 1;
  lessonId: string;
  actions: CanvaAction[];
}

type CanvaAction =
  | GenerateDesignAction
  | UploadAssetAction
  | EditPassAction
  | MoveToFolderAction
  | WriteDesignRecordAction;

interface UploadAssetAction {
  type: "upload-asset";
  params: {
    /** URL of the image to upload into Canva */
    url: string;
    /** Human-readable description of the asset */
    description: string;
    /** Slide index (1-based) where this asset should be placed */
    targetSlideIndex: number;
    /** Asset slug from teachingAssets config */
    assetSlug: string;
  };
}

interface GenerateDesignAction {
  type: "generate-design-structured";
  params: {
    topic: string;
    audience: string;
    style: string;
    length: string;
    presentation_outlines: { title: string; description: string }[];
    brand_kit_id?: string;
  };
}

interface EditPassAction {
  type: "edit-pass";
  params: {
    /** Placeholder — filled by agent after design generation */
    designId: string;
    slides: {
      slideIndex: number;
      canvaSlideId: string;
      elements: {
        elementId: string;
        expectedText: string;
        bold: boolean;
        italic: boolean;
        color: string;
        fontSizePt: number;
      }[];
    }[];
  };
}

interface MoveToFolderAction {
  type: "move-to-folder";
  params: {
    folderId: string;
    /** Placeholder — filled by agent */
    designId: string;
  };
}

interface WriteDesignRecordAction {
  type: "write-design-record";
  params: {
    outputPath: string;
    lessonId: string;
    brandKitId: string | null;
    deckSourceFile: string;
    canvaContentFile: string;
    slideCount: number;
  };
}

const actions: CanvaAction[] = [];

// Action 1: Generate the Canva presentation
const generateAction: GenerateDesignAction = {
  type: "generate-design-structured",
  params: {
    topic,
    audience: canvaConfig.defaultAudience,
    style: canvaConfig.defaultStyle,
    length: lengthHint,
    presentation_outlines: outline,
    ...(canvaConfig.brandKitId ? { brand_kit_id: canvaConfig.brandKitId } : {}),
  },
};
actions.push(generateAction);

// Action 2: Upload teaching assets (if any slides reference them)
// Teaching assets are keyed by slug in canva-pipeline-config.json.teachingAssets
// Slides reference them via visualStrategy.imageUsage containing "asset:{slug}"
if (canvaConfig.teachingAssets && Object.keys(canvaConfig.teachingAssets).length > 0) {
  for (let slideIdx = 0; slideIdx < deckSource.slides.length; slideIdx++) {
    const slide = deckSource.slides[slideIdx]!;
    const match = slide.visualStrategy.imageUsage.match(/^asset:(.+)$/);
    if (match) {
      const slug = match[1]!;
      const asset = canvaConfig.teachingAssets[slug];
      if (asset) {
        actions.push({
          type: "upload-asset",
          params: {
            url: asset.url,
            description: asset.description,
            targetSlideIndex: slideIdx + 1,
            assetSlug: slug,
          },
        });
      } else {
        console.warn(`[stage3-canva] Slide ${slideIdx + 1} references asset:${slug} but it is not in teachingAssets config`);
      }
    }
  }
}

// Action 3: Edit pass (if canva-content.json exists)
if (canvaContent) {
  const editSpec = buildEditPassSpec(canvaContent);
  const editAction: EditPassAction = {
    type: "edit-pass",
    params: {
      designId: "{{DESIGN_ID}}",
      slides: editSpec.map((s) => ({
        slideIndex: s.slideIndex,
        canvaSlideId: s.canvaSlideId,
        elements: s.elements.map((el) => ({
          elementId: el.elementId,
          expectedText: el.expectedText,
          bold: el.formatting.bold,
          italic: el.formatting.italic,
          color: el.formatting.color,
          fontSizePt: el.formatting.fontSizePt,
        })),
      })),
    },
  };
  actions.push(editAction);
}

// Action 4: Move to folder (if configured)
if (canvaConfig.targetFolderId) {
  actions.push({
    type: "move-to-folder",
    params: {
      folderId: canvaConfig.targetFolderId,
      designId: "{{DESIGN_ID}}",
    },
  });
}

// Action 5: Write canva-design.json
actions.push({
  type: "write-design-record",
  params: {
    outputPath: join(lessonDir, `${lessonId}-canva-design.json`),
    lessonId,
    brandKitId: canvaConfig.brandKitId,
    deckSourceFile: `${lessonId}-deck-source.json`,
    canvaContentFile: `${lessonId}-canva-content.json`,
    slideCount: deckSource.slides.length,
  },
});

// ---------------------------------------------------------------------------
// Write the action plan
// ---------------------------------------------------------------------------

const actionPlan: CanvaActionPlan = {
  schemaVersion: 1,
  lessonId,
  actions,
};

const actionPlanPath = join(lessonDir, `${lessonId}-canva-action-plan.json`);
writeJson(actionPlanPath, actionPlan);

console.log(`[stage3-canva] Action plan written to: ${actionPlanPath}`);
console.log(`[stage3-canva] Actions: ${actions.map((a) => a.type).join(" → ")}`);

// Also write the outline as a standalone file for easy review
const outlinePath = join(lessonDir, `${lessonId}-canva-outline.json`);
writeJson(outlinePath, {
  topic,
  audience: canvaConfig.defaultAudience,
  style: canvaConfig.defaultStyle,
  length: lengthHint,
  brandKitId: canvaConfig.brandKitId,
  slides: outline,
});

console.log(`[stage3-canva] Outline written to: ${outlinePath}`);
console.log(`[stage3-canva] Ready for Canva MCP execution.`);
