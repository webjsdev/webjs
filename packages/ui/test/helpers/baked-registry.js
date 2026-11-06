/**
 * A copy of the registry, baked with one style, for tests that IMPORT the
 * components and call their helpers (#1666).
 *
 * The registry sources are in base form: a helper like `buttonClass()` returns
 * semantic `cn-*` names, and the look comes from a style. What an app runs is
 * the BAKED copy `add` writes, so a test asserting on the classes a helper
 * returns imports this mirror instead of the raw source. The mirror keeps the
 * registry's layout (`components/`, `lib/`), so the relative imports between
 * files resolve unchanged; `lib/` is copied as is, since it carries no
 * `cn-*` names.
 *
 * It is written under test/.baked/ (gitignored), inside the package, so a
 * component's bare `@webjsdev/core` import resolves through the repo's
 * node_modules the way the source's does; a temp directory outside the repo
 * cannot resolve it. It is not under node_modules, because Node strips
 * TypeScript only outside node_modules.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeForStyle } from '../../src/registry/style-bake.js';

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'registry');

/** @type {Map<string, string>} */
const DIRS = new Map();

/**
 * The absolute path of the baked `components/` directory for a style,
 * created on first use and reused after that.
 * @param {string} [style]
 */
export function bakedComponentsDir(style = 'new-york') {
  const cached = DIRS.get(style);
  if (cached) return cached;
  // One directory per process, so two test files baking at once never write
  // over each other's copy.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '.baked', `${style}-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  cpSync(join(REGISTRY, 'lib'), join(root, 'lib'), { recursive: true });
  const out = join(root, 'components');
  mkdirSync(out);
  for (const f of readdirSync(join(REGISTRY, 'components')).filter((x) => x.endsWith('.ts'))) {
    writeFileSync(join(out, f), bakeForStyle(readFileSync(join(REGISTRY, 'components', f), 'utf8'), style));
  }
  DIRS.set(style, out);
  return out;
}
