"use client";

import { Button } from "@/components/ui/button";
import { SRS_RATINGS } from "@/lib/srs";

interface SrsRatingProps {
  onRate: (quality: number) => void;
}

export function SrsRating({ onRate }: SrsRatingProps) {
  return (
    <div className="flex gap-3 justify-center">
      {SRS_RATINGS.map((rating) => (
        <Button
          key={rating.label}
          variant={
            rating.color === "destructive"
              ? "destructive"
              : rating.color === "success"
              ? "secondary"
              : rating.color === "primary"
              ? "primary"
              : "outline"
          }
          size="sm"
          onClick={() => onRate(rating.quality)}
        >
          {rating.label}
        </Button>
      ))}
    </div>
  );
}
