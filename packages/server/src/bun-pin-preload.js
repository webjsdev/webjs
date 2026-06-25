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
 * Unlike the server transform (app files only), this DELIBERATELY rewrites the
 * tool's own cached files too: drizzle-kit's internal `import 'drizzle-orm'` must
 * resolve to the app's pinned ORM, not drizzle-kit's own floating range. Only
 * specifiers for packages the APP declares are rewritten (the version map is the
 * app's `package.json` / `bun.lock`), so a tool-only transitive dep is untouched.
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
        build.onLoad({ filter: /\.[mc]?[jt]sx?(\?|$)/ }, async (args) => {
          const loader = /\.tsx?($|\?)/.test(args.path) ? 'tsx' : (/\.[mc]?ts($|\?)/.test(args.path) ? 'ts' : 'js');
          let src;
          try { src = await Bun.file(args.path).text(); } catch { return undefined; }
          const imports = new Bun.Transpiler({ loader: loader === 'tsx' ? 'tsx' : loader }).scanImports(src);
          const out = rewriteDepSpecifiers(src, imports, versions);
          if (out === src) return undefined;
          return { contents: out, loader };
        });
      },
    });
  }
}
