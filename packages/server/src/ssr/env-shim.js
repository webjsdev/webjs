import { jsonForScriptTag } from '../script-tag-json.js';
import { escapeAttr } from './escape.js';
import { buildEpoch } from '../build-epoch.js';

/**
 * The `window.process.env` shim, kept in its own module because BOTH the head
 * builder and the render path emit it.
 *
 * It lived in `document.js` before, which made `head.js` import from
 * `document.js` while `document.js` imported from `head.js`. Nothing in
 * `document.js` used it, so the dependency was on the file rather than on the
 * code, and moving it here is what breaks that half of the ssr cycle.
 */

/**
 * Build an inline `<script>` that exposes server-side environment
 * variables to the browser via `window.process.env`. Two purposes:
 *
 *   1. App code can read `process.env.WEBJS_PUBLIC_X` directly in
 *      components (counterpart of Next.js's `NEXT_PUBLIC_` prefix,
 *      but without a build step).
 *   2. `process.env.NODE_ENV` is defined for vendor bundles that
 *      probe it (lit, react, etc.) so they do not throw
 *      ReferenceError in the browser.
 *
 * Only variables whose name starts with `WEBJS_PUBLIC_` are exposed.
 * Other server env vars stay on the server.
 *
 * `</...` sequences in stringified values are escaped so an env value
 * containing `</script>` cannot terminate the inline script tag.
 *
 * **The payload is a per-build SNAPSHOT (#1644).** Enumerating `process.env`
 * is an exotic getenv walk, about 266 µs with a couple of hundred variables,
 * and it ran on EVERY page render (24% of a production render's CPU) for a
 * result that only changes with the build: `applyEnvValidation` writes its
 * coerced values back BEFORE any render, and a dev rebuild bumps the build
 * epoch, which re-snapshots. So `WEBJS_PUBLIC_*` is read at the first render
 * of a build. A `process.env` mutation made at runtime, after that render, is
 * not reflected until the next build (restart, or a dev rebuild). Only the
 * nonce attribute varies per call. An explicit `opts.env` (tests) is never
 * memoized.
 *
 * @param {{ dev: boolean, nonce?: string, env?: Record<string, string|undefined> }} opts
 *   `env` defaults to `process.env`. Override for tests.
 * @returns {string}
 */
export function publicEnvShim(opts) {
  const dev = !!opts.dev;
  let payload;
  if (opts.env) {
    payload = publicEnvPayload(dev, opts.env);
  } else {
    const m = dev ? _memo.dev : _memo.prod;
    if (m.epoch === buildEpoch()) payload = m.value;
    else {
      payload = publicEnvPayload(dev, process.env);
      _memo[dev ? 'dev' : 'prod'] = { epoch: buildEpoch(), value: payload };
    }
  }
  const n = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';
  return `<script${n}>${payload}</script>`;
}

/**
 * The script BODY (everything inside the tag): the `WEBJS_PUBLIC_*` subset of
 * `source` plus `NODE_ENV`, serialized with `jsonForScriptTag`. Pure in its
 * inputs, so the memo above can hold its result.
 *
 * @param {boolean} dev
 * @param {Record<string, string|undefined>} source
 * @returns {string}
 */
export function publicEnvPayload(dev, source) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const [k, v] of Object.entries(source)) {
    if (k.startsWith('WEBJS_PUBLIC_') && v !== undefined) {
      env[k] = String(v);
    }
  }
  env.NODE_ENV = dev ? 'development' : 'production';
  return 'window.process=window.process||{};'
    + `window.process.env=Object.assign(window.process.env||{},${jsonForScriptTag(env)});`;
}

/**
 * One snapshot per `dev` flag (a test process renders both ways), each
 * `{ epoch, value }` keyed on the build epoch.
 * @type {{ dev: { epoch: number, value: string }, prod: { epoch: number, value: string } }}
 */
let _memo = { dev: { epoch: 0, value: '' }, prod: { epoch: 0, value: '' } };

