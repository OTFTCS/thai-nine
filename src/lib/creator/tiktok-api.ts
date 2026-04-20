const VIDEO_LIST_ENDPOINT = "https://open.tiktokapis.com/v2/video/list/";
const FIELDS = "id,title,create_time,share_url";
const MAX_PAGES = 20;
const PAGE_SIZE = 20;

interface TikTokVideo {
  id?: string;
  title?: string;
  share_url?: string;
}

interface TikTokListResponse {
  data?: {
    videos?: TikTokVideo[];
    cursor?: number;
    has_more?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

let _warnedMissingToken = false;

function warnOnce(message: string): void {
  if (_warnedMissingToken) return;
  _warnedMissingToken = true;
  console.warn(`[tiktok-api] ${message}`);
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().trim();
}

export async function fetchTikTokPublishedTitles(
  _root = process.cwd()
): Promise<Set<string>> {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim();
  if (!token) {
    warnOnce("TIKTOK_ACCESS_TOKEN not set — status will fall back to UNKNOWN");
    return new Set();
  }

  const titles = new Set<string>();
  let cursor: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${VIDEO_LIST_ENDPOINT}?fields=${encodeURIComponent(FIELDS)}`;
    const body: Record<string, unknown> = { max_count: PAGE_SIZE };
    if (cursor !== undefined) body.cursor = cursor;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn(
        `[tiktok-api] network error on page ${page}: ${(err as Error).message}`
      );
      return new Set();
    }

    if (!res.ok) {
      console.warn(
        `[tiktok-api] non-200 response (${res.status}) on page ${page}; aborting`
      );
      return new Set();
    }

    let json: TikTokListResponse;
    try {
      json = (await res.json()) as TikTokListResponse;
    } catch {
      console.warn(`[tiktok-api] JSON parse failure on page ${page}; aborting`);
      return new Set();
    }

    if (json.error?.code && json.error.code !== "ok") {
      console.warn(
        `[tiktok-api] API error ${json.error.code}: ${json.error.message ?? ""}`
      );
      return new Set();
    }

    const videos = json.data?.videos ?? [];
    for (const v of videos) {
      if (typeof v.title === "string" && v.title.length > 0) {
        titles.add(normalizeTitle(v.title));
      }
    }

    if (!json.data?.has_more) break;
    cursor = json.data.cursor;
    if (cursor === undefined) break;
  }

  return titles;
}
