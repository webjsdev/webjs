/**
 * Build the webjs VSCode extension's vendored tsserver plugin (#382).
 *
 * VSCode resolves a contributed `typescriptServerPlugins` entry by NAME from
 * `<extension>/node_modules/<name>`, so the plugin has to ship inside the vsix
 * under that exact path. We can't just let vsce walk the workspace dependency
 * though: `@webjsdev/intellisense` is a symlink into the monorepo, and following
 * it drags the entire repo `node_modules` (~86 MB of dev deps) into the
 * package. Instead we esbuild the plugin into a single self-contained CJS file
 * written to `node_modules/@webjsdev/intellisense/` as REAL files, then package
 * with `--no-dependencies` so vsce ships exactly that and nothing else.
 *
 * The plugin is standalone (no Lit dependency; the ts-lit-plugin reliance was
 * removed in Phase 3, #386), so the bundle is just the webjs language service:
 * go-to-definition, binding-aware completions, in-template diagnostics, and
 * hover. `typescript` is left external because it is provided by the user's
 * tsserver at runtime.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, '..');
const PLUGIN_SRC = resolve(EXT, '../intellisense');
const OUT_DIR = resolve(EXT, 'node_modules/@webjsdev/intellisense');

const pluginPkg = JSON.parse(readFileSync(resolve(PLUGIN_SRC, 'package.json'), 'utf8'));

// Start from a clean vendored dir so a stale symlink or old bundle can't leak in.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

await build({
  entryPoints: [resolve(PLUGIN_SRC, 'src/index.js')],
  outfile: resolve(OUT_DIR, 'index.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // typescript is provided by the host tsserver, never bundled.
  external: ['typescript', 'typescript/lib/tsserverlibrary'],
  logLevel: 'info',
});

writeFileSync(
  resolve(OUT_DIR, 'package.json'),
  JSON.stringify(
    {
      name: '@webjsdev/intellisense',
      version: pluginPkg.version,
      main: 'index.cjs',
      // Bundled + vendored into the webjs VSCode extension; not the npm package.
      private: true,
    },
    null,
    2,
  ) + '\n',
);

console.log(`[build] vendored @webjsdev/intellisense@${pluginPkg.version} -> ${OUT_DIR}`);
