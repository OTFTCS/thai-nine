"use client";

interface VideoPlayerProps {
  videoUrl?: string;
  title: string;
}

export function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  if (!videoUrl) {
    return (
      <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-3">🎬</span>
          <p className="text-muted-foreground font-medium">
            Video coming soon for &ldquo;{title}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back later for the video lesson
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      <iframe
        src={videoUrl}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
