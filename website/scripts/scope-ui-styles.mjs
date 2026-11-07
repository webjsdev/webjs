/**
 * Write each kit style as a CSS @scope block that stops at any nested style
 * wrapper (#1666, D8), into node_modules/.cache/ui-styles/scoped/.
 *
 * The registry's style files are nested rules under one `.style-<name>`
 * selector, so as written a rule matches every descendant of the wrapper.
 * On this site a region in one style can sit inside a region in another (a
 * nova demo inside the new-york docs chrome), and then both styles' rules
 * apply to it. shadcn never has that problem, because it bakes each part into
 * one style at import time. Scoping each style from its wrapper down to the
 * next style wrapper gives the same answer at runtime: the nearest wrapper
 * wins, and nothing leaks across.
 *
 * The registry files stay byte-for-byte shadcn's (the CLI's bake reads them),
 * so the scoping is applied to copies, and scripts/build-ui-styles.mjs
 * compiles each into its own sheet. copy-registry.mjs runs this too, and
 * build-ui-styles.mjs runs it itself.
 *
 * The copies also settle which part wins when one element carries two parts'
 * names. shadcn composes a part over another the way a FieldLabel renders a
 * Label or a dialog's close renders a Button: the composing part's classes
 * come LAST, and tailwind-merge resolves every conflict in its favour. The
 * CLI's bake gives the same answer (mapped classes in name order, then cn()).
 * Loaded as CSS, though, two single-class rules tie on specificity and the
 * one later in the file wins, so a FieldLabel took the Label's `leading-none`
 * and every labelled field drew 5px short. So each part's selector is raised
 * by its composition rank: a part composed over another (later in one class
 * string, or in a component that imports another's helpers) repeats its class
 * once per level, `.cn-field-label.cn-field-label`, which outranks the part it
 * extends wherever the two rules sit. The style files have no compound
 * selectors, so raising a name never reorders anything else, and the styles
 * stay in layer(base), so an author's utility still wins over all of them.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classSegments, segmentValue, CN_ALLOWLIST } from '../../packages/ui/src/registry/style-bake.js';
import { PRESET_STYLES } from '../../packages/ui/packages/registry/themes/preset.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const styles = resolve(site, '../packages/ui/packages/registry/styles');

/** Every kit style: the registry's own list, which a preset encodes. */
export const STYLE_NAMES = PRESET_STYLES;
export const SCOPED_DIR = join(site, 'node_modules', '.cache', 'ui-styles', 'scoped');

const LIMIT = `:is(${STYLE_NAMES.map((n) => `.style-${n}`).join(', ')})`;
const components = resolve(styles, '../components');

/**
 * Each part name's composition rank, from the registry components: 0 for a
 * part composed over nothing, and one more than the part it composes over.
 * A component that imports another component's helpers composes over that
 * component's parts (a dialog's close over the button), and within one class
 * string a later name composes over an earlier one (`cn-label
 * cn-field-label`). A name used by several components takes its lowest-ranked
 * owner, so a primitive's name stays at the primitive's rank.
 *
 * @param {string} [dir]  the registry components directory
 * @returns {Map<string, number>}
 */
export function compositeRanks(dir = components) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const sources = new Map(files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
  const imports = new Map(files.map((f) => [f, [...sources.get(f).matchAll(/^import (?!type\b)[^;]*from '\.\/([\w-]+\.ts)';/gm)].map((m) => m[1]).filter((x) => sources.has(x))]));
  const depth = new Map();
  const depthOf = (f, seen = new Set()) => {
    if (depth.has(f)) return depth.get(f);
    if (seen.has(f)) return 0;
    seen.add(f);
    const d = imports.get(f).reduce((n, g) => Math.max(n, depthOf(g, seen) + 1), 0);
    depth.set(f, d);
    return d;
  };
  const strings = [];
  /** @type {Map<string, number>} */
  const rank = new Map();
  for (const f of files) {
    const src = sources.get(f);
    for (const seg of classSegments(src)) {
      const names = segmentValue(src, seg).split(/\s+/).filter((t) => /^cn-[\w-]+$/.test(t) && !CN_ALLOWLIST.has(t));
      if (!names.length) continue;
      strings.push(names);
      for (const n of names) rank.set(n, Math.min(rank.get(n) ?? Infinity, depthOf(f)));
    }
  }
  // A later name in one string outranks the names before it.
  for (let changed = true; changed;) {
    changed = false;
    for (const names of strings) {
      for (let i = 1; i < names.length; i++) {
        const need = rank.get(names[i - 1]) + 1;
        if (rank.get(names[i]) < need) { rank.set(names[i], need); changed = true; }
      }
    }
  }
  return rank;
}

/** Raise each ranked part's class in a style's selectors, once per rank. */
export function raiseComposites(css, ranks) {
  return css.split('\n').map((line) => (/^\s*@apply\b/.test(line) ? line : line.replace(/\.(cn-[\w-]+)(?![\w-])/g, (m, name) => {
    const r = ranks.get(name) ?? 0;
    return r > 0 ? m.repeat(r + 1) : m;
  }))).join('\n');
}

/** One style file's text, each top-level `.style-<name> {` turned into a scope. */
export function scopeStyle(name, css, ranks) {
  const head = new RegExp(`^\\.style-${name.replace(/-/g, '\\-')} \\{$`, 'gm');
  const out = css.replace(head, `@scope (.style-${name}) to (${LIMIT}) {`);
  if (out === css) throw new Error(`style-${name}.css has no top-level .style-${name} block`);
  return ranks ? raiseComposites(out, ranks) : out;
}

export function writeScopedStyles() {
  mkdirSync(SCOPED_DIR, { recursive: true });
  const ranks = compositeRanks();
  for (const name of STYLE_NAMES) {
    const css = readFileSync(join(styles, `style-${name}.css`), 'utf8');
    writeFileSync(join(SCOPED_DIR, `style-${name}.css`), scopeStyle(name, css, ranks));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeScopedStyles();
  console.log(`[scope-ui-styles] wrote ${STYLE_NAMES.length} scoped styles`);
}
