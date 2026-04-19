const PTM_TONE_MARK_CHARS = "àáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ";

const LOWER_TONE_MAP: Record<string, { L: string; H: string; R: string; M: string }> = {
  a: { L: "à", H: "á", R: "ǎ", M: "a" },
  e: { L: "è", H: "é", R: "ě", M: "e" },
  i: { L: "ì", H: "í", R: "ǐ", M: "i" },
  o: { L: "ò", H: "ó", R: "ǒ", M: "o" },
  u: { L: "ù", H: "ú", R: "ǔ", M: "u" },
};

const UPPER_TONE_MAP: Record<string, { L: string; H: string; R: string; M: string }> = {
  A: { L: "À", H: "Á", R: "Ǎ", M: "A" },
  E: { L: "È", H: "É", R: "Ě", M: "E" },
  I: { L: "Ì", H: "Í", R: "Ǐ", M: "I" },
  O: { L: "Ò", H: "Ó", R: "Ǒ", M: "O" },
  U: { L: "Ù", H: "Ú", R: "Ǔ", M: "U" },
};

const MARKED_TO_BASE: Record<string, string> = {
  à: "a",
  á: "a",
  â: "a",
  ǎ: "a",
  è: "e",
  é: "e",
  ê: "e",
  ě: "e",
  ì: "i",
  í: "i",
  î: "i",
  ǐ: "i",
  ò: "o",
  ó: "o",
  ô: "o",
  ǒ: "o",
  ù: "u",
  ú: "u",
  û: "u",
  ǔ: "u",
  À: "A",
  Á: "A",
  Â: "A",
  Ǎ: "A",
  È: "E",
  É: "E",
  Ê: "E",
  Ě: "E",
  Ì: "I",
  Í: "I",
  Î: "I",
  Ǐ: "I",
  Ò: "O",
  Ó: "O",
  Ô: "O",
  Ǒ: "O",
  Ù: "U",
  Ú: "U",
  Û: "U",
  Ǔ: "U",
};

const SUPERSCRIPT_TO_TONE: Record<string, "H" | "M" | "L" | "R"> = {
  "ᴴ": "H",
  "ᴹ": "M",
  "ᴸ": "L",
  "ᴿ": "R",
};

export const PTM_ALLOWED_CHARACTER_CLASS = "A-Za-z0-9àáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ\\s\\-’'.,!?/:;()\\[\\]{}&+|•…\"";

const PTM_ALLOWED_TEXT_REGEX = new RegExp(`^[${PTM_ALLOWED_CHARACTER_CLASS}]+$`, "u");
const PTM_ALLOWED_SINGLE_CHAR_REGEX = new RegExp(`^[${PTM_ALLOWED_CHARACTER_CLASS}]$`, "u");

export const PTM_INLINE_TONE_MARK_REGEX = new RegExp(`[${PTM_TONE_MARK_CHARS}]`, "u");
export const PTM_LEGACY_TONE_SUFFIX_REGEX = /\b[a-z][a-z'’-]*[HMLR]\b/u;
export const PTM_SUPERSCRIPT_TONE_REGEX = /[ᴴᴹᴸᴿ]|\^[HMLR]/u;

export const PTM_FORBIDDEN_SYMBOLS = [
  "ʉ",
  "ə",
  "ɯ",
  "ɤ",
  "œ",
  "ɨ",
  "ɪ",
  "ʊ",
  "ɜ",
  "ɐ",
  "ɑ",
  "ɔ",
  "ɒ",
  "æ",
  "ɲ",
  "ŋ",
  "ɕ",
  "ʑ",
  "ʔ",
  "ɡ",
  "ː",
  "ˈ",
  "ˌ",
  "ᵊ",
  "ᶱ",
  "ᴴ",
  "ᴹ",
  "ᴸ",
  "ᴿ",
] as const;

export const PTM_FORBIDDEN_SYMBOL_REGEX = new RegExp(`[${PTM_FORBIDDEN_SYMBOLS.join("")}]`, "u");

const FORBIDDEN_SCAN_REGEX = new RegExp(`(${PTM_FORBIDDEN_SYMBOL_REGEX.source})|(${PTM_SUPERSCRIPT_TONE_REGEX.source})|(${PTM_LEGACY_TONE_SUFFIX_REGEX.source})`, "u");

export interface TransliterationPolicyIssue {
  code: "empty" | "invalid-char" | "forbidden-symbol" | "legacy-tone" | "missing-tone";
  message: string;
}

export interface TransliterationPolicyCheck {
  ok: boolean;
  issues: TransliterationPolicyIssue[];
}

export interface TransliterationRepairResult {
  value: string;
  changed: boolean;
  autoFixes: string[];
  manualReview: string[];
}

export interface ForbiddenLineIssue {
  line: number;
  message: string;
}

function baseChar(char: string): string {
  return MARKED_TO_BASE[char] ?? char;
}

function applyLegacyToneToToken(token: string, tone: "H" | "M" | "L" | "R"): string | null {
  const chars = Array.from(token);
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const current = chars[i] ?? "";
    const base = baseChar(current);

    if (LOWER_TONE_MAP[base]) {
      chars[i] = LOWER_TONE_MAP[base][tone];
      return chars.join("");
    }

    if (UPPER_TONE_MAP[base]) {
      chars[i] = UPPER_TONE_MAP[base][tone];
      return chars.join("");
    }
  }

  return null;
}

