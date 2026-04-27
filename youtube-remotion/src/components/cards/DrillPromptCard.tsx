import { Img, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../fonts";
import type { DrillPromptCardProps } from "../../data/types";

const FADE_FRAMES = 6;

export const DrillPromptCard: React.FC<DrillPromptCardProps> = ({ english, hint, imageSrc }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  const hintOpacity = interpolate(frame, [30, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hasImage = Boolean(imageSrc);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        opacity,
        fontFamily,
      }}
    >
      {hasImage && (
        <div
          style={{
            flex: "0 0 40%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 48px 12px",
          }}
        >
          <Img
            src={imageSrc!}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      )}
      <div
        style={{
          flex: hasImage ? "0 0 60%" : "1 1 100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 64px",
          gap: 36,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: "#1a1a1a",
            lineHeight: 1.4,
          }}
        >
          {english}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: "#8a8a8a",
              fontStyle: "italic",
              opacity: hintOpacity,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};
