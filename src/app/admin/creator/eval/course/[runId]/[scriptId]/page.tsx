import Link from "next/link";
import { requireAdminForPage } from "@/lib/auth/require-admin";
import { fetchScriptWithAnnotations, listRunScripts } from "@/lib/creator/eval-annotations";
import { parseReviewBlocks, readEvalScriptFile } from "@/lib/creator/eval-blocks";
import { EvalReviewBoard } from "@/components/creator/EvalReviewBoard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ runId: string; scriptId: string }>;
}

export default async function CourseScriptReviewPage({ params }: PageProps) {
  await requireAdminForPage();
  const { runId, scriptId } = await params;

  const file = await readEvalScriptFile("course", runId, scriptId);
  const listings = await listRunScripts("course", runId);
  const listing = listings.find((l) => l.scriptId === scriptId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/admin/creator/eval/course/${encodeURIComponent(runId)}`}
        className="text-xs text-blue-600 hover:underline"
      >
        ← Back to {runId}
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Course script: <span className="font-mono">{scriptId}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {listing ? `${listing.byteSize.toLocaleString()} bytes` : "file missing"}
          {listing?.isStub ? " - stub (generation failed)" : ""}
        </p>
      </header>

      {!file ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Script file not found at course/experiments/{runId}/{scriptId}.script.md.
        </p>
      ) : file.isStub ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This script is under 200 bytes (generation failed in the eval run). Re-run the
          eval to produce real content before annotating.
        </p>
      ) : !listing?.isSeeded || !listing.evalScriptId ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This script has no creator_eval_scripts row yet. Run scripts/seed_eval_scripts.py
          (one-off backfill for the 2026-04-26 set) so the annotation API has a parent row
          to link to.
        </p>
      ) : (
        <ReviewBoard evalScriptId={listing.evalScriptId} raw={file.raw} />
      )}
    </main>
  );
}

async function ReviewBoard({ evalScriptId, raw }: { evalScriptId: string; raw: string }) {
  const blocks = parseReviewBlocks("course", raw);
  const initial = await fetchScriptWithAnnotations(evalScriptId);
  const annotations = initial?.annotations ?? [];
  if (blocks.length === 0) {
    return (
      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Could not parse sections from the embedded script-master.json block. Open the file
        in your editor and confirm the &apos;## script-master.json&apos; heading + json fence
        exist.
      </p>
    );
  }
  return <EvalReviewBoard evalScriptId={evalScriptId} blocks={blocks} initialAnnotations={annotations} />;
}
