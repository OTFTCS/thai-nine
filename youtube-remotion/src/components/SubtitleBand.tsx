import { useCurrentFrame } from "remotion";
import { fontFamily } from "../fonts";
import type { SubtitleEntry } from "../data/types";

interface SubtitleBandProps {
  subtitles: SubtitleEntry[];
}

const TAIL_PAD_FRAMES = 30;

const findActive = (subtitles: SubtitleEntry[], frame: number): SubtitleEntry | null => {
  if (!subtitles.length) return null;
  if (frame < subtitles[0]!.startFrame) return null;
  let lo = 0;
  let hi = subtitles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (subtitles[mid]!.startFrame <= frame) lo = mid;
    else hi = mid - 1;
  }
  const active = subtitles[lo]!;
  const next = subtitles[lo + 1];
  const end = next ? next.startFrame : active.startFrame + TAIL_PAD_FRAMES * 6;
  if (frame >= end) return null;
  return active;
};

export const SubtitleBand: React.FC<SubtitleBandProps> = ({ subtitles }) => {
  const frame = useCurrentFrame();
  const active = findActive(subtitles, frame);
  if (!active) return null;

  const isThai = active.lang === "th" || active.lang === "th-split";

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "20px 32px 28px",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        textAlign: "center",
        fontFamily,
        color: "#ffffff",
        textShadow: "0 1px 3px rgba(0,0,0,0.45)",
      }}
    >
      {isThai && active.translit && (
        <div style={{ fontSize: 38, fontWeight: 600, lineHeight: 1.15 }}>
          {active.translit}
        </div>
      )}
      <div
        style={{
          fontSize: isThai ? 30 : 36,
          fontWeight: isThai ? 400 : 500,
          lineHeight: 1.25,
          opacity: isThai ? 0.92 : 1,
        }}
      >
        {active.text}
      </div>
    </div>
  );
};
