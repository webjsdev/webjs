/**
 * Next.js conformance: a server action that throws (#1686). Quotes, from the
 * local clone at `frameworks/next.js`:
 *
 *   docs/01-app/02-guides/interactive-apps.mdx:174 "If the Server Function ...
 *   throws, the error is forwarded to the nearest error boundary without a
 *   manual try/catch."
 *   docs/01-app/03-api-reference/03-file-conventions/error.mdx "`error.js`
 *   wraps a route segment and its nested children ... the `error` component
 *   shows as the fallback UI."
 *
 * A form bound to an action that throws answered a bare text 500 in WebJs.
 * It now renders the page's nearest error boundary, in production with the
 * sanitized message and a digest, as Next.js forwards them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../../packages/server/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(here, '../../../packages/core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

/** Boot an app with a page whose form action throws, submit it, return the response. */
async function submitThrowing({ dev, withBoundary }) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-conf-action-err-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  const seen = [];
  try {
    w('package.json', JSON.stringify({ name: 'conf-action-err', type: 'module' }));
    w('app/layout.js', `import { html } from ${CORE};\nexport default ({ children }) => html\`<!doctype html><html><body><header id="chrome">site</header>\${children}</body></html>\`;\n`);
    w('modules/save.server.js', `'use server';\nexport async function save() { throw new Error('pg: violates unique constraint "users_email_key"'); }\n`);
    w('app/notes/page.js', `import { html } from ${CORE};\nimport { save } from '../../modules/save.server.js';\nexport default () => html\`<form action=\${save}><button>Save</button></form>\`;\n`);
    if (withBoundary) {
      w('app/notes/error.js', `import { html } from ${CORE};\nexport default ({ error }) => html\`<p id="boundary">Could not save. <span id="msg">\${error.message}</span> <span id="digest">\${error.digest ?? ''}</span></p>\`;\n`);
    }
    const app = await createRequestHandler({ appDir: dir, dev, logger: quiet, onError: (e) => seen.push(e) });
    await app.warmup();
    const page = await (await app.handle(new Request('http://localhost/notes'))).text();
    const id = page.match(/name="__webjs_action" value="([^"]+)"/)?.[1];
    assert.ok(id, 'the form carries its action identity');
    const body = new URLSearchParams({ __webjs_action: id });
    const quietErr = console.error;
    console.error = () => {};
    try {
      const res = await app.handle(new Request('http://localhost/notes', {
        method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
      }));
      return { status: res.status, html: await res.text(), seen };
    } finally {
      console.error = quietErr;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a throwing action is forwarded to the nearest error boundary, inside its layout', async () => {
  const { status, html, seen } = await submitThrowing({ dev: false, withBoundary: true });
  assert.equal(status, 500);
  assert.match(html, /<p id="boundary">Could not save\./, 'error.js shows as the fallback UI');
  assert.match(html, /<header id="chrome">site<\/header>/, 'inside the layout the segment sits in');
  assert.doesNotMatch(html, /users_email_key/, 'production forwards a generic message, never the raw one');
  assert.match(html, /<span id="digest">[0-9a-z]+<\/span>/, 'and a digest to correlate with the server log');
  assert.equal(seen.length, 1, 'the error sink hears it once');
  assert.match(String(seen[0].message), /users_email_key/, 'with the original error');
});

test('with no error boundary the default 500 page answers, still with a digest', async () => {
  const { status, html } = await submitThrowing({ dev: false, withBoundary: false });
  assert.equal(status, 500);
  assert.match(html, /<h1>Server error<\/h1>/);
  assert.match(html, /Digest: [0-9a-z]+/);
});

test('in development the boundary sees the real message', async () => {
  const { html } = await submitThrowing({ dev: true, withBoundary: true });
  assert.match(html, /users_email_key/);
});
