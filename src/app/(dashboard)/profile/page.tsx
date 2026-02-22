import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import Link from "next/link";

export default function ProfilePage() {
  // Mock user data
  const user = {
    name: "Demo User",
    email: "demo@example.com",
    subscriptionStatus: "free" as const,
    lessonsCompleted: 1,
    totalLessons: 6,
    flashcardsReviewed: 12,
    quizzesPassed: 1,
  };

  const progressPercent = (user.lessonsCompleted / user.totalLessons) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Your Profile</h1>

      {/* User info */}
      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {user.name}
            </h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Subscription
            <Badge variant={user.subscriptionStatus === "free" ? "default" : "completed"}>
              {user.subscriptionStatus === "free" ? "Free Plan" : "Full Access"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.subscriptionStatus === "free" ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;re on the free plan. Upgrade to unlock all lessons,
                flashcards, and study guides.
              </p>
              <Link href="/pricing">
                <Button>Upgrade to Full Access</Button>
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">
                You have full access to all course content.
              </p>
              <Button variant="outline" size="sm" className="mt-3">
                Manage Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Course Progress</span>
              <span className="font-medium">
                {user.lessonsCompleted}/{user.totalLessons} lessons
              </span>
            </div>
            <ProgressBar value={progressPercent} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-foreground">
                {user.flashcardsReviewed}
              </p>
              <p className="text-xs text-muted-foreground">
                Flashcards Reviewed
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-foreground">
                {user.quizzesPassed}
              </p>
              <p className="text-xs text-muted-foreground">Quizzes Passed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
