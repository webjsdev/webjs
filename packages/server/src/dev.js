import { createServer as createHttp1Server } from 'node:http';
import { stat, readFile, watch as fsWatch } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { digestHex } from './crypto-utils.js';
import { createGzip, createBrotliCompress, constants as zlibConstants } from 'node:zlib';
import { join, extname, resolve, dirname, relative, sep } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Server-side `.ts` imports are handled natively by Node 24+'s default
// type-stripping (`process.features.typescript === 'strip'`). No loader
// hook required. The browser-bound TypeScript request handler uses
// `module.stripTypeScriptTypes` for the same transform, so SSR and
// hydration produce identical JS.
//
// Runtime backing: Node ships `stripTypeScriptTypes` via the `amaro`
// package internally (wraps SWC's WASM TypeScript transform in a
// position-preserving strip-only mode). If the framework ever needs
// to run on Bun, Deno, or another runtime that does NOT expose the
// equivalent built-in, we will need to install `amaro` directly (or
// an equivalent: Sucrase preserves lines but not columns; SWC's
// strip-only also works). The fast-path `stripTs` helper would
// change one import line.
//
// Suppress the one-shot ExperimentalWarning that Node prints the
// first time `stripTypeScriptTypes` is called. The API is committed
// per Node 24's release notes; the warning is a holdover. We keep
// every other warning intact.
const _origEmitWarning = process.emitWarning.bind(process);
process.emitWarning = function (warning, type, code, ctor) {
  const msg = warning && warning.message ? warning.message : String(warning);
  if (
    (type === 'ExperimentalWarning' || (warning && warning.name === 'ExperimentalWarning')) &&
    msg.includes('stripTypeScriptTypes')
  ) {
    return;
  }
  return _origEmitWarning(warning, type, code, ctor);
};

import { buildRouteTable, matchPage, matchApi } from './router.js';
import { ssrPage, ssrNotFound } from './ssr.js';
import { loadPageAction, runPageAction } from './page-action.js';
import { handleApi } from './api.js';
import {
  buildActionIndex,
  serveActionStub,
  serveServerOnlyStub,
  invokeAction,
  matchExposedAction,
  matchAllAtPath,
  invokeExposedAction,
  buildPreflightResponse,
  withCors,
  isServerFile,
  hasUseServerDirective,
  hashFile,
} from './actions.js';
import { defaultLogger } from './logger.js';
import { withRequest, setCspNonce } from './context.js';
import { readCspConfig, mintNonce, buildCspHeader, cspHeaderName } from './csp.js';
import { attachWebSocket } from './websocket.js';
import { scanBareImports, resolveVendorImports, serveDownloadedBundle, clearVendorCache, hasVendorPin, readPinFile, prunePinToReachable } from './vendor.js';
import { buildModuleGraph, transitiveDeps, reachableFromEntries, resolveImport } from './module-graph.js';
import { primeComponentRegistry, findOrphanComponents, scanComponents } from './component-scanner.js';
import { analyzeElision, elideImportsFromSource } from './component-elision.js';

/** PascalCase → kebab-case for a helpful diagnostic example tag name. */
function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
import { setVendorEntries, setCoreInstall, publishBuildId } from './importmap.js';
import { urlFromRequest } from './forwarded.js';
import { compileHeaderRules, applySecurityHeaders, webRequestIsHttps } from './headers.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.mts': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Cache of stripped `.ts` / `.mts` source.
 * Keyed by absolute file path. Entries expire when mtime changes.
 * Capped at 500 entries to prevent unbounded memory growth in
 * long-running production servers.
 *
 * Stripper: `module.stripTypeScriptTypes` (Node 24+ built-in).
 * Position-preserving whitespace replacement. No sourcemap is
 * emitted because every (line, column) maps to itself in the source.
 *
 * Only erasable TypeScript is supported. Non-erasable syntax (`enum`,
 * `namespace` with values, parameter properties, legacy decorators
 * with `emitDecoratorMetadata`, `import = require`) throws at strip
 * time. The `erasable-typescript-only` and `no-non-erasable-typescript`
 * lint rules catch these at edit time. webjs is buildless end-to-end:
 * there is no bundler fallback.
 *
 * The transformed bytes are cached per request handler in `state.tsCache`
 * (a `Map<string, { mtimeMs, code, map }>`), bounded to `TS_CACHE_MAX`
 * entries. The cache is per-handler rather than module-global because the
 * cached code bakes in that handler's elision verdict, so two handlers for
 * the same app with different elision settings must not share it.
 */
const TS_CACHE_MAX = 500;

/**
 * Auto-load `<appDir>/.env` into `process.env` once at boot. Mirrors
 * what Rails / Next / Astro do out of the box: a scaffolded app with
 * a committed `.env.example` and a developer-copied `.env` should
 * "just work" without the user having to add a dotenv import or set
 * the file path on the CLI.
 *
 * Uses Node 24+'s built-in `process.loadEnvFile`, which is dotenv-
 * compatible and DOES NOT override pre-existing `process.env` values.
 * Calls that hit a missing file or parse error are silenced; the
 * server should still come up cleanly when there's no `.env`.
 *
 * Idempotent: re-running is a no-op for any env var the user already
 * exported (e.g. via the host shell or a process manager). That
 * keeps the "shell-set wins over file" precedence Rails users
 * expect.
 *
 * Must run before any server-only module is loaded by
 * buildActionIndex, since module-init code in `lib/*.server.ts`
 * (e.g. `createAuth({ secret: process.env.AUTH_SECRET })`) reads
 * process.env at import time. createRequestHandler is the
 * single entry point where this is guaranteed.
 *
 * @param {string} appDir
 */
function loadAppEnv(appDir) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(join(appDir, '.env'));
    }
  } catch {
    // No .env file, malformed file, or Node version without
    // loadEnvFile. Either way, fall through silently: the user
    // may not need any env vars, or they may set them via shell.
  }
}

/**
 * Read the `WEBJS_ELIDE` environment override, if set.
 * `0` / `false` / `off` / `no` (case-insensitive) force elision OFF;
 * `1` / `true` / `on` / `yes` force it ON. Any other value, or an unset
 * variable, returns `undefined` so the caller falls through to the
 * `package.json` switch. The env override is the deploy-time / ops escape
 * hatch: force-disable elision to rule it out while debugging a wrong-strip
 * without editing committed code, or force-enable it regardless of an
 * app's `package.json`. It is also the seam the differential elision test
 * uses to render the same app on and off in one process.
 * @returns {boolean | undefined}
 */
