"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface LessonTranscriptProps {
  transcript?: string;
}

export function LessonTranscript({ transcript }: LessonTranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  if (!transcript) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card">
        <h3 className="font-semibold text-foreground mb-2">Lesson Script</h3>
        <p className="text-sm text-muted-foreground">
          Transcript will be available when the lesson video is published.
        </p>
      </div>
    );
  }

  const lines = transcript.split("\n");
  const previewLines = lines.slice(0, 8);
  const hasMore = lines.length > 8;

  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-foreground mb-4">Lesson Script</h3>
      <div className="space-y-2 text-sm">
        {(expanded ? lines : previewLines).map((line, i) => (
          <p
            key={i}
            className={
              line.match(/[\u0E00-\u0E7F]/)
                ? "text-foreground text-lg font-medium"
                : "text-muted-foreground"
            }
          >
            {line || "\u00A0"}
          </p>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show full script"}
        </Button>
      )}
    </div>
  );
}
