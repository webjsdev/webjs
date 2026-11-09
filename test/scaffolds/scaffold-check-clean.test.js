/**
 * A freshly scaffolded app is clean under `webjs check`, in every template and
 * after the gallery is cleared. The scaffold is the first WebJs code an agent
 * reads and the base it grows, and the check-on-edit hook reports violations in
 * any file the agent touches, so a violation shipped by the generator would be
 * blamed on the agent's first edit. Generators emit strings, so only a generated
 * app proves this.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { checkConventions } from '@webjsdev/server/check';
import { createRequestHandler } from '@webjsdev/server';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function mute() {
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  return () => { console.log = log; console.error = err; };
}

const describe = (vs) => vs.map((v) => `[${v.rule}] ${v.file}: ${v.message}`).join('\n');

for (const template of ['full-stack', 'api']) {
  test(`a scaffolded ${template} app is clean under webjs check, before and after clearing the gallery`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), `webjs-check-clean-${template}-`));
    const restore = mute();
    try {
      await scaffoldApp('demo', cwd, { template });
      const appDir = join(cwd, 'demo');
      await symlink(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));

      const fresh = await checkConventions(appDir);
      assert.deepEqual(fresh, [], `the generated app has violations:\n${describe(fresh)}`);

      if (template === 'full-stack') {
        // The brief tells agents to run `webjs status` after each edit, so a
        // fresh app must report clean there too. Rendering the home page also
        // renders the gallery's components, and a component that fails during
        // SSR answers 200 while the dev status records it.
        const h = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {}, debug() {} } });
        await h.warmup?.();
        const home = await h.handle(new Request('http://localhost/'));
        assert.equal(home.status, 200, 'the home page renders');
        const st = await (await h.handle(new Request('http://localhost/__webjs/dev/status'))).json();
        assert.deepEqual(st.errors, [], `the dev status reports problems on a fresh app: ${JSON.stringify(st.errors)}`);
      }

      const script = template === 'api' ? 'clear-api-gallery.mjs' : 'clear-gallery.mjs';
      const clear = join(appDir, 'scripts', script);
      assert.ok(existsSync(clear), `${script} ships with the ${template} app`);
      const r = spawnSync(process.execPath, [clear], { cwd: appDir, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr || r.stdout);

      const cleared = await checkConventions(appDir);
      assert.deepEqual(cleared, [], `the cleared app has violations:\n${describe(cleared)}`);
    } finally {
      restore();
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
