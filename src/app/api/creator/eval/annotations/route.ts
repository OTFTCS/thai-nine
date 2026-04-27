import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import {
  deleteAnnotation,
  fetchScriptWithAnnotations,
  upsertAnnotation,
} from "@/lib/creator/eval-annotations";

export const dynamic = "force-dynamic";

const RatingEnum = z.enum(["good", "ok", "rework"]);
const ScopeEnum = z.enum(["overall", "block"]);

const PutBodySchema = z.object({
  evalScriptId: z.string().uuid(),
  scope: ScopeEnum,
  blockId: z.string().min(1).nullable(),
  blockLabel: z.string().nullable(),
  rating: RatingEnum,
  comment: z.string().default(""),
  expectedUpdatedAt: z.string().nullable(),
});

const DeleteBodySchema = z.object({
  annotationId: z.string().uuid(),
});

function gateError(reason: "no-token-configured" | "missing-cookie" | "bad-cookie") {
  if (reason === "no-token-configured") {
    return NextResponse.json(
      { error: "Server misconfigured: CREATOR_ADMIN_TOKEN env var not set" },
      { status: 500 },
    );
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: Request) {
  const gate = await requireAdminForApi();
  if (!gate.ok) return gateError(gate.reason);

  const url = new URL(request.url);
  const evalScriptId = url.searchParams.get("eval_script_id");
  if (!evalScriptId) {
    return NextResponse.json({ error: "eval_script_id query param required" }, { status: 400 });
  }
  const result = await fetchScriptWithAnnotations(evalScriptId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const gate = await requireAdminForApi();
  if (!gate.ok) return gateError(gate.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await upsertAnnotation(parsed.data);
  if (result.ok) {
    return NextResponse.json({ ok: true, annotation: result.annotation });
  }
  switch (result.reason) {
    case "stale-lock":
      return NextResponse.json(
        { error: "Stale update", current: result.current },
        { status: 409 },
      );
    case "script-not-found":
      return NextResponse.json({ error: "Eval script not found" }, { status: 404 });
    case "scope-block-mismatch":
      return NextResponse.json(
        { error: "scope/block_id mismatch (overall must have null block_id; block must have block_id)" },
        { status: 400 },
      );
    case "db-error":
      return NextResponse.json({ error: result.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdminForApi();
  if (!gate.ok) return gateError(gate.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = DeleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "annotationId required" }, { status: 400 });
  }
  const result = await deleteAnnotation(parsed.data.annotationId);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
