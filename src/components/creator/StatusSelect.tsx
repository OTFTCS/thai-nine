"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  STATUS_OPTIONS,
  statusLabel,
  statusStyle,
  type StatusKind,
} from "@/lib/creator/status-colors";

export interface StatusSelectProps {
  kind: StatusKind;
  id: string;
  rowIndex?: number;
  status: string;
  onUpdate?: (newStatus: string) => void;
}

export function StatusSelect({
  kind,
  id,
  rowIndex,
  status,
  onUpdate,
}: StatusSelectProps) {
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = STATUS_OPTIONS[kind];
  const normalized = current.toUpperCase();
  const optionValues = options.includes(normalized)
    ? options
    : [normalized, ...options];

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    const previous = current;
    setCurrent(newStatus);
    setSaving(true);
    setError(null);
    try {
      const { url, body } =
        kind === "scriptStatus"
          ? {
              url: "/api/creator/youtube/script/status",
              body: { episodeId: id, scriptStatus: newStatus },
            }
          : {
              url: "/api/creator/status",
              body: { kind, id, rowIndex, status: newStatus },
            };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (payload.ok === false) {
        throw new Error(payload.error ?? "update rejected by server");
      }
      onUpdate?.(newStatus);
    } catch (err) {
      setCurrent(previous);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <select
        value={normalized}
        disabled={saving}
        onChange={handleChange}
        className={cn(
          "rounded border-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60",
          statusStyle(current)
        )}
        aria-label={`Status for ${id}`}
      >
        {optionValues.map((opt) => (
          <option key={opt} value={opt}>
            {statusLabel(opt)}
          </option>
        ))}
      </select>
      {error && (
        <span
          className="text-[10px] text-red-600"
          title={error}
        >
          {error.length > 48 ? `${error.slice(0, 48)}…` : error}
        </span>
      )}
    </span>
  );
}
