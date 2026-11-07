/**
 * The star count beside the /ui header's GitHub link (#1666), shadcn's
 * StarsCount (apps/v4/components/github-link.tsx), read from the GitHub REST
 * API on the server.
 *
 * shadcn revalidates a cached fetch once a day. This keeps the count in
 * module scope for an hour and serves a stale value while one refresh runs in
 * the background, so only the first render after a boot ever waits on GitHub,
 * and that wait is bounded by a timeout. A failure caches nothing new: the
 * last good value stays (or `null` before there was one), and a failed
 * attempt is not retried for a few minutes, so an outage costs one request
 * per window rather than one per page view. `null` renders the icon alone.
 *
 * `GITHUB_TOKEN`, when set, rides as a bearer token (the unauthenticated limit
 * is 60 requests an hour per IP, which the cache already stays far under).
 *
 * The test suites never reach GitHub. Under `node --test` (which marks its
 * processes with NODE_TEST_CONTEXT) there is no fetcher, so every test file
 * that renders a /ui page would otherwise spend one real request and could
 * exhaust that 60 an hour by itself; a test that exercises the read installs
 * its own with `setStarsFetcher`. `WEBJS_GITHUB_STARS=off` does the same for
 * any other process.
 */

const REPO_API = 'https://api.github.com/repos/webjsdev/webjs';
const TTL_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 2000;

interface StarsCache {
  value: number | null;
  /** When the value was last fetched, or the last attempt failed. */
  checkedAt: number;
  ttl: number;
  inflight: Promise<number | null> | null;
}

const cache: StarsCache = { value: null, checkedAt: 0, ttl: 0, inflight: null };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

let fetcher: Fetcher | null =
  process.env.NODE_TEST_CONTEXT || process.env.WEBJS_GITHUB_STARS === 'off' ? null : (url, init) => fetch(url, init);

/** Swap the request function, or pass `null` to read nothing. Tests only. */
export function setStarsFetcher(next: Fetcher | null): void {
  fetcher = next;
}

async function fetchStars(): Promise<number | null> {
  try {
    if (!fetcher) throw new Error('reading the star count is switched off');
    const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'webjs.dev' };
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetcher(REPO_API, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const json = await res.json() as { stargazers_count?: unknown };
    const count = json.stargazers_count;
    if (typeof count !== 'number' || !Number.isFinite(count)) throw new Error('no stargazers_count');
    cache.value = count;
    cache.ttl = TTL_MS;
  } catch {
    cache.ttl = RETRY_MS;
  } finally {
    cache.checkedAt = Date.now();
    cache.inflight = null;
  }
  return cache.value;
}

/** The repository's star count, or `null` when it has never been read. */
export async function readGithubStars(): Promise<number | null> {
  const fresh = cache.checkedAt > 0 && Date.now() - cache.checkedAt < cache.ttl;
  if (fresh) return cache.value;
  cache.inflight ??= fetchStars();
  // A stale value is served at once while the refresh runs; only a boot with
  // nothing cached waits for the (time-bounded) request.
  return cache.value !== null ? cache.value : cache.inflight;
}

/** Forget the cached count. Tests only, which is why this file is not an action (nor is setStarsFetcher). */
export function resetGithubStars(): void {
  cache.value = null;
  cache.checkedAt = 0;
  cache.ttl = 0;
  cache.inflight = null;
}
