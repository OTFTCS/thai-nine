import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SubtitleItem = {
  startFrame: number;
  endFrame: number;
  heroText: string;
  heroSubText?: string;
  thaiScript?: string;
  phonetics?: string;
  englishTranslate?: string;
  image?: string;
  emoji?: string;
  type: "hook" | "term" | "outro";
};

export type SubtitleTheme = "default" | "thaiFlag";

const getTheme = (theme: SubtitleTheme) => {
  if (theme === "thaiFlag") {
    return {
      pageBg: "#fff",
      pageText: "#0f172a",
      leftBg:
        "linear-gradient(180deg, #a51931 0%, #a51931 16%, #ffffff 16%, #ffffff 32%, #2d2a4a 32%, #2d2a4a 68%, #ffffff 68%, #ffffff 84%, #a51931 84%, #a51931 100%)",
      leftBorder: "1px solid rgba(45,42,74,0.25)",
      chipBg: "rgba(255,255,255,0.92)",
      chipBorder: "1px solid rgba(45,42,74,0.22)",
      chipText: "#1e1b4b",
      progressTrack: "rgba(45,42,74,0.2)",
      progressFill: "linear-gradient(90deg, #a51931 0%, #2d2a4a 100%)",
      rightBg: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
      rightBorder: "1px dashed rgba(45,42,74,0.38)",
      zoneText: "#475569",
      cardBg: "rgba(255,255,255,0.95)",
      cardBorder: "1px solid rgba(45,42,74,0.2)",
      titleText: "#111827",
      phoneticText: "#a51931",
      englishText: "#334155",
      badgeBg: "#fee2e2",
      badgeBorder: "1px solid #fca5a5",
      badgeText: "#7f1d1d",
    };
  }

  return {
    pageBg: "#f8fafc",
    pageText: "#0f172a",
    leftBg:
      "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.22), transparent 48%), radial-gradient(circle at 80% 10%, rgba(251,113,133,0.18), transparent 45%), linear-gradient(180deg, #eff6ff 0%, #f0fdf4 100%)",
    leftBorder: "1px solid rgba(148,163,184,0.4)",
    chipBg: "rgba(255,255,255,0.88)",
    chipBorder: "1px solid rgba(148,163,184,0.4)",
    chipText: "#0f172a",
    progressTrack: "rgba(148,163,184,0.35)",
    progressFill: "linear-gradient(90deg, #0ea5e9, #22c55e)",
    rightBg: "linear-gradient(180deg, #fff7ed 0%, #fefce8 100%)",
    rightBorder: "1px dashed rgba(148,163,184,0.55)",
    zoneText: "#64748b",
    cardBg: "rgba(255,255,255,0.94)",
    cardBorder: "1px solid rgba(148,163,184,0.4)",
    titleText: "#0f172a",
    phoneticText: "#0369a1",
    englishText: "#334155",
    badgeBg: "#d1fae5",
    badgeBorder: "1px solid #6ee7b7",
    badgeText: "#065f46",
  };
};

export const SubtitleVideo: React.FC<{ subtitles: SubtitleItem[]; episodeTitle?: string; theme?: SubtitleTheme }> = ({
  subtitles,
  episodeTitle,
  theme = "default",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(100, Math.round((frame / Math.max(1, durationInFrames - 1)) * 100));
  const colors = getTheme(theme);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.pageBg, color: colors.pageText, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Left 2/3 = Remotion teaching area */}
      <AbsoluteFill
        style={{
          width: "66.6667%",
          left: 0,
          background: colors.leftBg,
          borderRight: colors.leftBorder,
        }}
      >
        <div style={{ position: "absolute", top: 24, left: 24, right: 24, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              background: colors.chipBg,
              border: colors.chipBorder,
              padding: "10px 14px",
              borderRadius: 12,
              color: colors.chipText,
            }}
          >
            {episodeTitle || "Immersion Thai with Nine"}
          </div>
          <div
            style={{
              fontSize: 15,
              color: colors.englishText,
              background: colors.chipBg,
              border: colors.chipBorder,
              padding: "10px 12px",
              borderRadius: 12,
              minWidth: 112,
              textAlign: "right",
            }}
          >
            Progress {progress}%
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: 82,
            height: 7,
            borderRadius: 99,
            background: colors.progressTrack,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: colors.progressFill,
            }}
          />
        </div>

        {subtitles.map((sub, index) => (
          <Sequence key={index} from={sub.startFrame} durationInFrames={sub.endFrame - sub.startFrame}>
            <SubtitleOverlay item={sub} theme={theme} />
          </Sequence>
        ))}
      </AbsoluteFill>

      {/* Right 1/3 = reserved camera space for Nine */}
      <AbsoluteFill
        style={{
          left: "66.6667%",
          width: "33.3333%",
          background: colors.rightBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: colors.rightBorder,
        }}
      >
        <div
          style={{
            width: "86%",
            height: "92%",
            border: "2px dashed rgba(148,163,184,0.6)",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 16,
            color: colors.zoneText,
            fontSize: 22,
            lineHeight: 1.4,
          }}
        >
          Nine Camera Zone
          <br />
          (raw talking head)
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SubtitleOverlay: React.FC<{ item: SubtitleItem; theme: SubtitleTheme }> = ({ item, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const scale = spring({ fps, frame, config: { damping: 100, mass: 0.5 } });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const imagePath = item.image ? staticFile(item.image) : null;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
      <div
        style={{
          width: "90%",
          display: "grid",
          gridTemplateColumns: "35% 65%",
          gap: 18,
          alignItems: "stretch",
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        <div
          style={{
            borderRadius: 20,
            background: "rgba(255,255,255,0.92)",
            border: colors.cardBorder,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 280,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {imagePath ? (
            <Img src={imagePath} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 84 }}>{item.emoji || "🧠"}</div>
          )}
        </div>

        <div
          style={{
            borderRadius: 20,
            backgroundColor: colors.cardBg,
            border: colors.cardBorder,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 280,
          }}
        >
          <div style={{ fontSize: item.type === "hook" ? 44 : 46, fontWeight: 700, marginBottom: 10, color: colors.titleText, lineHeight: 1.15 }}>
            {item.thaiScript || item.heroText}
          </div>

          {(item.phonetics || item.heroSubText) && (
            <div style={{ fontSize: 28, color: colors.phoneticText, marginBottom: 8 }}>
              {item.phonetics || item.heroSubText}
            </div>
          )}

          {item.englishTranslate && <div style={{ fontSize: 30, color: colors.englishText }}>{item.englishTranslate}</div>}

          {item.type === "outro" && (
            <div
              style={{
                marginTop: 14,
                display: "inline-block",
                width: "fit-content",
                fontSize: 20,
                color: colors.badgeText,
                background: colors.badgeBg,
                border: colors.badgeBorder,
                borderRadius: 999,
                padding: "8px 14px",
              }}
            >
              Quiz + Drill now
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
