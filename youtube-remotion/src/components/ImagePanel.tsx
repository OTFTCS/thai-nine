import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { fontFamily } from "../fonts";

interface ImagePanelProps {
  imageSrc?: string | null;
}

const FADE_FRAMES = 6;

export const ImagePanel: React.FC<ImagePanelProps> = ({ imageSrc }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 680,
        right: 40,
        width: 1030,
        height: 360,
        backgroundColor: "#ffffff",
        borderRadius: 24,
        border: "2px solid #f0e9dc",
        boxShadow: "0 12px 40px rgba(20, 20, 20, 0.06)",
        overflow: "hidden",
        opacity,
      }}
    >
      {imageSrc && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 32px 56px",
          }}
        >
          <Img
            src={staticFile(imageSrc)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 24,
          bottom: 18,
          fontFamily,
          fontSize: 22,
          fontWeight: 500,
          color: "#a09a8e",
          letterSpacing: "0.04em",
        }}
      >
        thai with nine
      </div>
    </div>
  );
};
