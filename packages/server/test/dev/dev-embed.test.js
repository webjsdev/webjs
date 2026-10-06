/**
 * The dev embed bridge, server half (#1498), through the REAL request pipeline.
 *
 * With `WEBJS_EMBED_ORIGINS` set under dev, every document carries the inline
 * bridge script (nonce-signed when CSP is on) and the response stops refusing
 * the frame. Unset, or in production, the document is byte-identical to a run
 * without the feature and the framing headers are untouched: those two are the
 * counterfactuals that keep the feature from leaking into `webjs start`.
 */
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';
import { parseEmbedOrigins, allowEmbedFraming, embedScriptTag, setEmbedOrigins } from '../../src/dev-embed.js';

let tmpRoot;
const savedEnv = process.env.WEBJS_EMBED_ORIGINS;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-dev-embed-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });
afterEach(() => {
  if (savedEnv === undefined) delete process.env.WEBJS_EMBED_ORIGINS;
  else process.env.WEBJS_EMBED_ORIGINS = savedEnv;
  setEmbedOrigins([]);
});

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const PAGE = { 'app/page.js': "export default function P() { return '<h1>hi</h1>'; }\n" };
const ORIGINS = 'https://crisp.app, http://localhost:8080/';

async function get(opts, env, path = '/') {
  if (env === undefined) delete process.env.WEBJS_EMBED_ORIGINS;
  else process.env.WEBJS_EMBED_ORIGINS = env;
  const app = await createRequestHandler(opts);
  const res = await app.handle(new Request('http://localhost' + path));
  return { res, html: await res.text() };
}

test('parseEmbedOrigins normalizes origins and drops anything that is not one', () => {
  const warned = [];
  const got = parseEmbedOrigins(' https://a.dev/ ,http://localhost:8080/x, *, a.dev, ftp://f.dev, https://a.dev,', {
    warn: (m) => warned.push(m),
  });
  assert.deepEqual(got, ['https://a.dev', 'http://localhost:8080']);
  assert.equal(warned.length, 3, 'the wildcard, the bare host and the ftp origin are each warned about');
  assert.deepEqual(parseEmbedOrigins(undefined), []);
  assert.deepEqual(parseEmbedOrigins('  '), []);
});

test('dev + WEBJS_EMBED_ORIGINS: the document carries the bridge and the frame is allowed', async () => {
  const appDir = makeApp(PAGE);
  const { res, html } = await get({ appDir, dev: true }, ORIGINS);
  assert.equal(res.status, 200);
  assert.match(html, /<script data-webjs-embed>\(function\(\)\{function installEmbedBridge/);
  assert.ok(html.includes('installEmbedBridge(["https://crisp.app","http://localhost:8080"])'), 'the parsed origins are inlined');
  // Early in <head>, before the importmap and every module script, so a throw
  // during boot is already observed.
  assert.ok(html.indexOf('data-webjs-embed') < html.indexOf('type="importmap"'), 'the bridge runs before the importmap');
  assert.equal(res.headers.get('x-frame-options'), null, 'X-Frame-Options is dropped so the parent can frame the page');
});

test('dev without the variable: zero bytes added and the framing defaults stand', async () => {
  const appDir = makeApp(PAGE);
  const off = await get({ appDir, dev: true }, undefined);
  assert.ok(!off.html.includes('data-webjs-embed'), 'no bridge script');
  assert.ok(!off.html.includes('installEmbedBridge'), 'no bridge source');
  assert.equal(off.res.headers.get('x-frame-options'), 'SAMEORIGIN', 'the secure default is untouched');
  // Byte-identical to a dev document rendered with the bridge on, minus the
  // script itself: the off case adds no stray newline either.
  const on = await get({ appDir, dev: true }, ORIGINS);
  const stripped = on.html.replace(/\n<script data-webjs-embed>[\s\S]*?<\/script>/, '');
  assert.equal(stripped, off.html);
});

test('production never injects the bridge nor relaxes framing, even with the variable set', async () => {
  const appDir = makeApp(PAGE);
  const { res, html } = await get({ appDir, dev: false }, ORIGINS);
  assert.equal(res.status, 200);
  assert.ok(!html.includes('data-webjs-embed'), 'no bridge in a production document');
  assert.ok(!html.includes('installEmbedBridge'), 'no bridge source in a production document');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN', 'production keeps X-Frame-Options');
});

test('CSP on: the bridge carries the request nonce and frame-ancestors names the origins', async () => {
  const appDir = makeApp({
    ...PAGE,
    'package.json': JSON.stringify({ name: 'csp-embed', type: 'module', webjs: { csp: true } }),
  });
  const { res, html } = await get({ appDir, dev: true }, ORIGINS);
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp, 'CSP is on');
  const nonce = /nonce-([^']+)/.exec(csp)[1];
  assert.ok(html.includes(`<script nonce="${nonce}" data-webjs-embed>`), 'the bridge script is nonce-signed with the header nonce');
  assert.match(csp, /frame-ancestors 'self' https:\/\/crisp\.app http:\/\/localhost:8080/);
  assert.equal(res.headers.get('x-frame-options'), null);
});

test('allowEmbedFraming widens frame-ancestors, replaces none, and leaves a policy without it alone', () => {
  const h = new Headers({
    'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; img-src *",
    'content-security-policy-report-only': "script-src 'self'",
  });
  allowEmbedFraming(h, ['https://a.dev']);
  assert.equal(h.get('x-frame-options'), null);
  assert.equal(h.get('content-security-policy'), "default-src 'self'; frame-ancestors https://a.dev; img-src *");
  assert.equal(h.get('content-security-policy-report-only'), "script-src 'self'");
  const first = new Headers({ 'content-security-policy': "frame-ancestors 'self'" });
  allowEmbedFraming(first, ['https://a.dev', 'https://b.dev']);
  assert.equal(first.get('content-security-policy'), "frame-ancestors 'self' https://a.dev https://b.dev");
});

test('the inlined bridge is comment-free, contains no script closer, and stays small', () => {
  setEmbedOrigins(['https://a.dev']);
  const tag = embedScriptTag({ dev: true });
  const body = tag.slice(tag.indexOf('>') + 1, tag.lastIndexOf('</script>'));
  assert.ok(!/<\/script/i.test(body), 'no </script inside the inline body');
  assert.ok(!body.includes('<!--'), 'no comment opener that would flip the script parser state');
  assert.ok(!/^\s*\/\//m.test(body), 'whole-line comments are stripped');
  assert.ok(body.length < 10_000, `the bridge stays small (${body.length} bytes)`);
  assert.equal(embedScriptTag({ dev: false }), '', 'never emitted outside dev');
  // The stripper is regex-based, so the source must not hide a comment opener
  // inside a string or a regex literal, where stripping would corrupt code.
  const src = readFileSync(new URL('../../src/dev-embed-client.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/['"`][^'"`\n]*(\/\*|\/\/)[^'"`\n]*['"`]/.test(code), 'no comment opener inside a string literal');
  assert.doesNotThrow(() => new Function(body), 'the inlined body parses');
});
