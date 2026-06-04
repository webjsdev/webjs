/**
 * Integration test for the docs site's llms.txt agent entrypoints (#261).
 *
 * Boots the docs app via createRequestHandler in prod mode (appDir =>
 * <repo>/docs) and asserts the three machine-readable surfaces serve
 * correctly and stay in sync with the live doc pages:
 *   GET /llms.txt                       the structured index
 *   GET /llms-full.txt                  the full prose corpus
 *   GET /docs/<topic>/llms.txt          a per-page markdown variant
 *
 * The routes are generated live from app/docs/<topic>/page.ts, so the
 * link-count == page-count assertion proves there is no drift (adding a
 * doc page automatically appears in the index, no build step).
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { createRequestHandler } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const DOCS_DIR = resolve(ROOT, 'docs');

/** @type {(path: string) => Promise<Response>} */
let handle;

before(async () => {
  const app = await createRequestHandler({ appDir: DOCS_DIR, dev: false });
  handle = (path) => app.handle(new Request('http://localhost' + path));
});

/** Count the topic folders under docs/app/docs that hold a page.{ts,js}. */
async function countTopicPages() {
  const root = resolve(DOCS_DIR, 'app', 'docs');
  const dirents = await readdir(root, { withFileTypes: true });
  let n = 0;
  for (const d of dirents) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name.startsWith('_')) continue;
    if (d.name.startsWith('[')) continue; // dynamic [topic] folder is not a page
    const files = await readdir(resolve(root, d.name)).catch(() => []);
    if (files.includes('page.ts') || files.includes('page.js')) n++;
  }
  return n;
}

describe('docs /llms.txt (the index)', () => {
  test('GET /llms.txt returns 200 text/plain starting with an H1', async () => {
    const r = await handle('/llms.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/plain/);
    const body = await r.text();
    assert.ok(body.startsWith('# '), 'body should start with a markdown H1');
    assert.match(body, /^# webjs documentation/);
  });

  test('index lists known doc topics with absolute https URLs', async () => {
    const body = await (await handle('/llms.txt')).text();
    // The request origin is http in the harness, so links carry the
    // request origin. Assert the known titles are linked, and that the
    // link target is an absolute URL (origin-prefixed), which in
    // production resolves to https://docs.webjs.com.
    const links = body.split('\n').filter((l) => l.startsWith('- ['));
    assert.ok(links.length >= 3, 'expected at least 3 topic links');
    for (const title of ['Getting Started', 'Components', 'Server Actions']) {
      const line = links.find((l) => l.startsWith(`- [${title}]`));
      assert.ok(line, `missing index link for "${title}"`);
      assert.match(line, /\(https?:\/\/[^/]+\/docs\/[^)]+\/llms\.txt\)/, `link for "${title}" is not absolute`);
    }
  });

  test('the index is in sync with the doc pages (no drift)', async () => {
    const body = await (await handle('/llms.txt')).text();
    const linkCount = body.split('\n').filter((l) => l.startsWith('- [')).length;
    const pageCount = await countTopicPages();
    assert.equal(
      linkCount,
      pageCount,
      `index link count (${linkCount}) must equal the number of doc topic pages (${pageCount}); ` +
        'a mismatch means the live generation drifted from app/docs/**'
    );
  });
});

describe('docs /llms-full.txt (the corpus)', () => {
  test('GET /llms-full.txt returns 200 text/plain', async () => {
    const r = await handle('/llms-full.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/plain/);
  });

  test('corpus contains the FULL prose of at least two known pages', async () => {
    const body = await (await handle('/llms-full.txt')).text();
    // Distinctive sentences proving the corpus is the full body, not the
    // index. One from getting-started, one from components.
    assert.ok(
      body.includes('AI-first, web-components-first framework with a NextJs-like API'),
      'corpus missing getting-started prose'
    );
    assert.ok(
      body.includes('whose render method returns a tagged template instead of JSX'),
      'corpus missing components prose'
    );
    // And a third from no-build, to prove breadth.
    assert.ok(body.includes('no bundler, no webjs build command'), 'corpus missing no-build prose');
    // Much larger than the index (full bodies, not blurbs).
    const index = await (await handle('/llms.txt')).text();
    assert.ok(body.length > index.length * 5, 'corpus should dwarf the index');
  });
});

describe('docs per-page markdown variant', () => {
  test('GET /docs/getting-started/llms.txt returns that page in markdown', async () => {
    const r = await handle('/docs/getting-started/llms.txt');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/plain/);
    const body = await r.text();
    assert.match(body, /^# Getting Started/);
    assert.ok(body.includes('Source: '), 'should carry a Source: line');
    assert.ok(
      body.includes('AI-first, web-components-first framework'),
      'should contain the getting-started page prose'
    );
  });

  test('a core API page (components) also has a markdown variant', async () => {
    const body = await (await handle('/docs/components/llms.txt')).text();
    assert.match(body, /^# Components/);
    assert.ok(body.includes('whose render method returns a tagged template instead of JSX'));
  });

  test('an unknown topic returns 404 text/plain', async () => {
    const r = await handle('/docs/no-such-topic-xyz/llms.txt');
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type') || '', /text\/plain/);
  });

  test('the real human doc page still routes (no collision with [topic])', async () => {
    const r = await handle('/docs/getting-started');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/html/);
  });
});
