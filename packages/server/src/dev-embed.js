/**
 * The dev embed bridge, SERVER half (#1498).
 *
 * `webjs dev` with `WEBJS_EMBED_ORIGINS` set (a comma-separated list of parent
 * origins, e.g. `https://crisp.app,http://localhost:8080`) makes an app ready
 * to be previewed inside an iframe on those origins:
 *
 *   1. every HTML document gets a small inline script (the browser half,
 *      `dev-embed-client.js`) that reports page state to the parent and takes
 *      a few commands from it, carrying the request's CSP nonce like every
 *      other inline script WebJs emits;
 *   2. the response stops refusing the frame: `X-Frame-Options` is dropped
 *      and a CSP `frame-ancestors` directive is widened to the listed origins.
 *
 * Unset, both are a no-op and a document is byte-identical to before. Under
 * `webjs start` (`dev: false`) neither ever happens: the handler records no
 * origins and `wrapHead` gates on `opts.dev` as well.
 *
 * The origins are a module-level switch (mirroring `setClientRouterEnabled`),
 * set by `createRequestHandler`, so no option has to thread through every
 * render path that reaches `wrapHead`.
 */
import { readFileSync } from 'node:fs';
import { jsonForScriptTag } from './script-tag-json.js';
import { escapeAttr } from './ssr/escape.js';

/**
 * The browser half, read once and inlined: its `export` keyword stripped, and
 * its comments too, since they are the bulk of the file and every framed page
 * would carry them. The source has no string or regex containing a comment
 * opener, which `test/dev/dev-embed.test.js` pins.
 */
const CLIENT_SRC = readFileSync(new URL('./dev-embed-client.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/^export /gm, '')
  .replace(/^\s+/gm, '')
  .trim();

/** @type {string[]} */
let _origins = [];

/**
 * Parse `WEBJS_EMBED_ORIGINS`. Each entry must be an http(s) origin; a path or
 * trailing slash is normalized away (`https://a.dev/` is `https://a.dev`).
 * Anything else (a bare host, `*`, another scheme) is dropped with a warning,
 * because a wildcard would hand every page's console and errors to any site
 * that frames it.
 *
 * @param {string | undefined} raw
 * @param {{ warn?: (msg: string) => void }} [opts]
 * @returns {string[]} unique normalized origins, in input order
 */
export function parseEmbedOrigins(raw, opts) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const warn = (opts && opts.warn) || ((m) => console.warn(m));
  /** @type {string[]} */
  const out = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (!v) continue;
    let origin = '';
    try {
      const u = new URL(v);
      if (u.protocol === 'http:' || u.protocol === 'https:') origin = u.origin;
    } catch { /* not a URL */ }
    if (!origin) {
      warn(`[webjs] WEBJS_EMBED_ORIGINS: ignoring "${v}", expected an origin like https://example.com`);
      continue;
    }
    if (!out.includes(origin)) out.push(origin);
  }
  return out;
}

/**
 * Record the allowed embed origins for this process. `createRequestHandler`
 * calls it at construction: the parsed env value in dev, `[]` otherwise.
 *
 * @param {string[]} origins
 */
export function setEmbedOrigins(origins) {
  _origins = Array.isArray(origins) ? origins.slice() : [];
}

/** @returns {string[]} the allowed embed origins (empty = bridge off) */
export function embedOrigins() {
  return _origins;
}

/**
 * The inline bridge `<script>` for a document, or `''` when the bridge is off.
 * Includes its own leading newline so the off case adds zero bytes to the
 * head (the same shape as the client-router opt-out flag beside it).
 *
 * @param {{ dev: boolean, nonce?: string }} opts
 * @returns {string}
 */
export function embedScriptTag(opts) {
  if (!opts.dev || !_origins.length) return '';
  const n = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';
  return `\n<script${n} data-webjs-embed>(function(){${CLIENT_SRC}\ninstallEmbedBridge(${jsonForScriptTag(_origins)});})();</script>`;
}

/**
 * Let the listed origins frame a dev response: drop `X-Frame-Options` (it has
 * no way to name another origin) and add the origins to a `frame-ancestors`
 * directive in either CSP header. A policy without `frame-ancestors` already
 * allows any parent, so it is left alone. Mutates `headers` in place.
 *
 * @param {Headers} headers
 * @param {string[]} origins
 */
export function allowEmbedFraming(headers, origins) {
  if (!origins.length) return;
  headers.delete('x-frame-options');
  for (const name of ['content-security-policy', 'content-security-policy-report-only']) {
    const value = headers.get(name);
    if (!value) continue;
    const next = value.split(';').map((d) => {
      const t = d.trim();
      if (!/^frame-ancestors(\s|$)/i.test(t)) return d;
      const sources = t.split(/\s+/).slice(1).filter((s) => s !== "'none'");
      for (const o of origins) if (!sources.includes(o)) sources.push(o);
      return ` frame-ancestors ${sources.join(' ')}`;
    }).join(';').trim();
    try { headers.set(name, next); } catch { /* keep the original policy */ }
  }
}
