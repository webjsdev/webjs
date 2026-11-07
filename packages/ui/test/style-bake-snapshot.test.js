/**
 * The `new-york` snapshot (#1666, D8): baking each registry component with the
 * `new-york` style must give back the classes it had before the kit moved to
 * base form.
 *
 * The baseline is test/fixtures/class-strings.json, captured from the
 * pre-conversion sources (see capture-class-strings.mjs for when it may be
 * regenerated). Strings are paired by position, as found by the bake's own
 * lexer, so a conversion that adds or drops a string fails on the count before
 * it fails on a value.
 *
 * Each pair is compared THROUGH the kit's real `cn()`, not as a set of tokens.
 * The bake concatenates the style's classes with the classes kept inline, and
 * the failure that matters is the merger then evicting one of them through a
 * conflict-group misclassification (#1065, #1072, #1265). A token-set check
 * would pass over exactly that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScript } from '../../server/src/ts-strip.js';
import { classSegments, segmentValue, bakeSource, loadStyleMap, leftoverCnNames, CN_ALLOWLIST } from '../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY = join(HERE, '..', 'packages', 'registry');
const fixture = JSON.parse(readFileSync(join(HERE, 'fixtures', 'class-strings.json'), 'utf8'));

const utilsJs = await stripTypeScript(readFileSync(join(REGISTRY, 'lib', 'utils.ts'), 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'webjs-ui-bake-'));
writeFileSync(join(tmp, 'utils.mjs'), utilsJs);
const { cn } = await import(pathToFileURL(join(tmp, 'utils.mjs')).href);

/**
 * Two kinds of class survive the bake without being a difference in LOOK: the
 * allowlisted hooks, and the marker classes (`group`, `group/button`, `peer`)
 * that shadcn's base form keeps inline. A marker has no CSS of its own, it only
 * names an element for a `group-*` / `peer-*` variant, so a base-form component
 * may carry one the old source lacked.
 */
const MARKER = /^(group|peer)(\/[\w-]+)?$/;
const withoutHooks = (s, before) => s.split(/(\s+)/).filter((t) => !CN_ALLOWLIST.has(t) && !(MARKER.test(t) && !before.split(/\s+/).includes(t))).join('');

const newYork = loadStyleMap('new-york');

for (const [file, before] of Object.entries(fixture)) {
  test(`new-york bake of ${file} equals its pre-conversion classes`, () => {
    const src = readFileSync(join(REGISTRY, file), 'utf8');
    const baked = bakeSource(src, newYork);
    const after = classSegments(baked).map((s) => segmentValue(baked, s));
    assert.equal(after.length, before.length, `${file}: the conversion added or removed a string`);
    for (let i = 0; i < before.length; i++) {
      // Order is not part of the look (the bake puts the style's classes first),
      // so each merged result is compared as a sorted list. A class the merger
      // EVICTED still shows up as missing.
      const sorted = (x) => x.split(/\s+/).filter(Boolean).sort().join(' ');
      const a = sorted(cn(withoutHooks(after[i], before[i])));
      const b = sorted(cn(before[i].split(/(\s+)/).filter((t) => !CN_ALLOWLIST.has(t)).join('')));
      assert.equal(a, b, `${file}, string ${i}: baked ${JSON.stringify(after[i])} merges to ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
      // cn() trims, so the merged comparison above cannot see the edges. A
      // string that is CONCATENATED into another (card's ' gap-6 py-6' size
      // suffix) depends on its leading space, and losing it glues two classes
      // together in the installed file (flex-colgap-6).
      const edges = (x) => [/^\s/.test(x), /\s$/.test(x)];
      assert.deepEqual(edges(after[i]), edges(before[i]), `${file}, string ${i}: the leading or trailing whitespace changed (${JSON.stringify(before[i])} became ${JSON.stringify(after[i])})`);
    }
    assert.deepEqual(leftoverCnNames(baked), [], `${file}: a cn- name survived the bake`);
  });
}
