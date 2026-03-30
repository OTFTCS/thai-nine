import { Composition } from "remotion";
import { SubtitleVideo } from "./SubtitleVideo";
import subtitles from "./data/subtitles.json";

export const RemotionVideo = () => {
    return (
        <>
            <Composition
                id="TikTokSlangVideo"
                component={SubtitleVideo}
                durationInFrames={30 * 150} // 150 seconds (2.5 mins) @ 30fps
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{ subtitles }}
            />
        </>
    );
};
