/**
 * Drift guard: a `no-restyle` message may not carry a value the shared
 * projector (`registry/extract.js`, #979 pattern) does not produce for the
 * kit's own button. Same guard shape as `extract.test.js` uses for `webjsui
 * view` against the MCP `ui` tool.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractHelperAxes } from '../src/registry/extract.js';
import { scanClassSites } from '../src/lint/scan.js';
import { noRestyle } from '../src/lint/rules/no-restyle.js';

const reg = (name) => readFileSync(new URL(`../packages/registry/components/${name}.ts`, import.meta.url), 'utf8');

test('drift: the no-restyle size list equals extractHelperAxes(button.ts).buttonClass.size', () => {
  const axes = extractHelperAxes(reg('button')).buttonClass;
  assert.deepEqual(axes.size, ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']);
  const s = scanClassSites("html`<button class=${cn(buttonClass(), 'rounded-full')}>`", { helpers: ['buttonClass'] })[0];
  const [v] = noRestyle(s, { allow: ['layout'], axesFor: () => ({ axes, file: 'components/ui/button.ts' }) });
  const listed = /Use a buttonClass size: ([^(]+) \(/.exec(v.message)[1].split(', ');
  assert.deepEqual(listed, axes.size);
});

test('drift: the projector resolves badge.ts inline and unions switch.ts objects; an unmatched shape yields nothing', () => {
  assert.deepEqual(extractHelperAxes(reg('badge')).badgeClass.variant, ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link']);
  assert.deepEqual(extractHelperAxes(reg('switch')).switchTrackClass.size, ['default', 'sm']);
  assert.deepEqual(extractHelperAxes(reg('card')), {});
});
