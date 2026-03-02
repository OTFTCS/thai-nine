import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pre-Course Assessment — Immersion Thai",
  description:
    "Take our placement quiz, tone check, or reading assessment to find your level.",
};

const assessments = [
  {
    title: "Placement Quiz",
    description:
      "Find your starting lesson based on existing Thai knowledge. 9 questions, weighted scoring.",
    href: "/assessment/placement",
    icon: "🎯",
    badge: "Recommended first",
  },
  {
    title: "Tone Check",
    description:
      "Test your ear for Thai tones. Score 70%+ to unlock tone-focused content.",
    href: "/assessment/tone",
    icon: "🎵",
    badge: "8 questions",
  },
  {
    title: "Read & Identify Tones",
    description:
      "Can you read Thai tone marks and consonant classes? Test your script skills.",
    href: "/assessment/reader-tones",
    icon: "📖",
    badge: "6 questions",
  },
];

export default function AssessmentHubPage() {
  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Pre-Course Assessment
        </h1>
        <p className="text-muted-foreground mt-2">
          These short quizzes help us find the right starting point for your
          Thai learning journey. Start with the Placement Quiz.
        </p>
      </div>

      <div className="space-y-4">
        {assessments.map((a) => (
          <Link key={a.href} href={a.href} className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {a.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{a.title}</CardTitle>
                      {a.badge && (
                        <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                          {a.badge}
                        </span>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {a.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/dashboard">
          <Button variant="ghost">Skip for now — go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
