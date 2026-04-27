import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EvalRunScriptListing, EvalScriptType } from "@/types/creator-eval";

interface Props {
  scriptType: EvalScriptType;
  evalRunId: string;
  scripts: EvalRunScriptListing[];
}

const STATUS_STYLES: Record<EvalRunScriptListing["annotationStatus"], string> = {
  none: "bg-muted/40 text-muted-foreground",
  partial: "bg-amber-100 text-amber-900",
  complete: "bg-emerald-100 text-emerald-800",
};

const STATUS_LABEL: Record<EvalRunScriptListing["annotationStatus"], string> = {
  none: "no notes",
  partial: "partial",
  complete: "complete",
};

export function EvalRunIndex({ scriptType, evalRunId, scripts }: Props) {
  if (scripts.length === 0) {
    return (
      <p className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        No script files found in this run directory.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Script</th>
            <th className="px-3 py-2 text-left">File</th>
            <th className="px-3 py-2 text-right">Bytes</th>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {scripts.map((s) => {
            const reviewable = !s.isStub && s.isSeeded;
            const href = `/admin/creator/eval/${scriptType}/${encodeURIComponent(evalRunId)}/${encodeURIComponent(s.scriptId)}`;
            return (
              <tr key={s.scriptId} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-xs">
                  {reviewable ? (
                    <Link href={href} className="text-blue-600 hover:underline">
                      {s.scriptId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{s.scriptId}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.filename}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                  {s.byteSize.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.isStub ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-800">
                      stub
                    </span>
                  ) : !s.isSeeded ? (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                      not seeded
                    </span>
                  ) : (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-800">
                      ready
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      STATUS_STYLES[s.annotationStatus],
                    )}
                  >
                    {STATUS_LABEL[s.annotationStatus]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
