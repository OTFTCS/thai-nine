import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  loadMissionControlLessonReview,
  type MissionControlLessonArtifact,
} from "@/lib/mission-control/lesson-review";
import { renderMissionControlMarkdown } from "@/lib/mission-control/render-markdown";

const STATE_COLORS: Record<string, string> = {
  READY_TO_RECORD: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  DRAFT: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  PLANNED: "border-blue-500/40 bg-blue-500/10 text-blue-200",
  BACKLOG: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function rawArtifactLabel(artifact: MissionControlLessonArtifact): string {
  if (artifact.isPdf) return "Open PDF";
  if (artifact.isPptx) return "Download PPTX";
  if (artifact.isJson || artifact.isMarkdown) return "Open raw";
  return "Open file";
}

function JsonPreview({ data }: { data: unknown }) {
  return (
    <pre className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-6 text-slate-200 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: renderMissionControlMarkdown(markdown),
      }}
    />
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 shadow-xl">
      <h2 className="text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function MissionControlLessonReviewPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const review = await loadMissionControlLessonReview(lessonId);

  if (!review) {
    notFound();
  }

  const stateColor =
    STATE_COLORS[review.status.state] || "border-slate-600/40 bg-slate-600/10 text-slate-200";
  const pdfArtifact = review.artifacts.find((artifact) => artifact.name === "pdf.pdf");
  const qaArtifact = review.artifacts.find((artifact) => artifact.name === "qa-report.md");
  const editorialQaArtifact = review.artifacts.find(
    (artifact) => artifact.name === "editorial-qa-report.md"
  );
  const visualQaArtifact = review.artifacts.find(
    (artifact) => artifact.name === "visual-qa-report.md"
  );
  const assessmentQaArtifact = review.artifacts.find(
    (artifact) => artifact.name === "assessment-qa-report.md"
  );
  const statusArtifact = review.artifacts.find((artifact) => artifact.name === "status.json");
  const deckArtifact = review.artifacts.find((artifact) => artifact.name === "deck.pptx");
  const deckSourceArtifact = review.artifacts.find(
    (artifact) => artifact.name === "deck-source.json"
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <a href="/mission-control" className="text-indigo-300 hover:text-indigo-200">
            ← Back to Mission Control
          </a>
          <span className="text-slate-600">/</span>
          <span>{review.lesson.moduleId}</span>
          <span className="text-slate-600">/</span>
          <span>{review.lesson.id}</span>
        </div>

        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-6 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {review.lesson.trackTitle}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {review.lesson.cefrBand}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${stateColor}`}>
                  {review.status.state}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-400">{review.lesson.moduleId} — {review.lesson.moduleTitle}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
                  {review.lesson.id}: {review.lesson.title}
                </h1>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Primary Outcome</p>
                  <p className="mt-2 text-sm text-slate-200">{review.lesson.primaryOutcome}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Secondary Outcome</p>
                  <p className="mt-2 text-sm text-slate-200">{review.lesson.secondaryOutcome}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
              <MetricCard
                label="QA"
                value={review.checks.qaPass === null ? "Unknown" : review.checks.qaPass ? "PASS" : "FAIL"}
                tone={review.checks.qaPass === true ? "good" : review.checks.qaPass === false ? "bad" : "neutral"}
              />
              <MetricCard
                label="Artifacts"
                value={`${review.checks.coreArtifactsPresent}/${review.checks.totalArtifacts}`}
                tone={review.checks.missingArtifacts.length === 0 ? "good" : "warn"}
              />
              <MetricCard label="Slides" value={String(review.checks.slideCount)} tone="neutral" />
              <MetricCard label="Quiz Questions" value={String(review.checks.quizQuestionCount)} tone="neutral" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <InfoRow label="Updated" value={formatDateTime(review.status.updatedAt)} />
            <InfoRow label="Validated" value={formatDateTime(review.status.validatedAt)} />
            <InfoRow label="Quiz Focus" value={review.lesson.quizFocus || "—"} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {pdfArtifact?.exists ? (
              <a
                href={pdfArtifact.mediaHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20"
              >
                Open PDF
              </a>
            ) : null}
            {qaArtifact?.exists ? (
              <a
                href={qaArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open raw QA
              </a>
            ) : null}
            {editorialQaArtifact?.exists ? (
              <a
                href={editorialQaArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open editorial QA
              </a>
            ) : null}
            {visualQaArtifact?.exists ? (
              <a
                href={visualQaArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open visual QA
              </a>
            ) : null}
            {assessmentQaArtifact?.exists ? (
              <a
                href={assessmentQaArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open assessment QA
              </a>
            ) : null}
            {statusArtifact?.exists ? (
              <a
                href={statusArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open raw status
              </a>
            ) : null}
            {deckArtifact?.exists ? (
              <a
                href={deckArtifact.mediaHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Download PPTX deck
              </a>
            ) : null}
            {deckSourceArtifact?.exists ? (
              <a
                href={deckSourceArtifact.viewHref}
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Open raw deck source
              </a>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <SectionCard title="Overview">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Teaching Frame</p>
                  {review.content.scriptMasterJson?.teachingFrame ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      <p>{review.content.scriptMasterJson.objective || "No explicit script objective."}</p>
                      <p>
                        Runtime: {review.content.scriptMasterJson.teachingFrame.targetRuntimeMin ?? "—"}-
                        {review.content.scriptMasterJson.teachingFrame.targetRuntimeMax ?? "—"} minutes
                      </p>
                      <p>{review.content.scriptMasterJson.teachingFrame.openingHook || "No opening hook."}</p>
                      <p>{review.content.scriptMasterJson.teachingFrame.scenario || "No scenario."}</p>
                      <p>{review.content.scriptMasterJson.teachingFrame.learnerTakeaway || "No learner takeaway."}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Teaching frame not available yet.</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Output Summary</p>
                  <dl className="mt-3 space-y-2 text-sm text-slate-200">
                    <SummaryRow label="Flashcards" value={String(review.checks.flashcardCount)} />
                    <SummaryRow label="Quiz questions" value={String(review.checks.quizQuestionCount)} />
                    <SummaryRow label="Slide count" value={String(review.checks.slideCount)} />
                    <SummaryRow label="Notes" value={review.lesson.notes || "—"} />
                  </dl>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Brief">
              {review.content.briefMd ? (
                <MarkdownBlock markdown={review.content.briefMd} />
              ) : (
                <MissingArtifact name="brief.md" />
              )}
            </SectionCard>

            <SectionCard title="Spoken Script">
              {review.content.scriptSpokenMd ? (
                <MarkdownBlock markdown={review.content.scriptSpokenMd} />
              ) : (
                <MissingArtifact name="script-spoken.md" />
              )}
            </SectionCard>

            <SectionCard title="Visual Plan">
              <div className="space-y-5">
                {review.content.scriptVisualMd ? (
                  <MarkdownBlock markdown={review.content.scriptVisualMd} />
                ) : (
                  <MissingArtifact name="script-visual.md" />
                )}
                {review.content.deckSourceJson?.slides?.length ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Slide Layout Summary</p>
                    <div className="mt-3 space-y-3">
                      {review.content.deckSourceJson.slides.map((slide, index) => (
                        <div key={slide.id ?? `slide-${index + 1}`} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-slate-100">{slide.id ?? `slide-${index + 1}`}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                              <span className="rounded-full border border-slate-700 px-2 py-0.5">{slide.layout ?? "—"}</span>
                              <span className="rounded-full border border-slate-700 px-2 py-0.5">{slide.estimatedSeconds ?? 0}s</span>
                              <span className="rounded-full border border-slate-700 px-2 py-0.5">{slide.assets?.length ?? 0} assets</span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">
                            {slide.visualStrategy?.onScreenGoal || slide.title || "No slide objective."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="Resources">
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Flashcards</p>
                    {review.content.flashcardsJson?.cards?.length ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p>{review.content.flashcardsJson.cards.length} cards generated.</p>
                        <div className="space-y-2">
                          {review.content.flashcardsJson.cards.slice(0, 5).map((card, index) => (
                            <div key={card.id ?? `card-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                              <p className="font-medium text-slate-100">{card.front || "—"}</p>
                              <p className="text-slate-300">{card.translit || "—"}</p>
                              <p className="text-slate-400">{card.back || "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <MissingArtifact name="flashcards.json" compact />
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Quiz</p>
                    {review.content.quizJson?.questions?.length ? (
                      <div className="mt-3 space-y-2 text-sm text-slate-200">
                        <p>Pass score: {review.content.quizJson.passScore ?? "—"}</p>
                        <div className="space-y-2">
                          {review.content.quizJson.questions.slice(0, 5).map((question, index) => (
                            <div key={question.id ?? `question-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                              <p className="font-medium text-slate-100">
                                {question.prompt?.text || question.prompt?.thai || question.prompt?.english || "Untitled prompt"}
                              </p>
                              <p className="text-slate-400">{question.type || "—"} · {question.displayMode || "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <MissingArtifact name="quiz.json" compact />
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">PPTX Deck</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {review.previews.deckExists ? "Recording deck is available." : "Deck not generated yet."}
                      </p>
                    </div>
                    {review.previews.deckUrl ? (
                      <a
                        href={review.previews.deckUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20"
                      >
                        Download PPTX
                      </a>
                    ) : null}
                  </div>
                  {review.previews.deckLabel ? (
                    <p className="mt-3 text-sm text-slate-400">{review.previews.deckLabel}</p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">PDF Preview</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {review.previews.pdfExists ? "Lesson resource PDF is available." : "PDF not generated yet."}
                      </p>
                    </div>
                    {review.previews.pdfUrl ? (
                      <a
                        href={review.previews.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/20"
                      >
                        Open PDF
                      </a>
                    ) : null}
                  </div>
                  {review.previews.pdfUrl ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
                      <iframe title={`${review.lesson.id} PDF`} src={review.previews.pdfUrl} className="h-[720px] w-full bg-white" />
                    </div>
                  ) : null}
                </div>

              </div>
            </SectionCard>

            <SectionCard title="QA">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <MetricCard
                    label="Stage 2 QA"
                    value={review.checks.qaPass === null ? "Unknown" : review.checks.qaPass ? "PASS" : "FAIL"}
                    tone={review.checks.qaPass === true ? "good" : review.checks.qaPass === false ? "bad" : "neutral"}
                  />
                  <MetricCard
                    label="Editorial QA"
                    value={
                      review.checks.editorialQaPass === null
                        ? "Pending"
                        : review.checks.editorialQaPass
                        ? "PASS"
                        : "FAIL"
                    }
                    tone={
                      review.checks.editorialQaPass === true
                        ? "good"
                        : review.checks.editorialQaPass === false
                        ? "bad"
                        : "neutral"
                    }
                  />
                  <MetricCard
                    label="Visual QA"
                    value={
                      review.checks.visualQaPass === null
                        ? "Pending"
                        : review.checks.visualQaPass
                        ? "PASS"
                        : "FAIL"
                    }
                    tone={
                      review.checks.visualQaPass === true
                        ? "good"
                        : review.checks.visualQaPass === false
                        ? "bad"
                        : "neutral"
                    }
                  />
                  <MetricCard
                    label="Assessment QA"
                    value={
                      review.checks.assessmentQaPass === null
                        ? "Pending"
                        : review.checks.assessmentQaPass
                        ? "PASS"
                        : "FAIL"
                    }
                    tone={
                      review.checks.assessmentQaPass === true
                        ? "good"
                        : review.checks.assessmentQaPass === false
                        ? "bad"
                        : "neutral"
                    }
                  />
                  <MetricCard label="Validated at" value={formatDateTime(review.status.validatedAt)} tone="neutral" />
                  <MetricCard label="Missing artifacts" value={String(review.checks.missingArtifacts.length)} tone={review.checks.missingArtifacts.length === 0 ? "good" : "warn"} />
                </div>

                {review.content.editorialQaReportMd ? (
                  <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-100">Open editorial-qa-report.md</summary>
                    <div className="mt-4">
                      <MarkdownBlock markdown={review.content.editorialQaReportMd} />
                    </div>
                  </details>
                ) : (
                  <MissingArtifact name="editorial-qa-report.md" compact />
                )}

                {review.content.qaReportMd ? (
                  <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-100">Open raw qa-report.md</summary>
                    <div className="mt-4">
                      <MarkdownBlock markdown={review.content.qaReportMd} />
                    </div>
                  </details>
                ) : (
                  <MissingArtifact name="qa-report.md" compact />
                )}

                {review.content.visualQaReportMd ? (
                  <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-100">Open visual-qa-report.md</summary>
                    <div className="mt-4">
                      <MarkdownBlock markdown={review.content.visualQaReportMd} />
                    </div>
                  </details>
                ) : (
                  <MissingArtifact name="visual-qa-report.md" compact />
                )}

                {review.content.assessmentQaReportMd ? (
                  <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-100">Open assessment-qa-report.md</summary>
                    <div className="mt-4">
                      <MarkdownBlock markdown={review.content.assessmentQaReportMd} />
                    </div>
                  </details>
                ) : (
                  <MissingArtifact name="assessment-qa-report.md" compact />
                )}

                <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" open>
                  <summary className="cursor-pointer text-sm font-medium text-slate-100">Stage results</summary>
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {Object.keys(review.status.stageResults).length > 0 ? (
                      Object.entries(review.status.stageResults).map(([stage, result]) => (
                        <div key={stage} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm">
                          <p className="text-slate-400">Stage {stage}</p>
                          <p className="mt-1 font-medium text-slate-100">{result}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No stage results recorded yet.</p>
                    )}
                  </div>
                </details>

                <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-100">Open raw status.json</summary>
                  <div className="mt-4">
                    <JsonPreview data={review.content.statusJson} />
                  </div>
                </details>

                <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-100">Open raw deck-source.json</summary>
                  <div className="mt-4">
                    {review.content.deckSourceJson ? <JsonPreview data={review.content.deckSourceJson} /> : <MissingArtifact name="deck-source.json" compact />}
                  </div>
                </details>

                <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-100">Open raw quiz.json</summary>
                  <div className="mt-4">
                    {review.content.quizJson ? <JsonPreview data={review.content.quizJson} /> : <MissingArtifact name="quiz.json" compact />}
                  </div>
                </details>
              </div>
            </SectionCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <SectionCard title="Artifact Rail">
              <div className="space-y-3">
                {review.artifacts.map((artifact) => (
                  <div key={artifact.name} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{artifact.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{artifact.exists ? artifact.relPath : "Missing"}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                          artifact.exists
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-slate-700 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {artifact.exists ? "Present" : "Missing"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {artifact.exists ? (
                        <>
                          <a
                            href={artifact.isPdf || artifact.isPptx ? artifact.mediaHref : artifact.viewHref}
                            target={artifact.isPdf || artifact.isPptx ? "_blank" : undefined}
                            rel={artifact.isPdf || artifact.isPptx ? "noreferrer" : undefined}
                            className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/20"
                          >
                            {rawArtifactLabel(artifact)}
                          </a>
                          {artifact.isJson || artifact.isMarkdown ? (
                            <a
                              href={artifact.viewHref}
                              className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                            >
                              View raw text
                            </a>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Lesson Metadata">
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Track" value={review.lesson.trackTitle} />
                <SummaryRow label="Module" value={`${review.lesson.moduleId} — ${review.lesson.moduleTitle}`} />
                <SummaryRow label="Lesson Dir" value={review.lesson.lessonDir} />
                <SummaryRow label="Tags" value={review.lesson.flashcardTags.join(", ") || "—"} />
              </dl>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : tone === "bad"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
      : "border-slate-700 bg-slate-950/40 text-slate-100";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="max-w-[70%] text-right text-slate-200">{value}</dd>
    </div>
  );
}

function MissingArtifact({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/40 text-slate-400 ${compact ? "p-3 text-sm" : "p-4 text-sm"}`}>
      {name} is not available for this lesson yet.
    </div>
  );
}
