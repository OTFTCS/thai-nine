import { createHash } from "node:crypto";
import type { Lexeme, ScriptMaster } from "./types.ts";

export function canonicalLexemeKey(
  lex: Pick<Lexeme, "thai" | "translit" | "english">
): string {
  return `${lex.thai.trim()}|${lex.translit.trim().toLowerCase()}|${lex.english
    .trim()
    .toLowerCase()}`;
}

export function deterministicVocabId(
  lex: Pick<Lexeme, "thai" | "translit" | "english">
): string {
  const digest = createHash("sha1")
    .update(canonicalLexemeKey(lex))
    .digest("hex")
    .slice(0, 10);
  return `v-${digest}`;
}

export function withVocabId(lex: Lexeme): Lexeme {
  return {
    ...lex,
    vocabId:
      lex.vocabId && lex.vocabId.trim().length > 0
        ? lex.vocabId
        : deterministicVocabId(lex),
  };
}

export function recomputeVocabId(lex: Lexeme): Lexeme {
  return {
    ...lex,
    vocabId: deterministicVocabId(lex),
  };
}

export function dedupeLexemes(lexemes: Lexeme[]): Lexeme[] {
  const seen = new Map<string, Lexeme>();
  for (const lex of lexemes) {
    const finalLex = withVocabId(lex);
    seen.set(canonicalLexemeKey(finalLex), finalLex);
  }
  return Array.from(seen.values());
}

export function fixupScriptVocabIds(script: ScriptMaster): ScriptMaster {
  return {
    ...script,
    sections: script.sections.map((section) => ({
      ...section,
      languageFocus: section.languageFocus.map(recomputeVocabId),
    })),
  };
}
