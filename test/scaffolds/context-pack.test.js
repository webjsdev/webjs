// The agent context pack (.agents/context-pack.md): `webjs create` writes the
// skill core and one example per concern into one file that CLAUDE.md
// imports, so an agent starts with them in its cached prompt prefix instead of
// opening each file. It must be byte-stable across apps (one cache key), show
// the app's own files verbatim, and survive gallery:clear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

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
    for (const rel of ['modules/todo/components/todo-app.ts', 'modules/auth/auth.server.ts', 'app/features/forms/page.ts', '.agents/skills/webjs/SKILL.md', '.agents/skills/webjs/references/data-and-actions.md']) {
      assert.ok(one.includes(`### \`${rel}\``), `the pack includes ${rel}`);
      assert.ok(one.includes(readFileSync(join(cwd, 'one-app', rel), 'utf8').trimEnd()), `${rel} is verbatim`);
    }
    assert.doesNotMatch(one, new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'no absolute paths');
    const clear = spawnSync(process.execPath, ['scripts/clear-gallery.mjs'], { cwd: join(cwd, 'one-app'), encoding: 'utf8' });
    assert.equal(clear.status, 0, clear.stderr);
    assert.equal(readFileSync(join(cwd, 'one-app/.agents/context-pack.md'), 'utf8'), one, 'gallery:clear keeps the pack');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
