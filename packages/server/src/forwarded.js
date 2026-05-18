/**
 * Build a full URL from a Node IncomingMessage, respecting standard
 * reverse-proxy headers (`X-Forwarded-Proto`, `X-Forwarded-Host`).
 *
 * Why: webjs apps are almost always deployed behind a reverse proxy
 * (Railway, Fly, Render, Vercel, Cloudflare, nginx, Caddy, Traefik -
 * see the no-build architecture docs). The proxy terminates TLS and
 * speaks plain HTTP/1.1 to the container, so `req.url` inside the
 * container reflects the internal "http" view. Without honoring the
 * forwarded headers, `ctx.url.origin` returns `http://container-host`
 * even though the browser is on `https://your-domain.com`: which
 * breaks OG / og:image tags, OAuth callback URLs, and any user code
 * that builds absolute URLs.
 *
 * Threat model: in webjs's typical deployment topology, the
 * container's HTTP port is only reachable through the trusted edge
 * proxy. There's no path for an attacker to inject these headers
 * without going through that proxy. For self-hosted bare-VM deploys
 * where the container is somehow directly exposed, set
 * `WEBJS_NO_TRUST_PROXY=1` to fall back to the raw `Host` header and
 * `http://` default.
 *
 * Header semantics:
 * - `X-Forwarded-Host` / `X-Forwarded-Proto` can be a comma-separated
 *   chain if multiple proxies are in front (e.g. CDN -> load balancer
 *   -> container). The first entry is the value closest to the
 *   original client: that's what we want.
 * - Node sometimes returns headers as an array (when the same header
 *   appears multiple times); handle both string and array shapes.
 *
 * @param {{ url?: string, headers: Record<string, string | string[] | undefined> }} req
 * @returns {URL}
 */
export function urlFromRequest(req) {
  const trust = process.env.WEBJS_NO_TRUST_PROXY !== '1';
  let host = null;
  let proto = null;
  if (trust) {
    host = firstHeaderValue(req.headers['x-forwarded-host']);
    proto = firstHeaderValue(req.headers['x-forwarded-proto']);
  }
  const finalHost = host || /** @type {string|undefined} */ (req.headers.host) || 'localhost';
  const finalProto = proto || 'http';
  return new URL(req.url || '/', `${finalProto}://${finalHost}`);
}

/**
 * Pick the first comma-separated value from a header that may be a
 * string, an array of strings, or undefined.
 *
 * @param {string | string[] | undefined} h
 * @returns {string | null}
 */
function firstHeaderValue(h) {
  const v = Array.isArray(h) ? h[0] : h;
  if (!v) return null;
  const first = v.split(',')[0].trim();
  return first || null;
}
