import { DiagnosticAdminPanel } from "@/components/quizzes/diagnostic-admin-panel";

export default function DiagnosticAdminPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Diagnostic Quizzes</h1>
        <p className="text-sm text-muted-foreground">
          Create invite links for prospective learners and review their results.
        </p>
      </div>
      <DiagnosticAdminPanel />
    </div>
  );
}
