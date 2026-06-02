/**
 * The per-file inline escape hatch: `// webjs-check-ignore <rule>` suppresses
 * that rule for the file, so a component that genuinely needs a flagged
 * pattern can keep it without disabling the rule project-wide. `*` suppresses
 * all rules for the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions } from '../../src/check.js';

async function appWith(rel, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-ig-'));
  const filePath = join(dir, rel);
  await mkdir(filePath.slice(0, filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(filePath, contents);
  return dir;
}
const ofRule = (vs, rule, file) => vs.filter((v) => v.rule === rule && v.file.includes(file));

const FLAGGED = `
import { WebComponent, html } from '@webjsdev/core';
export class C extends WebComponent {
  show() { return Number(this.getAttribute('delay-duration') ?? 700); }
  render() { return html\`<p></p>\`; }
}
C.register('c-el');
`;

test('without the directive, the rule fires', async () => {
  const dir = await appWith('components/c.ts', FLAGGED);
  try {
    assert.equal(ofRule(await checkConventions(dir), 'prefer-reactive-prop-over-getattribute', 'c.ts').length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('webjs-check-ignore <rule> suppresses that rule for the file', async () => {
  const dir = await appWith('components/c.ts',
    `// webjs-check-ignore prefer-reactive-prop-over-getattribute reading a legacy attr\n${FLAGGED}`);
  try {
    assert.equal(ofRule(await checkConventions(dir), 'prefer-reactive-prop-over-getattribute', 'c.ts').length, 0,
      'the inline directive suppresses the violation');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('webjs-check-ignore * suppresses all rules for the file', async () => {
  const dir = await appWith('components/c.ts', `// webjs-check-ignore *\n${FLAGGED}`);
  try {
    assert.equal(ofRule(await checkConventions(dir), 'prefer-reactive-prop-over-getattribute', 'c.ts').length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the directive only affects the file it is in', async () => {
  const dir = await appWith('components/c.ts', FLAGGED);
  // a second flagged file without the directive still fires
  const fp = join(dir, 'components/d.ts');
  await writeFile(fp, FLAGGED.replace(/\bC\b/g, 'D').replace('c-el', 'd-el'));
  await writeFile(join(dir, 'components/c.ts'),
    `// webjs-check-ignore prefer-reactive-prop-over-getattribute\n${FLAGGED}`);
  try {
    const vs = await checkConventions(dir);
    assert.equal(ofRule(vs, 'prefer-reactive-prop-over-getattribute', 'c.ts').length, 0, 'c.ts suppressed');
    assert.equal(ofRule(vs, 'prefer-reactive-prop-over-getattribute', 'd.ts').length, 1, 'd.ts still fires');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
