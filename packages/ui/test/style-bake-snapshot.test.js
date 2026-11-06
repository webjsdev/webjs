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

/** The allowlisted hooks survive the bake by design, so they are not a difference. */
const withoutHooks = (s) => s.split(/(\s+)/).filter((t) => !CN_ALLOWLIST.has(t)).join('');

const newYork = loadStyleMap('new-york');

for (const [file, before] of Object.entries(fixture)) {
  test(`new-york bake of ${file} equals its pre-conversion classes`, () => {
    const src = readFileSync(join(REGISTRY, file), 'utf8');
    const baked = bakeSource(src, newYork);
    const after = classSegments(baked).map((s) => segmentValue(baked, s));
    assert.equal(after.length, before.length, `${file}: the conversion added or removed a string`);
    for (let i = 0; i < before.length; i++) {
      const a = cn(withoutHooks(after[i]));
      const b = cn(before[i]);
      assert.equal(a, b, `${file}, string ${i}: baked ${JSON.stringify(after[i])} merges to ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
    }
    assert.deepEqual(leftoverCnNames(baked), [], `${file}: a cn- name survived the bake`);
  });
}
