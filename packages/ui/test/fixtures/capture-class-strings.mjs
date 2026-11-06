/**
 * Capture every class-bearing string of every registry component, as the
 * components stood BEFORE they were converted to base form (#1666, D8).
 *
 *   node packages/ui/test/fixtures/capture-class-strings.mjs
 *
 * The output, class-strings.json, is what test/style-bake-snapshot.test.js
 * holds the `new-york` bake to: baking a base-form component with the
 * `new-york` style must give back, string for string, the classes the
 * component had before the conversion. It was captured once, at the commit
 * where the conversion started, and must NOT be regenerated from base-form
 * sources, which would make the snapshot compare the bake against itself.
 * Re-run it only when a component's LOOK is changed on purpose (the
 * logical-property audit is the planned one), and say so in that commit.
 *
 * The strings are found by `classSegments` from src/registry/style-bake.js,
 * the same function the bake rewrites with, so the fixture and the bake
 * cannot disagree about which strings carry classes.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classSegments, segmentValue } from '../../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, '..', '..', 'packages', 'registry', 'components');

/** @type {Record<string, string[]>} */
const out = {};
for (const f of readdirSync(COMPONENTS).filter((x) => x.endsWith('.ts')).sort()) {
  const src = readFileSync(join(COMPONENTS, f), 'utf8');
  out[`components/${f}`] = classSegments(src).map((s) => segmentValue(src, s));
}
writeFileSync(join(HERE, 'class-strings.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`captured ${Object.keys(out).length} files, ${Object.values(out).reduce((n, v) => n + v.length, 0)} strings`);
