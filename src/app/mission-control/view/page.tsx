import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COURSE_ROOT = path.join(ROOT, "course");

function safeResolveCoursePath(relativePath: string) {
  const cleaned = relativePath.replace(/^\/+/, "");
  const resolved = path.resolve(COURSE_ROOT, cleaned);

  if (!resolved.startsWith(COURSE_ROOT)) {
    throw new Error("Blocked path traversal");
  }

  return resolved;
}

async function readFileSafe(relativePath: string) {
  const fullPath = safeResolveCoursePath(relativePath);
  const content = await fs.readFile(fullPath, "utf8");
  return { fullPath, content };
}

export default async function MissionControlFileView({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  const relPath = params.path;

  let fullPath = "";
  let content = "";
  let error = "";

  if (!relPath) {
    error = "Missing file path.";
  } else {
    try {
      const result = await readFileSafe(relPath);
      fullPath = result.fullPath;
      content = result.content;
    } catch (e) {
      error = String((e as Error)?.message || e);
    }
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <a href="/mission-control" className="inline-block text-sm text-indigo-300 hover:text-indigo-200 mb-3">
          ← Back to Mission Control
        </a>
        <p className="text-rose-300">Could not open file: {error}</p>
      </main>
    );
  }

  const isJson = relPath?.endsWith(".json");
  const displayText = isJson ? JSON.stringify(JSON.parse(content), null, 2) : content;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <a href="/mission-control" className="inline-block text-sm text-indigo-300 hover:text-indigo-200">
          ← Back to Mission Control
        </a>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">File</p>
          <p className="text-sm mt-1 break-all">{fullPath}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 overflow-auto">
          <pre className="text-xs whitespace-pre-wrap break-words leading-relaxed text-slate-200">{displayText}</pre>
        </div>
      </div>
    </main>
  );
}
