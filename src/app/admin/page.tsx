import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBlueprintCurriculum } from "@/lib/curriculum/blueprint-loader";

export default async function AdminPage() {
  const curriculum = await getBlueprintCurriculum();
  const totalLessons = curriculum.lessons.length;
  const totalModules = curriculum.modules.length;
  const totalTracks = curriculum.tracks.length;

  const stats = [
    { label: "Total Lessons", value: totalLessons, icon: "📚" },
    { label: "Modules", value: totalModules, icon: "🧩" },
    { label: "Tracks", value: totalTracks, icon: "🛤️" },
    { label: "Coming Soon", value: totalLessons, icon: "⏳" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-8">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-6 text-center">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Curriculum structure is now sourced from the blueprint CSV. Lesson rows
            remain placeholders until production assets are authored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
