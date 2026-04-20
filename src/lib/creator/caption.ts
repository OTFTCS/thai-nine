import type { SocialsRow } from "@/types/creator";

const BASE_HASHTAGS = ["#LearnThai", "#ThaiLanguage", "#ภาษาไทย"];

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  "thai classifiers": ["#ThaiClassifiers", "#ThaiGrammar"],
  vocabulary: ["#ThaiVocabulary", "#ThaiWords"],
  grammar: ["#ThaiGrammar"],
  pronunciation: ["#ThaiTones", "#ThaiPronunciation"],
  culture: ["#ThaiCulture"],
};

const PLATFORM_HASHTAGS: Record<string, string[]> = {
  ig: ["#InstagramReels", "#LanguageLearning"],
  tt: ["#TikTokLearn", "#LanguageTok"],
  yt: ["#YouTubeShorts"],
};

function normalisePlatforms(value: string): string[] {
  return value
    .split(/[,/|]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

export function suggestCaption(row: SocialsRow): {
  caption: string;
  hashtags: string[];
  platforms: string[];
} {
  const platforms = normalisePlatforms(row.platforms);
  const category = row.category.toLowerCase();

  const hashtagSet = new Set<string>(BASE_HASHTAGS);
  for (const [key, tags] of Object.entries(CATEGORY_HASHTAGS)) {
    if (category.includes(key)) for (const t of tags) hashtagSet.add(t);
  }
  for (const p of platforms) {
    for (const t of PLATFORM_HASHTAGS[p] ?? []) hashtagSet.add(t);
  }

  const hashtags = Array.from(hashtagSet);
  const title = row.title || "New Thai lesson";
  const tail = row.contentType
    ? `\n\n(${row.contentType}${row.category ? ` · ${row.category}` : ""})`
    : "";

  const caption = `${title}${tail}\n\n${hashtags.join(" ")}`;

  return { caption, hashtags, platforms };
}
