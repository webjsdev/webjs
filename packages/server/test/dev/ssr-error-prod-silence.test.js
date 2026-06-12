/**
 * SSR error prod-silence keys on the server `dev` flag, not NODE_ENV (#483).
 *
 * A component whose `render()` throws during SSR is isolated to a
 * component-scoped error state (`defaultSSRErrorTemplate`). Dev surfaces the
 * message; prod stays silent. The prod signal is the server `dev` flag threaded
 * through the SSR render context, NOT `process.env.NODE_ENV` (which `webjs
 * start` does not export, so a bare prod launch would otherwise leak). A
 * context-free `renderToString` with no dev signal falls back to NODE_ENV.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { renderToString } from '../../../core/src/render-server.js';
import { html } from '../../../core/src/html.js';
import { WebComponent } from '../../../core/src/component.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_INDEX = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

const SECRET = 'SECRET-DB-ERROR-9c2f1';

// A component whose render throws, so the SSR walker isolates it to a
// component-scoped error state via defaultSSRErrorTemplate.
const THROW_CARD =
  `import { WebComponent, html } from ${JSON.stringify(CORE_INDEX)};\n` +
  `export class ThrowCard extends WebComponent {\n` +
  `  render() { throw new Error('${SECRET}'); }\n` +
  `}\n` +
  `ThrowCard.register('throw-card');\n`;

const PAGE =
  `import { html } from ${JSON.stringify(CORE_INDEX)};\n` +
  `import './throw-card.ts';\n` +
  `export default function P() {\n` +
  `  return html\`<main><h1>page</h1><throw-card></throw-card></main>\`;\n` +
  `}\n`;

let tmpRoot;
let savedNodeEnv;
before(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-ssr-err-'));
  // Prove the signal is `dev`, not NODE_ENV, by running with NODE_ENV unset.
  savedNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
});
after(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = savedNodeEnv;
});

function makeApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.ts'), PAGE);
  writeFileSync(join(appDir, 'app', 'throw-card.ts'), THROW_CARD);
  return appDir;
}

test('PROD (dev:false, NODE_ENV unset): a thrown component render does NOT leak the message', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: false });
  const res = await app.handle(new Request('http://x/'));
  const body = await res.text();
  assert.ok(body.includes('page'), 'sibling content rendered (the throw is isolated)');
  assert.ok(
    !body.includes(SECRET),
    `prod must NOT leak the component error message even with NODE_ENV unset; body:\n${body}`,
  );
});

test('DEV (dev:true): a thrown component render surfaces the message', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: true });
  const res = await app.handle(new Request('http://x/'));
  const body = await res.text();
  assert.ok(body.includes(SECRET), `dev must surface the component error message; body:\n${body}`);
});

test('CORE: renderToString gates on suspenseCtx.dev, independent of NODE_ENV', async () => {
  // This is the reliable counterfactual for the leak (#483). It drives a
  // throwing component straight through renderToString with the suspenseCtx
  // that ssr.js stamps, NODE_ENV deleted, so NO env signal masks the result:
  // dev:false MUST stay silent (reverting the dev-gating to isProd() would leak
  // here because isProd() is false with NODE_ENV unset), dev:true MUST surface.
  class SuspenseThrow extends WebComponent {
    render() { throw new Error('SUSPCTX-SECRET'); }
  }
  SuspenseThrow.register('suspctx-throw');
  const tpl = html`<div><suspctx-throw></suspctx-throw></div>`;
  delete process.env.NODE_ENV;

  const prod = await renderToString(tpl, { ssr: true, suspenseCtx: { pending: [], nextId: 1, dev: false } });
  assert.ok(!prod.includes('SUSPCTX-SECRET'), 'dev:false stays silent with NODE_ENV unset (the leak-prevention)');

  const dev = await renderToString(tpl, { ssr: true, suspenseCtx: { pending: [], nextId: 1, dev: true } });
  assert.ok(dev.includes('SUSPCTX-SECRET'), 'dev:true surfaces the message');
});

test('context-free renderToString falls back to NODE_ENV', async () => {
  class CtxFreeThrow extends WebComponent {
    render() { throw new Error('CTXFREE-SECRET'); }
  }
  CtxFreeThrow.register('ctxfree-throw');
  const tpl = html`<div><ctxfree-throw></ctxfree-throw></div>`;

  // No dev signal + NODE_ENV unset (not 'production') means not prod, so surface.
  delete process.env.NODE_ENV;
  const dev = await renderToString(tpl);
  assert.ok(dev.includes('CTXFREE-SECRET'), 'no dev signal + non-prod NODE_ENV surfaces the message');

  // No dev signal + NODE_ENV=production means prod, so stay silent.
  process.env.NODE_ENV = 'production';
  const prod = await renderToString(tpl);
  assert.ok(!prod.includes('CTXFREE-SECRET'), 'no dev signal + NODE_ENV=production stays silent');
  delete process.env.NODE_ENV;
});
