export const STATUS_STYLES: Record<string, string> = {
  READY_TO_RECORD: "bg-green-100 text-green-800",
  DRAFT: "bg-blue-100 text-blue-800",
  PLANNED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  READY: "bg-green-100 text-green-800",
  POSTED: "bg-green-100 text-green-800",
  BACKLOG: "bg-gray-100 text-gray-600",
  UNKNOWN: "bg-gray-100 text-gray-600",
  RECORDED: "bg-green-100 text-green-800",
  UPLOADED: "bg-green-100 text-green-800",
  UNLISTED: "bg-purple-100 text-purple-800",
  PENDING: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
};

export const STATUS_LABELS: Record<string, string> = {
  READY_TO_RECORD: "READY",
  IN_PROGRESS: "WIP",
  RECORDED: "REC",
  UPLOADED: "UP",
  PUBLISHED: "PUB",
  SCHEDULED: "SCHED",
};

export const DEFAULT_STATUS_STYLE = "bg-gray-100 text-gray-600";

export function statusStyle(status: string): string {
  return STATUS_STYLES[status.toUpperCase()] ?? DEFAULT_STATUS_STYLE;
}

export function statusLabel(status: string): string {
  const upper = status.toUpperCase();
  return STATUS_LABELS[upper] ?? upper;
}

export type StatusKind = "tiktok" | "youtube" | "carousel" | "social";

export const STATUS_OPTIONS: Record<StatusKind, string[]> = {
  tiktok: ["DRAFT", "SCHEDULED", "PUBLISHED", "UNKNOWN"],
  youtube: ["PENDING", "RECORDED", "UPLOADED", "PUBLISHED", "UNLISTED", "UNKNOWN"],
  carousel: ["PLANNED", "IN_PROGRESS", "READY", "POSTED"],
  social: ["DRAFT", "SCHEDULED", "PUBLISHED"],
};
