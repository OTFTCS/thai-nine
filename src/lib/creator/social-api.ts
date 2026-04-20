const IG_GRAPH_BASE = "https://graph.facebook.com/v19.0";
const TIKTOK_BASE = "https://open.tiktokapis.com/v2";

function isDryRun(): boolean {
  // Default to dry-run when unset — nothing leaves localhost until the user flips this.
  const flag = process.env.SOCIAL_DRY_RUN;
  if (flag === undefined) return true;
  return flag !== "false" && flag !== "0";
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name} — TODO: add to .env.local before publishing`);
  }
  return value;
}

export interface InstagramPublishInput {
  caption: string;
  mediaUrl: string | null;
  kind?: "reel" | "image" | "carousel";
}

export interface InstagramPublishResult {
  dryRun: boolean;
  mediaId?: string;
  creationId?: string;
  wouldPost?: InstagramPublishInput;
}

export async function publishToInstagram(
  input: InstagramPublishInput
): Promise<InstagramPublishResult> {
  if (isDryRun()) {
    return { dryRun: true, wouldPost: input };
  }
  const token = requireEnv("IG_GRAPH_ACCESS_TOKEN");
  const userId = requireEnv("IG_USER_ID");
  if (!input.mediaUrl) {
    throw new Error("Instagram publish requires a mediaUrl");
  }

  const kind = input.kind ?? "reel";
  const createParams = new URLSearchParams({
    caption: input.caption,
    access_token: token,
  });
  if (kind === "reel") {
    createParams.set("media_type", "REELS");
    createParams.set("video_url", input.mediaUrl);
  } else if (kind === "image") {
    createParams.set("image_url", input.mediaUrl);
  } else {
    // Carousel flow would require child containers first; out of scope here.
    throw new Error("Carousel publishing not implemented");
  }

  const createRes = await fetch(`${IG_GRAPH_BASE}/${userId}/media`, {
    method: "POST",
    body: createParams,
  });
  if (!createRes.ok) {
    throw new Error(`IG media create failed: ${createRes.status} ${await createRes.text()}`);
  }
  const { id: creationId } = (await createRes.json()) as { id: string };

  const publishRes = await fetch(`${IG_GRAPH_BASE}/${userId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  if (!publishRes.ok) {
    throw new Error(`IG publish failed: ${publishRes.status} ${await publishRes.text()}`);
  }
  const { id: mediaId } = (await publishRes.json()) as { id: string };

  return { dryRun: false, mediaId, creationId };
}

export interface TikTokPublishInput {
  caption: string;
  videoUrl: string | null;
}

export interface TikTokPublishResult {
  dryRun: boolean;
  publishId?: string;
  wouldPost?: TikTokPublishInput;
}

export async function publishToTikTok(
  input: TikTokPublishInput
): Promise<TikTokPublishResult> {
  if (isDryRun()) {
    return { dryRun: true, wouldPost: input };
  }
  const token = requireEnv("TIKTOK_ACCESS_TOKEN");
  if (!input.videoUrl) {
    throw new Error("TikTok publish requires a videoUrl");
  }
  const res = await fetch(`${TIKTOK_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      post_info: { title: input.caption, privacy_level: "SELF_ONLY" },
      source_info: { source: "PULL_FROM_URL", video_url: input.videoUrl },
    }),
  });
  if (!res.ok) {
    throw new Error(`TikTok publish failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: { publish_id?: string } };
  return { dryRun: false, publishId: body.data?.publish_id };
}

export function socialApiStatus(): {
  dryRun: boolean;
  instagramConfigured: boolean;
  tiktokConfigured: boolean;
} {
  return {
    dryRun: isDryRun(),
    instagramConfigured: Boolean(process.env.IG_GRAPH_ACCESS_TOKEN && process.env.IG_USER_ID),
    tiktokConfigured: Boolean(process.env.TIKTOK_ACCESS_TOKEN),
  };
}
