// Module-level in-memory lock keyed by episodeId. Used to serialise long-running
// script generation / regeneration so a second concurrent click does not stomp
// the first request's intermediate state. The map is process-local; a cluster
// of Next.js workers would each maintain its own. That is acceptable for a
// single-user creator dashboard but documented here for future readers.

const inFlight = new Map<string, Promise<unknown>>();

export class ScriptInFlightError extends Error {
  public readonly episodeId: string;

  constructor(episodeId: string) {
    super(`generation already in flight for ${episodeId}`);
    this.name = "ScriptInFlightError";
    this.episodeId = episodeId;
  }
}

export async function withEpisodeLock<T>(
  episodeId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (inFlight.has(episodeId)) {
    throw new ScriptInFlightError(episodeId);
  }

  const promise = fn();
  inFlight.set(episodeId, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(episodeId);
  }
}
