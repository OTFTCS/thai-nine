import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockLessons } from "@/lib/mock-data";

export default function AdminPage() {
  const totalLessons = mockLessons.length;
  const publishedLessons = mockLessons.filter((l) => l.isPublished).length;
  const freeLessons = mockLessons.filter((l) => l.isFree).length;

  const stats = [
    { label: "Total Lessons", value: totalLessons, icon: "📚" },
    { label: "Published", value: publishedLessons, icon: "✅" },
    { label: "Free Lessons", value: freeLessons, icon: "🆓" },
    { label: "Premium Lessons", value: totalLessons - freeLessons, icon: "💎" },
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
            Admin content management features will be available here. Use the
            navigation above to manage lessons, flashcards, and quizzes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
