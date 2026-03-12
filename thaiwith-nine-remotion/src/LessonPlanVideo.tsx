import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type LessonScene = {
  id: string;
  startFrame: number;
  durationInFrames: number;
  title: string;
  guidance: string | null;
  objective: string;
  overlays: string[];
  voiceover: string[];
  thaiFocus: Array<{ thai: string; translit: string; english: string }>;
  layout: string;
  visualStrategy: {
    onScreenGoal: string;
    teachingVisuals: string[];
    teacherCues: string[];
    imageUsage: "real-image" | "icon" | "text-only";
    rationale: string;
  } | null;
};

export type LessonPlanVideoData = {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  episodeTitle: string;
  safeZoneLabel: string;
  scenes: LessonScene[];
};

export const LessonPlanVideo: React.FC<LessonPlanVideoData> = ({
  lessonId,
  lessonTitle,
  moduleTitle,
  episodeTitle,
  safeZoneLabel,
  scenes,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(100, Math.round((frame / Math.max(1, durationInFrames - 1)) * 100));

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(160deg, #f7efe1 0%, #fff9f0 40%, #f4ead8 100%)",
        color: "#201712",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <AbsoluteFill
        style={{
          width: "66.6667%",
          left: 0,
          background:
            "radial-gradient(circle at top left, rgba(186,134,58,0.18), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,244,232,0.96) 100%)",
          borderRight: "1px solid rgba(101,67,33,0.14)",
        }}
      >
        <Header episodeTitle={episodeTitle} moduleTitle={moduleTitle} lessonId={lessonId} progress={progress} />
        {scenes.map((scene) => (
          <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
            <LessonSceneCard scene={scene} lessonTitle={lessonTitle} />
          </Sequence>
        ))}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          left: "66.6667%",
          width: "33.3333%",
          background:
            "linear-gradient(180deg, rgba(114,47,55,0.08) 0%, rgba(255,251,245,0.98) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: "1px dashed rgba(114,47,55,0.28)",
        }}
      >
        <div
          style={{
            width: "86%",
            height: "90%",
            borderRadius: 24,
            border: "2px dashed rgba(114,47,55,0.42)",
            background: "rgba(255,255,255,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
            color: "#6b3d2d",
            lineHeight: 1.45,
            fontSize: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
              Reserved Camera Zone
            </div>
            <div>{safeZoneLabel}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Header: React.FC<{
  episodeTitle: string;
  moduleTitle: string;
  lessonId: string;
  progress: number;
}> = ({ episodeTitle, moduleTitle, lessonId, progress }) => {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          right: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 20, letterSpacing: 2, textTransform: "uppercase", color: "#87553d" }}>
            {lessonId}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{episodeTitle}</div>
          <div style={{ fontSize: 18, color: "#6b5b4f" }}>{moduleTitle}</div>
        </div>
        <div
          style={{
            minWidth: 120,
            textAlign: "right",
            fontSize: 18,
            color: "#6b5b4f",
          }}
        >
          Progress {progress}%
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 92,
          left: 24,
          right: 24,
          height: 8,
          borderRadius: 99,
          background: "rgba(101,67,33,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #8b5e3c 0%, #c58940 100%)",
          }}
        />
      </div>
    </>
  );
};

const LessonSceneCard: React.FC<{ scene: LessonScene; lessonTitle: string }> = ({ scene, lessonTitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame, config: { damping: 120, mass: 0.7 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: "126px 26px 30px 26px", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "58% 42%",
          gap: 18,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div
          style={{
            minHeight: 820,
            borderRadius: 28,
            background: "rgba(255,255,255,0.94)",
            border: "1px solid rgba(101,67,33,0.14)",
            boxShadow: "0 18px 48px rgba(70,42,22,0.09)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase", color: "#8f6646" }}>
            {scene.layout.replace(/-/g, " ")}
          </div>
          <div style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.08 }}>{scene.title}</div>
          <div style={{ fontSize: 24, lineHeight: 1.4, color: "#5b4a3f" }}>
            {scene.guidance ?? scene.objective}
          </div>
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 18,
              background: "rgba(197,137,64,0.09)",
              border: "1px solid rgba(197,137,64,0.18)",
            }}
          >
            <div style={{ fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase", color: "#8f6646", marginBottom: 8 }}>
              Teaching objective
            </div>
            <div style={{ fontSize: 24, lineHeight: 1.35 }}>{scene.objective || lessonTitle}</div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {scene.thaiFocus.map((item) => (
              <div
                key={`${scene.id}-${item.thai}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 4,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, #fffaf4 0%, #fff 100%)",
                  border: "1px solid rgba(101,67,33,0.11)",
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 34, fontWeight: 700 }}>{item.thai}</div>
                <div style={{ fontSize: 22, color: "#9a6139" }}>{item.translit}</div>
                <div style={{ fontSize: 24, color: "#4d3d32" }}>{item.english}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <InfoPanel
            title="On-screen plan"
            items={scene.overlays}
            tone="gold"
          />
          <InfoPanel
            title="Voiceover beats"
            items={scene.voiceover}
            tone="plum"
          />
          <InfoPanel
            title="Teacher cues"
            items={scene.visualStrategy?.teacherCues ?? []}
            tone="ink"
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InfoPanel: React.FC<{
  title: string;
  items: string[];
  tone: "gold" | "plum" | "ink";
}> = ({ title, items, tone }) => {
  const palette =
    tone === "gold"
      ? { bg: "rgba(197,137,64,0.11)", border: "rgba(197,137,64,0.25)", title: "#8f6646" }
      : tone === "plum"
        ? { bg: "rgba(114,47,55,0.09)", border: "rgba(114,47,55,0.18)", title: "#6f3742" }
        : { bg: "rgba(67,78,96,0.08)", border: "rgba(67,78,96,0.14)", title: "#3b4657" };

  return (
    <div
      style={{
        borderRadius: 22,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        padding: 20,
        minHeight: 180,
      }}
    >
      <div style={{ fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase", color: palette.title, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => (
          <div key={`${title}-${index}`} style={{ display: "flex", gap: 10, fontSize: 21, lineHeight: 1.35 }}>
            <div style={{ color: palette.title }}>{String(index + 1).padStart(2, "0")}</div>
            <div>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
