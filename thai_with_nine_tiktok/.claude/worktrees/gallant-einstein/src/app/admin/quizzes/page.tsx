import { NineModePanel } from "@/components/quizzes/nine-mode-panel";

export default function AdminNineModePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Nine Mode</h1>
        <p className="text-muted-foreground mt-1">
          Review misses, replay counts, time-to-answer, notes, overrides, and lesson assignments.
        </p>
      </div>
      <NineModePanel />
    </div>
  );
}
