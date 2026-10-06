/**
 * End-to-end test for `webjs dev` in a workspace (#1526).
 *
 * A bun workspace hoists `@webjsdev/cli` to the ROOT `node_modules`, so
 * `webjs dev` inside a member app runs the root's `.bin/webjs`. This starts the
 * real CLI the way a workspace does, through the hoisted bin, under Node and
 * (when installed) under `bun --bun`, and proves:
 *
 *   1. started inside the member app, it serves THAT app (200 with the page);
 *   2. started at the workspace root, which has no `app/`, it exits 1 with a
 *      message naming the member app, instead of booting a server that answers
 *      404 for every route (what a launch from the Crisp repo root did).
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-workspace-member.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HAS_BUN = spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)); });
    srv.on('error', rej);
  });
}

/** A workspace root with `apps/web` as its one member app and a hoisted cli. */
function stageWorkspace() {
  const ws = mkdtempSync(join(tmpdir(), 'webjs-ws-e2e-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', private: true, type: 'module', workspaces: ['apps/*', 'packages/*'] }));
  const nm = join(ws, 'node_modules');
  mkdirSync(join(nm, '@webjsdev'), { recursive: true });
  mkdirSync(join(nm, '.bin'));
  for (const pkg of ['core', 'server', 'cli']) symlinkSync(join(ROOT, 'packages', pkg), join(nm, '@webjsdev', pkg));
  symlinkSync('../@webjsdev/cli/bin/webjs.js', join(nm, '.bin', 'webjs'));
  const app = join(ws, 'apps', 'web');
  mkdirSync(join(app, 'app'), { recursive: true });
  mkdirSync(join(ws, 'packages', 'lib'), { recursive: true });
  writeFileSync(join(ws, 'packages', 'lib', 'package.json'), JSON.stringify({ name: '@ws/lib', version: '0.0.0', type: 'module' }));
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: '@ws/web', version: '0.0.0', private: true, type: 'module' }));
  writeFileSync(join(app, 'app', 'page.js'), "import { html } from '@webjsdev/core';\nexport default function Home() { return html`<h1>member app served</h1>`; }\n");
  return { ws, app, bin: join(nm, '.bin', 'webjs') };
}

/** How each runtime runs the hoisted bin, the way a workspace member script does. */
const RUNTIMES = [
  { name: 'node', cmd: (bin) => [process.execPath, [bin]] },
  ...(HAS_BUN ? [{ name: 'bun', cmd: () => ['bun', ['--bun', 'webjs']] }] : []),
];

async function getRoot(port, ms = 30000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      return { status: res.status, body: await res.text() };
    } catch (e) { last = e; }
    await sleep(150);
  }
  throw new Error(`no answer on :${port} (${last && last.message})`);
}

describe('webjs dev in a workspace (#1526)', { skip: !process.env.WEBJS_E2E }, () => {
  /** @type {ReturnType<typeof stageWorkspace>} */
  let s;
  before(() => { s = stageWorkspace(); });
  after(() => rmSync(s.ws, { recursive: true, force: true }));

  for (const rt of RUNTIMES) {
    test(`${rt.name}: started in the member app, it serves that app through the hoisted bin`, async () => {
      const port = await freePort();
      const [cmd, pre] = rt.cmd(s.bin);
      const child = spawn(cmd, [...pre, 'dev', '--port', String(port)], {
        cwd: s.app,
        env: { ...process.env, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
      let log = '';
      child.stdout.on('data', (c) => { log += c; });
      child.stderr.on('data', (c) => { log += c; });
      try {
        const res = await getRoot(port);
        assert.equal(res.status, 200, log);
        assert.match(res.body, /member app served/);
      } finally {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        await new Promise((r) => { child.once('exit', r); setTimeout(r, 5000); });
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }
    });

    for (const cmdName of ['dev', 'start']) {
      test(`${rt.name}: webjs ${cmdName} at the workspace root exits 1 naming the member app`, () => {
        const [cmd, pre] = rt.cmd(s.bin);
        const r = spawnSync(cmd, [...pre, cmdName, '--port', '1'], { cwd: s.ws, encoding: 'utf8', timeout: 30000 });
        assert.equal(r.status, 1, r.stdout + r.stderr);
        assert.match(r.stderr, new RegExp(`webjs ${cmdName}: this directory is not a WebJs app`));
        assert.match(r.stderr, new RegExp(`cd apps/web && webjs ${cmdName}`));
        assert.doesNotMatch(r.stdout + r.stderr, /ready on/);
      });
    }
  }
});
