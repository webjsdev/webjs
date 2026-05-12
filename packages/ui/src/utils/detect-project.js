import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Detect the host project type so we can pick sensible defaults for paths.
 *
 * @param {string} cwd
 * @returns {{ type: 'webjs' | 'next' | 'vite' | 'astro' | 'plain', meta: any }}
 */
export function detectProject(cwd = process.cwd()) {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return { type: 'plain', meta: {} };

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  if (deps['@webjskit/server'] || deps['@webjskit/cli'] || existsSync(join(cwd, 'app', 'layout.ts')) || existsSync(join(cwd, 'app', 'layout.js'))) {
    return { type: 'webjs', meta: { pkg } };
  }
  if (deps['next']) return { type: 'next', meta: { pkg } };
  if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) return { type: 'vite', meta: { pkg } };
  if (deps['astro']) return { type: 'astro', meta: { pkg } };

  return { type: 'plain', meta: { pkg } };
}

/**
 * Pick default `aliases` + `tailwind.css` path based on the detected project.
 *
 * @param {string} cwd
 */
export function defaultsForProject(cwd = process.cwd()) {
  const { type } = detectProject(cwd);
  switch (type) {
    case 'webjs':
      return {
        tailwindCss: 'app/globals.css',
        aliases: { components: 'components', utils: 'lib/utils', ui: 'components/ui', lib: 'lib' },
      };
    case 'next':
      return {
        tailwindCss: 'app/globals.css',
        aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui', lib: '@/lib' },
      };
    case 'vite':
      return {
        tailwindCss: 'src/index.css',
        aliases: { components: 'src/components', utils: 'src/lib/utils', ui: 'src/components/ui', lib: 'src/lib' },
      };
    case 'astro':
      return {
        tailwindCss: 'src/styles/globals.css',
        aliases: { components: 'src/components', utils: 'src/lib/utils', ui: 'src/components/ui', lib: 'src/lib' },
      };
    default:
      return {
        tailwindCss: 'styles/globals.css',
        aliases: { components: 'components', utils: 'lib/utils', ui: 'components/ui', lib: 'lib' },
      };
  }
}
