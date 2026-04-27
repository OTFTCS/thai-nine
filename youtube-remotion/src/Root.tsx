import { Composition, getStaticFiles } from "remotion";
import { readFileSync, existsSync } from "node:fs";
import { Episode } from "./Episode";
import { waitUntilDone as waitForFonts } from "./fonts";
import type { EpisodeTimeline } from "./data/types";
import {
  LayoutOptionA,
  LayoutOptionB,
  LayoutOptionC,
  LayoutOptionD,
  LayoutOptionE,
} from "./previews/LayoutOptions";

const DEFAULT_EPISODE = "YT-S01-E01";

const loadTimeline = async (episodeId: string): Promise<EpisodeTimeline | null> => {
  await waitForFonts();
  const file = `episodes/${episodeId}.timeline.json`;
  const all = getStaticFiles();
  const match = all.find((f) => f.name === file);
  if (!match) return null;
  const res = await fetch(match.src);
  if (!res.ok) return null;
  return (await res.json()) as EpisodeTimeline;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Episode"
        component={Episode}
        defaultProps={{ timeline: null as unknown as EpisodeTimeline }}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        calculateMetadata={async ({ props }) => {
          const episodeId =
            (props as { episodeId?: string }).episodeId ?? DEFAULT_EPISODE;
          const timeline = await loadTimeline(episodeId);
          if (!timeline) {
            return { durationInFrames: 300, fps: 30, props: { timeline: null as any } };
          }
          return {
            durationInFrames: timeline.totalDurationInFrames,
            fps: timeline.fps,
            props: { timeline },
          };
        }}
      />
      <Composition id="LayoutOptionA" component={LayoutOptionA} width={1920} height={1080} fps={30} durationInFrames={30} />
      <Composition id="LayoutOptionB" component={LayoutOptionB} width={1920} height={1080} fps={30} durationInFrames={30} />
      <Composition id="LayoutOptionC" component={LayoutOptionC} width={1920} height={1080} fps={30} durationInFrames={30} />
      <Composition id="LayoutOptionD" component={LayoutOptionD} width={1920} height={1080} fps={30} durationInFrames={30} />
      <Composition id="LayoutOptionE" component={LayoutOptionE} width={1920} height={1080} fps={30} durationInFrames={30} />
    </>
  );
};