function replaceWithReport(
  input: string,
  pattern: RegExp,
  replacement: string,
  note: string,
  autoFixes: string[],
  manualReview: string[],
  uncertain = false,
): string {
  if (!pattern.test(input)) return input;
  const output = input.replace(pattern, replacement);
  if (output !== input) {
    autoFixes.push(note);
    if (uncertain) manualReview.push(`${note} (verify meaning manually)`);
  }
  return output;
}

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function applyLegacyToneReplacement(
  input: string,
  autoFixes: string[],
  manualReview: string[],
): string {
  let out = input;

  out = out.replace(/\b([A-Za-zàáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ'’-]+)\^([HMLR])\b/g, (_, token: string, tone: "H" | "M" | "L" | "R") => {
    const applied = applyLegacyToneToToken(token, tone);
    if (!applied) {
      manualReview.push(`Could not apply ^${tone} tone to '${token}'`);
      return `${token}^${tone}`;
    }
    autoFixes.push(`Applied ^${tone} inline tone mark in '${token}'`);
    return applied;
  });

  out = out.replace(/\b([A-Za-zàáâǎèéêěìíîǐòóôǒùúûǔÀÁÂǍÈÉÊĚÌÍÎǏÒÓÔǑÙÚÛǓ'’-]+)([ᴴᴹᴸᴿ])(?![A-Za-z])/g, (_, token: string, superscript: keyof typeof SUPERSCRIPT_TO_TONE) => {
    const tone = SUPERSCRIPT_TO_TONE[superscript];
    const applied = applyLegacyToneToToken(token, tone);
    if (!applied) {
      manualReview.push(`Could not apply superscript tone ${superscript} to '${token}'`);
      return `${token}${superscript}`;
    }
    autoFixes.push(`Converted superscript tone ${superscript} in '${token}'`);
    return applied;
  });

  out = out.replace(/\b([a-z][a-z'’-]*)([HMLR])\b/g, (_, token: string, tone: "H" | "M" | "L" | "R") => {
    const applied = applyLegacyToneToToken(token, tone);
    if (!applied) {
      manualReview.push(`Could not apply trailing tone ${tone} to '${token}'`);
      return `${token}${tone}`;
    }
    autoFixes.push(`Converted trailing tone ${tone} in '${token}'`);
    return applied;
  });

  return out;
}

export function checkTransliterationPolicy(text: string, requireToneMark = true): TransliterationPolicyCheck {
  const value = text.trim();
  const issues: TransliterationPolicyIssue[] = [];

  if (value.length === 0) {
    issues.push({ code: "empty", message: "transliteration is empty" });
    return { ok: false, issues };
  }

  if (PTM_FORBIDDEN_SYMBOL_REGEX.test(value)) {
    const found = Array.from(new Set(Array.from(value).filter((char) => PTM_FORBIDDEN_SYMBOLS.includes(char as (typeof PTM_FORBIDDEN_SYMBOLS)[number]))));
    issues.push({
      code: "forbidden-symbol",
      message: `contains forbidden symbol(s): ${found.join(", ")}`,
    });
  }

  if (PTM_SUPERSCRIPT_TONE_REGEX.test(value) || PTM_LEGACY_TONE_SUFFIX_REGEX.test(value)) {
    issues.push({ code: "legacy-tone", message: "contains forbidden superscript/caret/trailing legacy tone notation" });
  }

  if (!PTM_ALLOWED_TEXT_REGEX.test(value)) {
    const badChar = Array.from(value).find((char) => !PTM_ALLOWED_SINGLE_CHAR_REGEX.test(char));
    if (badChar) {
      issues.push({ code: "invalid-char", message: `contains non-PTM character '${badChar}'` });
    }
  }

  if (requireToneMark && !PTM_INLINE_TONE_MARK_REGEX.test(value)) {
    issues.push({ code: "missing-tone", message: "must include inline PTM tone marks" });
  }

  return { ok: issues.length === 0, issues };
}

export function repairTransliteration(input: string): TransliterationRepairResult {
  const autoFixes: string[] = [];
  const manualReview: string[] = [];

  let value = input.normalize("NFC");

  value = replaceWithReport(value, /ˈ|ˌ/g, "", "Removed IPA stress markers", autoFixes, manualReview);
  value = value.replace(/([A-Za-z])ː/g, (_, vowel: string) => {
    autoFixes.push(`Expanded IPA length marker after '${vowel}'`);
    return `${vowel}${vowel}`;
  });

  value = applyLegacyToneReplacement(value, autoFixes, manualReview);

  const replacements: Array<{ pattern: RegExp; replacement: string; note: string; uncertain?: boolean }> = [
    { pattern: /ʉː/g, replacement: "uu", note: "Converted ʉː to uu" },
    { pattern: /ʉ/g, replacement: "uu", note: "Converted ʉ to uu" },
    { pattern: /ɯː/g, replacement: "euu", note: "Converted ɯː to euu" },
    { pattern: /ɯ/g, replacement: "eu", note: "Converted ɯ to eu" },
    { pattern: /ɤː/g, replacement: "euu", note: "Converted ɤː to euu" },
    { pattern: /ɤ/g, replacement: "eu", note: "Converted ɤ to eu" },
    { pattern: /ə/g, replacement: "er", note: "Converted ə to er", uncertain: true },
    { pattern: /œ/g, replacement: "oe", note: "Converted œ to oe" },
    { pattern: /ɨ/g, replacement: "eu", note: "Converted ɨ to eu" },
    { pattern: /ɪ/g, replacement: "i", note: "Converted ɪ to i" },
    { pattern: /ʊ/g, replacement: "u", note: "Converted ʊ to u" },
    { pattern: /ɔː/g, replacement: "aaw", note: "Converted ɔː to aaw" },
    { pattern: /ɔ/g, replacement: "aw", note: "Converted ɔ to aw" },
    { pattern: /ɒ/g, replacement: "aw", note: "Converted ɒ to aw" },
    { pattern: /æ/g, replacement: "ae", note: "Converted æ to ae" },
    { pattern: /ŋ/g, replacement: "ng", note: "Converted ŋ to ng" },
    { pattern: /ɲ/g, replacement: "y", note: "Converted ɲ to y" },
    { pattern: /tɕʰ/g, replacement: "ch", note: "Converted tɕʰ to ch" },
    { pattern: /tɕ/g, replacement: "j", note: "Converted tɕ to j" },
    { pattern: /dʑ/g, replacement: "j", note: "Converted dʑ to j" },
    { pattern: /ɕ/g, replacement: "ch", note: "Converted ɕ to ch" },
    { pattern: /ʑ/g, replacement: "ch", note: "Converted ʑ to ch", uncertain: true },
    { pattern: /ʔ/g, replacement: "", note: "Removed glottal stop marker ʔ", uncertain: true },
    { pattern: /ɡ/g, replacement: "g", note: "Normalized IPA g to ASCII g" },
  ];

  for (const replacement of replacements) {
    value = replaceWithReport(
      value,
      replacement.pattern,
      replacement.replacement,
      replacement.note,
      autoFixes,
      manualReview,
      replacement.uncertain ?? false,
    );
  }

  if (/^[\u0E00-\u0E7F\s]+$/u.test(value)) {
    manualReview.push("Value is still Thai script; transliteration must be entered manually");
  }

  value = normalizeWhitespace(value);

  return {
    value,
    changed: value !== input,
    autoFixes: Array.from(new Set(autoFixes)),
    manualReview: Array.from(new Set(manualReview)),
  };
}

export function scanTextForTransliterationDrift(raw: string): ForbiddenLineIssue[] {
  const issues: ForbiddenLineIssue[] = [];
  const lines = raw.split("\n");

  for (const [index, line] of lines.entries()) {
    if (!FORBIDDEN_SCAN_REGEX.test(line)) continue;

    const fragments: string[] = [];
    if (PTM_FORBIDDEN_SYMBOL_REGEX.test(line)) {
      const found = Array.from(new Set(Array.from(line).filter((char) => PTM_FORBIDDEN_SYMBOLS.includes(char as (typeof PTM_FORBIDDEN_SYMBOLS)[number]))));
      if (found.length > 0) fragments.push(`forbidden symbol(s): ${found.join(", ")}`);
    }
    if (PTM_SUPERSCRIPT_TONE_REGEX.test(line)) {
      fragments.push("superscript/caret tone notation");
    }
    if (PTM_LEGACY_TONE_SUFFIX_REGEX.test(line)) {
      fragments.push("legacy trailing H/M/L/R tone suffix");
    }

    issues.push({
      line: index + 1,
      message: fragments.length > 0 ? fragments.join(" + ") : "non-PTM transliteration drift detected",
    });
  }

  return issues;
}

export interface TripletTranslitSegment {
  line: number;
  translit: string;
}

export function extractTripletTranslitSegments(raw: string): TripletTranslitSegment[] {
  const segments: TripletTranslitSegment[] = [];
  const lines = raw.split("\n");

  for (const [index, line] of lines.entries()) {
    if (!line.includes("|")) continue;
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 3) continue;
    const translit = parts[1] ?? "";
    if (!translit) continue;
    segments.push({ line: index + 1, translit });
  }

  return segments;
}
