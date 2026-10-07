// The agent context pack (.agents/context-pack.md): `webjs create` writes the
// skill core and one example per concern into one file that CLAUDE.md
// imports, so an agent starts with them in its cached prompt prefix instead of
// opening each file. It must be byte-stable across apps (one cache key), show
// the app's own files verbatim, and survive gallery:clear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffoldApp } from '../../packages/cli/lib/create.js';
import { stripPackOmit, PACK_EXAMPLES } from '../../packages/cli/lib/context-pack.js';

const mute = () => { const l = console.log; console.log = () => {}; return () => { console.log = l; }; };

test('webjs create writes a byte-stable context pack that CLAUDE.md imports and gallery:clear keeps', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-pack-'));
  const restore = mute();
  try {
    await scaffoldApp('one-app', cwd, { template: 'full-stack', install: false });
    await scaffoldApp('other-app', cwd, { template: 'full-stack', install: false });
  } finally { restore(); }
  try {
    const one = readFileSync(join(cwd, 'one-app/.agents/context-pack.md'), 'utf8');
    const other = readFileSync(join(cwd, 'other-app/.agents/context-pack.md'), 'utf8');
    assert.equal(one, other, 'two apps get the same pack, so they share a cache key');
    assert.match(readFileSync(join(cwd, 'one-app/CLAUDE.md'), 'utf8'), /^@AGENTS\.md\n@\.agents\/context-pack\.md\n/);
    for (const rel of ['modules/todo/components/todo-app.ts', 'modules/auth/auth.server.ts', 'app/features/forms/page.ts', 'modules/forms/actions/send-message.server.ts']) {
      assert.ok(one.includes(`### \`${rel}\``), `the pack includes ${rel}`);
      assert.ok(one.includes(readFileSync(join(cwd, 'one-app', rel), 'utf8').trimEnd()), `${rel} is verbatim`);
    }
    for (const [, files] of PACK_EXAMPLES) for (const rel of files) assert.ok(existsSync(join(cwd, 'one-app', rel)), `PACK_EXAMPLES names a file the gallery ships: ${rel}`);
    // The skill files are in the pack minus their pack:omit regions: the code a
    // pack example already shows is replaced by a one-line pointer, nothing else
    // changes, and no marker reaches the pack.
    for (const rel of ['.agents/skills/webjs/SKILL.md', '.agents/skills/webjs/references/data-and-actions.md']) {
      const disk = readFileSync(join(cwd, 'one-app', rel), 'utf8');
      assert.ok(one.includes(`### \`${rel}\``), `the pack includes ${rel}`);
      assert.ok(disk.includes('<!-- pack:omit '), `${rel} on disk keeps its marked regions`);
      assert.ok(one.includes(stripPackOmit(disk).trimEnd()), `${rel} is verbatim once stripped`);
    }
    assert.ok(!one.includes('pack:omit'), 'no marker reaches the pack');
    assert.ok(readFileSync(join(cwd, 'one-app/.agents/skills/webjs/SKILL.md'), 'utf8').includes('// app/about/page.ts'), 'the canonical page example stays on disk');
    assert.ok(!one.includes('// app/about/page.ts'), 'the pack drops the page example its todo page already shows');
    assert.ok(one.includes('`app/features/auth/login/page.ts` above is one'), 'the pack points at the example it holds instead');
    assert.doesNotMatch(one, new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'no absolute paths');
    const clear = spawnSync(process.execPath, ['scripts/clear-gallery.mjs'], { cwd: join(cwd, 'one-app'), encoding: 'utf8' });
    assert.equal(clear.status, 0, clear.stderr);
    assert.equal(readFileSync(join(cwd, 'one-app/.agents/context-pack.md'), 'utf8'), one, 'gallery:clear keeps the pack');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('stripPackOmit removes a marked region, keeps its replacement line and leaves the rest alone', () => {
  const text = 'intro\n\n<!-- pack:omit `a.ts` above shows this. -->\n```ts\nconst x = 1;\n```\n<!-- /pack:omit -->\n\nrules stay\n\n<!-- pack:omit -->\ngone without a trace\n<!-- /pack:omit -->\n\ntail\n';
  assert.equal(stripPackOmit(text), 'intro\n\n`a.ts` above shows this.\n\nrules stay\n\ntail\n');
  // Counterfactual: text with no marker is returned unchanged.
  const plain = 'no markers\n\n```ts\nconst y = 2;\n```\n';
  assert.equal(stripPackOmit(plain), plain);
});
