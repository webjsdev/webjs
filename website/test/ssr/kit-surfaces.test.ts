/**
 * A surface this site shares with a scaffolded app, which drifted before
 * #1216 with nothing to catch it: components/ui/ belongs to `webjs ui add`,
 * exactly as it does in a real app, so this site tracks nothing there. Eleven
 * byte-identical copies of the generated modules/ui/components/ mirror were
 * committed into it by accident and sat unimported until someone read the
 * directory. Plus the colour rule every stylesheet here follows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('components/ui/ is left empty for webjs ui add', () => {
  const dir = resolve(ROOT, 'components/ui');
  const entries = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
  assert.deepEqual(
    entries,
    [],
    'components/ui/ is reserved for `webjs ui add`; the gallery previews import from modules/ui/components/ instead',
  );
});

/**
 * The general rule, swept across every stylesheet and every page/layout that
 * writes CSS. The kit palette the retired gallery carried was duplicated worst,
 * but it was not the only one: the syntax-highlight classes in input.css
 * and the home page's code-sample tokens each carried the same pair of
 * verbatim dark blocks. A per-file assertion would have kept missing them, so
 * this asserts the rule itself.
 */
test('no colour is declared under a per-theme selector anywhere', () => {
  // modules/ is deliberately absent: its only subtree is the gitignored
  // modules/ui/components/ mirror of the @webjsdev/ui registry, which is the
  // kit's code rather than this site's, and modules/ui/utils holds no CSS.
  // Add it here the moment a feature module starts writing styles.
  const files = [
    'public/input.css',
    'public/shared-base.css',
    ...['app', 'lib', 'components'].flatMap(function walk(dir: string): string[] {
      const abs = resolve(ROOT, dir);
      if (!existsSync(abs)) return [];
      return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : [],
      );
    }),
  ];

  // Only these three NON-colour tokens may sit under a theme selector. Every
  // colour belongs in a light-dark() pair instead.
  const ALLOWED = new Set(['--glow-strength', '--cta-mix', '--shadow-spread']);
  const offenders: string[] = [];

  for (const rel of files) {
    // Comments are stripped so prose naming a selector is not read as a rule,
    // and code blocks in the docs pages are left alone: those are code SAMPLES
    // teaching the reader, not this site's own styling. Both tags are matched
    // because the docs author `<code-block>` and the marketing pages still
    // author `<pre>`; dropping either would scan a sample that teaches a
    // dark-theme override as if it were this site's own styling.
    const src = readFileSync(resolve(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<pre[\s\S]*?<\/pre>/g, '')
      .replace(/<code-block[\s\S]*?<\/code-block>/g, '');
    // Terminate on the first closing brace, NOT on one at the start of a line:
    // a single-line rule (`:root[data-theme='dark'] .t-str { color: ... }`) is
    // the exact shape the highlight classes used, and anchoring to a newline
    // walked straight past it.
    const re = /(?:@media\s*\(prefers-color-scheme:\s*dark\)|\[data-theme=['"]dark['"]\])([\s\S]{0,900}?)\}/g;
    for (const m of src.matchAll(re)) {
      for (const d of m[1].matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
        if (ALLOWED.has(d[1])) continue;
        offenders.push(`${rel}: ${d[1]}`);
      }
      // A bare colour on a class inside a theme block (the .t-* highlight
      // shape) has no custom property to catch, so look for it directly.
      for (const d of m[1].matchAll(/\bcolor:\s*(oklch|#|rgb|hsl)/g)) {
        offenders.push(`${rel}: a bare ${d[1]} colour`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'these belong in a light-dark(LIGHT, DARK) pair, not under a per-theme selector',
  );
});
