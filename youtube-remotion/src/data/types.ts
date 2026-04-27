export type CardType = "text" | "breakdown" | "drillPrompt" | "brand" | "recapGrid";

export interface TextCardProps {
  thai?: string;
  translit?: string;
  english?: string;
  imageSrc?: string | null;
}

export interface BreakdownCardProps {
  thai: string;
  translit: string;
  english: string;
  imageSrc?: string | null;
}

export interface DrillPromptCardProps {
  english: string;
  hint?: string;
  imageSrc?: string | null;
}

export interface BrandCardProps {
  episodeTitle: string;
  imageSrc?: string | null;
}

export interface RecapGridItem {
  thai: string;
  translit: string;
  english: string;
}

export interface RecapGridCardProps {
  items: RecapGridItem[];
  imageSrc?: string | null;
}

export type CardProps =
  | TextCardProps
  | BreakdownCardProps
  | DrillPromptCardProps
  | BrandCardProps
  | RecapGridCardProps;

export interface TimelineEvent {
  cardKey: string;
  cardType: CardType;
  startFrame: number;
  durationInFrames: number;
  props: CardProps;
}

export type SubtitleLang = "th" | "th-split" | "en";

export interface SubtitleEntry {
  text: string;
  translit: string | null;
  lang: SubtitleLang;
  startFrame: number;
}

export interface EpisodeTimeline {
  episodeId: string;
  episodeTitle: string;
  fps: number;
  totalDurationInFrames: number;
  audioSrc: string;
  pipSrc: string | null;
  events: TimelineEvent[];
  subtitles: SubtitleEntry[];
}
