import { Button } from "@/components/ui/button";

interface PdfDownloadProps {
  pdfUrl?: string;
  lessonTitle: string;
}

export function PdfDownload({ pdfUrl, lessonTitle }: PdfDownloadProps) {
  if (!pdfUrl) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
        <span className="text-2xl">📄</span>
        <div>
          <p className="text-sm font-medium text-foreground">
            PDF Study Guide
          </p>
          <p className="text-xs text-muted-foreground">
            Coming soon for this lesson
          </p>
        </div>
      </div>
    );
  }

  return (
    <a href={pdfUrl} download>
      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer">
        <span className="text-2xl">📄</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Download Study Guide
          </p>
          <p className="text-xs text-muted-foreground">{lessonTitle}.pdf</p>
        </div>
        <Button variant="outline" size="sm">
          Download
        </Button>
      </div>
    </a>
  );
}
