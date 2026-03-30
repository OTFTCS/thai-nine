"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface QuizAudioPlayerProps {
  thai: string;
  translit: string;
  showTranslit?: boolean;
  audioSrc: string;
  replayCount: number;
  onReplay: () => void;
}

export function QuizAudioPlayer({
  thai,
  translit,
  showTranslit = true,
  audioSrc,
  replayCount,
  onReplay,
}: QuizAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playWithSpeechFallback = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(thai);
    utterance.lang = "th-TH";
    utterance.rate = 0.92;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => {
      setIsPlaying(false);
      setError("Unable to play audio in this browser.");
    };

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const handlePlay = async () => {
    onReplay();
    setError(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        const fallbackWorked = playWithSpeechFallback();
        if (!fallbackWorked) {
          setError("Audio file missing and speech fallback unavailable.");
        }
      };

      setIsPlaying(true);
      await audio.play();
    } catch {
      setIsPlaying(false);
      const fallbackWorked = playWithSpeechFallback();
      if (!fallbackWorked) {
        setError("Unable to play audio in this browser.");
      }
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
      <div>
        <p className="text-2xl font-semibold text-foreground">{thai}</p>
        {showTranslit && (
          <p className="text-sm text-muted-foreground mt-1">{translit}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handlePlay} variant="outline" size="sm">
          {isPlaying ? "Playing..." : "Play Audio"}
        </Button>
        <p className="text-xs text-muted-foreground">Replays: {replayCount}</p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
