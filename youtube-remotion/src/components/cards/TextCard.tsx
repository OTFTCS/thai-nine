import { interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../fonts";
import type { TextCardProps } from "../../data/types";

const FADE_FRAMES = 6;

export const TextCard: React.FC<TextCardProps> = ({ thai, translit, english }) => {
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
        padding: "32px 64px",
        gap: 22,
        textAlign: "center",
        opacity,
        fontFamily,
      }}
    >
      {translit && (
        <div
          style={{
            fontSize: 88,
            fontWeight: 500,
            color: "#1a1a1a",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {translit}
        </div>
      )}
      {thai && (
        <div
          style={{
            fontSize: 68,
            fontWeight: 400,
            color: "#1a1a1a",
            lineHeight: 1.5,
          }}
        >
          {thai}
        </div>
      )}
      {english && (
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            color: "#5a5a5a",
            lineHeight: 1.4,
          }}
        >
          {english}
        </div>
      )}
    </div>
  );
};
