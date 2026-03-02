"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  AssessmentResult,
  AssessmentSession,
  TeacherAssignment,
  TeacherNote,
  TeacherOverride,
} from "@/types/assessment";
import { saveTeacherAssignment } from "@/lib/assessment-persistence";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TeacherPanelProps {
  result: AssessmentResult;
  session: AssessmentSession;
  /** Existing assignment if editing */
  existingAssignment?: TeacherAssignment | null;
  onSave?: (assignment: TeacherAssignment) => void;
}

/**
 * Nine's Teacher Mode panel.
 * Allows Nine to review a learner's assessment, add notes,
 * override placement, and assign a custom starting point.
 */
export function TeacherPanel({
  result,
  session,
  existingAssignment,
  onSave,
}: TeacherPanelProps) {
  const [notes, setNotes] = useState<TeacherNote[]>(
    existingAssignment?.notes ?? [],
  );
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteTarget, setNewNoteTarget] = useState<"overall" | string>(
    "overall",
  );
  const [override, setOverride] = useState<TeacherOverride | undefined>(
    existingAssignment?.override,
  );
  const [overrideLesson, setOverrideLesson] = useState(
    existingAssignment?.override?.overrideStartLessonId ?? "",
  );
  const [overrideReason, setOverrideReason] = useState(
    existingAssignment?.override?.reason ?? "",
  );
  const [showOverrideForm, setShowOverrideForm] = useState(
    !!existingAssignment?.override,
  );
  const [saved, setSaved] = useState(false);

  const addNote = () => {
    if (!newNoteText.trim()) return;

    const note: TeacherNote = {
      targetId: newNoteTarget === "overall" ? "overall" : newNoteTarget,
      targetType:
        newNoteTarget === "overall" ? "overall" : "question",
      note: newNoteText.trim(),
      createdAt: new Date().toISOString(),
    };

    setNotes([...notes, note]);
    setNewNoteText("");
  };

  const removeNote = (index: number) => {
    setNotes(notes.filter((_, i) => i !== index));
  };

  const handleSetOverride = () => {
    if (!overrideLesson.trim() || !overrideReason.trim()) return;

    setOverride({
      overrideStartLessonId: overrideLesson.trim(),
      overrideDeepLink: `/lessons/${overrideLesson.trim()}`,
      overrideBandLabel: `Teacher Override → ${overrideLesson.trim()}`,
      reason: overrideReason.trim(),
      teacherId: "nine",
      createdAt: new Date().toISOString(),
    });
  };

  const clearOverride = () => {
    setOverride(undefined);
    setOverrideLesson("");
    setOverrideReason("");
    setShowOverrideForm(false);
  };

  const handleSave = () => {
    const effectiveStartLesson =
      override?.overrideStartLessonId ??
      result.placementBand?.startLessonId ??
      "M01-L001";

    const assignment: TeacherAssignment = {
      sessionId: session.sessionId,
      notes,
      override,
      assignedStartLessonId: effectiveStartLesson,
      assignedDeepLink: `/lessons/${effectiveStartLesson}`,
      assignedAt: new Date().toISOString(),
    };

    saveTeacherAssignment(assignment);
    setSaved(true);
    onSave?.(assignment);

    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            👩‍🏫
          </span>
          <div>
            <CardTitle>Nine&apos;s Teacher Notes</CardTitle>
            <CardDescription>
              Review, annotate, and optionally override this learner&apos;s
              placement
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Quick Summary ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className="font-semibold text-foreground">
              {Math.round(result.overallScore)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p
              className={cn(
                "font-semibold",
                result.confidence.level === "high" && "text-success",
                result.confidence.level === "medium" && "text-primary",
                result.confidence.level === "low" && "text-accent",
              )}
            >
              {result.confidence.level}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Auto-placed</p>
            <p className="font-semibold text-foreground">
              {result.placementBand?.label ?? "N/A"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">
              {override ? "Override" : "Assigned"}
            </p>
            <p className="font-semibold text-foreground">
              {override?.overrideStartLessonId ??
                result.placementBand?.startLessonId ??
                "M01-L001"}
            </p>
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Notes</h4>

          {notes.length > 0 && (
            <ul className="space-y-2">
              {notes.map((note, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-3"
                >
                  <span className="text-xs text-muted-foreground min-w-[60px]">
                    {note.targetType === "overall"
                      ? "Overall"
                      : note.targetId}
                  </span>
                  <span className="flex-1 text-foreground">{note.note}</span>
                  <button
                    onClick={() => removeNote(i)}
                    className="text-muted-foreground hover:text-destructive text-xs"
                    aria-label="Remove note"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <select
              value={newNoteTarget}
              onChange={(e) => setNewNoteTarget(e.target.value)}
              className="text-sm rounded-lg border border-border bg-background px-2 py-1.5"
              aria-label="Note target"
            >
              <option value="overall">Overall</option>
              {session.questionPath.map((qId) => (
                <option key={qId} value={qId}>
                  {qId}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Add a note..."
              className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-1.5"
              aria-label="Note text"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addNote}
              disabled={!newNoteText.trim()}
            >
              Add
            </Button>
          </div>
        </div>

        {/* ── Override ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Placement Override
            </h4>
            {!showOverrideForm && !override && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOverrideForm(true)}
              >
                Add Override
              </Button>
            )}
            {override && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearOverride}
                className="text-destructive"
              >
                Remove Override
              </Button>
            )}
          </div>

          {override && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <p>
                <span className="font-medium">Override:</span> Start at{" "}
                {override.overrideStartLessonId}
              </p>
              <p className="text-muted-foreground mt-1">
                Reason: {override.reason}
              </p>
            </div>
          )}

          {showOverrideForm && !override && (
            <div className="space-y-2 border border-border rounded-lg p-3">
              <input
                type="text"
                value={overrideLesson}
                onChange={(e) => setOverrideLesson(e.target.value)}
                placeholder="Lesson ID (e.g. M01-L003)"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5"
                aria-label="Override lesson ID"
              />
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override (required)"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5"
                aria-label="Override reason"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSetOverride}
                  disabled={
                    !overrideLesson.trim() || !overrideReason.trim()
                  }
                >
                  Set Override
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOverrideForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button onClick={handleSave}>
            {saved ? "Saved!" : "Save Assignment"}
          </Button>
          {saved && (
            <span className="text-sm text-success">
              Assignment saved successfully
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
