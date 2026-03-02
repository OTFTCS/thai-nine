import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkTransliterationPolicy } from "../../../course/tools/lib/transliteration-policy.ts";

export interface ScriptLexeme {
  thai: string;
  translit: string;
  english: string;
  notes?: string;
}

export interface ScriptBrief {
  topic: string;
  goals: string[];
  template?: string;
  runtimeProfile?: string;
  lexemes: ScriptLexeme[];
  voice?: {
    persona?: string;
    tone?: string;
    energy?: string;
  };
  ctaGoal?: string;
}

interface RuntimeProfile {
  label: string;
  targetSeconds: number;
  targetWordCount: number;
  teachingBlocks: number;
  ctaSeconds: number;
}

interface TemplateConfig {
  name: string;
  styleTags: string[];
  hookFormula: string;
  setupFormula: string;
  teachingBlockFormula: string;
  recapFormula: string;
  ctaFormula: string;
}

export interface TransliterationIssue {
  lexemeThai: string;
  translit: string;
  messages: string[];
}

export interface GeneratedScript {
  meta: {
    topic: string;
    generatedAt: string;
    runtimeProfile: string;
    template: string;
    styleTags: string[];
    targetSeconds: number;
    targetWordCount: number;
    voice: {
      persona: string;
      tone: string;
      energy: string;
    };
  };
  promptPack: {
    hookPrompt: string;
    setupPrompt: string;
    teachingPrompt: string;
    recapPrompt: string;
    ctaPrompt: string;
  };
  sections: {
    hook: string[];
    setup: string[];
    teachingBlocks: Array<{
      title: string;
      lines: string[];
      examples: Array<{
        thai: string;
        translit: string;
        english: string;
        coachNote: string;
      }>;
    }>;
    recap: string[];
    cta: string[];
  };
  transliterationValidation: {
    ok: boolean;
    issues: TransliterationIssue[];
  };
}

