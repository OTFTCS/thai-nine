import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../fonts";
import type { BrandCardProps } from "../../data/types";

const FADE_FRAMES = 6;

export const BrandCard: React.FC<BrandCardProps> = ({ episodeTitle }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 64px",
        gap: 28,
        textAlign: "center",
        opacity,
        fontFamily,
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 600,
          color: "#1a1a1a",
          letterSpacing: "-0.02em",
          lineHeight: 1.0,
        }}
      >
        thai with nine
      </div>
      {episodeTitle && (
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "#9a8e74",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {episodeTitle}
        </div>
      )}
    </div>
  );
};
