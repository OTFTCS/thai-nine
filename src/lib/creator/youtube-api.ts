const CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const PLAYLIST_ITEMS_ENDPOINT =
  "https://www.googleapis.com/youtube/v3/playlistItems";
const MAX_PAGES = 4;
const PAGE_SIZE = 50;
const EPISODE_ID_PATTERN = /\b(YT-S01-E\d{2,})\b/g;

interface ChannelsResponse {
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
  error?: { message?: string; code?: number };
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
    };
  }>;
  nextPageToken?: string;
  error?: { message?: string; code?: number };
}

let _warned = false;

function warnOnce(message: string): void {
  if (_warned) return;
  _warned = true;
  console.warn(`[youtube-api] ${message}`);
}

function extractEpisodeIds(text: string | undefined, into: Set<string>): void {
  if (!text) return;
  const matches = text.matchAll(EPISODE_ID_PATTERN);
  for (const m of matches) {
    into.add(m[1]);
  }
}

export async function fetchYouTubeUploadedIds(
  _root = process.cwd()
): Promise<Set<string>> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim();
  const oauthToken = process.env.YOUTUBE_OAUTH_TOKEN?.trim();

  if (!apiKey && !oauthToken) {
    warnOnce(
      "YOUTUBE_API_KEY (or YOUTUBE_OAUTH_TOKEN) not set — status will fall back to local inventory"
    );
    return new Set();
  }
  if (!channelId) {
    warnOnce(
      "YOUTUBE_CHANNEL_ID not set — cannot query uploads playlist"
    );
    return new Set();
  }

  const authHeaders: Record<string, string> = {};
  if (oauthToken) authHeaders.Authorization = `Bearer ${oauthToken}`;

  // Step 1: resolve uploads playlist id for this channel.
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
  const channelUrl = `${CHANNELS_ENDPOINT}?part=contentDetails&id=${encodeURIComponent(channelId)}${keyParam}`;

  let uploadsPlaylistId: string | undefined;
  try {
    const res = await fetch(channelUrl, { headers: authHeaders });
    if (!res.ok) {
      console.warn(
        `[youtube-api] channels lookup failed (${res.status}); aborting`
      );
      return new Set();
    }
    const json = (await res.json()) as ChannelsResponse;
    uploadsPlaylistId =
      json.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.warn(
        "[youtube-api] channel has no uploads playlist; returning empty set"
      );
      return new Set();
    }
  } catch (err) {
    console.warn(
      `[youtube-api] network error on channels lookup: ${(err as Error).message}`
    );
    return new Set();
  }

  // Step 2: paginate playlistItems, scan each title+description for episode IDs.
  const ids = new Set<string>();
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      part: "snippet",
      maxResults: String(PAGE_SIZE),
      playlistId: uploadsPlaylistId,
    });
    if (apiKey) params.set("key", apiKey);
    if (pageToken) params.set("pageToken", pageToken);
    const url = `${PLAYLIST_ITEMS_ENDPOINT}?${params.toString()}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: authHeaders });
    } catch (err) {
      console.warn(
        `[youtube-api] network error on playlistItems page ${page}: ${(err as Error).message}`
      );
      return new Set();
    }

    if (!res.ok) {
      console.warn(
        `[youtube-api] playlistItems non-200 (${res.status}) on page ${page}; aborting`
      );
      return new Set();
    }

    let json: PlaylistItemsResponse;
    try {
      json = (await res.json()) as PlaylistItemsResponse;
    } catch {
      console.warn(
        `[youtube-api] JSON parse failure on playlistItems page ${page}`
      );
      return new Set();
    }

    for (const item of json.items ?? []) {
      extractEpisodeIds(item.snippet?.title, ids);
      extractEpisodeIds(item.snippet?.description, ids);
    }

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return ids;
}
