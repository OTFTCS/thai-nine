"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiagnosticInviteWithSubmission } from "@/types/diagnostic";

interface CreateInviteForm {
  learnerName: string;
  email: string;
  note: string;
}

export function DiagnosticAdminPanel() {
  const [invites, setInvites] = useState<DiagnosticInviteWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateInviteForm>({
    learnerName: "",
    email: "",
    note: "",
  });
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/diagnostic/invites");
      const json = (await res.json()) as { invites?: DiagnosticInviteWithSubmission[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load invites");
      setInvites(json.invites ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreatedLink(null);
    try {
      const res = await fetch("/api/diagnostic/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerName: form.learnerName || undefined,
          email: form.email || undefined,
          note: form.note || undefined,
        }),
      });
      const json = (await res.json()) as { invite?: { token: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to create invite");
      const token = json.invite!.token;
      const link = `${window.location.origin}/quiz/diagnostic/${token}`;
      setCreatedLink(link);
      setForm({ learnerName: "", email: "", note: "" });
      await fetchInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (link: string) => {
    void navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-8">
      {/* Create invite */}
      <Card>
        <CardHeader>
          <CardTitle>Create Diagnostic Invite</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a one-time link to send to a prospective student.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="learnerName">
                  Learner name
                </label>
                <input
                  id="learnerName"
                  type="text"
                  value={form.learnerName}
                  onChange={(e) => setForm((f) => ({ ...f, learnerName: e.target.value }))}
                  placeholder="e.g. Sarah"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  Email (optional)
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="sarah@example.com"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="note">
                Note (optional)
              </label>
              <input
                id="note"
                type="text"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Trial student — referred by Maria"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Generate Invite Link"}
            </Button>
          </form>

          {createdLink && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Invite link created:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-primary break-all">{createdLink}</code>
                <Button size="sm" variant="outline" onClick={() => copyLink(createdLink)}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the student. It expires once they submit.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Diagnostic Invites</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void fetchInvites()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading invites…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!loading && invites.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No invites yet. Create one above.
            </p>
          )}
          {!loading && invites.length > 0 && (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.token}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {invite.learnerName ?? "Unnamed learner"}
                    </p>
                    {invite.email && (
                      <p className="text-xs text-muted-foreground">{invite.email}</p>
                    )}
                    {invite.note && (
                      <p className="text-xs text-muted-foreground italic">{invite.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(invite.createdAt).toLocaleDateString()}
                      {invite.completedAt &&
                        ` · Completed ${new Date(invite.completedAt).toLocaleDateString()}`}
                    </p>
                    {invite.submission && (
                      <p className="text-xs font-medium text-primary">
                        Band: {invite.submission.band} · Score: {invite.submission.score}% · Confidence: {invite.submission.confidence}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        invite.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}
                    >
                      {invite.status}
                    </span>
                    {invite.status === "completed" ? (
                      <Link href={`/admin/quizzes/diagnostic/${invite.token}`}>
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyLink(
                            `${window.location.origin}/quiz/diagnostic/${invite.token}`
                          )
                        }
                      >
                        Copy link
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
