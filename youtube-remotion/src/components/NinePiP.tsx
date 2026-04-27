import { OffthreadVideo } from "remotion";
import { SubtitleBand } from "./SubtitleBand";
import type { SubtitleEntry } from "../data/types";

interface NinePiPProps {
  src: string | null;
  subtitles: SubtitleEntry[];
}

export const NinePiP: React.FC<NinePiPProps> = ({ src, subtitles }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 810,
        height: 1080,
        overflow: "hidden",
        backgroundColor: "#1f1d1a",
      }}
    >
      {src ? (
        <OffthreadVideo
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          muted
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6e6a64",
            fontSize: 28,
            fontFamily: "sans-serif",
          }}
        >
          PiP placeholder (810×1080, 3:4)
        </div>
      )}
      <SubtitleBand subtitles={subtitles} />
    </div>
  );
};
