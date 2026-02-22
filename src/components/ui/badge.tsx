import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "free" | "locked" | "completed" | "in_progress" | "new";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  free: "bg-green-100 text-green-800",
  locked: "bg-gray-100 text-gray-600",
  completed: "bg-primary-light text-primary-dark",
  in_progress: "bg-blue-100 text-blue-800",
  new: "bg-accent/10 text-accent",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
