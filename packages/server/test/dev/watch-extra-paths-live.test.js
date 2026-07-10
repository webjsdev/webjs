/**
 * #894 end-to-end: a `webjs.dev.watch` entry pointing OUTSIDE the appDir makes
 * an edit under that dir live-reload, exactly like an in-tree edit. Booting the
 * real dev server (not just the handler) is the point: the extra watchers are
 * wired in `startServer`, alongside the recursive appDir watcher, and prove
 * themselves only by firing an actual SSE `reload` frame. The counterfactual
 * (no config -> the same sibling edit fires NOTHING) proves the appDir watch
 * alone never saw the outside dir, which is the bug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startServer } from '../../src/dev.js';

/** Build an app dir + a SIBLING content dir; return both. */
function scaffold(webjs) {
  const root = mkdtempSync(join(tmpdir(), 'webjs-extrawatch-'));
  const appDir = join(root, 'site');
  const contentDir = join(root, 'content');
  mkdirSync(join(appDir, 'app'), { recursive: true });
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), "export default function P() { return 'ok'; }\n");
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'site', type: 'module', ...(webjs ? { webjs } : {}) }));
  writeFileSync(join(contentDir, 'post.md'), '# original\n');
  return { appDir, contentDir };
}

/** Resolve on the FIRST `event: reload` seen on the SSE stream, or on timeout. */
function waitForReload(port, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { req.destroy(); } catch {} resolve(v); } };
    const req = get({ port, path: '/__webjs/events', headers: { accept: 'text/event-stream' } }, (res) => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (c) => { buf += c; if (/(^|\n)event: reload(\n|$)/.test(buf)) finish(true); });
    });
    req.on('error', () => finish(false));
    setTimeout(() => finish(false), ms);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('an edit under a webjs.dev.watch dir OUTSIDE the appDir live-reloads (#894)', async () => {
  const { appDir, contentDir } = scaffold({ dev: { watch: ['../content'] } });
  const srv = await startServer({ appDir, port: 0, dev: true });
  const port = srv.server.address().port;
  try {
    const reloaded = waitForReload(port, 4000);
    await sleep(150); // let the SSE stream connect before the edit
    writeFileSync(join(contentDir, 'post.md'), '# edited\n');
    assert.equal(await reloaded, true, 'editing the sibling content dir fired a reload');
  } finally {
    await srv.close();
  }
});

test('WITHOUT the config, the same sibling edit fires nothing (proves it was unwatched)', async () => {
  const { appDir, contentDir } = scaffold(undefined); // no webjs.dev.watch
  const srv = await startServer({ appDir, port: 0, dev: true });
  const port = srv.server.address().port;
  try {
    const reloaded = waitForReload(port, 1500);
    await sleep(150);
    writeFileSync(join(contentDir, 'post.md'), '# edited\n');
    assert.equal(await reloaded, false, 'the sibling dir is not watched by default');
  } finally {
    await srv.close();
  }
});

test('an in-tree app edit still reloads (extra watchers do not displace the appDir watcher)', async () => {
  const { appDir } = scaffold({ dev: { watch: ['../content'] } });
  const srv = await startServer({ appDir, port: 0, dev: true });
  const port = srv.server.address().port;
  try {
    const reloaded = waitForReload(port, 4000);
    await sleep(150);
    writeFileSync(join(appDir, 'app', 'page.js'), "export default function P() { return 'edited'; }\n");
    assert.equal(await reloaded, true, 'the recursive appDir watcher still fires');
  } finally {
    await srv.close();
  }
});
