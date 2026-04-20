import { cn } from "@/lib/utils";
import { statusLabel, statusStyle } from "@/lib/creator/status-colors";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        statusStyle(status)
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
