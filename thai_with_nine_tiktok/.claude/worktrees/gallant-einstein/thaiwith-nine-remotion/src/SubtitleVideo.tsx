import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

export type SubtitleItem = {
    startFrame: number;
    endFrame: number;
    heroText: string;
    heroSubText?: string;
    thaiScript?: string;
    phonetics?: string;
    englishTranslate?: string;
    type: "hook" | "term" | "outro";
};

export const SubtitleVideo: React.FC<{ subtitles: SubtitleItem[] }> = ({ subtitles }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#222", color: "white" }}>
            {/* Placeholder for raw video. Nine will replace this with her actual MP4 video */}
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <h1 style={{ color: "#444" }}>[Raw Video Place Holder]</h1>
            </AbsoluteFill>

            {/* Subtitles Overlay */}
            {subtitles.map((sub, index) => {
                return (
                    <Sequence key={index} from={sub.startFrame} durationInFrames={sub.endFrame - sub.startFrame}>
                        <SubtitleOverlay item={sub} />
                    </Sequence>
                );
            })}
        </AbsoluteFill>
    );
};

const SubtitleOverlay: React.FC<{ item: SubtitleItem }> = ({ item }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Smooth pop-in animation
    const scale = spring({
        fps,
        frame,
        config: { damping: 100, mass: 0.5 },
    });
    const opacity = interpolate(frame, [0, 10], [0, 1], {
        extrapolateRight: "clamp",
    });

    if (item.type === "hook" || item.type === "outro") {
        return (
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: "70%" }}>
                <div style={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    padding: "20px 40px",
                    borderRadius: "20px",
                    textAlign: "center",
                    transform: `scale(${scale})`,
                    opacity
                }}>
                    <h2 style={{ fontSize: "50px", margin: 0 }}>{item.heroText}</h2>
                    {item.heroSubText && <h3 style={{ fontSize: "40px", margin: 0, marginTop: "10px", color: "#FFD700" }}>{item.heroSubText}</h3>}
                </div>
            </AbsoluteFill>
        );
    }

    return (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "300px" }}>
            <div style={{
                backgroundColor: "rgba(0,0,0,0.8)",
                padding: "40px",
                borderRadius: "30px",
                textAlign: "center",
                minWidth: "600px",
                transform: `scale(${scale})`,
                opacity
            }}>
                {/* 1. Thai Script */}
                <div style={{ fontSize: "70px", fontWeight: "bold", marginBottom: "20px" }}>
                    {item.thaiScript?.split(item.heroText).map((part, i, arr) => (
                        <React.Fragment key={i}>
                            {part}
                            {i < arr.length - 1 && <span style={{ color: "#FFDF00" }}>{item.heroText}</span>}
                        </React.Fragment>
                    ))}
                </div>
                {/* 2. Phonetics */}
                <div style={{ fontSize: "40px", color: "#ddd", marginBottom: "20px" }}>
                    {item.phonetics}
                </div>
                {/* 3. English Translation */}
                <div style={{ fontSize: "45px", color: "#fff" }}>
                    {item.englishTranslate}
                </div>
            </div>
        </AbsoluteFill>
    );
};
