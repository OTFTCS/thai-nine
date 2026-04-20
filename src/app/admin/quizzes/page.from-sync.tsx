import { NineModePanel } from "@/components/quizzes/nine-mode-panel";
import { DiagnosticAdminPanel } from "@/components/quizzes/diagnostic-admin-panel";
import {
  getBlueprintLessons,
  getBlueprintPlacementRecommendations,
} from "@/lib/curriculum/blueprint-loader";

export default async function AdminQuizzesPage() {
  const [lessons, recommendationMap] = await Promise.all([
    getBlueprintLessons(),
    getBlueprintPlacementRecommendations(),
  ]);

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Diagnostic Invites</h1>
          <p className="text-muted-foreground mt-1">
            Create one-time assessment links and review learner results + lesson briefs.
          </p>
        </div>
        <DiagnosticAdminPanel />
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nine Mode</h2>
          <p className="text-muted-foreground mt-1">
            Review misses, replay counts, time-to-answer, notes, overrides, and lesson assignments.
          </p>
        </div>
        <NineModePanel lessons={lessons} recommendationMap={recommendationMap} />
      </section>
    </div>
  );
}
