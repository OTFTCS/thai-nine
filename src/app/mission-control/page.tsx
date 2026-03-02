"use client";

import { useEffect, useMemo, useState } from "react";

type Lesson = {
  lessonId: string;
  moduleId: string;
  lessonKey: string;
  state: string;
  updatedAt: string | null;
  artifacts: { name: string; exists: boolean }[];
};

type ModuleData = {
  moduleId: string;
  title: string;
  lessons: Lesson[];
};

type Snapshot = {
  updatedAt: string;
  branch: string;
  status: string;
  commits: string;
  missionControl: string;
  runlog: string;
  totals: {
    modules: number;
    lessons: number;
    ready: number;
    planned: number;
    inProgress: number;
  };
  modules: ModuleData[];
  todos: { lessonId: string; priority: "high" | "medium"; task: string }[];
  agentBoard: Record<string, string[]>;
  requiredArtifacts: string[];
  renders: { label: string; relPath: string; exists: boolean; url: string }[];
};

const REFRESH_MS = 3500;
const STATE_COLORS: Record<string, string> = {
  READY_TO_RECORD: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  QA_PASS: "bg-green-500/20 text-green-300 border-green-500/30",
  QA_FAIL: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  DRAFT: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  PLANNED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  BACKLOG: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function MissionControlPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [openModule, setOpenModule] = useState<string>("M01");

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/mission-control", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Snapshot;
        if (!alive) return;
        setData(json);
        setError("");
        if (!openModule && json.modules[0]) setOpenModule(json.modules[0].moduleId);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load mission control data");
      }
    };

    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [openModule]);

  const selectedModule = useMemo(
    () => data?.modules.find((m) => m.moduleId === openModule) ?? data?.modules[0],
    [data, openModule]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">🎛️ Thai Nine Mission Control</h1>
              <p className="text-slate-300 mt-1">Live production board for modules, lessons, artifacts, and next actions.</p>
            </div>
            <div className="text-sm text-slate-300 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
              Auto-refresh: {REFRESH_MS / 1000}s
              <br />
              {data ? `Updated: ${new Date(data.updatedAt).toLocaleTimeString()}` : "Loading..."}
            </div>
          </div>
          {error ? <p className="text-rose-300 mt-3">Error: {error}</p> : null}
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric label="Branch" value={data?.branch || "—"} />
          <Metric label="Modules" value={String(data?.totals.modules ?? "—")} />
          <Metric label="Lessons" value={String(data?.totals.lessons ?? "—")} />
          <Metric label="Ready" value={String(data?.totals.ready ?? "—")} tone="good" />
          <Metric label="Todo" value={String((data?.totals.lessons ?? 0) - (data?.totals.ready ?? 0) || "—")} tone="warn" />
        </section>

        <section className="grid xl:grid-cols-4 gap-4">
          <Panel title="Remotion Previews">
            <div className="space-y-2">
              {(data?.renders || []).map((r) => (
                <div key={r.relPath} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-slate-400 mb-2">{r.relPath}</p>
                  {r.exists ? (
                    <div className="space-y-2">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs inline-block rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-2 py-1 hover:bg-emerald-500/20"
                      >
                        Open video
                      </a>
                      <video
                        controls
                        preload="metadata"
                        className="w-full rounded border border-slate-700 bg-black"
                        src={r.url}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Not rendered yet</span>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Agent Work Queues">
            <AgentQueue name="Course Architect" items={data?.agentBoard?.courseArchitect || []} />
            <AgentQueue name="Lesson Scripter" items={data?.agentBoard?.lessonScripter || []} />
            <AgentQueue name="Linguistic QA" items={data?.agentBoard?.linguisticQa || []} />
            <AgentQueue name="Release Manager" items={data?.agentBoard?.releaseManager || []} />
            <AgentQueue name="Ready to Record" items={data?.agentBoard?.readyToRecord || []} />
          </Panel>

          <Panel title="Priority To‑Do List" className="xl:col-span-2">
            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {(data?.todos || []).length === 0 ? (
                <p className="text-slate-400 text-sm">No todos. Everything looks completed.</p>
              ) : (
                data?.todos.map((todo, idx) => (
                  <div key={`${todo.lessonId}-${idx}`} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{todo.lessonId}</p>
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                          todo.priority === "high"
                            ? "border-rose-400/40 text-rose-300 bg-rose-500/10"
                            : "border-amber-400/40 text-amber-300 bg-amber-500/10"
                        }`}
                      >
                        {todo.priority}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">{todo.task}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>

        <section className="grid xl:grid-cols-3 gap-4">
          <Panel title="Course Structure" className="xl:col-span-1">
            <div className="space-y-2 max-h-[480px] overflow-auto pr-1">
              {(data?.modules || []).map((module) => {
                const ready = module.lessons.filter((l) => l.state === "READY_TO_RECORD").length;
                const pct = Math.round((ready / Math.max(1, module.lessons.length)) * 100);
                const selected = selectedModule?.moduleId === module.moduleId;
                return (
                  <button
                    type="button"
                    key={module.moduleId}
                    onClick={() => setOpenModule(module.moduleId)}
                    className={`w-full text-left rounded-lg border p-3 transition ${
                      selected
                        ? "border-indigo-400/60 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{module.moduleId}</p>
                      <p className="text-xs text-slate-300">{ready}/{module.lessons.length}</p>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 line-clamp-2">{module.title}</p>
                    <div className="mt-2 h-1.5 rounded bg-slate-700 overflow-hidden">
                      <div className="h-full bg-indigo-400" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title={`${selectedModule?.moduleId || "Module"} Lessons`} className="xl:col-span-2">
            <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
              {(selectedModule?.lessons || []).map((lesson) => {
                const done = lesson.artifacts.filter((a) => a.exists).length;
                return (
                  <div key={lesson.lessonId} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div>
                        <p className="font-semibold">{lesson.lessonId}</p>
                        <p className="text-xs text-slate-400">Updated: {lesson.updatedAt || "—"}</p>
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 border ${
                          STATE_COLORS[lesson.state] || "bg-slate-600/20 text-slate-200 border-slate-600/40"
                        }`}
                      >
                        {lesson.state}
                      </span>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {lesson.artifacts.map((artifact) => {
                        const relPath = `modules/${lesson.moduleId}/${lesson.lessonKey}/${artifact.name}`;
                        const isPdf = artifact.name.endsWith(".pdf");
                        const href = isPdf
                          ? `/api/mission-control/media?path=${encodeURIComponent(relPath)}`
                          : `/mission-control/view?path=${encodeURIComponent(relPath)}`;

                        return artifact.exists ? (
                          <a
                            key={artifact.name}
                            href={href}
                            target={isPdf ? "_blank" : undefined}
                            rel={isPdf ? "noreferrer" : undefined}
                            className="rounded-lg border px-2 py-1.5 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition"
                            title={`Open ${relPath}`}
                          >
                            ✅ {artifact.name}
                          </a>
                        ) : (
                          <div
                            key={artifact.name}
                            className="rounded-lg border px-2 py-1.5 text-xs border-slate-600 bg-slate-700/40 text-slate-300"
                          >
                            ⬜ {artifact.name}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-slate-400 mt-2">Artifact completeness: {done}/{lesson.artifacts.length}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <Panel title="Run Log (course/runlogs/latest.md)">
            <Pre text={data?.runlog || "No runlog yet."} />
          </Panel>
          <Panel title="Git: Recent Commits + Status">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-1">Commits</h3>
            <Pre text={data?.commits || "—"} />
            <h3 className="text-xs uppercase tracking-wide text-slate-400 mt-3 mb-1">Status</h3>
            <Pre text={data?.status || "—"} />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-slate-700 bg-slate-900/70";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg ${className}`}>
      <h2 className="text-sm uppercase tracking-wide text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function AgentQueue({ name, items }: { name: string; items: string[] }) {
  return (
    <div className="mb-3">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{name}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No items</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="text-xs rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Pre({ text }: { text: string }) {
  return <pre className="text-xs whitespace-pre-wrap break-words overflow-auto max-h-[340px] text-slate-200 leading-relaxed">{text}</pre>;
}
