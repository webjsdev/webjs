/**
 * Cross-runtime taken-port test (#1527): a second `webjs dev` / `webjs start`
 * on a port another server listens on must fail fast, naming the holder, on
 * WHICHEVER runtime runs this file. Run under both:
 *
 *   node test/bun/port-in-use.mjs
 *   bun  test/bun/port-in-use.mjs
 *
 * On Bun this used to bind SILENTLY: `Bun.serve({ development: false })`
 * defaults SO_REUSEPORT on, so the kernel split requests between the two
 * servers. On Node the bind error crashed the child and the dev supervisor
 * retried it forever. Also proves `WEBJS_REUSE_PORT=1` still shares the port
 * on purpose (Linux only, where SO_REUSEPORT load-balances).
 *
 * A plain assert script (not node:test) so the SAME file runs on both
 * runtimes; it spawns the real CLI via the current runtime's execPath.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const PORT = 9750 + (process.pid % 200);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, { timeoutMs, stepMs = 100 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(stepMs);
  }
}

/** @param {string} cmd @param {Record<string, string>} [env] */
function run(cmd, env = {}) {
  const c = spawn(process.execPath, [CLI, cmd, '--port', String(PORT)], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: cmd === 'dev' ? 'development' : 'production', ...env },
  });
  c.log = '';
  c.stdout.on('data', (d) => { c.log += d; });
  c.stderr.on('data', (d) => { c.log += d; });
  c.done = new Promise((r) => c.on('exit', (code, signal) => r({ code, signal })));
  return c;
}

const kill = (c) => { if (c && c.pid) { try { process.kill(-c.pid, 'SIGKILL'); } catch {} } };

const root = mkdtempSync(join(tmpdir(), 'webjs-port-in-use-'));
const children = [];
try {
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(join(root, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>first</h1>`;\n");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'port-in-use', type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(root, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(root, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(root, 'node_modules/@webjsdev/server'));

  const first = run('dev');
  children.push(first);
  const up = await until(async () => (await (await fetch(`${BASE}/`)).text()).includes('first'), { timeoutMs: 30_000 });
  assert.ok(up, `the first dev server never came up on ${runtime}\n${first.log}`);

  for (const cmd of ['dev', 'start']) {
    const second = run(cmd);
    children.push(second);
    const res = await Promise.race([second.done, sleep(20_000).then(() => null)]);
    assert.ok(res, `a second \`webjs ${cmd}\` on a taken port kept running on ${runtime} (it shares the port)\n${second.log}`);
    assert.equal(res.code, 98, `a second \`webjs ${cmd}\` exited ${res.code}/${res.signal}, not 98, on ${runtime}\n${second.log}`);
    assert.match(second.log, new RegExp(`port ${PORT} is already in use`), `no clear message on ${runtime}\n${second.log}`);
    if (process.platform === 'linux') {
      assert.match(second.log, /in use by PID \d+/, `the holder's PID is not named on ${runtime}\n${second.log}`);
    }
    assert.doesNotMatch(second.log, /restarting in/, `the supervisor retried a taken port on ${runtime}\n${second.log}`);
  }
  assert.equal(first.exitCode, null, `the first server died on ${runtime}`);
  assert.ok((await fetch(`${BASE}/`)).ok, `the first server stopped serving on ${runtime}`);

  if (process.platform === 'linux') {
    // Opt-in sharing: both servers bind and the second stays up.
    kill(first);
    await first.done;
    await until(async () => { try { await fetch(`${BASE}/`); return false; } catch { return true; } }, { timeoutMs: 5000 });
    const a = run('dev', { WEBJS_REUSE_PORT: '1' });
    children.push(a);
    assert.ok(await until(async () => (await fetch(`${BASE}/`)).ok, { timeoutMs: 30_000 }), `the opted-in server never came up on ${runtime}\n${a.log}`);
    const b = run('dev', { WEBJS_REUSE_PORT: '1' });
    children.push(b);
    const sharedUp = await until(() => /server ready/.test(b.log), { timeoutMs: 20_000 });
    assert.ok(sharedUp, `WEBJS_REUSE_PORT=1 did not let a second server share the port on ${runtime}\n${b.log}`);
    assert.equal(b.exitCode, null, `the opted-in second server exited on ${runtime}\n${b.log}`);
  }

  console.log(`OK  a taken port fails fast with its holder named, and WEBJS_REUSE_PORT=1 still shares it, on ${runtime} (#1527)`);
} finally {
  for (const c of children) kill(c);
  rmSync(root, { recursive: true, force: true });
}