function elideEnvOverride() {
  const raw = process.env.WEBJS_ELIDE;
  if (raw == null || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  return undefined;
}

/**
 * Read the project-level elision switch.
 * Precedence: the `WEBJS_ELIDE` env override wins when set, otherwise the
 * `package.json` `{ "webjs": { "elide": false } }` switch disables
 * display-only and inert-route elision app-wide (everything ships, like
 * before the feature existed). Any other value, or an absent key, leaves
 * elision enabled (the default). Re-read on every rebuild so toggling
 * either control takes effect without a server restart.
 * @param {string} appDir
 * @returns {Promise<boolean>}
 */
export async function readElideEnabled(appDir) {
  const override = elideEnvOverride();
  if (override !== undefined) return override;
  try {
    const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
    if (pkg && pkg.webjs && pkg.webjs.elide === false) return false;
  } catch {
    // No package.json, malformed JSON, or unreadable. Keep the default.
  }
  return true;
}

/**
 * Read the per-path response-header config (`webjs.headers`) from the
 * app's package.json and compile it to URLPattern rules. A missing,
 * malformed, or unreadable config yields an empty rule set (the secure
 * defaults still apply), never a throw.
 *
 * @param {string} appDir
 * @returns {Promise<ReturnType<typeof compileHeaderRules>>}
 */
export async function readHeaderRules(appDir) {
  try {
    const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
    return compileHeaderRules(pkg);
  } catch {
    return [];
  }
}

/**
 * Read the CSP config (`webjs.csp`) from the app's package.json and
 * normalize it (issue #233). A missing, malformed, or unreadable config
 * yields a disabled config (no nonce minted, no CSP header), never a
 * throw: a broken security knob must fail closed, not take the app down.
 *
 * @param {string} appDir
 * @returns {Promise<ReturnType<typeof readCspConfig>>}
 */
export async function readCspConfigFromApp(appDir) {
  try {
    const pkg = JSON.parse(await readFile(join(appDir, 'package.json'), 'utf8'));
    return readCspConfig(pkg);
  } catch {
    return readCspConfig(undefined);
  }
}

/**
 * Create a reusable, framework-agnostic request handler for a webjs app.
 * The returned `handle(req)` takes a standard `Request` and resolves to a
 * standard `Response`: suitable for Node http, Deno, Bun, Cloudflare Workers,
 * or embedding inside an Express/Fastify app.
 *
 * @param {{
 *   appDir: string,
 *   dev?: boolean,
 *   logger?: import('./logger.js').Logger,
 *   onReload?: () => void,
 * }} opts
 */
export async function createRequestHandler(opts) {
  const appDir = resolve(opts.appDir);
  // Load <appDir>/.env into process.env BEFORE anything else.
  // buildActionIndex below imports server-only files (lib/*.server.ts,
  // modules/**/*.server.ts), some of which read process.env at module
  // init (e.g. createAuth reads AUTH_SECRET). Without this call,
  // scaffolded apps with a committed .env.example + .env would fail
  // to boot until the user discovered the missing env-load. See
  // tracker #37.
  loadAppEnv(appDir);
  const dev = !!opts.dev;
  const logger = opts.logger || defaultLogger({ dev });
  const coreDir = locateCoreDir(appDir);
  // Switch the importmap between dist/ bundles and src/ per-file
  // URLs depending on whether the resolved @webjsdev/core install
  // has built bundles on disk. npm-installed copies always do;
  // workspace dev does only after `npm run build:dist`. Without
  // a built dist the server falls back to the historical per-file
  // src/ URLs so dev iteration does not require a build step.
  //
  // Both required bundles must exist. An older @webjsdev/core
  // install built BEFORE the browser-entry split (#119/#128) has
  // `webjs-core.js` but no `webjs-core-browser.js`. Enabling dist
  // mode in that case would route the bare `@webjsdev/core`
  // specifier at a 404 on every page. Require both so a partial
  // dist transparently degrades to src/ mode instead.
  const distDir = join(coreDir, 'dist');
  const distComplete =
    existsSync(join(distDir, 'webjs-core.js')) &&
    existsSync(join(distDir, 'webjs-core-browser.js'));
  await setCoreInstall(coreDir, distComplete);

  // When an app commits a vendor pin (.webjs/vendor/importmap.json) it carries a
  // deterministic vendor map that is cheap to read (one file, no analysis, no
  // network). Resolve it AT BOOT and publish the build id immediately so the
  // process advertises a stable, non-empty id from its very first response: a
  // freshly-deployed pinned process is detected as a new deploy by old-deploy
  // clients with zero warmup window. Mirrors Rails importmap (committed pins
  // rendered deterministically at runtime). Pinning stays optional; an unpinned
  // app does no vendor work at boot and publishes its id after the first
  // successful resolve instead. Either way the EXPENSIVE analysis (graph, scan,
  // gate, elision) and the UNPINNED jspm resolve stay deferred to the first
  // request, so #143's win is intact; only the cheap committed-file read moves
  // back to boot, and only when a VALID pin exists. A committed pin file is
  // served as-is (elision never prunes it), so the boot-resolved map equals the
  // final served map and the published id is authoritative.
  //
  // Validate the pin with readPinFile BEFORE treating the app as pinned-at-boot.
  // hasVendorPin is a cheap existence check; a malformed pin (exists but
  // unparseable) must NOT short-circuit here, because resolveVendorImports would
  // then fall through to its bare-import scan thunk, and the boot-time thunk is
  // empty (the real scan is part of the deferred analysis). A broken pin instead
  // falls through to the normal deferred resolve, which carries the real scan
  // thunk and degrades gracefully, exactly as an unpinned app does.
  let bootVendorPinned = false;
  if (hasVendorPin(appDir) && (await readPinFile(appDir))) {
    try {
      const v = await resolveVendorImports(appDir, () => new Set());
      await setVendorEntries(v.imports, v.integrity);
      publishBuildId();
      bootVendorPinned = true;
    } catch (e) {
      // An unexpected failure applying a VALID pin (e.g. setVendorEntries
      // throwing) is non-fatal: leave bootVendorPinned false so the deferred
      // resolve re-attempts on the first request. Boot stays resilient.
      logger.error?.(`[webjs] applying the committed vendor pin at boot failed (will retry on the first request):`, e);
    }
  }

  // Whole-app analysis (module graph, component scan, browser-bound gate,
  // action index, middleware, elision, vendor) is NOT run at boot. It is
  // computed on the first request via ensureReady() below and memoized, so the
  // server starts without walking or reading the app's source, executing any
  // server module, or hitting the network. Only the route table is built
  // eagerly: it is a cheap directory scan (no code reads), and routing, Early
  // Hints, and WebSocket lookups need it available before the first request.
  const routeTable = await buildRouteTable(appDir);

  // Per-path response-header rules (issue #232), read once from the
  // app's package.json `webjs.headers`. Static config, so no rebuild
  // re-read; the secure defaults need no config and apply regardless.
  const headerRules = await readHeaderRules(appDir);

  // CSP config (issue #233), read once from the app's package.json
  // `webjs.csp`. OFF by default: when disabled no nonce is minted and no
  // Content-Security-Policy header is set, so an unconfigured app is
  // unchanged. When enabled, `handle()` mints a fresh per-request nonce,
  // makes it the value `cspNonce()` returns (so the SSR'd inline scripts
  // carry it), and sets the matching header carrying the same nonce.
  const cspConfig = await readCspConfigFromApp(appDir);

  const state = {
    routeTable,
    actionIndex: null,
    middleware: null,
    logger,
    moduleGraph: null,
    elidableComponents: new Set(),
    inertRouteModules: new Set(),
    browserBoundFiles: null,
    // Transformed-source cache (stripped TS + applied elision). Per-handler,
    // NOT module-global: the cached bytes bake in THIS handler's elision
    // verdict, so two handlers for the same app with different elision
    // settings (a multi-tenant embedder, or the differential elision test)
    // must not share it, or the second would serve the first's elided source.
    tsCache: new Map(),
  };

  // All whole-app analysis is built lazily on the first request, memoized so
  // boot does none of it. It runs in two stages. The deterministic analysis
  // (module graph, component scan + prime, browser-bound gate, action index,
  // middleware, elision) is network-free and, once built, never re-runs unless
  // a rebuild invalidates it; readiness gates on it. Vendor resolution is a
  // SEPARATE, best-effort stage: a pinned app reads a committed importmap file,
  // an unpinned app auto-fetches from jspm. It does NOT gate readiness, so an
  // offline or partially-unresolvable app still boots. A transient vendor
  // failure is re-attempted on the NEXT ensureReady call (driven by an incoming
  // request, a readiness probe, or the warm-up), with no background timer: the
  // platform's traffic and probes are the retry loop. `readyError` holds a
  // propagating analysis failure so /__webjs/ready can report it.
  let analysisDone = false;        // deterministic analysis complete (readiness gate)
  // A pinned app applied its FULL vendor map and published the build id at boot
  // (above). The deferred vendor stage still runs once (and after every rebuild)
  // to PRUNE that map to the elision-reachable specifiers, so a pinned app serves
  // the same map an unpinned one does (#197); it does not re-publish the build id
  // (the boot hash stays the deploy fingerprint). An unpinned app starts false and
  // resolves live on the first request.
  let vendorResolved = false;      // vendor map fully resolved/pruned (or permanently tolerated)
  let vendorAttemptedOnce = false; // the first (blocking) vendor attempt has run
  let vendorGen = 0;               // bumped on rebuild; a stale resolve cannot flip vendorResolved
  let readyDone = false;           // mirrors analysisDone; the /__webjs/ready gate
  /** @type {unknown} */
  let readyError = null;
  /** @type {Promise<void> | null} */
  let readyInFlight = null;
  async function ensureReady() {
    // Fully warm: analysis done and vendor resolved. Nothing to do.
    if (analysisDone && vendorResolved) return;
    // A warm pass is in flight (the analysis and/or the FIRST vendor attempt).
    // Await it rather than serving past it: a concurrent early request must get
    // the FINAL importmap, never a half-resolved one. This is what makes the
    // unpinned warmup flawless. The first attempt's jspm resolve is
    // timeout-bounded (vendor.js), so an offline app cannot hang here: on
    // timeout the resolve returns and the response is served with an empty,
    // reload-safe build id, then the retry below completes it. Without this
    // wait, a request arriving mid-resolve would serve a partial map and an
    // empty-then-changing build id, the exact warmup drift that hard-reloads
    // and wipes a half-filled form.
    if (readyInFlight) { await readyInFlight; return; }
    // Analysis warm but the first vendor attempt already completed and failed:
    // re-attempt WITHOUT blocking this request. The single-flight dedupes
    // concurrent attempts; success flips the flag AND publishes the build id.
    // This is the request/probe-driven retry (no timer). Until it succeeds the
    // served build id stays empty (reload-safe), so no navigation hard-reloads.
    if (analysisDone && vendorAttemptedOnce) {
      const gen = vendorGen;
      resolveAndApplyVendor().then((ok) => { if (ok && gen === vendorGen) { vendorResolved = true; if (!bootVendorPinned) publishBuildId(); } }).catch(() => {});
      return;
    }
    // Otherwise run the (single-flighted) full warm: the analysis, then the
    // first vendor attempt, awaited so the first response carries the import map.
    if (!readyInFlight) {
      readyInFlight = (async () => {
        /** @type {Record<string, number>} */
        const t = {};
        let ranAnalysis = false, ranVendor = false;
        const now = () => performance.now();
        try {
          if (!analysisDone) {
            let m = now();
            state.moduleGraph = await buildModuleGraph(appDir);
            t.graph = now() - m; m = now();
            const components = await scanComponents(appDir);
            await primeComponentRegistry(appDir, components);
            t.scan = now() - m; m = now();
            state.browserBoundFiles = computeBrowserBoundFiles(state.routeTable, state.moduleGraph, components, appDir);
            t.gate = now() - m; m = now();
            state.actionIndex = await buildActionIndex(appDir, dev);
            t.actions = now() - m; m = now();
            state.middleware = await loadMiddleware(appDir, dev, logger);
            t.middleware = now() - m; m = now();
            const r = (await readElideEnabled(appDir))
              ? await analyzeElision(components, collectRouteModules(state.routeTable),
                  state.moduleGraph, (f) => readFile(f, 'utf8'), appDir)
              : { elidableComponents: new Set(), inertRouteModules: new Set() };
            state.elidableComponents = r.elidableComponents;
            state.inertRouteModules = r.inertRouteModules;
            t.elision = now() - m;
            if (dev) {
              for (const { className, file } of await findOrphanComponents(appDir)) {
                logger.warn?.(
                  `[webjs] ${className} extends WebComponent but has no customElements.define(...) call in ${file}. ` +
                    `Add \`customElements.define('<tag-name>', ${className});\` or <${kebab(className)}> tags won't upgrade.`,
                );
              }
            }
            analysisDone = true;
            ranAnalysis = true;
          }
          readyError = null;
          if (!vendorResolved) {
            const m = now();
            const gen = vendorGen;
            vendorAttemptedOnce = true;
            const ok = await resolveAndApplyVendor();
            t.vendor = now() - m;
            ranVendor = true;
            // Only memoize success (and only if a rebuild didn't intervene). A
            // transient failure leaves vendorResolved false; the next ensureReady
            // call re-attempts it non-blocking. A permanent unresolvable (jspm
            // 401) reports ok and is tolerated, so it does not loop. On success
            // the importmap is now authoritatively final, so publish the build
            // id: from here every response advertises the same stable value and
            // the client router's deploy detection works without warmup drift.
            // A pinned app published the build id at boot (hash of the committed
            // pin) and the prune only shrinks the served map, so do NOT re-publish
            // (that would drift the id mid-process). An unpinned app publishes its
            // now-final live map here.
            if (ok && gen === vendorGen) { vendorResolved = true; if (!bootVendorPinned) publishBuildId(); }
          }
          // Readiness reflects a FULLY warm instance: the deterministic analysis
          // AND the first vendor attempt have both completed (note: completed,
          // not necessarily succeeded). A readiness-gated platform (Railway
          // healthcheckPath, k8s readinessProbe) therefore admits traffic only
          // AFTER the build id is published (vendor resolved) or definitively
          // empty (a bounded vendor failure), never DURING the vendor-resolution
          // window. This is what makes warm-up actually protect users: the prior
          // instance keeps serving until the new one is fully warm, so a real
          // request lands on a warm instance with a stable build id instead of
          // racing the resolve. The first vendor attempt is bounded (the jspm
          // fetch timeout in vendor.js), so an offline / CDN-degraded app still
          // becomes ready shortly after that timeout, degraded but reload-safe,
          // which preserves the boot resilience #143 introduced. The gate is the
          // FIRST attempt only: a transient failure still flips readyDone here,
          // so a later non-blocking retry never has to re-open the readiness gate.
          readyDone = true;
          if (ranAnalysis) {
            const ms = (x) => Math.round(x || 0);
            const total = ms(t.graph) + ms(t.scan) + ms(t.gate) + ms(t.actions) + ms(t.middleware) + ms(t.elision) + ms(t.vendor);
            logger.info?.(
              `[webjs] analysis warm in ${total}ms (graph ${ms(t.graph)}, scan ${ms(t.scan)}, ` +
                `gate ${ms(t.gate)}, actions ${ms(t.actions)}, middleware ${ms(t.middleware)}, ` +
                `elision ${ms(t.elision)}, vendor ${ms(t.vendor)})`,
            );
          } else if (ranVendor && vendorResolved) {
            logger.info?.(`[webjs] vendor resolved in ${Math.round(t.vendor || 0)}ms`);
          }
        } catch (e) {
          readyError = e;
          throw e;
        } finally {
          readyInFlight = null;
        }
      })();
    }
    await readyInFlight;
  }

  // All vendor resolves funnel through one single-flight so two never overlap
  // (resolveVendorImports reports a transient failure via a module-global flag
  // that only one in-flight resolve may safely touch). Never rejects; returns
  // the resolve's ok flag (false on a transient failure, applying whatever
  // partial map resolved so the app is no worse off).
  /** @type {Promise<boolean> | null} */
  let vendorResolveInFlight = null;
  function resolveAndApplyVendor() {
    if (vendorResolveInFlight) return vendorResolveInFlight;
    vendorResolveInFlight = (async () => {
      try {
        const scan = () => scanBareImports(appDir, new Set([...state.elidableComponents, ...state.inertRouteModules]));
        const v = await resolveVendorImports(appDir, scan);
        let { imports, integrity } = v;
        if (bootVendorPinned) {
          // resolveVendorImports returns a committed pin VERBATIM (it never runs
          // the scan for a pinned app). Prune it to the elision-reachable
          // specifiers so a pinned app serves the same map an unpinned one does
          // (#197): an elided-only dep like dayjs is dropped. One scan; the pin
          // path skipped it. This runs on the first warm AND after every rebuild,
          // so the pruned map is the single source of truth.
          const reachable = await scan();
          ({ imports, integrity } = prunePinToReachable(imports, integrity, reachable));
        }
        await setVendorEntries(imports, integrity);
        return v.ok;
      } catch (e) {
        logger.error?.(`[webjs] vendor resolve failed (will retry on the next request):`, e);
        return false;
      }
    })().finally(() => { vendorResolveInFlight = null; });
    return vendorResolveInFlight;
  }

  // Optional app-level readiness check. A `readiness.{js,ts}` file at the app
  // root may default-export an async function; /__webjs/ready runs it once the
  // analysis is warm, so readiness can reflect LIVE dependency health (a DB
  // ping, a queue connection) that the static analysis cannot see. Returning
  // false or throwing reports the instance not ready (503), so a readinessProbe
  // holds traffic off an instance whose deps are down. Absent file => analysis-
  // warm is the only gate. The module is cached per build (cleared on rebuild);
  // the function itself runs on every probe so it reflects current state.
  let readinessFn; // undefined = unloaded, null = no file, function = loaded
  async function getReadinessCheck() {
    if (readinessFn !== undefined) return readinessFn;
    let file = null;
    for (const name of ['readiness.ts', 'readiness.js', 'readiness.mts', 'readiness.mjs']) {
      const p = join(appDir, name);
      if (await exists(p)) { file = p; break; }
    }
    if (!file) { readinessFn = null; return null; }
    try {
      const url = pathToFileURL(file).toString();
      const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
      const mod = await import(url + bust);
      readinessFn = typeof mod.default === 'function' ? mod.default : null;
    } catch (e) {
      logger.error?.(`[webjs] failed to load readiness.{js,ts}`, { err: String(e) });
      readinessFn = null;
    }
    return readinessFn;
  }

  // Rebuilds are serialized so a slow rebuild #1 cannot overwrite a fresher
  // rebuild #2's route table when it finally finishes. Without this, two file
  // edits inside one fs.watch debounce window could produce a permanently
  // stale state until the next rebuild.
  let rebuildInFlight = Promise.resolve();

  async function rebuild() {
    rebuildInFlight = rebuildInFlight.then(() => doRebuild()).catch((e) => {
      logger.error?.(`[webjs] rebuild failed:`, e);
    });
    return rebuildInFlight;
  }

  async function doRebuild() {
    // The route table is the only eager artifact (cheap directory scan); rebuild
    // it so routing reflects added/removed route files immediately.
    state.routeTable = await buildRouteTable(appDir);
    clearVendorCache();
    state.tsCache.clear();
    // Invalidate the lazy analysis; the next request rebuilds the graph,
    // component scan, gate, action index, middleware, elision, and vendor map.
    // Wait out any in-flight build first so it cannot commit stale results
    // after the reset. A dependency edit can flip an elision verdict without
    // changing an importer's mtime, hence the state.tsCache.clear above.
    if (readyInFlight) { try { await readyInFlight; } catch {} }
    // Bump the vendor generation so a vendor resolve still in flight from the
    // previous build cannot flip vendorResolved against the fresh state.
    vendorGen++;
    analysisDone = false;
    vendorResolved = false;
    vendorAttemptedOnce = false;
    readyDone = false;
    readyError = null;
    readinessFn = undefined; // reload readiness.{js,ts} after a rebuild
    opts.onReload?.();
  }

  /** @param {Request} req */
  function handle(req) {
    return withRequest(req, async () => {
      // CSP (issue #233): when enabled, mint a fresh CSPRNG nonce and store
      // it on the request scope BEFORE producing the response, so the SSR
      // pipeline's `cspNonce()` reads this exact value and stamps it on the
      // inline boot script, the importmap, and the modulepreload hints.
      // Disabled by default, so no nonce is minted and the response is
      // unchanged. One minted value flows mint -> store -> SSR -> header.
      const nonce = cspConfig.enabled ? mintNonce() : '';
      if (nonce) setCspNonce(nonce);

      const res = await produce(req);
      // Merge in the secure-by-default headers plus the per-path config
      // (issue #232) as the final step, so app middleware, route
      // handlers, and `expose` headers (already on `res`) always win.
      // Applied to every served response (documents, assets, the core
      // runtime, probes), since the defaults are universally safe.
      let pathname = '/';
      try { pathname = new URL(req.url).pathname; } catch { /* keep default */ }
      const merged = applySecurityHeaders(res, {
        pathname,
        https: webRequestIsHttps(req),
        prod: !dev,
        rules: headerRules,
      });
      // Emit the Content-Security-Policy header carrying the SAME minted
      // nonce the SSR'd scripts got (no drift). Set only when CSP is
      // enabled; never clobber a CSP header the app already set (in
      // middleware, a route handler, or via the webjs.headers config), so
      // an explicit app policy still wins.
      if (nonce && !merged.headers.has('content-security-policy') &&
          !merged.headers.has('content-security-policy-report-only')) {
        merged.headers.set(cspHeaderName(cspConfig), buildCspHeader(cspConfig, nonce));
      }
      return merged;
    });
  }

  /** @param {Request} req */
  function produce(req) {
    return (async () => {
      // Health and readiness probes are answered BEFORE ensureReady so a probe
      // never blocks on the analysis. `/__webjs/health` is liveness (the
      // process is up and accepting connections). `/__webjs/ready` is 503 until
      // the instance is FULLY warm (the deterministic analysis AND the first
      // vendor attempt have both completed, so the importmap build id is
      // settled), then 200 unless an optional app readiness check
      // (readiness.{js,ts}) reports a dependency down. So a readinessProbe holds
      // traffic off a not-yet-warm or dependency-unhealthy instance, and admits
      // it only once the build id is stable, never mid vendor-resolution.
      // Probing `/__webjs/ready` also kicks off the warm in the background, so
      // an embedder that never called warmup() still warms. The first vendor
      // attempt is bounded (the jspm fetch timeout), so a vendor CDN failure
      // delays readiness only briefly and then admits the instance (degraded but
      // reload-safe); a transient failure is re-attempted on the next request.
      let probePath;
      try { probePath = new URL(req.url).pathname; } catch { probePath = ''; }
      if (probePath === '/__webjs/health') {
        return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
      }
      if (probePath === '/__webjs/ready') {
        const noStore = { 'cache-control': 'no-store' };
        if (!readyDone) {
          ensureReady().catch(() => {}); // drive the warm; never block the probe
          const body = readyError
            ? { status: 'error', error: String((readyError && readyError.message) || readyError) }
            : { status: 'pending' };
          return Response.json(body, { status: 503, headers: noStore });
        }
        // Analysis is warm. Consult the optional app readiness check (live
        // dependency health, e.g. a DB ping) if the app provides one.
        const check = await getReadinessCheck();
        if (check) {
          try {
            if ((await check()) === false) {
              return Response.json({ status: 'unready' }, { status: 503, headers: noStore });
            }
          } catch (e) {
            return Response.json(
              { status: 'unready', error: String((e && e.message) || e) },
              { status: 503, headers: noStore },
            );
          }
        }
        return Response.json({ status: 'ok' }, { headers: noStore });
      }
      // Framework-internal static assets (the @webjsdev/core runtime, the dev
      // reload client, downloaded vendor bundles) depend on neither the analysis
      // nor the vendor importmap, so serve them BEFORE ensureReady(). Otherwise a
      // cold instance blocks them behind the first vendor resolve (issue #190),
      // and the core bundle is on every page's boot path, so that stalled first
      // interactivity site-wide. Matched on the decoded path, like handleCore.
      let assetPath = probePath;
      try { assetPath = decodeURIComponent(probePath); } catch { /* keep raw on malformed escape */ }
      const staticResp = await tryServeFrameworkStatic(assetPath, req.method.toUpperCase(), { coreDir, appDir, dev });
      if (staticResp) return staticResp;
      // Build all whole-app analysis on the first request (memoized), before
      // any SSR, module serve, gate check, action dispatch, or middleware runs.
      await ensureReady();
      const next = () => handleCore(req, { state, appDir, coreDir, dev });
      if (state.middleware) {
        try {
          return await state.middleware(req, next);
        } catch (e) {
          logger.error('middleware threw', { err: String(e) });
          return new Response('Server error', { status: 500 });
        }
      }
      return next();
    })();
  }

  /**
   * Lightweight lookup used by the HTTP layer to emit 103 Early Hints
   * BEFORE running SSR: resolves a pathname to its page-route module URLs
   * without loading them. Returns null for non-page paths.
   *
   * @param {string} pathname
   */
  function routeFor(pathname) {
    const page = matchPage(state.routeTable, pathname);
    if (!page) return null;
    const moduleUrls = [page.route.file, ...page.route.layouts].map((f) => {
      let rel = f.startsWith(appDir) ? f.slice(appDir.length) : f;
      return rel.split('\\').join('/').replace(/^\/?/, '/');
    });
    return { moduleUrls };
  }

  return {
    handle,
    rebuild,
    routeFor,
    /**
     * Proactively run the first-request analysis (module graph, component
     * scan, gate, action index, middleware, elision, vendor map) in the
     * background, so a real first request finds it already memoized. Safe to
     * call any number of times and concurrently: the work is single-flighted,
     * so this never duplicates it or races a real request. It is a single
     * best-effort kick: errors are caught and logged rather than thrown (a
     * background warm-up must not crash the process), and whatever failed simply
     * re-runs on the next request or readiness probe (the platform's traffic and
     * probes are the retry loop, so there is no internal backoff). `startServer`
     * calls this once the HTTP server is listening; embedders can call it after
     * their own listen.
     * @returns {Promise<void>}
     */
    warmup: () => ensureReady().catch((e) => logger.error?.(`[webjs] background warm-up failed (will retry on the next request):`, e)),
    /** current route table getter: used by the WebSocket subsystem */
    getRouteTable: () => state.routeTable,
    appDir,
    dev,
    logger,
  };
}

/**
 * Start a webjs HTTP server. Thin wrapper around `createRequestHandler`.
 *
 * Speaks plain HTTP/1.1. TLS termination + HTTP/2 to the browser is
 * expected to be handled by a reverse proxy (PaaS edge, nginx, Caddy,
 * etc.) sitting in front of this process. See the deployment docs for
 * the recommended topology.
 *
 * @param {{
 *   appDir: string,
 *   port?: number,
 *   dev?: boolean,
 *   compress?: boolean,
 *   logger?: import('./logger.js').Logger,
 * }} opts
 */
export async function startServer(opts) {
  const dev = !!opts.dev;
  const port = opts.port ?? 8080;
  // Compression default: on in prod, off in dev (cheaper to debug raw bytes).
  const compress = opts.compress ?? !dev;
  const logger = opts.logger || defaultLogger({ dev });

  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set();
  const app = await createRequestHandler({
    ...opts,
    logger,
    onReload: () => {
      for (const res of sseClients) {
        try { res.write(`event: reload\ndata: now\n\n`); } catch {}
      }
    },
  });

  /** @type {AbortController | null} */
  let watcherAbort = null;
  if (dev) {
    // Watch the app root recursively via Node's built-in
    // `fs.promises.watch`. Stable on macOS, Windows, and Linux as of
    // Node 24. No external dep needed.
    //
    // fs.watch returns relative paths in event.filename. We apply
    // the same ignore filter chokidar used before: skip
    // node_modules, .git, and prisma's dev artefacts (dev.db,
    // dev.db-journal, migrations/) which the dev server writes
    // during db:migrate and would otherwise loop.
    //
    // The prisma branch uses prefix-only matching (no required
    // trailing separator) so the SQLite sidecar files like
    // `prisma/dev.db` and `prisma/dev.db-journal` are ignored too.
    // node_modules / .git stay separator-anchored so unrelated
    // names like `node_modules.bak/foo` don't get caught.
    const IGNORE = /(?:^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)|(?:^|[\\/])prisma[\\/](?:dev|migrations)/;
    const rebuild = debounce(() => app.rebuild(), 80);
    watcherAbort = new AbortController();
    (async () => {
      try {
        const events = fsWatch(app.appDir, { recursive: true, signal: watcherAbort.signal });
        for await (const event of events) {
          const filename = event.filename || '';
          if (IGNORE.test(filename)) continue;
          rebuild();
        }
      } catch (err) {
        if (err && /** @type any */(err).name !== 'AbortError') {
          logger.warn({ err }, 'file watcher exited');
        }
      }
    })();
  }

  // SSE keepalive: send a comment frame every 25s to defeat proxy idle timeouts.
  // Cheap (no event listeners on the client side) and safe: comments are ignored.
  const keepalive = setInterval(() => {
    for (const res of sseClients) {
      try { res.write(`: ka\n\n`); } catch {}
    }
  }, 25_000);
  keepalive.unref();

  const server = makeHttpServer(async (req, res) => {
    try {
      const url = urlFromRequest(req);

      // SSE: handled specially; doesn't fit the req→Response model.
      if (url.pathname === '/__webjs/events') {
        if (!dev) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.write(`event: hello\ndata: webjs\n\n`);
        sseClients.add(res);
        res.socket?.on('close', () => sseClients.delete(res));
        return;
      }

      // 103 Early Hints: before running SSR, send preload hints for the
      // page's module URLs so the browser can begin fetching them while
      // the server is still computing the body. Skipped in dev (file churn
      // would send stale URLs after rebuilds) and for non-GET/HEAD.
      if (
        !dev &&
        (req.method === 'GET' || req.method === 'HEAD') &&
        typeof res.writeEarlyHints === 'function'
      ) {
        const match = app.routeFor(url.pathname);
        if (match && match.moduleUrls.length) {
          try {
            res.writeEarlyHints({
              link: match.moduleUrls.map((u) => `<${u}>; rel=modulepreload`),
            });
          } catch (e) {
            logger.warn('writeEarlyHints failed', { err: String(e) });
          }
        }
      }

      const webReq = toWebRequest(req, url);
      const resp = await app.handle(webReq);
      await sendWebResponse(res, resp, req, { compress });
    } catch (e) {
      logger.error('request pipeline threw', { err: e instanceof Error ? e.stack : String(e) });
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(dev && e instanceof Error ? `webjs error: ${e.stack}` : 'Internal server error');
    }
  });

  // WebSocket upgrade handling: any route.js that exports `WS` becomes a
  // WebSocket endpoint at its URL.
  attachWebSocket(server, () => app.getRouteTable(), { dev, logger });

  server.listen(port, () => {
    logger.info(`webjs ${dev ? 'dev' : 'prod'} server ready on http://localhost:${port}`);
    // The server is now accepting connections; warm the first-request analysis
    // in the background so a real first request finds it memoized. Fire-and-
    // forget: listening (and thus readiness probes / load-balancer health) does
    // not wait on it, and a failure here does not bring the process down.
    app.warmup();
  });

  const shutdown = gracefulShutdown(server, sseClients, logger);
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Catch-all process handlers: log, but don't tear the process down on a
  // single mishandled promise. Uncaught exceptions are different: state may be
  // corrupted, so log + start an orderly shutdown rather than continuing.
  installProcessHandlers(logger, () => shutdown('uncaughtException'));

  return {
    server,
    close: () => new Promise((r) => {
      if (watcherAbort) watcherAbort.abort();
      server.close(() => r());
    }),
  };
}

/**
 * The core request → response pipeline, minus middleware.
 * @param {Request} req
 * @param {{state: any, appDir: string, coreDir: string, dev: boolean}} ctx
 */
/**
 * Serve framework-internal static assets that depend on NEITHER the whole-app
 * analysis NOR the vendor importmap: the `@webjsdev/core` runtime files, the
 * dev reload client, and (in `--download` pin mode) the committed vendor
 * bundles. `handle()` calls this BEFORE `ensureReady()`, so a cold instance
 * returns them immediately instead of blocking on the first vendor resolve
 * (issue #190). The core bundle is on every page's boot path, so coupling it
 * to the jspm resolve stalled first interactivity site-wide on a cold instance.
 *
 * Like the health / readiness probes (also answered pre-`ensureReady`), these
 * bypass app middleware. That is correct: they are framework infrastructure the
 * app needs to function, not app routes, and `state.middleware` is not even
 * loaded until `ensureReady()` completes.
 *
 * @param {string} path decoded pathname
 * @param {string} method upper-cased HTTP method
 * @param {{ coreDir: string, appDir: string, dev: boolean }} ctx
 * @returns {Promise<Response|null>} a Response, or null when path is not one of these assets
 */
async function tryServeFrameworkStatic(path, method, ctx) {
  const { coreDir, appDir, dev } = ctx;

  // Dev live-reload client.
  if (path === '/__webjs/reload.js') {
    if (!dev) return new Response('Not found', { status: 404 });
    return new Response(RELOAD_CLIENT_JS, {
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }

  // Core module: /__webjs/core/*
  //
  // ETag + ~1h max-age, NOT immutable. The URL path is un-versioned
  // (`/__webjs/core/src/render-client.js` etc.), so bumping `@webjsdev/core`
  // ships different bytes at the same URL. An `immutable` cache-control
  // directive at an edge CDN (Cloudflare, Vercel, Fly) keeps the prior bytes
  // pinned for up to a year, which silently bricks the next deploy: browsers
  // load the old client renderer against a server emitting the new SSR shape,
  // and any exports added in the bump (e.g., the slot.js entry points landed
  // for 0.6.0) resolve to undefined in the cached file.
  // Regression: 2026-05-20, ui.webjs.dev tier-2 components after
  // @webjsdev/core 0.5.0 -> 0.6.0 republish.
  if (path.startsWith('/__webjs/core/')) {
    const rel = path.slice('/__webjs/core/'.length);
    const abs = resolve(coreDir, rel);
    // Trailing-separator boundary check, not a raw string prefix: a raw
    // `startsWith(coreDir)` would admit a sibling like `@webjsdev/core-evil`,
    // reachable via an encoded slash (`..%2f`, which survives URL normalization
    // and then decodes to `../`). Match the public-root branch's guard.
    if (abs !== coreDir && !abs.startsWith(coreDir + sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return fileResponse(abs, { dev, immutable: false });
  }

  // Vendor URL handler for `webjs vendor pin --download` mode only. In default
  // pin mode (or no-pin mode) the importmap routes bare imports straight to
  // ga.jspm.io URLs and the browser bypasses this server entirely. When the
  // user ran `webjs vendor pin --download`, the importmap has local
  // `/__webjs/vendor/<file>.js` URLs and this serves the committed bundle files
  // from `.webjs/vendor/`. These are read-only static content: allow GET/HEAD
  // for the normal fetch, OPTIONS for any cross-origin preflight (204 with the
  // same Allow header rather than 405, which some intermediaries treat as a
  // hard failure even for a CORS probe), and 405 everything else.
  if (path.startsWith('/__webjs/vendor/') && path.endsWith('.js')) {
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { allow: 'GET, HEAD, OPTIONS' } });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, OPTIONS' } });
    }
    const filename = path.slice('/__webjs/vendor/'.length);
    const resp = await serveDownloadedBundle(filename, appDir, dev);
    if (method === 'HEAD') {
      // HEAD must return same headers as GET with no body.
      return new Response(null, { status: resp.status, headers: resp.headers });
    }
    return resp;
  }

  return null;
}

async function handleCore(req, ctx) {
  const { state, appDir, coreDir, dev } = ctx;
  const url = new URL(req.url);
  // Decode percent-encoded characters so filesystem lookups match real
  // filenames. Dynamic route segments like `[slug]` and route groups like
  // `(marketing)` contain chars that browsers percent-encode in URLs
  // (`%5B`, `%5D`, `%28`, `%29`). Without decoding, the server joins the
  // encoded path with the app directory → file not found → 404 → no JS
  // loads → no interactivity.
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
  const method = req.method.toUpperCase();

  // Health / readiness probes (`/__webjs/health`, `/__webjs/ready`) and the
  // framework-internal static assets (`/__webjs/core/*`, `/__webjs/reload.js`,
  // downloaded `/__webjs/vendor/*`) are served in `handle()` BEFORE ensureReady,
  // so they are not repeated here. This fallback covers the (currently
  // unreachable) case of handleCore being entered for one of those assets, so
  // the routing stays correct if a future caller bypasses the early path.
  const frameworkStatic = await tryServeFrameworkStatic(path, method, { coreDir, appDir, dev });
  if (frameworkStatic) return frameworkStatic;

  // Internal server-action RPC endpoint
  const actMatch = /^\/__webjs\/action\/([a-f0-9]+)\/([A-Za-z0-9_$]+)$/.exec(path);
  if (actMatch) {
    if (method !== 'POST') return new Response('POST only', { status: 405 });
    return invokeAction(state.actionIndex, actMatch[1], actMatch[2], req);
  }

  // expose()d server actions (first-class REST), with optional CORS support.
  if (method === 'OPTIONS') {
    const allAtPath = matchAllAtPath(state.actionIndex, path);
    if (allAtPath.length) {
      const corsRoute = allAtPath.find((r) => r.cors);
      const methods = [...new Set(allAtPath.map((r) => r.method))];
      if (corsRoute) {
        // Preflight: respond with cors headers + the union of methods at this path.
        const preflight = buildPreflightResponse(corsRoute, req);
        const newHeaders = new Headers(preflight.headers);
        newHeaders.set('access-control-allow-methods', `${methods.join(', ')}, OPTIONS`);
        return new Response(null, { status: preflight.status, headers: newHeaders });
      }
      return new Response(null, { status: 204, headers: { allow: `${methods.join(', ')}, OPTIONS` } });
    }
  } else {
    const exposed = matchExposedAction(state.actionIndex, method, path);
    if (exposed) {
      const resp = await invokeExposedAction(state.actionIndex, exposed.route, exposed.params, req);
      return withCors(resp, exposed.route, req);
    }
  }

  // Static: /public/*
  if (path.startsWith('/public/') || path === '/favicon.ico') {
    const p = path === '/favicon.ico' ? '/public/favicon.ico' : path;
    const abs = join(appDir, p);
    // Containment check. `join` normalises `..` segments, so a path
    // like `/public/%2E%2E/secret/x.svg` decodes (after URL parsing,
    // which doesn't touch `%2E`) to `/public/../secret/x.svg` and
    // `join(appDir, ...)` resolves it to `appDir/secret/x.svg`. The
    // resulting `abs` could be inside `appDir` but OUTSIDE `appDir/
    // public/`, exposing files the user reasonably thought were
    // private under their non-public directories. Reject anything
    // that doesn't stay under `appDir/public/` (and the favicon
    // exception, which is already validated above).
    const publicRoot = join(appDir, 'public') + sep;
    if (!abs.startsWith(publicRoot)) {
      return new Response(null, { status: 404 });
    }
    if (await exists(abs)) return fileResponse(abs, { dev, immutable: false });
  }

  // User source modules (served as ES modules, with action-file rewriting).
  //
  // Authorization gate: only files reachable from a browser-bound entry
  // (page, layout, error, loading, not-found, component) via the module
  // graph are servable. Same posture as Next.js, where the bundler's
  // manifest is the source of truth for what the browser may fetch.
  // Anything not in the set (node_modules/, top-level package.json,
  // scripts/, etc.) 404s here regardless of whether the file exists on
  // disk. The `.server.{js,ts}` stub guardrail runs below as a
  // defense-in-depth layer.
  if (method === 'GET' && /\.(js|mjs|ts|mts|css|svg|png|jpg|jpeg|gif|webp|json|ico|txt)$/.test(path)) {
    let abs = join(appDir, path);
    // When the browser asks for `.js`, allow falling through to a sibling
    // `.ts` (the TypeScript-with-"allowImportingTsExtensions: false" pattern).
    if (!(await exists(abs)) && /\.js$/.test(abs)) {
      const tsAbs = abs.replace(/\.js$/, '.ts');
      if (await exists(tsAbs)) abs = tsAbs;
      else {
        const mtsAbs = abs.replace(/\.js$/, '.mts');
        if (await exists(mtsAbs)) abs = mtsAbs;
      }
    }
    // Gate: must be in the browser-bound module graph. Server-action
    // files (.server.{js,ts}) get a stub via the guardrail below; they
    // ARE included in browserBoundFiles because client code imports
    // them by path (the import rewrites to an RPC stub at request time).
    const inGraph = state.browserBoundFiles && state.browserBoundFiles.has(abs);
    if (abs.startsWith(appDir) && inGraph && (await exists(abs))) {
      // Server-file guardrail: a file matching `.server.{js,ts,mjs,mts}`
      // MUST NEVER be served as source to the browser. The extension is
      // the path-level boundary; we re-verify it on every request (not
      // just rely on the action-index snapshot, which is built on the first
      // request and refreshed on rebuild) so files created later, FS races,
      // or developer error never punch through.
      //
      // What the browser gets depends on the file's `'use server'` status:
      //   - With `'use server'` => server action: a generated RPC stub
      //     whose exports POST to /__webjs/action/:hash/:fn.
      //   - Without `'use server'` => server-only utility: a stub that
      //     throws at module load with a clear error. The file's source
      //     never reaches the browser either way.
      if (isServerFile(abs)) {
        if (await hasUseServerDirective(abs)) {
          // Lazily ensure the index knows about this file so serveActionStub
          // can mint a stable hash and function list.
          if (!state.actionIndex.fileToHash.has(abs)) {
            const h = await hashFile(abs);
            state.actionIndex.fileToHash.set(abs, h);
            state.actionIndex.hashToFile.set(h, abs);
          }
          const stub = await serveActionStub(state.actionIndex, abs);
          return new Response(stub, {
            headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
          });
        }
        const relPath = relative(appDir, abs);
        const stub = serveServerOnlyStub(relPath);
        return new Response(stub, {
          headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      // TypeScript source: strip types via Node 24+'s built-in, cache by mtime.
      // Both module paths also strip side-effect imports of display-only
      // components so the browser never downloads their JS.
      const elideOpts = {
        moduleGraph: state.moduleGraph,
        elidableComponents: state.elidableComponents,
        appDir,
      };
      if (/\.m?ts$/.test(abs)) {
        return tsResponse(abs, dev, elideOpts, state.tsCache);
      }
      if (/\.m?js$/.test(abs)) {
        return jsModuleResponse(abs, dev, elideOpts);
      }
      return fileResponse(abs, { dev, immutable: false });
    }
  }

  // Metadata routes: /sitemap.xml, /robots.txt, /icon, /opengraph-image, etc.
  if (method === 'GET' && state.routeTable.metadataRoutes) {
    const meta = state.routeTable.metadataRoutes.find((r) => r.urlPath === path);
    if (meta) {
      try {
        const mod = await import(pathToFileURL(meta.file).toString() + (dev ? `?t=${Date.now()}` : ''));
        if (mod.default) {
          const result = await mod.default();
          // If the function returns a Response, use it directly.
          if (result instanceof Response) return result;
          // If it returns a string, determine content type from the URL path.
          const ct = path.endsWith('.xml') ? 'application/xml; charset=utf-8'
            : path.endsWith('.txt') ? 'text/plain; charset=utf-8'
            : path.endsWith('.json') ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
          return new Response(typeof result === 'string' ? result : JSON.stringify(result), {
            headers: { 'content-type': ct, 'cache-control': dev ? 'no-cache' : 'public, max-age=3600' },
          });
        }
      } catch (e) {
        if (dev) console.error(`[webjs] metadata route error (${meta.stem}):`, e);
        return new Response('Internal error', { status: 500 });
      }
    }
  }

  // API route (route.js handler)
  const api = matchApi(state.routeTable, path);
  if (api) {
    const handler = () => handleApi(api.route, api.params, req, dev);
    return runWithSegmentMiddleware(req, api.route.middlewares, handler, dev);
  }

  // Page route. GET/HEAD render the page. A NON-GET/HEAD method (POST/PUT/…)
  // is only routed here when the page module exports an `action` (#244); the
  // action runs inside the page's segment middleware, then either PRG-redirects
  // (303) on success, re-renders the same page (422) with field errors on
  // failure, or honors a thrown redirect()/notFound(). Without an `action`
  // export, a non-GET/HEAD request falls through to the 404 below, unchanged.
  {
    const page = matchPage(state.routeTable, path);
    if (page) {
      const ssrOpts = {
        dev, appDir, moduleGraph: state.moduleGraph,
        serverFiles: state.actionIndex.fileToHash,
        elidableComponents: state.elidableComponents,
        inertRouteModules: state.inertRouteModules,
        notFoundFile: state.routeTable.notFound,
      };
      if (method === 'GET' || method === 'HEAD') {
        const handler = () => ssrPage(page.route, page.params, url, { ...ssrOpts, req });
        return runWithSegmentMiddleware(req, page.route.middlewares, handler, dev);
      }
      const loaded = await loadPageAction(page.route.file, dev);
      if (loaded) {
        const handler = () => runPageAction(page.route, page.params, url, loaded, req, ssrOpts);
        return runWithSegmentMiddleware(req, page.route.middlewares, handler, dev);
      }
    }
  }

  // Fallback: content-negotiated 404
  if (wantsJson(req, path)) {
    return Response.json({ error: 'Not found', path }, { status: 404 });
  }
  return ssrNotFound(state.routeTable.notFound, { dev, appDir, req, url });
}

/** @param {Request} req @param {string} path */
function wantsJson(req, path) {
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  if (path.startsWith('/api/') || path.startsWith('/__webjs/')) return true;
  return false;
}

/**
 * Chain segment-level middleware.js (outermost first) around a handler.
 * Each middleware is `(req, next) => Response`. If any throws, log and 500.
 *
 * @param {Request} req
 * @param {string[]} files   absolute paths of middleware.js files, outermost → innermost
 * @param {() => Promise<Response>} terminal
 * @param {boolean} dev
 */
async function runWithSegmentMiddleware(req, files, terminal, dev) {
  if (!files || !files.length) return terminal();
  const handlers = [];
  for (const f of files) {
    try {
      const url = pathToFileURL(f).toString();
      const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
      const mod = await import(url + bust);
      if (typeof mod.default === 'function') handlers.push(mod.default);
    } catch {
      // Bad middleware file: skip; top-level error handler will catch real problems.
    }
  }
  let i = 0;
  const next = () => {
    if (i >= handlers.length) return terminal();
    const fn = handlers[i++];
    return fn(req, next);
  };
  return next();
}

/**
 * Load the optional top-level `middleware.js`.
 * @param {string} appDir
 * @param {boolean} dev
 * @param {import('./logger.js').Logger} logger
 */
async function loadMiddleware(appDir, dev, logger) {
  const file = join(appDir, 'middleware.js');
  if (!(await exists(file))) return null;
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  try {
    const mod = await import(url + bust);
    return typeof mod.default === 'function' ? mod.default : null;
  } catch (e) {
    logger.error('failed to load middleware.js', { err: String(e) });
    return null;
  }
}

/**
 * Install signal handlers that stop accepting new connections, close SSE
 * clients, and exit once in-flight requests drain.
 * @param {import('node:http').Server} server
 * @param {Set<import('node:http').ServerResponse>} sseClients
 * @param {import('./logger.js').Logger} logger
 */
/**
 * Create a plain HTTP/1.1 server. webjs deploys are expected to sit
 * behind a reverse proxy (PaaS edge, nginx, Caddy, etc.) that handles
 * TLS termination and speaks HTTP/2 to clients: Node's http2 module
 * doesn't need to be involved on the framework side.
 *
 * @param {(req: any, res: any) => void} handler
 */
function makeHttpServer(handler) {
  return createHttp1Server(handler);
}

/**
 * Install once-only process error handlers. Idempotent across multiple
 * `startServer` calls in the same process.
 *
 * @param {import('./logger.js').Logger} logger
 * @param {() => void} onFatal
 */
function installProcessHandlers(logger, onFatal) {
  if (/** @type any */ (globalThis).__webjsProcHandlers) return;
  /** @type any */ (globalThis).__webjsProcHandlers = true;
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', {
      err: reason instanceof Error ? reason.stack || reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { err: err.stack || err.message });
    // Begin orderly shutdown; process state may be corrupt.
    try { onFatal(); } catch {}
  });
}

function gracefulShutdown(server, sseClients, logger) {
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal}, shutting down`);
    for (const res of sseClients) {
      try { res.end(); } catch {}
    }
    sseClients.clear();
    server.close((err) => {
      if (err) {
        logger.error('server close error', { err: String(err) });
        process.exit(1);
      }
      logger.info('bye');
      process.exit(0);
    });
    // Hard-fail after 10s if we can't drain.
    setTimeout(() => {
      logger.warn('shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };
}

/* ------------ helpers ------------ */

/** @param {import('node:http').IncomingMessage} req @param {URL} url */
function toWebRequest(req, url) {
  const method = (req.method || 'GET').toUpperCase();
  /** @type {Record<string,string>} */
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    // Drop HTTP/2 pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`).
    // They're parsed separately into req.method / req.url and are rejected
    // by the standard Headers class if we pass them through verbatim.
    if (k.startsWith(':')) continue;
    // Strip any inbound `x-webjs-remote-ip` header so clients cannot
    // spoof the framework-stamped client IP that rate-limit's
    // `clientIp(req, { trustProxy: false })` reads. We rewrite it
    // below from the actual TCP socket. Node's IncomingMessage
    // always lowercases header keys, so a literal compare is enough.
    if (k === 'x-webjs-remote-ip') continue;
    headers[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
  }
  // Stamp the framework-trusted remote IP from the socket. Read by
  // `clientIp(req)` (rate-limit.js) as the bucket key when
  // `trustProxy: false` (the safe default).
  const remoteIp = req.socket?.remoteAddress;
  if (remoteIp) headers['x-webjs-remote-ip'] = remoteIp;
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    body = new ReadableStream({
      start(controller) {
        req.on('data', (chunk) => controller.enqueue(chunk));
        req.on('end', () => controller.close());
        req.on('error', (e) => controller.error(e));
      },
    });
  }
  return new Request(url, /** @type any */ ({ method, headers, body, duplex: 'half' }));
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {Response} webRes
 * @param {import('node:http').IncomingMessage} [req]
 * @param {{ compress?: boolean }} [opts]
 */
