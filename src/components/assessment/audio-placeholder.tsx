"use client";

import { cn } from "@/lib/utils";

interface AudioPlaceholderProps {
  /** Path to audio file (may not exist yet) */
  src?: string;
  /** Whether audio is required for this question */
  required?: boolean;
  className?: string;
}

/**
 * Audio player placeholder. Shows a play button if audio exists,
 * or a "coming soon" notice for unrecorded audio.
 * Convention: /audio/assessment/{quizId}/{questionId}.mp3
 */
export function AudioPlaceholder({
  src,
  required,
  className,
}: AudioPlaceholderProps) {
  // For now, all audio is placeholder since files aren't recorded yet.
  // When audio files are added, this will become a real <audio> player.
  const isPlaceholder = true; // TODO: check if src file actually exists

  if (!src && !required) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3",
        className,
      )}
      role="region"
      aria-label={isPlaceholder ? "Audio coming soon" : "Audio player"}
    >
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
          isPlaceholder
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-white",
        )}
      >
        {isPlaceholder ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isPlaceholder ? (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              Audio coming soon
            </p>
            <p className="text-xs text-muted-foreground/70">
              {required
                ? "Read the Thai script and transliteration for now"
                : "Audio will be available when Nine records this prompt"}
            </p>
          </>
        ) : (
          <audio controls className="w-full" preload="none">
            <source src={src} type="audio/mpeg" />
            Your browser does not support audio playback.
          </audio>
        )}
      </div>
    </div>
  );
}
