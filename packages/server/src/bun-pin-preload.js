/**
 * Standalone Bun preload that pins a SPAWNED tool's deps under zero-install (#704).
 *
 * `webjs db` / `test` / `typecheck` spawn a tool (drizzle-kit, the test runner,
 * tsc) as a SEPARATE Bun process. The server's #685 onLoad does NOT run there, so
 * the tool's bare imports (and the user-authored `db/schema.server.ts`'s
 * `import 'drizzle-orm'`) would hit raw auto-install and get the wrong version.
 *
 * This module is referenced from a `bunfig.toml` `preload` (or `bun --preload`)
 * on the spawn, so it loads in the tool process FIRST and installs a `Bun.plugin`
 * `onLoad` that rewrites a declared dep's bare specifier to its pinned inline
 * version, the same `resolveDepVersions` + `rewriteDepSpecifiers` the server uses.
 *
 * APP files only: the onLoad filter EXCLUDES `node_modules` / Bun's global
 * install cache, so a cached dependency is loaded by Bun normally. This matters
 * for two reasons: (1) returning `{ contents }` from an onLoad forces ESM parsing,
 * which BREAKS a CommonJS dep (drizzle-kit's `bin.cjs` is CJS), and (2) it is not
 * needed, since Bun resolves a tool's OWN transitive deps from the tool's
 * manifest. The user `db/schema.server.ts`'s `import 'drizzle-orm'` IS an app
 * file, so it is pinned; the tool bin itself is pinned by the cli (the spec it
 * passes is already `<tool>@<version>`), so the cache never needs rewriting.
 *
 * Bun-only: it references `Bun.plugin` / `Bun.Transpiler`, and is never loaded on
 * Node (only a Bun spawn preloads it). The pure rewrite core stays unit-testable
 * in `bun-pin-rewrite.js`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveDepVersions, rewriteDepSpecifiers } from './bun-pin-rewrite.js';

/**
 * Read the app's declared dep version map from cwd (`package.json` + optional
 * `bun.lock`). Exported so the spawn wiring and tests can assert it without
 * loading the Bun plugin.
 * @param {string} appDir
 * @returns {Record<string, string>}
 */
export function pinVersionsFor(appDir) {
  let pkgText;
  try { pkgText = readFileSync(join(appDir, 'package.json'), 'utf8'); } catch { return {}; }
  let lockText = null;
  try { lockText = readFileSync(join(appDir, 'bun.lock'), 'utf8'); } catch { /* optional */ }
  return resolveDepVersions(pkgText, lockText);
}

// Side effect on import (the point of a preload): install the onLoad on Bun.
if (typeof Bun !== 'undefined') {
  const versions = pinVersionsFor(process.cwd());
  if (Object.keys(versions).length > 0) {
    Bun.plugin({
      name: 'webjs-pin-spawn',
      setup(build) {
        // Exclude node_modules / Bun's global cache: only APP files are
        // rewritten, so a cached (possibly CommonJS) dep loads normally.
        build.onLoad({ filter: /^(?!.*[\/\\](?:node_modules|install[\/\\]cache|\.bun)[\/\\]).*\.[mc]?[jt]sx?(\?|$)/ }, async (args) => {
          const path = args.path.split('?')[0];
          const loader = /\.[mc]?tsx$/.test(path) ? 'tsx'
            : /\.[mc]?ts$/.test(path) ? 'ts'
            : /\.[mc]?jsx$/.test(path) ? 'jsx'
            : 'js';
          // Bun's onLoad MUST return an object for EVERY matched file (returning
          // undefined to defer to the default loader is an error), so we always
          // read and return the source, rewritten when a declared-dep specifier
          // matched. A genuine read failure (missing file) propagates, so Bun
          // reports it exactly as it would without the plugin.
          let src = await Bun.file(args.path).text();
          try {
            const imports = new Bun.Transpiler({ loader }).scanImports(src);
            src = rewriteDepSpecifiers(src, imports, versions);
          } catch { /* fail-open: serve the raw source, never break the load (#715) */ }
          return { contents: src, loader };
        });
      },
    });
  }
}
