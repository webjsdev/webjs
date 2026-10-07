/**
 * The release gate (#1575 follow-up): what must pass before ANY @webjsdev
 * release is published. Two regressions shipped in 0.8.85 / 0.8.86 because the
 * unit suites were green while a real app on Bun was not, so the gate runs the
 * CANDIDATE packages (packed from this checkout, exactly what npm would get)
 * inside real apps.
 *
 *   node scripts/release-gate.mjs [--crisp <path to crisp apps/web>] [--skip-suites] [--only=bun|node]
 *
 * Stages, each printed PASS / FAIL, exit non-zero on any failure:
 *   1. suites   `npm test` (Node) and `node scripts/run-bun-tests.js` (Bun).
 *   2. scaffold for Bun and Node: `webjs create --db postgres` with the packed
 *      candidate, then `webjs dev` and the app checks: every static page renders
 *      (no 500, no "not a server action"), sign up and log in through the bound
 *      form actions, a probe page with a bound `<form action=${fn}>`, request
 *      context (`headers()`), a `*.server.ts` with relative imports reached both
 *      statically and through `await import('#...')`. Then the agent-style
 *      reload stress (`scripts/dev-reload-stress.mjs`), and every check again
 *      after the edits. Then `webjs check` and `webjs typecheck`.
 *   3. crisp (with --crisp): the candidate linked into Crisp's install, its
 *      server and browser suites, and a fresh `bun run dev` loading /,
 *      /dashboard, a project page, the provisioning module chain, and a server
 *      action, before and after an edit. GATE_CRISP_PROVISION=1 also creates a
 *      real project (one pilots machine) and deletes it.
 *
 * Needs a Postgres at GATE_PG (default postgres://crisp:crisp@localhost:5432),
 * where it creates and drops one scratch database per app.
 */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync, cpSync, appendFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { runDevReloadStress, summarizeStress } from './dev-reload-stress.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const PG = process.env.GATE_PG || 'postgres://crisp:crisp@localhost:5432';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (stage, name, ok, detail = '') => {
  results.push({ stage, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${stage}] ${name}${detail ? `  ${detail}` : ''}`);
};

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', timeout: opts.timeoutMs ?? 1_800_000, ...opts });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Pack core, server and cli as npm would publish them. */
function packCandidate() {
  // Build core's dist from THIS checkout (a linked worktree has it as a symlink
  // into another checkout, which `npm pack` would silently leave out).
  const dist = join(ROOT, 'packages/core/dist');
  try { if (lstatSync(dist).isSymbolicLink()) rmSync(dist); } catch {}
  execFileSync('node', ['scripts/build-framework-dist.js'], { cwd: ROOT, stdio: 'pipe' });
  const dir = mkdtempSync(join(tmpdir(), 'webjs-gate-pack-'));
  const tarballs = {};
  for (const pkg of ['core', 'server', 'cli']) {
    const out = execFileSync('npm', ['pack', '--silent', '--pack-destination', dir], { cwd: join(ROOT, 'packages', pkg), encoding: 'utf8' }).trim().split('\n').pop();
    tarballs[`@webjsdev/${pkg}`] = join(dir, out);
  }
  return tarballs;
}

/** Start a dev server in its own process group; resolves once `/` answers. */
async function startDev(cwd, cmd, argv, port, env = {}) {
  let log = '';
  const child = spawn(cmd, argv, { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), ...env } });
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const deadline = Date.now() + 180_000;
  for (;;) {
    try { const r = await fetch(`http://localhost:${port}/`); if (r.status < 500) break; } catch {}
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`dev server did not come up\n${log.slice(-3000)}`);
    await sleep(300);
  }
  return { child, log: () => log, stop: async () => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} await sleep(800); try { process.kill(-child.pid, 'SIGKILL'); } catch {} } };
}

/** Static page URLs from the app tree (no dynamic segments). */
function staticPages(appDir) {
  const out = [];
  const walk = (dir, url) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name.startsWith('_') || e.name.startsWith('[') || e.name === 'crash' || e.name.startsWith('.') || e.name.startsWith('zz')) continue;
        walk(join(dir, e.name), /^\(.*\)$/.test(e.name) ? url : `${url}/${e.name}`);
      } else if (/^page\.m?[jt]s$/.test(e.name)) out.push(url || '/');
    }
  };
  walk(join(appDir, 'app'), '');
  return out.sort();
}

