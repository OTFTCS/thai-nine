"use client";

import { ReactNode } from "react";
import { ArtifactLink } from "@/components/creator/ArtifactLink";
import type { ContentRow } from "@/types/creator";

export interface ColumnSpec<TRow> {
  key: string;
  label: string;
  render?: (row: TRow) => ReactNode;
  className?: string;
}

interface Props<TRow extends ContentRow<unknown>> {
  rows: TRow[];
  columns: ColumnSpec<TRow>[];
  getRowId: (row: TRow) => string;
  empty?: ReactNode;
}

export function ArtifactSpreadsheet<TRow extends ContentRow<unknown>>({
  rows,
  columns,
  getRowId,
  empty,
}: Props<TRow>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        {empty ?? "No rows."}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              className="border-t border-border/50 hover:bg-muted/20"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 align-middle ${col.className ?? ""}`}
                >
                  {col.render
                    ? col.render(row)
                    : renderDefault(row, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderDefault<TRow extends ContentRow<unknown>>(
  row: TRow,
  key: string
): ReactNode {
  const artifact = row.artifacts[key];
  if (artifact) return <ArtifactLink artifact={artifact} />;
  return null;
}
