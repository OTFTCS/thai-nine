"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
          <CardTitle>Lesson Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input id="title" label="Title" placeholder="e.g., Thai Greetings & Introductions" required />
            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                id="description"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors min-h-[80px]"
                placeholder="Brief description of the lesson"
              />
            </div>
            <Input id="videoUrl" label="Video URL" placeholder="https://vimeo.com/..." />
            <div className="space-y-1.5">
              <label htmlFor="transcript" className="block text-sm font-medium text-foreground">
                Transcript
              </label>
              <textarea
                id="transcript"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors min-h-[200px] font-mono"
                placeholder="Full lesson script in Thai and English..."
              />
            </div>
            <Input id="duration" label="Duration (minutes)" type="number" placeholder="15" />
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded border-border" />
                Free lesson
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded border-border" />
                Published
              </label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button">Create Lesson</Button>
              <Link href="/admin/lessons">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
