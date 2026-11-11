/**
 * `webjs stop` stops the app's running server from the record it wrote, so an
 * agent needs no pkill / kill / pgrep after booting the dev server (54 turns
 * across 24 eval builds). The supervised dev case is the one that matters: the
 * record names the hot-reload supervisor, and stopping only its child would
 * have the supervisor start another, so the counterfactual is the port
 * answering again after the stop. The supervisor writes the record before its
 * `dev.before` steps, so a stop while they run finds it too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A port nothing is listening on, from the OS. A port derived from the pid
 * collides when `bun test` runs several of these files in one process, and
 * an unrelated WebJs server already on it answers the probe before the test
 * server exists.
 */
async function freePort() {
  const srv = createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(150);
  }
}

function makeApp(webjs = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'stop-app', type: 'module', imports: { '#*': './*' }, webjs }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  return dir;
}

const stop = (dir) => new Promise((done) => {
  // Async, so this process keeps reaping the dev server it spawned meanwhile.
  const c = spawn(process.execPath, [CLI, 'stop'], { cwd: dir, env: { ...process.env, NODE_ENV: 'development' } });
  let stdout = '';
  let stderr = '';
  c.stdout.on('data', (d) => { stdout += d; });
  c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => done({ status, stdout, stderr }));
});
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('stops a supervised dev server: the supervisor, its child and the port all go', async () => {
  const dir = makeApp();
  const port = await freePort();
  const child = spawn(process.execPath, [CLI, 'dev', '--port', String(port)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => child.once('exit', r));
  try {
    const up = await until(async () => (await fetch(`http://localhost:${port}/__webjs/version`)).ok, 30_000);
    assert.ok(up, `the dev server never came up\n${log}`);
    const record = JSON.parse(readFileSync(join(dir, '.webjs/dev-server.json'), 'utf8'));
    assert.equal(record.port, port);
    assert.equal(record.pid, child.pid, 'the record names the supervisor, the process to signal');

    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${child.pid}\\)`));
    await exited;
    assert.equal(alive(record.pid), false, 'the supervisor is gone');
    // Not restarted: a stop that signalled only the child would see the
    // supervisor bring the port back within its crash backoff.
    await sleep(1500);
    await assert.rejects(fetch(`http://localhost:${port}/__webjs/version`), 'the port is free');
    assert.equal(existsSync(join(dir, '.webjs/dev-server.json')), false, 'the record is gone');
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('with nothing running it says so and exits 0', async () => {
  const dir = makeApp();
  try {
    const r = await stop(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no server is running for this app/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale record is removed and nothing is signalled', async () => {
  const dir = makeApp();
  try {
    mkdirSync(join(dir, '.webjs'));
    // A pid that cannot be running: well above any kernel pid_max.
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8080, pid: 2 ** 30 }));
    const r = await stop(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(existsSync(join(dir, '.webjs/start-server.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A live process whose command line names a path containing "webjs" but is no WebJs server. */
const bystander = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', '/tmp/webjs/server.js', 'start'], { stdio: 'ignore' });

test('a live pid that is not a WebJs server is never signalled, even with "webjs" in its argv', async () => {
  const dir = makeApp();
  const other = bystander();
  try {
    await sleep(100);
    mkdirSync(join(dir, '.webjs'));
    // No start time recorded: the command line decides (where /proc has one).
    writeFileSync(join(dir, '.webjs/dev-server.json'), JSON.stringify({ port: 8080, pid: other.pid }));
    // A start time that is not this process's: the pid was reused.
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8081, pid: other.pid, startTime: '1' }));
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    if (existsSync('/proc/self/cmdline')) assert.match(r.stdout, /no dev server running \(removed the stale record/);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(alive(other.pid), true, 'a reused pid is left alone');
  } finally {
    other.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('run from a subdirectory it acts on the app root', async () => {
  const dir = makeApp();
  try {
    mkdirSync(join(dir, '.webjs'));
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8080, pid: 2 ** 30 }));
    mkdirSync(join(dir, 'app/blog'), { recursive: true });
    const r = await stop(join(dir, 'app/blog'));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(existsSync(join(dir, '.webjs/start-server.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outside any app it says so and exits 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-none-'));
  try {
    const r = await stop(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not inside a WebJs app/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stop while dev.before runs stops the supervisor before the server ever binds', async () => {
  // A before-step that outlasts the test: without the supervisor's early
  // record, the stop found nothing, printed that nothing was running, and the
  // server came up once the step finished.
  const dir = makeApp({ dev: { before: [`"${process.execPath}" -e "setTimeout(() => {}, 20000)"`] } });
  const port = await freePort();
  const child = spawn(process.execPath, [CLI, 'dev', '--port', String(port)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => child.once('exit', r));
  const recordFile = join(dir, '.webjs/dev-server.json');
  try {
    assert.ok(await until(() => /running before-step/.test(log) && existsSync(recordFile), 15_000), `the before-step never started\n${log}`);
    const record = JSON.parse(readFileSync(recordFile, 'utf8'));
    assert.equal(record.pid, child.pid);
    assert.equal(record.port, port);
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${child.pid}\\)`));
    await exited;
    assert.equal(existsSync(recordFile), false, 'the record is gone');
    await assert.rejects(fetch(`http://localhost:${port}/__webjs/version`), 'nothing ever bound the port');
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Spawn `webjs <args>` in `cwd` as its own process group, collecting its output. */
function startCli(cwd, args) {
  const child = spawn(process.execPath, [CLI, ...args], {
    cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  const out = { log: '' };
  child.stdout.on('data', (d) => { out.log += d; });
  child.stderr.on('data', (d) => { out.log += d; });
  return { child, out, exited: new Promise((r) => child.once('exit', (code) => r(code))) };
}
const answers = async (port) => (await fetch(`http://localhost:${port}/__webjs/version`)).ok;
const killGroup = (child) => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ } };

test('a second supervised dev on the same port exits 98 and leaves the first one\'s record byte-identical; stop stops the first', async () => {
  // The supervisor records BEFORE its child binds, so this is the case the
  // never-overwrite guard in recordServer exists for: without it the second
  // supervisor replaced the record, exited 98, and its exit handler deleted
  // it, leaving the first server running with no record.
  const dir = makeApp();
  const port = await freePort();
  const first = startCli(dir, ['dev', '--port', String(port)]);
  const recordFile = join(dir, '.webjs/dev-server.json');
  try {
    assert.ok(await until(() => answers(port), 30_000), `the first server never came up\n${first.out.log}`);
    const before = readFileSync(recordFile, 'utf8');
    assert.equal(JSON.parse(before).pid, first.child.pid);
    const second = startCli(dir, ['dev', '--port', String(port)]);
    let timer;
    const code = await Promise.race([second.exited, new Promise((r) => { timer = setTimeout(r, 30_000, 'timeout'); })]);
    clearTimeout(timer);
    killGroup(second.child);
    assert.equal(code, 98, `the second supervisor stops on the taken port\n${second.out.log}`);
    assert.equal(readFileSync(recordFile, 'utf8'), before, 'the first server\'s record is untouched');
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${first.child.pid}\\)`));
    await first.exited;
  } finally {
    killGroup(first.child);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a second dev server on another port takes the record over once the first exits, so stop then stops it', async () => {
  const dir = makeApp();
  const portA = await freePort();
  let portB = await freePort();
  while (portB === portA) portB = await freePort();
  const a = startCli(dir, ['dev', '--port', String(portA)]);
  let b = null;
  const recordFile = join(dir, '.webjs/dev-server.json');
  try {
    assert.ok(await until(() => answers(portA), 30_000), `A never came up\n${a.out.log}`);
    b = startCli(dir, ['dev', '--port', String(portB)]);
    assert.ok(await until(() => answers(portB), 30_000), `B never came up\n${b.out.log}`);
    assert.equal(JSON.parse(readFileSync(recordFile, 'utf8')).pid, a.child.pid, 'A keeps the record while it runs');
    assert.match(b.out.log, /another dev server for this app is running/);
    const r1 = await stop(dir);
    assert.equal(r1.status, 0, r1.stderr);
    assert.match(r1.stdout, new RegExp(`stopped the dev server on port ${portA} \\(pid ${a.child.pid}\\)`));
    await a.exited;
    // B checks every two seconds and takes the record over with its own port.
    const claimed = await until(() => {
      const rec = JSON.parse(readFileSync(recordFile, 'utf8'));
      return rec.pid === b.child.pid && rec.port === portB;
    }, 6000);
    assert.ok(claimed, `B never took the record over\n${existsSync(recordFile) ? readFileSync(recordFile, 'utf8') : '(no record)'}`);
    const r2 = await stop(dir);
    assert.equal(r2.status, 0, r2.stderr);
    assert.match(r2.stdout, new RegExp(`stopped the dev server on port ${portB} \\(pid ${b.child.pid}\\)`));
    await b.exited;
    await assert.rejects(fetch(`http://localhost:${portB}/__webjs/version`), 'B is gone');
  } finally {
    killGroup(a.child);
    if (b) killGroup(b.child);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('with a route folder named app, status and stop run from the app/ directory find the server', async () => {
  // `app/app/page.ts` is a `/app` route, so `<root>/app` holds an `app/`
  // directory. Taken for the app root, it had no record: stop printed that
  // nothing was running and exited 0 while the server kept the port.
  const dir = makeApp();
  mkdirSync(join(dir, 'app/app'), { recursive: true });
  writeFileSync(join(dir, 'app/app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>dashboard</h1>`;\n");
  const port = await freePort();
  const dev = startCli(dir, ['dev', '--port', String(port)]);
  try {
    assert.ok(await until(() => answers(port), 30_000), `the dev server never came up\n${dev.out.log}`);
    const status = await new Promise((done) => {
      // No PORT, so the port can only come from the record status finds.
      const env = { ...process.env, NODE_ENV: 'development' };
      delete env.PORT;
      const c = spawn(process.execPath, [CLI, 'status', '/app', '--json'], { cwd: join(dir, 'app'), env });
      let stdout = '';
      c.stdout.on('data', (d) => { stdout += d; });
      c.on('close', (code) => done({ code, stdout }));
    });
    assert.equal(JSON.parse(status.stdout).url, `http://localhost:${port}`, `status probed the running server\n${status.stdout}`);
    const r = await stop(join(dir, 'app'));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${dev.child.pid}\\)`));
    await dev.exited;
    await assert.rejects(fetch(`http://localhost:${port}/__webjs/version`), 'the port is free');
  } finally {
    killGroup(dev.child);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dev --no-hot keeps its dev.parallel tasks running alongside the server, and stop takes them down', async () => {
  // The inline server used to call killTasks() right after its port bound
  // (startServer resolves on listen), so a Tailwind watcher died at boot.
  const dir = makeApp({ dev: { parallel: [`"${process.execPath}" task.cjs`] } });
  writeFileSync(join(dir, 'task.cjs'), "require('fs').writeFileSync(__dirname + '/task.pid', String(process.pid)); setInterval(() => {}, 1e9);\n");
  const port = await freePort();
  const dev = startCli(dir, ['dev', '--no-hot', '--port', String(port)]);
  let taskPid = 0;
  try {
    assert.ok(await until(() => answers(port), 30_000), `the dev server never came up\n${dev.out.log}`);
    assert.ok(await until(() => existsSync(join(dir, 'task.pid')), 10_000), 'the parallel task never started');
    taskPid = Number(readFileSync(join(dir, 'task.pid'), 'utf8'));
    await sleep(1500);
    assert.equal(alive(taskPid), true, 'the parallel task outlives the bind');
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${dev.child.pid}\\)`));
    await dev.exited;
    assert.ok(await until(() => !alive(taskPid), 5000), 'the parallel task went with the server');
  } finally {
    killGroup(dev.child);
    if (taskPid) try { process.kill(taskPid, 'SIGKILL'); } catch { /* gone */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the dev parent never drops its early signal handlers before the ones that replace them are installed', () => {
  // A signal in that window takes the default action: no exit handler, so the
  // record stays behind, and the detached dev.parallel tasks are orphaned. It
  // cannot be hit reliably at runtime, so the ordering is pinned in source:
  // in each branch the early handlers come off after the replacement is in
  // place, with nothing awaited in between.
  const src = readFileSync(CLI, 'utf8');
  const devCase = src.slice(src.indexOf("    case 'dev': {"), src.indexOf("    case 'start': {"));
  const off = 'process.off(sig, earlyStop)';
  const offs = [];
  for (let i = devCase.indexOf(off); i >= 0; i = devCase.indexOf(off, i + 1)) offs.push(i);
  assert.equal(offs.length, 2, 'one hand-over per branch (inline, supervise)');
  const inlineStart = devCase.indexOf("if (plan.mode === 'inline')");
  const inlineInstall = devCase.indexOf('process.on(sig,', inlineStart);
  assert.ok(inlineStart >= 0 && inlineInstall > inlineStart && offs[0] > inlineInstall, 'inline: installed before the early handlers come off');
  assert.doesNotMatch(devCase.slice(inlineInstall, offs[0]), /\bawait\b/, 'inline: nothing awaited between install and removal');
  const supervise = devCase.indexOf('superviseDevServer({');
  assert.ok(supervise > inlineStart && offs[1] > supervise, 'supervise: the supervisor runs before the early handlers come off');
  assert.doesNotMatch(devCase.slice(supervise, offs[1]), /\bawait\b/, 'supervise: nothing awaited between the supervisor and the removal');
  // And the supervisor installs its handlers synchronously before returning.
  const reload = readFileSync(join(ROOT, 'packages/cli/lib/dev-reload.js'), 'utf8');
  const fn = reload.slice(reload.indexOf('export function superviseDevServer'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /process\.on\('SIGTERM'/);
  assert.doesNotMatch(body, /\bawait\b/, 'superviseDevServer is synchronous');
});
