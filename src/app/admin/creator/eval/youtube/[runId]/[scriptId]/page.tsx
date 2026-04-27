import Link from "next/link";
import { requireAdminForPage } from "@/lib/auth/require-admin";
import { fetchScriptWithAnnotations, listRunScripts } from "@/lib/creator/eval-annotations";
import { parseReviewBlocks, readEvalScriptFile } from "@/lib/creator/eval-blocks";
import { EvalReviewBoard } from "@/components/creator/EvalReviewBoard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ runId: string; scriptId: string }>;
}

export default async function YoutubeScriptReviewPage({ params }: PageProps) {
  await requireAdminForPage();
  const { runId, scriptId } = await params;

  const file = await readEvalScriptFile("youtube", runId, scriptId);
  const listings = await listRunScripts("youtube", runId);
  const listing = listings.find((l) => l.scriptId === scriptId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/admin/creator/eval/youtube/${encodeURIComponent(runId)}`}
        className="text-xs text-blue-600 hover:underline"
      >
        ← Back to {runId}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          YouTube script: <span className="font-mono">{scriptId}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {listing ? `${listing.byteSize.toLocaleString()} bytes` : "file missing"}
          {listing?.isStub ? " - stub (generation failed)" : ""}
        </p>
      </header>

      {!file ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Script file not found at youtube/experiments/{runId}/{scriptId}.json.
        </p>
      ) : file.isStub ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This script is under 200 bytes (the eval run produced an empty placeholder).
          Re-run the eval to produce real content before annotating.
        </p>
      ) : !listing?.isSeeded || !listing.evalScriptId ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This script has no creator_eval_scripts row yet. Seed it first.
        </p>
      ) : (
        <ReviewBoard evalScriptId={listing.evalScriptId} raw={file.raw} />
      )}
    </main>
  );
}

async function ReviewBoard({ evalScriptId, raw }: { evalScriptId: string; raw: string }) {
  const blocks = parseReviewBlocks("youtube", raw);
  const initial = await fetchScriptWithAnnotations(evalScriptId);
  const annotations = initial?.annotations ?? [];
  if (blocks.length === 0) {
    return (
      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Could not parse blocks from this YouTube script JSON.
      </p>
    );
  }
  return <EvalReviewBoard evalScriptId={evalScriptId} blocks={blocks} initialAnnotations={annotations} />;
}
