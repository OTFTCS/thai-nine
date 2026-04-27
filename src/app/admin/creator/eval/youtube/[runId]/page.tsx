import Link from "next/link";
import { requireAdminForPage } from "@/lib/auth/require-admin";
import { listRunScripts } from "@/lib/creator/eval-annotations";
import { EvalRunIndex } from "@/components/creator/EvalRunIndex";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function YoutubeRunPage({ params }: PageProps) {
  await requireAdminForPage();
  const { runId } = await params;
  const scripts = await listRunScripts("youtube", runId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/creator/eval" className="text-xs text-blue-600 hover:underline">
        ← All eval runs
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          YouTube run: <span className="font-mono">{runId}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{scripts.length} script files.</p>
      </header>
      <EvalRunIndex scriptType="youtube" evalRunId={runId} scripts={scripts} />
    </main>
  );
}
