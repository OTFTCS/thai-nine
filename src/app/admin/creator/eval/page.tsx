import Link from "next/link";
import { requireAdminForPage } from "@/lib/auth/require-admin";
import { listEvalRuns } from "@/lib/creator/eval-annotations";

export const dynamic = "force-dynamic";

export default async function EvalRunsIndexPage() {
  await requireAdminForPage();
  const runs = await listEvalRuns();

  const youtube = runs.filter((r) => r.scriptType === "youtube");
  const course = runs.filter((r) => r.scriptType === "course");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Prompt eval runs</h1>
        <p className="text-sm text-muted-foreground">
          Annotate scripts produced by the YouTube and course prompts. Annotations roll up
          into prompt-feedback-notes.md.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Course
        </h2>
        <RunsTable kind="course" runs={course} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          YouTube
        </h2>
        <RunsTable kind="youtube" runs={youtube} />
      </section>
    </main>
  );
}

interface RunsTableProps {
  kind: "youtube" | "course";
  runs: Awaited<ReturnType<typeof listEvalRuns>>;
}

function RunsTable({ kind, runs }: RunsTableProps) {
  if (runs.length === 0) {
    return (
      <p className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        No eval runs found under {kind}/experiments/.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Run</th>
            <th className="px-3 py-2 text-right">Scripts</th>
            <th className="px-3 py-2 text-right">Annotated</th>
            <th className="px-3 py-2 text-left">Newest file</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={`${r.scriptType}-${r.evalRunId}`} className="border-t border-border/60">
              <td className="px-3 py-2">
                <Link
                  href={`/admin/creator/eval/${r.scriptType}/${encodeURIComponent(r.evalRunId)}`}
                  className="font-mono text-xs text-blue-600 hover:underline"
                >
                  {r.evalRunId}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs">{r.scriptCount}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">
                {r.annotatedCount} / {r.scriptCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {r.newestRun ? r.newestRun.slice(0, 19).replace("T", " ") : "n/a"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
