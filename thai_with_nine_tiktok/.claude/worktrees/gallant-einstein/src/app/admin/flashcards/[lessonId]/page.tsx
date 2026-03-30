import { notFound } from "next/navigation";
import Link from "next/link";
import { mockLessons, mockFlashcards } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AdminFlashcardsPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function AdminFlashcardsPage({ params }: AdminFlashcardsPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

  if (!lesson) {
    notFound();
  }

  const cards = mockFlashcards[lessonId] || [];

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/admin/lessons/${lessonId}/edit`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to {lesson.title}
      </Link>

      <div className="flex items-center justify-between mt-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Flashcards: {lesson.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button>+ Add Card</Button>
      </div>

      <div className="space-y-3">
        {cards.map((card, i) => (
          <Card key={card.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-6">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground text-lg">
                    {card.frontText}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {card.backText}
                    {card.backNotes && (
                      <span className="text-xs ml-2">({card.backNotes})</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button variant="ghost" size="sm">
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {cards.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No flashcards yet. Add your first card to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
