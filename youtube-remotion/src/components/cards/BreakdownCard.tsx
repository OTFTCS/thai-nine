import { Img, interpolate, useCurrentFrame } from "remotion";
import { fontFamily } from "../../fonts";
import type { BreakdownCardProps } from "../../data/types";

const FADE_FRAMES = 4;

export const BreakdownCard: React.FC<BreakdownCardProps> = ({
  thai,
  translit,
  english,
  imageSrc,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
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
          padding: "24px 56px",
          gap: 28,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 500,
            color: "#1a1a1a",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {translit}
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 400,
            color: "#1a1a1a",
            lineHeight: 1.5,
          }}
        >
          {thai}
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#5a5a5a",
            lineHeight: 1.4,
          }}
        >
          {english}
        </div>
      </div>
    </div>
  );
};
