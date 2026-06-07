/**
 * Build the webjs VSCode extension's vendored tsserver plugin (#382).
 *
 * VSCode resolves a contributed `typescriptServerPlugins` entry by NAME from
 * `<extension>/node_modules/<name>`, so the plugin has to ship inside the vsix
 * under that exact path. We can't just let vsce walk the workspace dependency
 * though: `@webjsdev/ts-plugin` is a symlink into the monorepo, and following
 * it drags the entire repo `node_modules` (~86 MB of dev deps) into the
 * package. Instead we esbuild the plugin into a single self-contained CJS file
 * written to `node_modules/@webjsdev/ts-plugin/` as REAL files, then package
 * with `--no-dependencies` so vsce ships exactly that and nothing else.
 *
 * `ts-lit-plugin` and `typescript` are left external on purpose. The plugin's
 * `require('ts-lit-plugin')` is wrapped in a graceful fallback (see
 * packages/ts-plugin/src/index.js), so with neither present it degrades to the
 * bare webjs language service: webjs-aware go-to-definition, attribute
 * completion from `static properties`, and tag diagnostics, with NO Lit
 * dependency. `typescript` is provided by the user's tsserver at runtime.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, '..');
const PLUGIN_SRC = resolve(EXT, '../ts-plugin');
const OUT_DIR = resolve(EXT, 'node_modules/@webjsdev/ts-plugin');

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
  // typescript: provided by the host tsserver. ts-lit-plugin: intentionally
  // absent so the plugin runs as the bare, Lit-free webjs language service.
  external: ['typescript', 'typescript/lib/tsserverlibrary', 'ts-lit-plugin'],
  logLevel: 'info',
});

writeFileSync(
  resolve(OUT_DIR, 'package.json'),
  JSON.stringify(
    {
      name: '@webjsdev/ts-plugin',
      version: pluginPkg.version,
      main: 'index.cjs',
      // Bundled + vendored into the webjs VSCode extension; not the npm package.
      private: true,
    },
    null,
    2,
  ) + '\n',
);

console.log(`[build] vendored @webjsdev/ts-plugin@${pluginPkg.version} -> ${OUT_DIR}`);