/** Submit every POST form on `path` with its hidden fields plus test values. */
async function submitForms(base, path, cookie, values) {
  const res = await fetch(base + path, { headers: cookie ? { cookie } : {} });
  const html = await res.text();
  const forms = [...html.matchAll(/<form\b([^>]*method="post"[^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => [m[0], m[2], /\baction="(\/[^"]*)"/.exec(m[1])?.[1]]);
  const statuses = [];
  for (const f of forms) {
    const fd = new FormData();
    for (const m of f[1].matchAll(/<input\b([^>]*)>/gi)) {
      const name = /name="([^"]+)"/.exec(m[1])?.[1];
      if (!name) continue;
      const type = /type="([^"]+)"/.exec(m[1])?.[1] || 'text';
      const val = /value="([^"]*)"/.exec(m[1])?.[1] ?? '';
      fd.append(name, type === 'hidden' ? val : (values[name] ?? values[type] ?? 'gate'));
    }
    // A submitter button can carry the action identity (name + value).
    const btn = /<button\b([^>]*\bname="([^"]+)"[^>]*)>/i.exec(f[1]);
    if (btn) { const v = /value="([^"]*)"/.exec(btn[1])?.[1] ?? ''; fd.append(btn[2], v); }
    const r = await fetch(base + (f[2] || path), { method: 'POST', body: fd, redirect: 'manual', headers: { origin: base, ...(cookie ? { cookie } : {}) } });
    statuses.push(r.status);
  }
  return { count: forms.length, statuses };
}

const probeFiles = {
  'modules/zzgate/types.ts': "export const T = 'gate-ok';\n",
  'modules/zzgate/engine.server.ts': "import { T } from './types.ts';\nexport function eng() { return T; }\n",
  'modules/zzgate/act.server.ts': "'use server';\nimport { T } from './types.ts';\nexport async function act(_input?: unknown) { return { success: true as const, data: T }; }\n",
  'app/zzgate/page.ts': "import { html } from '@webjsdev/core';\nimport { headers } from '@webjsdev/server';\nimport { act } from '#modules/zzgate/act.server.ts';\nexport default async function P() {\n  const { eng } = await import('#modules/zzgate/engine.server.ts');\n  const ua = headers().get('x-gate') || 'none';\n  return html`<p>dyn:${eng()} hdr:${ua}</p><form method=\"post\" action=${act}><input name=\"q\"><button>go</button></form>`;\n}\n",
};

/** The app checks, run before and after the reload stress. */
async function appChecks(stage, appDir, base, when) {
  const bad = [];
  for (const p of staticPages(appDir)) {
    const r = await fetch(base + p).catch((e) => ({ status: 0, text: async () => String(e) }));
    const body = await r.text();
    if (r.status >= 500 || /is not a server action/.test(body)) bad.push(`${p} ${r.status}`);
  }
  record(stage, `${when}: every static page renders`, bad.length === 0, bad.slice(0, 5).join(', '));
  const probe = await fetch(base + '/zzgate', { headers: { 'x-gate': 'seen' } });
  const body = await probe.text();
  record(stage, `${when}: dynamic # import of a *.server.ts with relative imports`, probe.status === 200 && body.includes('dyn:gate-ok'), `${probe.status}`);
  record(stage, `${when}: request context (headers())`, body.includes('hdr:seen'));
  const bound = await submitForms(base, '/zzgate', '', { q: 'x' });
  record(stage, `${when}: bound form action submits`, bound.count === 1 && bound.statuses.every((s) => s < 400) && !/not a server action/.test(body), JSON.stringify(bound));
  if (existsSync(join(appDir, 'app/features/auth/signup'))) {
    const email = `gate-${randomBytes(4).toString('hex')}@example.com`;
    const su = await submitForms(base, '/features/auth/signup', '', { name: 'Gate', email, password: 'gate-password-1' });
    const li = await submitForms(base, '/features/auth/login', '', { email, password: 'gate-password-1' });
    record(stage, `${when}: sign up and log in`, su.count > 0 && li.count > 0 && [...su.statuses, ...li.statuses].every((s) => s < 400), JSON.stringify({ su, li }));
  }
}

