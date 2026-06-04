/**
 * Integration test for the content-negotiated stream-action form path (#248),
 * through the REAL request pipeline (`createRequestHandler`).
 *
 * A page `action` branches on `acceptsStream(request)`:
 *   - WITH the stream Accept (a router-enhanced submission) it returns
 *     `streamResponse(...)`, honored verbatim (status 200, stream content type,
 *     a `<webjs-stream>` body the client applies surgically).
 *   - WITHOUT it (a native no-JS form POST) the SAME action returns a normal
 *     ActionResult, so the pipeline does Post/Redirect/Get (303). This is the
 *     progressive-enhancement degrade the grammar promises.
 *
 * The counterfactual is the no-Accept branch: prove the SAME endpoint does NOT
 * emit a stream when the client did not negotiate one.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());
const SERVER = JSON.stringify(pathToFileURL(resolve(__dirname, '../../index.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-stream-form-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

// A page whose `action` content-negotiates: a stream response when the client
// asked for one, a normal PRG redirect (the no-JS degrade) otherwise.
const COMMENT_PAGE = `
import { html } from ${CORE};
import { acceptsStream, stream, streamResponse } from ${SERVER};
export async function action({ request, formData }) {
  const text = String(formData.get('text') || '');
  if (acceptsStream(request)) {
    return streamResponse(stream.append('comments', '<li>' + text + '</li>'));
  }
  return { success: true, redirect: '/post' };
}
export default function Post() {
  return html\`<ul id="comments"></ul><form method="POST"><input name="text"></form>\`;
}
`;

function formPost(extraHeaders) {
  const body = new URLSearchParams({ text: 'hi' }).toString();
  return new Request('http://x/post', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...extraHeaders },
    body,
  });
}

test('WITH the stream Accept, the page action returns a surgical stream response', async () => {
  const appDir = makeApp({ 'app/post/page.js': COMMENT_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });

  const res = await app.handle(formPost({ accept: 'text/vnd.webjs-stream.html, text/html' }));
  assert.equal(res.status, 200, 'stream response is 200');
  assert.match(res.headers.get('content-type') || '', /text\/vnd\.webjs-stream\.html/, 'stream content type');
  const body = await res.text();
  assert.match(body, /<webjs-stream action="append" target="comments">/, 'carries the append action');
  assert.match(body, /<li>hi<\/li>/, 'carries the new comment content');
});

test('WITHOUT the stream Accept (no-JS form), the SAME action degrades to a 303 PRG', async () => {
  const appDir = makeApp({ 'app/post/page.js': COMMENT_PAGE });
  const app = await createRequestHandler({ appDir, dev: true });

  const res = await app.handle(formPost({})); // a native form POST sends no stream Accept
  assert.equal(res.status, 303, 'degrades to Post/Redirect/Get');
  assert.equal(res.headers.get('location'), '/post', 'redirects to the page');
  // The counterfactual: the body is NOT a stream payload.
  const ctype = res.headers.get('content-type') || '';
  assert.ok(!ctype.includes('webjs-stream'), 'no stream content type on the no-JS path');
});
