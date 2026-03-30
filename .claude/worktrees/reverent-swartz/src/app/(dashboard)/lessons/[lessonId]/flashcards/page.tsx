import { notFound } from "next/navigation";
import Link from "next/link";
import { mockLessons, mockFlashcards } from "@/lib/mock-data";
import { FlashcardDeck } from "@/components/flashcards/flashcard-deck";
import { Button } from "@/components/ui/button";

interface FlashcardsPageProps {
  params: Promise<{ lessonId: string }>;
}

export default async function FlashcardsPage({ params }: FlashcardsPageProps) {
  const { lessonId } = await params;
  const lesson = mockLessons.find((l) => l.id === lessonId);

  if (!lesson) {
    notFound();
  }

  const cards = mockFlashcards[lessonId] || [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/lessons/${lessonId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to {lesson.title}
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-2">
          Flashcards: {lesson.title}
        </h1>
        <p className="text-muted-foreground mt-1">
          {cards.length} card{cards.length !== 1 ? "s" : ""} to review
        </p>
      </div>

      {cards.length > 0 ? (
        <FlashcardDeck cards={cards} lessonId={lessonId} />
      ) : (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🗂️</div>
          <p className="text-muted-foreground mb-4">
            No flashcards available for this lesson yet.
          </p>
          <Link href={`/lessons/${lessonId}`}>
            <Button variant="outline">Back to Lesson</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
