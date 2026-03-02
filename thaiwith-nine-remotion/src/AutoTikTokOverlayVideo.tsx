import React from "react";
import { AbsoluteFill, Sequence, Video, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type AutoCaption = {
  startFrame: number;
  endFrame: number;
  text: string;
};

export type AutoCue = {
  startFrame: number;
  endFrame: number;
  label: string;
  searchQuery: string;
  emoji: string;
};

export type AutoOverlayProps = {
  videoSrc: string;
  captions: AutoCaption[];
  cues: AutoCue[];
};

export const AutoTikTokOverlayVideo: React.FC<AutoOverlayProps> = ({ videoSrc, captions, cues }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const activeCue = cues.find((cue) => frame >= cue.startFrame && frame <= cue.endFrame);
  const progress = Math.min(100, Math.round((frame / Math.max(1, durationInFrames - 1)) * 100));

  return (
    <AbsoluteFill style={{ backgroundColor: "#020617", color: "white", fontFamily: "Inter, system-ui, sans-serif" }}>
      {videoSrc !== "autogen/placeholder.mp4" ? (
        <Video src={staticFile(videoSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 20% 10%, rgba(56,189,248,0.45), transparent 35%), radial-gradient(circle at 80% 90%, rgba(34,197,94,0.35), transparent 40%), linear-gradient(180deg, #0f172a 0%, #020617 100%)",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 80,
            fontSize: 48,
            lineHeight: 1.3,
            fontWeight: 600,
          }}
        >
          <div>Add your source video with:</div>
          <div style={{ fontSize: 30, opacity: 0.9, marginTop: 20 }}>
            npm run tiktok:build-post -- --video /path/to/file.mp4 --transcript /path/to/transcript.srt
          </div>
        </AbsoluteFill>
      )}

      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(2,6,23,0.12) 0%, rgba(2,6,23,0.68) 78%, rgba(2,6,23,0.82) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 38,
          left: 32,
          right: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            background: "rgba(2,6,23,0.62)",
            border: "1px solid rgba(148,163,184,0.45)",
            borderRadius: 999,
            padding: "10px 18px",
          }}
        >
          Thai With Nine
        </div>

        <div
          style={{
            minWidth: 132,
            textAlign: "right",
            fontSize: 22,
            background: "rgba(2,6,23,0.62)",
            border: "1px solid rgba(148,163,184,0.45)",
            borderRadius: 999,
            padding: "10px 16px",
          }}
        >
          {progress}%
        </div>
      </div>

      {activeCue ? <CueBadge cue={activeCue} /> : null}

      {captions.map((caption, index) => (
        <Sequence key={`${caption.startFrame}-${index}`} from={caption.startFrame} durationInFrames={caption.endFrame - caption.startFrame}>
          <CaptionCard text={caption.text} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const CueBadge: React.FC<{ cue: AutoCue }> = ({ cue }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame, config: { damping: 120, stiffness: 200, mass: 0.5 } });

  return (
    <div
      style={{
        position: "absolute",
        top: 128,
        left: 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        transform: `scale(${interpolate(scale, [0, 1], [0.95, 1])})`,
        transformOrigin: "left top",
        background: "rgba(15,23,42,0.72)",
        border: "1px solid rgba(148,163,184,0.45)",
        borderRadius: 999,
        padding: "10px 16px",
      }}
    >
      <span style={{ fontSize: 26 }}>{cue.emoji}</span>
      <span style={{ fontSize: 24, fontWeight: 600 }}>{cue.label}</span>
    </div>
  );
};

const CaptionCard: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ fps, frame, config: { damping: 110, mass: 0.55 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 96,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "92%",
          textAlign: "center",
          fontSize: 56,
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: "#f8fafc",
          textShadow: "0px 3px 8px rgba(0,0,0,0.58)",
          background: "rgba(15,23,42,0.58)",
          border: "1px solid rgba(148,163,184,0.45)",
          borderRadius: 28,
          padding: "20px 28px",
          opacity,
        }}
      >
        {text}
      </div>
    </div>
  );
};
