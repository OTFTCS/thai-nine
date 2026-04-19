"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SubscribeForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          type: "newsletter",
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_campaign: searchParams.get("utm_campaign") || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl bg-card border border-border p-6 text-center" role="status" aria-live="polite">
        <div className="text-3xl mb-2">✓</div>
        <p className="text-lg font-semibold text-foreground">You&apos;re in!</p>
        <p className="text-sm text-muted-foreground mt-1">Check your inbox for a welcome from Nine.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground text-center">Free Thai lessons in your inbox</h2>
      <p className="text-sm text-muted-foreground text-center mt-1.5 mb-4">
        Weekly phrases, vocab tips, and early access when the course launches
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            aria-label="Email address"
            error={status === "error" ? errorMsg : undefined}
          />
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {status === "loading" ? "..." : "Join free"}
        </button>
      </form>
      {status === "error" && !errorMsg && (
        <p className="text-sm text-destructive mt-2" role="alert" aria-live="polite">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