function loadJson<T>(relativePath: string): T {
  const path = resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function validateBriefTransliteration(lexemes: ScriptLexeme[]): TransliterationIssue[] {
  const issues: TransliterationIssue[] = [];

  for (const lexeme of lexemes) {
    const check = checkTransliterationPolicy(lexeme.translit, true);
    if (!check.ok) {
      issues.push({
        lexemeThai: lexeme.thai,
        translit: lexeme.translit,
        messages: check.issues.map((issue) => issue.message),
      });
    }
  }

  return issues;
}

function pickTemplate(
  templates: Record<string, TemplateConfig>,
  key: string | undefined,
): { key: string; config: TemplateConfig } {
  const fallbackKey = "one-word-many-uses";
  const selectedKey = key && templates[key] ? key : fallbackKey;
  return {
    key: selectedKey,
    config: templates[selectedKey] ?? templates[fallbackKey],
  };
}

function pickRuntimeProfile(
  profiles: Record<string, RuntimeProfile>,
  key: string | undefined,
): { key: string; config: RuntimeProfile } {
  const fallbackKey = "default";
  const selectedKey = key && profiles[key] ? key : fallbackKey;
  return {
    key: selectedKey,
    config: profiles[selectedKey] ?? profiles[fallbackKey],
  };
}

export function generateScriptFromBrief(brief: ScriptBrief): GeneratedScript {
  const templates = loadJson<Record<string, TemplateConfig>>("thai_with_nine_tiktok/config/script-templates.json");
  const runtimeProfiles = loadJson<Record<string, RuntimeProfile>>("thai_with_nine_tiktok/config/runtime-profiles.json");

  const templateSelection = pickTemplate(templates, brief.template);
  const runtimeSelection = pickRuntimeProfile(runtimeProfiles, brief.runtimeProfile);

  const translitIssues = validateBriefTransliteration(brief.lexemes);
  const safeLexemes = brief.lexemes.length > 0 ? brief.lexemes : [{ thai: "คำ", translit: "kham", english: "word" }];

  const blocksWanted = clamp(2, 4, runtimeSelection.config.teachingBlocks);
  const examplesPerBlock = clamp(1, 3, Math.ceil(safeLexemes.length / blocksWanted));

  const teachingBlocks = Array.from({ length: blocksWanted }).map((_, blockIndex) => {
    const start = blockIndex * examplesPerBlock;
    const stop = start + examplesPerBlock;
    const examples = safeLexemes.slice(start, stop).length > 0
      ? safeLexemes.slice(start, stop)
      : [safeLexemes[blockIndex % safeLexemes.length]];

    const blockNo = blockIndex + 1;

    return {
      title: `Block ${blockNo}: ${sentenceCase(brief.goals[blockIndex] ?? "Practical usage")}`,
      lines: [
        `Authority line: ${templateSelection.config.teachingBlockFormula}`,
        `Contrast move: show wrong usage first, then fix it with clear context cues.`,
        `Delivery cue: confident teacher rhythm, short pauses before each Thai line.`,
      ],
      examples: examples.map((example) => ({
        thai: example.thai,
        translit: example.translit,
        english: example.english,
        coachNote: example.notes ?? "Give one realistic situation and one correction tip.",
      })),
    };
  });

  const voice = {
    persona: brief.voice?.persona ?? "Nine",
    tone: brief.voice?.tone ?? "teacher-authority",
    energy: brief.voice?.energy ?? "confident",
  };

  return {
    meta: {
      topic: brief.topic,
      generatedAt: new Date().toISOString(),
      runtimeProfile: runtimeSelection.key,
      template: templateSelection.key,
      styleTags: templateSelection.config.styleTags,
      targetSeconds: runtimeSelection.config.targetSeconds,
      targetWordCount: runtimeSelection.config.targetWordCount,
      voice,
    },
    promptPack: {
      hookPrompt: templateSelection.config.hookFormula,
      setupPrompt: templateSelection.config.setupFormula,
      teachingPrompt: templateSelection.config.teachingBlockFormula,
      recapPrompt: templateSelection.config.recapFormula,
      ctaPrompt: templateSelection.config.ctaFormula,
    },
    sections: {
      hook: [
        templateSelection.config.hookFormula,
        `Topic: ${brief.topic}`,
      ],
      setup: [
        templateSelection.config.setupFormula,
        `Today’s goals: ${brief.goals.join(" • ")}`,
      ],
      teachingBlocks,
      recap: [
        templateSelection.config.recapFormula,
        `Quick memory reset: ${safeLexemes.slice(0, 3).map((lex) => `${lex.thai} (${lex.translit})`).join(" · ")}`,
      ],
      cta: [
        brief.ctaGoal
          ? `CTA target: ${brief.ctaGoal}`
          : templateSelection.config.ctaFormula,
        "Tell viewers exactly what to comment to get corrected feedback.",
      ],
    },
    transliterationValidation: {
      ok: translitIssues.length === 0,
      issues: translitIssues,
    },
  };
}

export function renderScriptMarkdown(script: GeneratedScript): string {
  const lines: string[] = [];

  lines.push(`# Thai With Nine TikTok Script`);
  lines.push("");
  lines.push(`- Topic: ${script.meta.topic}`);
  lines.push(`- Runtime profile: ${script.meta.runtimeProfile} (~${script.meta.targetSeconds}s / ~${script.meta.targetWordCount} words)`);
  lines.push(`- Template: ${script.meta.template}`);
  lines.push(`- Voice: ${script.meta.voice.persona} | ${script.meta.voice.tone} | ${script.meta.voice.energy}`);
  lines.push(`- Generated at: ${script.meta.generatedAt}`);
  lines.push("");

  lines.push("## Hook");
  for (const line of script.sections.hook) lines.push(`- ${line}`);
  lines.push("");

  lines.push("## Setup");
  for (const line of script.sections.setup) lines.push(`- ${line}`);
  lines.push("");

  lines.push("## Teaching Blocks");
  script.sections.teachingBlocks.forEach((block) => {
    lines.push(`### ${block.title}`);
    block.lines.forEach((line) => lines.push(`- ${line}`));
    lines.push("- Examples:");
    block.examples.forEach((example) => {
      lines.push(`  - ${example.thai} | ${example.translit} | ${example.english}`);
      lines.push(`    - coach note: ${example.coachNote}`);
    });
    lines.push("");
  });

  lines.push("## Recap");
  for (const line of script.sections.recap) lines.push(`- ${line}`);
  lines.push("");

  lines.push("## CTA");
  for (const line of script.sections.cta) lines.push(`- ${line}`);
  lines.push("");

  lines.push("## Transliteration Validation");
  lines.push(`- Status: ${script.transliterationValidation.ok ? "PASS" : "FAIL"}`);
  if (!script.transliterationValidation.ok) {
    script.transliterationValidation.issues.forEach((issue) => {
      lines.push(`- ${issue.lexemeThai} (${issue.translit})`);
      issue.messages.forEach((message) => lines.push(`  - ${message}`));
    });
  }

  return `${lines.join("\n")}\n`;
}
