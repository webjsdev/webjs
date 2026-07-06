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
 * action, and everything loads through the real dev pipeline (TS strip,
 * `.server.ts` -> RPC stub, `#` alias, `/__webjs/core/*`, the importmap)
 * instead of raw untransformed TS.
 *
 * The enabling change is the test-mode serve gate. The normal gate serves only
 * browser-bound files (route entries + every discovered component + their
 * imports). A test can import a NON-component helper/fixture that no route
 * reaches, which the normal gate 404s; test mode serves any app file under
 * appDir, while the `.server.*` source guardrail (source -> RPC stub) is
 * unchanged, so no server source is exposed.
 */

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-browser-test-'));
  await mkdir(join(dir, 'app'), { recursive: true });
  await mkdir(join(dir, 'components'), { recursive: true });
  await mkdir(join(dir, 'lib'), { recursive: true });
  await mkdir(join(dir, 'modules/todos/actions'), { recursive: true });
  await writeFile(
    join(dir, 'app/page.ts'),
    `import { html } from '@webjsdev/core';\nexport default () => html\`<h1>home</h1>\`;\n`,
  );
  // A registered component that imports a 'use server' action: the real thing a
  // browser test mounts. A component IS browser-bound (every discovered
  // component is a browser-bound entry), so the normal gate already serves it;
  // the harness's job is to serve it TRANSFORMED (stripped + stubbed).
  await writeFile(
    join(dir, 'components/todo-list.ts'),
    `import { WebComponent, html } from '@webjsdev/core';\n` +
      `import { createTodo } from '../modules/todos/actions/create-todo.server.ts';\n` +
      `class TodoList extends WebComponent({}) { render() { return html\`<button @click=\${() => createTodo()}>add</button>\`; } }\n` +
      `TodoList.register('todo-list');\n`,
  );
  await writeFile(
    join(dir, 'modules/todos/actions/create-todo.server.ts'),
    `'use server';\nexport async function createTodo() { return { ok: true }; }\n`,
  );
  // A NON-component helper no route reaches: not browser-bound, so the normal
  // gate 404s it, but a browser test may import it. This is what test mode adds.
  await writeFile(
    join(dir, 'lib/test-only.ts'),
    `export const marker: string = 'test-only-helper';\nexport function help() { return marker; }\n`,
  );
  return dir;
}

test('normal handler 404s a non-browser-bound helper a test would import (#806)', async () => {
  const dir = await makeApp();
  try {
    const app = await createRequestHandler({ appDir: dir, dev: true });
    if (app.warmup) await app.warmup();
    const resp = await app.handle(new Request('http://localhost/lib/test-only.ts'));
    assert.equal(resp.status, 404, 'a helper no route imports is not browser-bound, so the normal gate 404s it');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('test handler serves any app file (incl. a non-browser-bound helper), stripped (#806)', async () => {
  const dir = await makeApp();
  try {
    const t = await createBrowserTestHandler(dir);
    const resp = await t.handle(new Request('http://localhost/lib/test-only.ts'));
    assert.equal(resp.status, 200, 'test mode serves any app file under appDir');
    const body = await resp.text();
    assert.ok(body.includes('test-only-helper') && body.includes('function help'), 'served the helper module');
    assert.ok(!/marker: string/.test(body), 'TS was stripped (the `: string` annotation is gone)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('test handler serves a real component + its action as an RPC stub + an importmap (#806)', async () => {
  const dir = await makeApp();
  try {
    const t = await createBrowserTestHandler(dir);

    const comp = await t.handle(new Request('http://localhost/components/todo-list.ts'));
    assert.equal(comp.status, 200, 'the component under test is served');
    const compBody = await comp.text();
    assert.ok(compBody.includes('register') && compBody.includes('WebComponent'), 'served the component module');

    // The `.server.ts` action is a working RPC stub, never its source.
    const action = await t.handle(new Request('http://localhost/modules/todos/actions/create-todo.server.ts'));
    assert.equal(action.status, 200, 'the action file resolves (as a stub)');
    const stub = await action.text();
    assert.ok(/__webjs\/action\/|server-action stub/.test(stub), 'the action import is an RPC stub');

    // The importmap the test page injects maps @webjsdev/core so bare imports resolve.
    const im = t.importmapHtml();
    assert.ok(im.includes('type="importmap"'), 'importmapHtml is an importmap script tag');
    assert.ok(im.includes('@webjsdev/core'), 'the importmap maps @webjsdev/core');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