async function scaffoldStage(runtime, tarballs, port) {
  const stage = `scaffold:${runtime}`;
  const parent = mkdtempSync(join(tmpdir(), `webjs-gate-${runtime}-`));
  const appDir = join(parent, 'gateapp');
  const db = `webjs_gate_${runtime}_${Date.now().toString(36)}`;
  let dev;
  try {
    const created = run('node', [join(ROOT, 'packages/cli/bin/webjs.js'), 'create', 'gateapp', '--template', 'full-stack', '--runtime', runtime, '--db', 'postgres', '--no-install'], { cwd: parent, quiet: true });
    record(stage, 'create', created.ok, created.ok ? '' : created.out.slice(-800));
    if (!created.ok) return;
    const pkgPath = join(appDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const [name, tgz] of Object.entries(tarballs)) pkg.dependencies[name] = `file:${tgz}`;
    pkg.overrides = { ...(pkg.overrides || {}), ...Object.fromEntries(Object.entries(tarballs).map(([n, t]) => [n, `file:${t}`])) };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    const inst = runtime === 'bun' ? run('bun', ['install'], { cwd: appDir, quiet: true }) : run('npm', ['install', '--no-audit', '--no-fund'], { cwd: appDir, quiet: true });
    record(stage, 'install candidate', inst.ok, inst.ok ? '' : inst.out.slice(-800));
    if (!inst.ok) return;
    const mk = run('node', ['-e', `const {Client}=require('pg');const c=new Client(${JSON.stringify(PG + '/postgres')});c.connect().then(()=>c.query('CREATE DATABASE ${db}')).then(()=>c.end())`], { cwd: appDir, quiet: true });
    if (!mk.ok) { record(stage, 'create database', false, mk.out.slice(-400)); return; }
    // `create --no-install` skips the migration generation an installing create runs.
    const gen = run(runtime === 'bun' ? 'bunx' : 'npx', [...(runtime === 'bun' ? ['--bun'] : []), 'webjs', 'db', 'generate'], { cwd: appDir, quiet: true });
    record(stage, 'webjs db generate', gen.ok, gen.ok ? '' : gen.out.slice(-600));
    const env = readFileSync(join(appDir, '.env.example'), 'utf8')
      .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${PG}/${db}`)
      .replace(/^PORT=.*$/m, `PORT=${port}`)
      .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${randomBytes(32).toString('hex')}`);
    writeFileSync(join(appDir, '.env'), env);
    for (const [f, s] of Object.entries(probeFiles)) { mkdirSync(dirname(join(appDir, f)), { recursive: true }); writeFileSync(join(appDir, f), s); }
    const base = `http://localhost:${port}`;
    dev = runtime === 'bun' ? await startDev(appDir, 'bun', ['run', 'dev'], port) : await startDev(appDir, 'npm', ['run', 'dev'], port);
    await sleep(1500);
    await appChecks(stage, appDir, base, 'fresh');
    const stress = await runDevReloadStress({ appDir, base, timeoutMs: 10_000, tolerateRestarts: runtime === 'node' });
    const failed = stress.filter((r) => !r.ok);
    record(stage, `reload stress: ${summarizeStress(stress)}`, failed.length === 0, failed.map((f) => `${f.name}: ${f.why}`).join('; ').slice(0, 600));
    // Edit the probe files themselves, then check everything again.
    appendFileSync(join(appDir, 'app/zzgate/page.ts'), '// edited\n');
    appendFileSync(join(appDir, 'modules/zzgate/act.server.ts'), '// edited\n');
    appendFileSync(join(appDir, 'modules/zzgate/engine.server.ts'), '// edited\n');
    await sleep(runtime === 'node' ? 4000 : 1500);
    await appChecks(stage, appDir, base, 'after edits');
    if (runtime === 'bun') {
      const restarts = (dev.log().match(/restarting the dev server/g) || []).length;
      record(stage, 'no dev-server restart on Bun', restarts === 0, `${restarts} restarts`);
    }
    if (results.some((r) => r.stage === stage && !r.ok)) {
      console.log((dev.log().match(/.*(error|Error|ENOENT|does not exist|Cannot find).*/g) || []).slice(0, 15).join('\n'));
    }
    await dev.stop(); dev = null;
    for (const f of Object.keys(probeFiles)) rmSync(join(appDir, f), { force: true });
    const x = runtime === 'bun' ? ['bunx', ['--bun', 'webjs']] : ['npx', ['webjs']];
    const check = run(x[0], [...x[1], 'check'], { cwd: appDir, quiet: true });
    record(stage, 'webjs check', check.ok, check.ok ? '' : check.out.slice(-600));
    const tc = run(x[0], [...x[1], 'typecheck'], { cwd: appDir, quiet: true });
    record(stage, 'webjs typecheck', tc.ok, tc.ok ? '' : tc.out.slice(-600));
  } catch (e) {
    record(stage, 'unexpected error', false, String(e && e.stack || e).slice(0, 1500));
  } finally {
    if (dev) await dev.stop();
    run('node', ['-e', `const {Client}=require('pg');const c=new Client(${JSON.stringify(PG + '/postgres')});c.connect().then(()=>c.query('DROP DATABASE IF EXISTS ${db} WITH (FORCE)')).then(()=>c.end())`], { cwd: appDir, quiet: true });
    rmSync(parent, { recursive: true, force: true });
  }
}