async function sendWebResponse(res, webRes, req, opts) {
  /** @type {Record<string,string | string[]>} */
  const headers = {};
  // Preserve multi-value headers (Set-Cookie) via getSetCookie when available.
  if (typeof /** @type any */ (webRes.headers).getSetCookie === 'function') {
    const cookies = /** @type any */ (webRes.headers).getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies;
  }
  webRes.headers.forEach((v, k) => {
    if (k === 'set-cookie') return;
    headers[k] = v;
  });

  // Negotiate compression.
  let compressor = null;
  if (opts?.compress && req && webRes.body && isCompressible(headers['content-type'])) {
    const accept = String(req.headers['accept-encoding'] || '');
    if (/(?:^|,\s*)br(?:;|,|$)/.test(accept)) {
      compressor = createBrotliCompress({
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
      });
      headers['content-encoding'] = 'br';
    } else if (/(?:^|,\s*)gzip(?:;|,|$)/.test(accept)) {
      compressor = createGzip({ level: 6 });
      headers['content-encoding'] = 'gzip';
    }
    if (compressor) {
      headers['vary'] = 'Accept-Encoding';
      delete headers['content-length'];
    }
  }

  res.writeHead(webRes.status, headers);
  if (!webRes.body) { res.end(); return; }

  if (compressor) {
    compressor.pipe(res);
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        compressor.write(value);
      }
    } finally {
      compressor.end();
    }
    return;
  }

  const reader = webRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

