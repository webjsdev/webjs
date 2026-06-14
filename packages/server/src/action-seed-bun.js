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
 */

/**
 * Install the `Bun.plugin` seed `onLoad`. Idempotency is the caller's
 * responsibility (`registerSeedHooks` guards on `_registered`).
 *
 * @param {{
 *   isSeedCandidate: (specifier: string) => boolean,
 *   buildSeedFacade: (origSpec: string, absPath: string, src: string) => (string | null),
 *   serverFileRe: RegExp,
 * }} helpers
 */
export function installBunSeedPlugin({ isSeedCandidate, buildSeedFacade, serverFileRe }) {
  Bun.plugin({
    name: 'webjs-action-seed',
    setup(build) {
      // The filter is a cheap path pre-screen (`*.server.*`, optional query);
      // `isSeedCandidate` then excludes the `?webjs-seed-orig` passthrough.
      build.onLoad({ filter: serverFileRe }, async (args) => {
        try {
          if (!isSeedCandidate(args.path)) return undefined;
          const absPath = args.path.split('?')[0];
          const src = await Bun.file(absPath).text();
          const source = buildSeedFacade(args.path, absPath, src);
          if (source == null) return undefined;
          return { contents: source, loader: 'js' };
        } catch {
          // Fail-open: a load the plugin cannot facade runs unwrapped (no
          // seeding for it), exactly like the Node hook's `nextLoad` fallback.
          return undefined;
        }
      });
    },
  });
}