/** Crisp downstream smoke with the candidate swapped into its install. */
async function crispStage(crispWeb, tarballs, port) {
  const stage = 'crisp';
  const repo = resolve(crispWeb, '../..');
  const nm = join(repo, 'node_modules/@webjsdev');
  const backup = mkdtempSync(join(repo, 'node_modules', '.webjs-gate-backup-'));
  const db = `webjs_gate_crisp_${Date.now().toString(36)}`;
  let dev;
  try {
    for (const [name, tgz] of Object.entries(tarballs)) {
      const short = name.split('/')[1];
      if (existsSync(join(nm, short))) renameSync(join(nm, short), join(backup, short));
      mkdirSync(join(nm, short), { recursive: true });
      execFileSync('tar', ['-xzf', tgz, '-C', join(nm, short), '--strip-components=1']);
    }
    if (existsSync(join(backup, 'server', 'node_modules'))) cpSync(join(backup, 'server', 'node_modules'), join(nm, 'server', 'node_modules'), { recursive: true });
    const mainEnv = readFileSync(join(crispWeb, '.env'), 'utf8');
    const mk = run('node', ['-e', `const {Client}=require('pg');const c=new Client(${JSON.stringify(PG + '/postgres')});c.connect().then(()=>c.query('CREATE DATABASE ${db}')).then(()=>c.end())`], { cwd: crispWeb, quiet: true });
    if (!mk.ok) { record(stage, 'create database', false, mk.out.slice(-400)); return; }
    const testEnv = { ...process.env, DATABASE_URL: `${PG}/${db}` };
    const mig = run('bun', ['run', 'db:migrate'], { cwd: crispWeb, quiet: true, env: testEnv });
    record(stage, 'migrate', mig.ok, mig.ok ? '' : mig.out.slice(-600));
    for (const suite of ['test:server', 'test:browser']) {
      let r = run('bun', ['run', suite], { cwd: crispWeb, quiet: true, env: testEnv, timeoutMs: 3_600_000 });
      // One retry, reported: a pass on the retry is a flake to look at, not a pass.
      let note = '';
      if (!r.ok) { const first = r.out; r = run('bun', ['run', suite], { cwd: crispWeb, quiet: true, env: testEnv, timeoutMs: 3_600_000 }); note = r.ok ? 'FLAKY: failed once, passed on retry' : (first.match(/.*(fail|Error|❌).*/gi) || []).slice(0, 8).join(' | '); }
      record(stage, `bun run ${suite}`, r.ok, r.ok ? note : (note || r.out.slice(-1500)));
    }
    // A fresh dev server on the scratch database.
    const envPath = join(crispWeb, '.env');
    const saved = readFileSync(envPath, 'utf8');
    writeFileSync(envPath, mainEnv.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${PG}/${db}`).replace(/^PORT=.*$/m, `PORT=${port}`).replace(/^APP_URL=.*$/m, `APP_URL=http://localhost:${port}`));
    try {
      dev = await startDev(crispWeb, 'bun', ['run', 'dev'], port, { NODE_ENV: 'development' });
    } finally {
      writeFileSync(envPath, saved);
    }
    const base = `http://localhost:${port}`;
    const cookie = execFileSync('bun', ['-e', "const { devSignInCookie } = await import('#modules/auth/dev-login.server.ts'); console.log((await devSignInCookie(process.env.CRISP_DEV_LOGIN_SECRET ?? null)) ?? ''); process.exit(0);"], { cwd: crispWeb, encoding: 'utf8', env: { ...process.env, ...Object.fromEntries(mainEnv.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])), DATABASE_URL: `${PG}/${db}`, NODE_ENV: 'development' } }).trim().split(';')[0];
    record(stage, 'dev sign-in cookie', cookie.startsWith('webjs.auth='));
    const probe = join(crispWeb, 'app/api/zzgate/route.ts');
    mkdirSync(dirname(probe), { recursive: true });
    writeFileSync(probe, "export async function GET() {\n  const { startInitialRun } = await import('#modules/runs/engine.server.ts');\n  const p = await import('#modules/projects/provision.server.ts');\n  return new Response(typeof startInitialRun + ':' + typeof p.provisionInBackground);\n}\n");
    const hash = createHash('sha256').update(join(crispWeb, 'modules/projects/actions/create-project.server.ts')).digest('hex').slice(0, 10);
    const delHash = createHash('sha256').update(join(crispWeb, 'modules/projects/actions/delete-project.server.ts')).digest('hex').slice(0, 10);
    const created = [];
    const checks = async (when) => {
      for (const p of ['/', '/dashboard']) {
        const r = await fetch(base + p, { headers: { cookie }, redirect: 'manual' });
        record(stage, `${when}: ${p}`, r.status < 400, `${r.status}`);
      }
      const chain = await (await fetch(base + '/api/zzgate')).text();
      record(stage, `${when}: provisioning module chain loads`, chain === 'function:function', chain.slice(0, 200));
      const r = await fetch(`${base}/__webjs/action/${hash}/createProject`, { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/vnd.webjs+json' }, body: JSON.stringify([{ prompt: 'release gate smoke: a todo list' }]) });
      const text = await r.text();
      const id = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(text)?.[0];
      record(stage, `${when}: server action (createProject)`, r.status === 200 && !!id, `${r.status} ${text.slice(0, 160)}`);
      if (id) {
        created.push(id);
        const page = await fetch(`${base}/projects/${id}`, { headers: { cookie } });
        record(stage, `${when}: /projects/<id>`, page.status === 200, `${page.status}`);
        if (process.env.GATE_CRISP_PROVISION === '1') {
          let status = '';
          for (let i = 0; i < 120 && !/ready|failed/.test(status); i++) {
            await sleep(2000);
            status = execFileSync('node', ['-e', `const {Client}=require('pg');const c=new Client(${JSON.stringify(`${PG}/${db}`)});c.connect().then(()=>c.query("select status from projects where id='${id}'")).then((r)=>{console.log(r.rows[0]?.status||'');return c.end()})`], { cwd: crispWeb, encoding: 'utf8' }).trim();
          }
          record(stage, `${when}: provisioning reaches ready`, status === 'ready', status);
        }
      }
    };
    await checks('fresh');
    appendFileSync(join(crispWeb, 'modules/projects/actions/create-project.server.ts'), '// gate edit\n');
    appendFileSync(probe, '// gate edit\n');
    await sleep(1500);
    await checks('after edits');
    for (const id of created) {
      await fetch(`${base}/__webjs/action/${delHash}/deleteProject`, { method: 'POST', headers: { origin: base, cookie, 'content-type': 'application/vnd.webjs+json' }, body: JSON.stringify([{ id }]) }).catch(() => {});
    }
  } catch (e) {
    record(stage, 'unexpected error', false, String(e && e.stack || e).slice(0, 1500));
  } finally {
    if (dev) await dev.stop();
    // Undo the probe edits and restore Crisp's own install.
    const cp = join(crispWeb, 'modules/projects/actions/create-project.server.ts');
    if (existsSync(cp)) writeFileSync(cp, readFileSync(cp, 'utf8').replace(/\/\/ gate edit\n$/m, ''));
    rmSync(join(crispWeb, 'app/api/zzgate'), { recursive: true, force: true });
    for (const short of readdirSync(backup)) { rmSync(join(nm, short), { recursive: true, force: true }); renameSync(join(backup, short), join(nm, short)); }
    rmSync(backup, { recursive: true, force: true });
    run('node', ['-e', `const {Client}=require('pg');const c=new Client(${JSON.stringify(PG + '/postgres')});c.connect().then(()=>c.query('DROP DATABASE IF EXISTS ${db} WITH (FORCE)')).then(()=>c.end())`], { cwd: crispWeb, quiet: true });
  }
}

if (!args.includes('--skip-suites')) {
  record('suites', 'npm test (Node)', run('npm', ['test'], { cwd: ROOT, quiet: true }).ok);
  record('suites', 'Bun matrix (scripts/run-bun-tests.js)', run('node', ['scripts/run-bun-tests.js'], { cwd: ROOT, quiet: true }).ok);
}
const tarballs = packCandidate();
console.log(`candidate: ${Object.values(tarballs).map((t) => t.split(sep).pop()).join(', ')}`);
for (const [i, rt] of ['bun', 'node'].entries()) if (!only || only === rt) await scaffoldStage(rt, tarballs, 9300 + i);
const crisp = opt('--crisp');
if (crisp) await crispStage(resolve(crisp), tarballs, 9310);

const failed = results.filter((r) => !r.ok);
console.log(`\nrelease gate: ${results.length - failed.length}/${results.length} passed${failed.length ? `; FAILED: ${failed.map((f) => `[${f.stage}] ${f.name}`).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
