import { NextRequest, NextResponse } from "next/server";

/**
 * Signup endpoint. POSTs a new subscriber to Kit (v4) and tags them by type.
 * Preserves the original request shape so the frontend does not need to change.
 *
 * Request body: { email, type, utm_source?, utm_medium?, utm_campaign? }
 *   type ∈ "newsletter" | "waitlist" | "cheat_sheet"
 *
 * Kit setup required:
 *   - KIT_API_KEY  (Developer settings)
 *   - KIT_TAG_NEWSLETTER / KIT_TAG_WAITLIST / KIT_TAG_CHEAT_SHEET (tag IDs)
 *   - Custom fields in Kit named exactly: utm_source, utm_medium, utm_campaign
 *     (Kit silently ignores fields that don't exist.)
 */

type SignupType = "newsletter" | "waitlist" | "cheat_sheet";

const KIT_API_BASE = "https://api.kit.com/v4";

const TAG_ENV: Record<SignupType, string> = {
  newsletter: "KIT_TAG_NEWSLETTER",
  waitlist: "KIT_TAG_WAITLIST",
  cheat_sheet: "KIT_TAG_CHEAT_SHEET",
};

interface KitSubscriberResponse {
  subscriber?: { id: number; email_address: string };
  errors?: string[];
}

async function kitRequest(
  path: string,
  init: RequestInit,
  apiKey: string,
): Promise<Response> {
  return fetch(`${KIT_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-Kit-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) {
    console.error("[waitlist] KIT_API_KEY is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, type, utm_source, utm_medium, utm_campaign } =
    (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (type !== "newsletter" && type !== "waitlist" && type !== "cheat_sheet") {
    return NextResponse.json({ error: "Invalid signup type" }, { status: 400 });
  }

  const tagId = process.env[TAG_ENV[type]];
  if (!tagId) {
    console.error(`[waitlist] ${TAG_ENV[type]} is not set`);
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const fields: Record<string, string> = {};
  if (typeof utm_source === "string" && utm_source) fields.utm_source = utm_source;
  if (typeof utm_medium === "string" && utm_medium) fields.utm_medium = utm_medium;
  if (typeof utm_campaign === "string" && utm_campaign) fields.utm_campaign = utm_campaign;

  try {
    // 1. Upsert subscriber. Kit creates if new, updates if existing.
    const subRes = await kitRequest(
      "/subscribers",
      {
        method: "POST",
        body: JSON.stringify({
          email_address: normalizedEmail,
          state: "active",
          ...(Object.keys(fields).length > 0 && { fields }),
        }),
      },
      apiKey,
    );

    if (!subRes.ok) {
      const errText = await subRes.text();
      console.error(`[waitlist] Kit subscriber upsert failed: ${subRes.status} ${errText}`);
      return NextResponse.json({ error: "Signup failed" }, { status: 502 });
    }

    const subData = (await subRes.json()) as KitSubscriberResponse;
    const subscriberId = subData.subscriber?.id;
    if (!subscriberId) {
      console.error("[waitlist] Kit response missing subscriber.id", subData);
      return NextResponse.json({ error: "Signup failed" }, { status: 502 });
    }

    // 2. Apply the tag. 200 = already tagged, 201 = newly tagged. Both are fine.
    const tagRes = await kitRequest(
      `/tags/${encodeURIComponent(tagId)}/subscribers/${subscriberId}`,
      { method: "POST", body: "{}" },
      apiKey,
    );

    if (!tagRes.ok) {
      const errText = await tagRes.text();
      console.error(`[waitlist] Kit tag apply failed: ${tagRes.status} ${errText}`);
      // Subscriber was created even if tagging failed, so report success.
      // Log so we can reconcile manually if needed.
    }

    return NextResponse.json({ message: "Success" }, { status: 201 });
  } catch (err) {
    console.error("[waitlist] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
