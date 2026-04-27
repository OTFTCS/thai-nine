import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { CardPanel } from "./components/CardPanel";
import { NinePiP } from "./components/NinePiP";
import { ImagePanel } from "./components/ImagePanel";
import type {
  BrandCardProps,
  BreakdownCardProps,
  DrillPromptCardProps,
  EpisodeTimeline,
  RecapGridCardProps,
  TextCardProps,
} from "./data/types";

const BACKGROUND = "#f5efe3";

interface EpisodeProps {
  timeline: EpisodeTimeline;
}

export const Episode: React.FC<EpisodeProps> = ({ timeline }) => {
  if (!timeline) {
    return (
      <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
        <div style={{ padding: 64, color: "#1a1a1a", fontSize: 28 }}>
          Timeline missing — run `pipeline build --episode YT-S01-E01`.
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND }}>
      <Audio src={staticFile(timeline.audioSrc)} />
      <NinePiP
        src={timeline.pipSrc ? staticFile(timeline.pipSrc) : null}
        subtitles={timeline.subtitles}
      />
      <Series>
        {timeline.events.map((event, i) => {
          const props = event.props as
            | TextCardProps
            | BreakdownCardProps
            | DrillPromptCardProps
            | BrandCardProps
            | RecapGridCardProps;
          const imageSrc = (props as { imageSrc?: string | null }).imageSrc ?? null;
          return (
            <Series.Sequence
              key={`${i}:${event.cardKey}`}
              durationInFrames={event.durationInFrames}
              name={event.cardKey}
            >
              <CardPanel cardType={event.cardType} props={props} />
              <ImagePanel imageSrc={imageSrc} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
