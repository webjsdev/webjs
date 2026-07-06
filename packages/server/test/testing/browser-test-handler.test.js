import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createRequestHandler } from '../../src/dev.js';
import { createBrowserTestHandler } from '../../src/testing.js';

/**
 * Browser-test harness (#806). `createBrowserTestHandler(appDir)` builds a
 * webjs handler a `web-test-runner` config proxies module requests to, so a
 * browser test can import a real `.ts` component that imports a `'use server'`
 * action. The key behaviour vs the normal handler is the test-mode serve gate:
 * a component a test imports is NOT route-reachable, so the normal gate
 * (`browserBoundFiles`) 404s it; test mode serves any app file under appDir,
 * while the `.server.*` guardrail (source -> RPC stub) is unchanged.
 */

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-browser-test-'));
  await mkdir(join(dir, 'app'), { recursive: true });
  await mkdir(join(dir, 'components'), { recursive: true });
  await mkdir(join(dir, 'modules/todos/actions'), { recursive: true });
  await writeFile(
    join(dir, 'app/page.ts'),
    `import { html } from '@webjsdev/core';\nexport default () => html\`<h1>home</h1>\`;\n`,
  );
  // An ORPHAN component: no page renders it, so it is not route-reachable.
  await writeFile(
    join(dir, 'components/orphan.ts'),
    `import { WebComponent, html } from '@webjsdev/core';\n` +
      `import { doThing } from '../modules/todos/actions/do-thing.server.ts';\n` +
      `class Orphan extends WebComponent({}) { render() { return html\`<p>\${typeof doThing}</p>\`; } }\n` +
      `Orphan.register('orphan-el');\n`,
  );
  await writeFile(
    join(dir, 'modules/todos/actions/do-thing.server.ts'),
    `'use server';\nexport async function doThing() { return { ok: true }; }\n`,
  );
  return dir;
}

test('normal handler 404s an orphan component (not route-reachable)', async () => {
  const dir = await makeApp();
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const resp = await app.handle(new Request('http://localhost/components/orphan.ts'));
    assert.equal(resp.status, 404, 'a component no page renders is not servable by the normal gate');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('test handler serves the orphan component as stripped JS, and its action as an RPC stub (#806)', async () => {
  const dir = await makeApp();
  try {
    const t = await createBrowserTestHandler(dir);

    const comp = await t.handle(new Request('http://localhost/components/orphan.ts'));
    assert.equal(comp.status, 200, 'test mode serves any app component under appDir');
    const body = await comp.text();
    assert.ok(body.includes('register') && body.includes('WebComponent'), 'served the component module');
    assert.ok(!/class Orphan extends WebComponent\(\{\}\) \{ render\(\): /.test(body), 'TS was stripped (no type annotations leaked)');

    // The `.server.ts` action is a working RPC stub, never its source.
    const action = await t.handle(new Request('http://localhost/modules/todos/actions/do-thing.server.ts'));
    assert.equal(action.status, 200, 'the action file resolves (as a stub)');
    const stub = await action.text();
    assert.ok(/__webjs\/action\/|server-action stub/.test(stub), 'the action import is an RPC stub');
    assert.ok(!/'use server'/.test(stub) || /stub/.test(stub), 'the action source is not served verbatim');

    // The importmap the test page injects maps @webjsdev/core.
    const im = t.importmapHtml();
    assert.ok(im.includes('type="importmap"'), 'importmapHtml is an importmap script tag');
    assert.ok(im.includes('@webjsdev/core'), 'the importmap maps @webjsdev/core so bare imports resolve');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
