import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rawConfigSchema } from '../registry/schema.js';

export const CONFIG_FILE = 'components.json';

/**
 * Read components.json from the given cwd. Returns null if missing.
 *
 * @param {string} cwd
 */
export function getConfig(cwd = process.cwd()) {
  const p = join(cwd, CONFIG_FILE);
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const parsed = rawConfigSchema.parse(raw);
  return {
    ...parsed,
    resolvedPaths: resolvePaths(cwd, parsed),
  };
}

function resolvePaths(cwd, config) {
  return {
    cwd: resolve(cwd),
    tailwindCss: resolve(cwd, config.tailwind.css),
    components: resolve(cwd, config.aliases.components.replace(/^@\//, '')),
    utils: resolve(cwd, config.aliases.utils.replace(/^@\//, '') + '.ts'),
    ui: resolve(cwd, (config.aliases.ui || 'components/ui').replace(/^@\//, '')),
    lib: resolve(cwd, (config.aliases.lib || 'lib').replace(/^@\//, '')),
  };
}

/**
 * Write components.json.
 *
 * @param {string} cwd
 * @param {any} config
 */
export function writeConfig(cwd, config) {
  const p = join(cwd, CONFIG_FILE);
  writeFileSync(p, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
