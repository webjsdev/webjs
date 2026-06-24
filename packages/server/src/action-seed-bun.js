/**
 * Bun install for SSR action-result seeding (#472, #529).
 *
 * Bun has no `module.registerHooks`, so the seed facade is installed via a
 * `Bun.plugin` `onLoad`, the Bun analog of the Node load hook in
 * `action-seed.js`. This module is dynamically imported by `registerSeedHooks`
 * ONLY when `serverRuntime()` is `'bun'`, so the `Bun.*` global is never
 * referenced on Node (the same isolation as `listener-bun.js`).
 *
 * The faceting DECISION (`isSeedCandidate`) and the facade SOURCE
 * (`buildSeedFacade`) are the shared, runtime-neutral helpers passed in, so Node
 * and Bun emit byte-identical facades that feed the same `AsyncLocalStorage`
 * collector. The only Bun-specific glue here is the plugin shell + reading the
 * source via `Bun.file`.
 *
 * Bun's `onLoad` `args.path` includes any query (verified), so the facade's
 * `?webjs-seed-orig` passthrough and a dev `?t=` re-import are both seen, exactly
 * like the Node hook's URL.
 *
 * UNLIKE Node's hook, a Bun `onLoad` registered for a filter MUST return a
 * `{ contents, loader }` object for EVERY match; returning `undefined` to defer
 * to the default loader is an error ("onLoad() expects an object returned"). So
 * the non-facet cases (the `?webjs-seed-orig` passthrough, a `.server.*` with no
 * `'use server'`, an unenumerable `export *`) are handled by reading and
 * RETURNING the real source ourselves with the extension's loader, which is the
 * same module Bun would have loaded.
 */

/** Bun's global install cache + node_modules: a dep, never an app file to rewrite. */
const DEP_PATH_RE = /[\\/](?:node_modules|install[\\/]cache|\.bun)[\\/]/;

/**
 * Install the webjs `Bun.plugin` `onLoad`. It carries two independent transforms
 * on ONE handler (Bun `onLoad` is first-match-wins, so a second overlapping
 * plugin would starve one of them):
 *
 *   - **Pin rewrite (#685)**, when `pinTransform` is supplied: rewrite bare
 *     specifiers of declared deps to inline-versioned ones so Bun zero-install
 *     fetches the pinned version, not latest. Applies to APP files only (a dep
 *     in `node_modules` / the global cache is returned raw). This broadens the
 *     filter to all JS/TS; without it the filter stays the cheap `*.server.*`
 *     pre-screen.
 *   - **Seed facade (#472)**, when `seedEnabled`: facet a `'use server'`
 *     candidate into the SSR action-result seed facade, built from the
 *     (already pin-rewritten) source.
 *
 * Idempotency is the caller's responsibility (`registerSeedHooks` guards on
 * `_registered`).
 *
 * @param {{
 *   isSeedCandidate: (specifier: string) => boolean,
 *   buildSeedFacade: (origSpec: string, absPath: string, src: string) => (string | null),
 *   serverFileRe: RegExp,
 *   seedEnabled?: boolean,
 *   pinTransform?: ((src: string, loader: 'ts' | 'js') => string) | null,
 * }} helpers
 */
export function installBunSeedPlugin({ isSeedCandidate, buildSeedFacade, serverFileRe, seedEnabled = true, pinTransform = null }) {
  // Pinning needs to see every app module's imports, so broaden the filter when
  // it is active; otherwise keep the narrow `*.server.*` seed pre-screen.
  const filter = pinTransform ? /\.m?[jt]s(\?|$)/ : serverFileRe;
  Bun.plugin({
    name: 'webjs-onload',
    setup(build) {
      build.onLoad({ filter }, async (args) => {
        const absPath = args.path.split('?')[0];
        // `.ts` / `.mts` strip via the `ts` loader; `.js` / `.mjs` via `js`.
        const loader = /\.m?ts$/.test(absPath) ? 'ts' : 'js';
        // A dependency (node_modules or Bun's global cache): never rewrite it
        // (the app's package.json does not pin transitive deps; they follow from
        // the pinned direct deps' own manifests). Return the raw source unchanged.
        if (pinTransform && DEP_PATH_RE.test(absPath)) {
          return { contents: await Bun.file(absPath).text(), loader };
        }
        // Read the real source. A genuine read failure (missing file) propagates,
        // which Bun reports as a load error exactly as it would without the plugin.
        let src = await Bun.file(absPath).text();
        // Pin rewrite. For a NON-`.server` module this is where its specifiers get
        // pinned. A `.server` candidate's REAL module is pinned on its
        // `?webjs-seed-orig` passthrough load (which re-enters this onLoad); the
        // facade itself only reads export names, unaffected by the rewrite.
        if (pinTransform) {
          try { src = pinTransform(src, loader); } catch { /* fail-open: raw source */ }
        }
        try {
          // Facet only a `'use server'` candidate (not the `?webjs-seed-orig`
          // passthrough); a non-candidate or a passthrough falls through to the
          // (possibly pin-rewritten) source below.
          if (seedEnabled && isSeedCandidate(args.path)) {
            const source = buildSeedFacade(args.path, absPath, src);
            if (source != null) return { contents: source, loader: 'js' };
          }
        } catch {
          // Fail-open: any faceting error serves the source (no seeding for this
          // module), the Bun analog of the Node hook's `nextLoad` fallback.
        }
        return { contents: src, loader };
      });
    },
  });
}
