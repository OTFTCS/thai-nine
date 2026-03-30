import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { SubtitleItem } from '../SubtitleVideo';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const VIDEO_INPUT_PATH = path.join(__dirname, '../data/raw_video.mp4');
const AUDIO_OUTPUT_PATH = path.join(__dirname, '../data/extracted_audio.mp3');
const SUBTITLES_OUTPUT_PATH = path.join(__dirname, '../data/subtitles.json');

// This is the script we want to match timings to
const THAI_SCRIPT = [
    { heroText: "3 Thai Slang Words You MUST Know 🇹🇭📱", type: "hook" },
    { heroText: "ปัง", heroSubText: "(bpang)", type: "term" },
    { heroText: "ปัง", thaiScript: "ชุดนี้ปังมาก!", phonetics: "chút níi bpang mâak!", englishTranslate: "This outfit is slaying! ✨💅", type: "term" },
    { heroText: "แกง", heroSubText: "(gaeng)", type: "term" },
    { heroText: "แกง", thaiScript: "อย่ามาแกงฉันนะ!", phonetics: "yàa maa gaeng chǎn ná!", englishTranslate: "Don't prank me! ❌", type: "term" },
    { heroText: "นก", heroSubText: "(nók)", type: "term" },
    { heroText: "นก", thaiScript: "วันนี้ฉันนกอีกแล้ว", phonetics: "wan-níi chǎn nók ìik-láew", englishTranslate: "Today I struck out again 😭", type: "term" },
    { heroText: "เท", heroSubText: "(thay)", type: "term" },
    { heroText: "เท", thaiScript: "โดนเท", phonetics: "doon thay", englishTranslate: "Got stood up / dumped ☹️", type: "term" },
    { heroText: "โป๊ะ", heroSubText: "(bpó)", type: "term" },
    { heroText: "โป๊ะ", thaiScript: "จะโป๊ะมั้ยเนี่ย", phonetics: "jà bpó mái nîa", englishTranslate: "Am I going to get caught? 😅", type: "term" },
    { heroText: "Comment below! 👇💬", type: "outro" }
];

const FPS = 30; // Assuming the output video will be 30 FPS

async function main() {
    try {
        console.log('1. Extracting audio from raw video...');
        if (!fs.existsSync(VIDEO_INPUT_PATH)) {
            throw new Error(`Please place your raw video at: ${VIDEO_INPUT_PATH}`);
        }

        // Use ffmpeg to extract audio. Assuming ffmpeg is installed on the system.
        execSync(`ffmpeg -y -i "${VIDEO_INPUT_PATH}" -q:a 0 -map a "${AUDIO_OUTPUT_PATH}"`);
        console.log('Audio extracted successfully.');

        console.log('2. Transcribing audio and getting timestamps from OpenAI...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(AUDIO_OUTPUT_PATH),
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['word'],
        });

        console.log('Transcription received. Parsing words...');
        const words = transcription.words || [];

        if (words.length === 0) {
            console.log("No words detected in the audio.");
            return;
        }

        console.log('3. Aligning transcription with predefined script...');
        // A simple heuristic mapping. In a production app, you might use forced alignment 
        // or specific prompt markers to align the API output perfectly to the script segments.

        // For this demo, we'll evenly distribute the script items across the spoken duration 
        // of the video, as matching Thai/English mixed speech perfectly via Whisper can be complex 
        // without a dedicated forced-alignment model.

        const totalDurationMs = words[words.length - 1].end;
        const durationPerItem = totalDurationMs / THAI_SCRIPT.length;

        const generatedSubtitles = THAI_SCRIPT.map((item, index) => {
            const startSeconds = index * durationPerItem;
            const endSeconds = (index + 1) * durationPerItem;

            return {
                ...item,
                startFrame: Math.floor(startSeconds * FPS),
                // Add padding/pause between items if needed, or overlap slightly
                endFrame: Math.floor(endSeconds * FPS) - 5
            };
        });

        console.log('4. Saving generated subtitles to JSON...');
        fs.writeFileSync(SUBTITLES_OUTPUT_PATH, JSON.stringify(generatedSubtitles, null, 2));

        console.log(`Success! ${generatedSubtitles.length} subtitle frames saved to ${SUBTITLES_OUTPUT_PATH}`);

    } catch (error) {
        console.error("Transcription Error:", error);
    }
}

main();