/** @param {string | string[] | undefined} contentType */
function isCompressible(contentType) {
  if (!contentType) return false;
  const ct = Array.isArray(contentType) ? contentType[0] : contentType;
  return /^(?:text\/|application\/(?:javascript|json|xml|wasm|manifest)|image\/svg\+xml)/i.test(ct);
}

/**
 * Read a file and return a Response with appropriate caching.
 * Dev: no-cache (always revalidate).
 * Prod: ETag + ~1h max-age for user files; `immutable` bumps to 1 year.
 *
 * @param {string} abs
 * @param {{ dev: boolean, immutable: boolean }} opts
 */
async function fileResponse(abs, opts) {
  try {
    const data = await readFile(abs);
    const type = MIME[extname(abs).toLowerCase()] || 'application/octet-stream';
    const headers = { 'content-type': type };
    if (opts.dev) {
      headers['cache-control'] = 'no-cache';
    } else {
      const etag = `"${(await digestHex('SHA-1', data)).slice(0, 16)}"`;
      headers['etag'] = etag;
      headers['cache-control'] = opts.immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
    }
    return new Response(data, { status: 200, headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Serve a plain `.js` / `.mjs` browser module, stripping side-effect
 * imports of display-only components. Mirrors {@link fileResponse}'s
 * headers but reads as text so the source can be transformed. Used only
 * for files that exist as `.js` on disk (TS apps usually hit
 * {@link tsResponse} via the .js to .ts sibling rewrite instead).
 *
 * @param {string} abs
 * @param {boolean} dev
 * @param {{ moduleGraph: any, elidableComponents: Set<string>|undefined, appDir: string }} elideOpts
 */
async function jsModuleResponse(abs, dev, elideOpts) {
  let source;
  try { source = await readFile(abs, 'utf8'); }
  catch { return new Response('Not found', { status: 404 }); }
  const code = elideImportsFromSource(
    source, abs, elideOpts.moduleGraph, elideOpts.elidableComponents, resolveImport, elideOpts.appDir,
  );
  const headers = { 'content-type': 'application/javascript; charset=utf-8' };
  if (dev) {
    headers['cache-control'] = 'no-cache';
  } else {
    headers['etag'] = `"${(await digestHex('SHA-1', code)).slice(0, 16)}"`;
    headers['cache-control'] = 'public, max-age=3600';
  }
  return new Response(code, { status: 200, headers });
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Strip TypeScript types from `source` via Node's built-in
 * `module.stripTypeScriptTypes`. Position-preserving whitespace
 * replacement: no sourcemap is needed because every (line, column)
 * maps to itself in the source.
 *
 * Only erasable TypeScript is supported. Non-erasable syntax
 * (`enum`, `namespace` with values, parameter properties, legacy
 * decorators with `emitDecoratorMetadata`, `import = require`)
 * throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` from Node and the
 * dev server returns the error to the caller. The
 * `erasable-typescript-only` and `no-non-erasable-typescript` lint
 * rules catch these at edit time. There is no bundler fallback;
 * webjs is buildless end-to-end.
 *
 * @param {string} source
 * @param {string} _abs  (unused; preserved for symmetry with prior signature)
 * @returns {Promise<string>}
 */
async function stripTs(source, _abs) {
  return stripTypeScriptTypes(source);
}

/**
 * Serve a `.ts` / `.mts` source file as JavaScript via {@link stripTs}.
 * Result is cached by mtime in the handler's own `cache` so subsequent
 * requests are instant; a file edit invalidates naturally. `elideOpts`
 * additionally strips side-effect imports of display-only components from
 * the served code, which is exactly why `cache` is the per-handler
 * `state.tsCache` and not a module-global: the cached bytes bake in this
 * handler's elision verdict.
 *
 * @param {string} abs
 * @param {boolean} dev
 * @param {{ moduleGraph: any, elidableComponents: Set<string>|undefined, appDir: string }} [elideOpts]
 * @param {Map<string, { mtimeMs: number, code: string, map: string | null }>} cache the handler's `state.tsCache`
 */
async function tsResponse(abs, dev, elideOpts, cache) {
  const st = await stat(abs);
  const cached = cache.get(abs);
  if (cached && cached.mtimeMs === st.mtimeMs) {
    return new Response(cached.code, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': dev ? 'no-cache' : 'public, max-age=3600',
      },
    });
  }
  const source = await readFile(abs, 'utf8');
  let code;
  try {
    code = await stripTs(source, abs);
  } catch (err) {
    // Node's stripTypeScriptTypes throws ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
    // for enum, namespace with values, parameter properties, legacy
    // decorators with emitDecoratorMetadata, and import = require.
    // Return a clean 500 with the file path and a pointer at the
    // erasable-typescript-only lint rule rather than letting the
    // error bubble up unstyled.
    if (err && err.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
      // Log full detail server-side regardless of mode so operators
      // see what went wrong in their logs.
      // eslint-disable-next-line no-console
      console.error(`[webjs] non-erasable TypeScript in ${abs}: ${err.message}`);
      const msg = dev
        // Dev: include the file path and Node's error message so the
        // developer's browser tooling can point them at the offending
        // construct. Replace `*` + `/` with `*\\/` so a path or
        // message containing the comment-close sequence cannot
        // terminate the wrapper comment early.
        ? `[webjs] non-erasable TypeScript in ${abs}: ${err.message}\n\n` +
          `webjs is buildless: only erasable TS syntax is supported. ` +
          `Replace enum / namespace / parameter-property / legacy-decorator / ` +
          `import = require constructs with their erasable equivalents. ` +
          `Run \`webjs check\` for guidance (no-non-erasable-typescript rule).`
        // Prod: terse, no path leak, no Node-message leak (Node's
        // message can include source snippets). Operators get the
        // detail in server logs above.
        : `[webjs] server error transforming a .ts response. Check server logs.`;
      return new Response(`/* ${msg.replace(/\*\//g, '*\\/')} */`, {
        status: 500,
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      });
    }
    throw err;
  }
  if (elideOpts) {
    code = elideImportsFromSource(
      code, abs, elideOpts.moduleGraph, elideOpts.elidableComponents, resolveImport, elideOpts.appDir,
    );
  }
  // Evict oldest entry if cache is full (simple FIFO: Map preserves insertion order).
  if (cache.size >= TS_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(abs, { mtimeMs: st.mtimeMs, code, map: null });
  return new Response(code, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': dev ? 'no-cache' : 'public, max-age=3600',
    },
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Walk the route table + component scanner to collect every file the
 * browser may legitimately fetch as an ES module, then expand via the
 * module graph into the full transitive closure.
 *
 * This is webjs's equivalent of Next.js's bundler-produced page
 * manifest, derived lazily on the first request (and re-derived on every
 * rebuild) instead of at compile time. The dev server's source-file branch uses the returned
 * Set as an authorization gate: in-set → served (subject to the
 * .server.{js,ts} stub guardrail); out-of-set → 404.
 *
 * Browser-bound entries:
 *   - page.{js,ts,mjs,mts}        (re-runs on client for hydration)
 *   - layout.{js,ts,mjs,mts}      (same)
 *   - error.{js,ts,mjs,mts}       (same)
 *   - loading.{js,ts,mjs,mts}     (same)
 *   - not-found.{js,ts,mjs,mts}   (same)
 *   - component files discovered by the scanner (eager + lazy)
 *
 * Server-only entries (NOT in the set):
 *   - route.{js,ts}   (API handlers, never fetched as JS module)
 *   - middleware.{js,ts}
 *   - metadata routes (sitemap.js, robots.js, manifest.js, …)
 *   - .server.{js,ts} files (browser gets a stub, not the source)
 *
 * Components are passed in (rather than rescanned) so the caller can
 * share one scan with `primeComponentRegistry`. Saves a full
 * appDir walk on each analysis (the first request and every rebuild).
 *
 * @param {Awaited<ReturnType<typeof buildRouteTable>>} routeTable
 * @param {Awaited<ReturnType<typeof buildModuleGraph>>} moduleGraph
 * @param {Awaited<ReturnType<typeof scanComponents>>} components
 * @param {string} appDir
 * @returns {Set<string>}
 */
/**
 * Collect every page + layout file across the route table. These are the
 * modules the client boot script imports, and thus the candidates for
 * inert-route elision (dropping a module that does no client work).
 * `route.{js,ts}` / middleware / metadata are excluded: they never ship.
 *
 * @param {Awaited<ReturnType<typeof buildRouteTable>>} routeTable
 * @returns {string[]}
 */
function collectRouteModules(routeTable) {
  /** @type {Set<string>} */
  const mods = new Set();
  for (const page of routeTable.pages || []) {
    if (page.file) mods.add(page.file);
    for (const f of page.layouts || []) mods.add(f);
  }
  return [...mods];
}

function computeBrowserBoundFiles(routeTable, moduleGraph, components, appDir) {
  /** @type {Set<string>} */
  const entries = new Set();
  for (const page of routeTable.pages) {
    if (page.file) entries.add(page.file);
    for (const f of page.layouts || []) entries.add(f);
    for (const f of page.errors || []) entries.add(f);
    for (const f of page.loadings || []) entries.add(f);
  }
  if (routeTable.notFound) entries.add(routeTable.notFound);
  if (routeTable.notFounds) {
    for (const f of routeTable.notFounds.values()) entries.add(f);
  }
  // Lazy components live in the registry but no page imports their
  // class directly; the lazy-loader fetches their module URLs on
  // viewport entry. Add every discovered component file as an entry so
  // the graph walk covers both eager and lazy paths.
  for (const c of components) entries.add(c.file);
  return reachableFromEntries(moduleGraph, [...entries], appDir);
}

/**
 * Find the absolute directory of the `@webjsdev/core` package, regardless of
 * whether we're running from the monorepo or an installed copy.
 * @param {string} appDir
 */
function locateCoreDir(appDir) {
  try {
    const require = createRequire(join(appDir, 'package.json'));
    const pkgPath = require.resolve('@webjsdev/core/package.json');
    return dirname(pkgPath);
  } catch {}
  const here = fileURLToPath(import.meta.url);
  return resolve(here, '..', '..', '..', 'core');
}

/**
 * Find an npm package's installed root folder in the app's node_modules graph.
 * @param {string} appDir
 * @param {string} pkgName
 * @returns {string | null}
 */
function locatePackageDir(appDir, pkgName) {
  // Many packages lock down `./package.json` in their exports field, so we
  // resolve the bare specifier (always exported) and trim back to the
  // folder named pkgName.
  const match = '/node_modules/' + pkgName + '/';
  const tryFrom = (from) => {
    const require = createRequire(from);
    const entry = require.resolve(pkgName).split(sep).join('/');
    const at = entry.lastIndexOf(match);
    if (at < 0) return null;
    return entry.slice(0, at + match.length - 1).split('/').join(sep);
  };
  try { const d = tryFrom(join(appDir, 'package.json')); if (d) return d; } catch {}
  try { const d = tryFrom(fileURLToPath(import.meta.url)); if (d) return d; } catch {}
  return null;
}

const RELOAD_CLIENT_JS = `// webjs dev reload client
const es = new EventSource('/__webjs/events');
es.addEventListener('reload', () => location.reload());
`;
