"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewLessonPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/admin/lessons"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Lessons
      </Link>

      <h1 className="text-3xl font-bold text-foreground mt-4 mb-8">
        Create New Lesson
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Blueprint-Managed Curriculum</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            New lessons are defined in the blueprint CSV and should not be created from the
            admin UI. Use the existing blueprint lesson list instead.
          </p>
          <Link href="/admin/lessons">
            <Button variant="outline">Back to Lessons</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
