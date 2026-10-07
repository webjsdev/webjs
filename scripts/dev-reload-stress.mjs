/**
 * The dev-server reload stress (#1575): edit a running `webjs dev` app the way
 * an AI agent does and check that, once each sequence of edits settles, the
 * server serves exactly the current files.
 *
 * Sequences: new / edited / burst-written pages, layouts, components, `'use
 * server'` actions and the modules they import, route handlers, new exports,
 * renamed actions and route folders, deleted routes, files written partially
 * then completed, syntax errors then fixes (page, action, imported component),
 * atomic (temp + rename) writes, a whole feature written at once, and a
 * git-checkout-like churn. Each check records how long after the write the new
 * version was served, then holds it for a moment to catch one that flaps back.
 *
 * Everything it writes lives under `zzstress` names and is removed at the end.
 * It never touches the app's own files.
 *
 *   node scripts/dev-reload-stress.mjs <appDir> <baseUrl> [--only=a,b] [--soak=N]
 *
 * `--soak=N` then makes N more edits and prints the server's RSS (Linux; the
 * pid listening on the port), the memory-growth check.
 *
 * Used by `test/bun/dev-reload-stress.mjs` against a staged fixture app.
 */
import { mkdirSync, writeFileSync, rmSync, renameSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NS = 'zzstress';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @typedef {{ name: string, ok: boolean, ms: number, why?: string }} StressResult
 */

/**
 * Run the stress sequences against a running dev server.
 *
 * @param {{
 *   appDir: string,
 *   base: string,
 *   only?: string[],
 *   timeoutMs?: number,
 *   tolerateRestarts?: boolean,
 *   log?: (line: string) => void,
 * }} opts  `tolerateRestarts`: a refused connection is "not yet" rather than a
 *   flap, for a runtime whose dev server restarts the process on an edit (Node).
 * @returns {Promise<StressResult[]>}
 */
export async function runDevReloadStress({ appDir, base, only = [], timeoutMs = 8000, tolerateRestarts = false, log = () => {} }) {
  const TIMEOUT = timeoutMs;
  const P = (rel) => join(appDir, rel);
  const write = (rel, s) => { mkdirSync(dirname(P(rel)), { recursive: true }); writeFileSync(P(rel), s); };
  const atomicWrite = (rel, s) => { mkdirSync(dirname(P(rel)), { recursive: true }); const t = P(rel) + '.tmp' + process.pid; writeFileSync(t, s); renameSync(t, P(rel)); };
  const rm = (rel) => rmSync(P(rel), { recursive: true, force: true });
  const hash = (rel) => createHash('sha256').update(P(rel)).digest('hex').slice(0, 10);
  const origin = new URL(base).origin;

  async function get(path) {
    try {
      const r = await fetch(base + path, { headers: { accept: 'text/html' }, redirect: 'manual' });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { status: 0, body: String(e) }; }
  }
  async function call(rel, fn) {
    try {
      const r = await fetch(`${base}/__webjs/action/${hash(rel)}/${fn}`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/vnd.webjs+json', accept: 'application/vnd.webjs+json' },
        body: '[]',
      });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { status: 0, body: String(e) }; }
  }

  /** Poll until `check` passes (ms from `t0`), then confirm it holds for `hold` ms. */
  async function settle(name, probe, check, t0, hold = 600) {
    let last;
    while (performance.now() - t0 < TIMEOUT) {
      last = await probe();
      if (check(last)) {
        const ms = Math.round(performance.now() - t0);
        const until = performance.now() + hold;
        while (performance.now() < until) {
          const again = await probe();
          if (!check(again) && !(tolerateRestarts && again.status === 0)) {
            return { name, ok: false, ms, why: `flapped back: ${again.status} ${again.body.slice(0, 160)}` };
          }
          await sleep(25);
        }
        return { name, ok: true, ms };
      }
      await sleep(10);
    }
    const mk = String(last?.body).match(/(?:marker|layout|comp|act|route):[A-Za-z0-9:]+/g);
    return { name, ok: false, ms: TIMEOUT, why: `last: ${last?.status} ${mk ? mk.join(',') : String(last?.body).replace(/\s+/g, ' ').slice(0, 300)}` };
  }
  const has = (m) => (r) => r.status === 200 && r.body.includes(m);
  const status = (s) => (r) => r.status === s;

  const results = [];
  const scenarios = {};
  const S = (name, fn) => { scenarios[name] = fn; };

  const page = (m, extra = '') => `import { html } from '@webjsdev/core';\n${extra}\nexport default function P() {\n  return html\`<main><p>marker:${m}</p></main>\`;\n}\n`;
  const pageWith = (imports, body) => `import { html } from '@webjsdev/core';\n${imports}\nexport default async function P() {\n  ${body}\n}\n`;
  const layout = (m) => `import { html } from '@webjsdev/core';\nexport default function L({ children }) {\n  return html\`<section data-l="${m}">layout:${m} \${children}</section>\`;\n}\n`;
  const action = (fn, m, imp = '', expr = `'${m}'`) => `'use server';\n${imp}\nexport async function ${fn}() {\n  return 'act:' + ${expr};\n}\n`;
  const comp = (tag, m) => `import { WebComponent, html } from '@webjsdev/core';\nexport class C extends WebComponent() {\n  static tag = '${tag}';\n  n = 0;\n  render() { return html\`<button @click=\${() => this.n++}>comp:${m}</button>\`; }\n}\nC.register('${tag}');\n`;
  const route = (m) => `export function GET() {\n  return new Response('route:${m}');\n}\n`;


  S('new-page', async () => {
    const t0 = performance.now(); write(`app/${NS}/new/page.ts`, page('np1'));
    return settle('new-page', () => get(`/${NS}/new`), has('marker:np1'), t0);
  });
  S('page-burst', async () => {
    write(`app/${NS}/burst/page.ts`, page('b0'));
    await settle('pre', () => get(`/${NS}/burst`), has('marker:b0'), performance.now());
    for (let i = 1; i <= 25; i++) { write(`app/${NS}/burst/page.ts`, page('b' + i)); await sleep(4); }
    const t0 = performance.now();
    return settle('page-burst', () => get(`/${NS}/burst`), has('marker:b25'), t0);
  });
  S('page-edit-spaced', async () => {
    const out = [];
    for (let i = 1; i <= 6; i++) {
      const t0 = performance.now(); write(`app/${NS}/burst/page.ts`, page('s' + i));
      out.push(await settle(`page-edit-${i}`, () => get(`/${NS}/burst`), has('marker:s' + i), t0, 100));
      await sleep(150 * i);
    }
    return out;
  });
  S('layout', async () => {
    let t0 = performance.now(); write(`app/${NS}/lay/layout.ts`, layout('L1')); write(`app/${NS}/lay/page.ts`, page('lp'));
    const a = await settle('layout-new', () => get(`/${NS}/lay`), (r) => has('layout:L1')(r) && r.body.includes('marker:lp'), t0);
    t0 = performance.now(); write(`app/${NS}/lay/layout.ts`, layout('L2'));
    const b = await settle('layout-edit', () => get(`/${NS}/lay`), has('layout:L2'), t0);
    return [a, b];
  });
  S('component', async () => {
    let t0 = performance.now();
    write(`components/${NS}-badge.ts`, comp(`${NS}-badge`, 'C1'));
    write(`app/${NS}/comp/page.ts`, pageWith(`import '#components/${NS}-badge.ts';`, `return html\`<p>cpage</p><${NS}-badge></${NS}-badge>\`;`));
    const a = await settle('component-new', () => get(`/${NS}/comp`), has('comp:C1'), t0);
    t0 = performance.now(); write(`components/${NS}-badge.ts`, comp(`${NS}-badge`, 'C2'));
    const b = await settle('component-edit', () => get(`/${NS}/comp`), has('comp:C2'), t0);
    return [a, b];
  });
  const ACT = `modules/${NS}/actions/ping.server.ts`;
  S('action', async () => {
    let t0 = performance.now(); write(ACT, action('ping', 'A1'));
    const a = await settle('action-new', () => call(ACT, 'ping'), has('act:A1'), t0);
    t0 = performance.now(); write(ACT, action('ping', 'A2'));
    const b = await settle('action-edit', () => call(ACT, 'ping'), has('act:A2'), t0);
    // transitive util
    write(`modules/${NS}/utils/val.server.ts`, `export const VAL = 'U1';\n`);
    t0 = performance.now(); write(ACT, action('ping', '', `import { VAL } from '#modules/${NS}/utils/val.server.ts';`, 'VAL'));
    const c = await settle('action-uses-util', () => call(ACT, 'ping'), has('act:U1'), t0);
    t0 = performance.now(); write(`modules/${NS}/utils/val.server.ts`, `export const VAL = 'U2';\n`);
    const d = await settle('action-util-edit', () => call(ACT, 'ping'), has('act:U2'), t0);
    t0 = performance.now(); write(`modules/${NS}/utils/val.ts`, `export const VAL2 = 'V1';\n`);
    write(ACT, action('ping', '', `import { VAL2 } from '#modules/${NS}/utils/val.ts';`, 'VAL2'));
    const e = await settle('action-uses-plain-util', () => call(ACT, 'ping'), has('act:V1'), t0);
    t0 = performance.now(); write(`modules/${NS}/utils/val.ts`, `export const VAL2 = 'V2';\n`);
    const f = await settle('action-plain-util-edit', () => call(ACT, 'ping'), has('act:V2'), t0);
    return [a, b, c, d, e, f];
  });
  S('action-new-fn', async () => {
    const t0 = performance.now(); write(ACT, action('ping', 'A3') + action('pong', 'P1').replace("'use server';\n", ''));
    return settle('action-new-export', () => call(ACT, 'pong'), has('act:P1'), t0);
  });
  S('action-rename', async () => {
    write(ACT, action('ping', 'R0'));
    await settle('pre', () => call(ACT, 'ping'), has('act:R0'), performance.now());
    const NEW = `modules/${NS}/actions/renamed.server.ts`;
    const t0 = performance.now(); renameSync(P(ACT), P(NEW));
    const [a, b] = await Promise.all([
      settle('action-rename-new', () => call(NEW, 'ping'), has('act:R0'), t0),
      settle('action-rename-old-gone', () => call(ACT, 'ping'), status(404), t0)]);
    renameSync(P(NEW), P(ACT));
    return [a, b];
  });
  S('route-handler', async () => {
    let t0 = performance.now(); write(`app/api/${NS}/route.ts`, route('R1'));
    const a = await settle('route-new', () => get(`/api/${NS}`), has('route:R1'), t0);
    t0 = performance.now(); write(`app/api/${NS}/route.ts`, route('R2'));
    const b = await settle('route-edit', () => get(`/api/${NS}`), has('route:R2'), t0);
    return [a, b];
  });
  S('delete', async () => {
    write(`app/${NS}/del/page.ts`, page('d1'));
    await settle('pre', () => get(`/${NS}/del`), has('marker:d1'), performance.now());
    const t0 = performance.now(); rm(`app/${NS}/del`);
    return settle('delete-page', () => get(`/${NS}/del`), status(404), t0);
  });
  S('rename-dir', async () => {
    write(`app/${NS}/ra/page.ts`, page('ra'));
    await settle('pre', () => get(`/${NS}/ra`), has('marker:ra'), performance.now());
    const t0 = performance.now(); rm(`app/${NS}/rb`); renameSync(P(`app/${NS}/ra`), P(`app/${NS}/rb`));
    const [a, b] = await Promise.all([
      settle('rename-dir-new', () => get(`/${NS}/rb`), has('marker:ra'), t0),
      settle('rename-dir-old', () => get(`/${NS}/ra`), status(404), t0)]);
    return [a, b];
  });
  S('partial-write', async () => {
    const full = page('pw1');
    const t0 = performance.now();
    write(`app/${NS}/partial/page.ts`, full.slice(0, 60));
    await sleep(30);
    write(`app/${NS}/partial/page.ts`, full);
    return settle('partial-then-complete', () => get(`/${NS}/partial`), has('marker:pw1'), t0);
  });
  S('partial-action', async () => {
    const full = action('ping', 'PA1');
    const t0 = performance.now();
    write(ACT, full.slice(0, 30));
    await sleep(30);
    write(ACT, full);
    return settle('partial-action', () => call(ACT, 'ping'), has('act:PA1'), t0);
  });
  S('syntax-error', async () => {
    write(`app/${NS}/syn/page.ts`, page('se0'));
    await settle('pre', () => get(`/${NS}/syn`), has('marker:se0'), performance.now());
    let t0 = performance.now(); write(`app/${NS}/syn/page.ts`, page('se1').replace('return html', 'return html(('));
    const a = await settle('syntax-error-shows-500', () => get(`/${NS}/syn`), (r) => r.status >= 500, t0, 300);
    t0 = performance.now(); write(`app/${NS}/syn/page.ts`, page('se2'));
    const b = await settle('syntax-error-recovers', () => get(`/${NS}/syn`), has('marker:se2'), t0);
    t0 = performance.now(); write(ACT, action('ping', 'X').replace('return', 'return ((('));
    const c = await settle('action-syntax-error', () => call(ACT, 'ping'), (r) => r.status >= 500 || r.status === 0, t0, 300);
    t0 = performance.now(); write(ACT, action('ping', 'SE3'));
    const d = await settle('action-syntax-recovers', () => call(ACT, 'ping'), has('act:SE3'), t0);
    return [a, b, c, d];
  });
  S('component-syntax-error', async () => {
    write(`components/${NS}-badge.ts`, comp(`${NS}-badge`, 'K0'));
    write(`app/${NS}/comp/page.ts`, pageWith(`import '#components/${NS}-badge.ts';`, `return html\`<p>cpage</p><${NS}-badge></${NS}-badge>\`;`));
    await settle('pre', () => get(`/${NS}/comp`), has('comp:K0'), performance.now());
    let t0 = performance.now(); write(`components/${NS}-badge.ts`, comp(`${NS}-badge`, 'K1').replace('render() {', 'render() {(('));
    const a = await settle('component-syntax-error-500', () => get(`/${NS}/comp`), (r) => r.status >= 500, t0, 300);
    t0 = performance.now(); write(`components/${NS}-badge.ts`, comp(`${NS}-badge`, 'K2'));
    const b = await settle('component-syntax-recovers', () => get(`/${NS}/comp`), has('comp:K2'), t0);
    return [a, b];
  });
  S('atomic-write', async () => {
    let t0 = performance.now(); atomicWrite(`app/${NS}/burst/page.ts`, page('aw1'));
    const a = await settle('atomic-page', () => get(`/${NS}/burst`), has('marker:aw1'), t0);
    t0 = performance.now(); atomicWrite(ACT, action('ping', 'AW2'));
    const b = await settle('atomic-action', () => call(ACT, 'ping'), has('act:AW2'), t0);
    t0 = performance.now(); atomicWrite(`app/${NS}/burst/page.ts`, page('aw3'));
    const c = await settle('atomic-page-again', () => get(`/${NS}/burst`), has('marker:aw3'), t0);
    return [a, b, c];
  });
  S('new-feature-at-once', async () => {
    // mkdir + page + action + component all at once, page calls action during SSR
    const f = `modules/${NS}f/actions/feat.server.ts`;
    const t0 = performance.now();
    write(f, action('feat', 'F1'));
    write(`app/${NS}/feat/page.ts`, pageWith(`import { feat } from '#modules/${NS}f/actions/feat.server.ts';`, `const v = await feat();\n  return html\`<p>marker:\${v}</p>\`;`));
    const [a, b] = await Promise.all([
      settle('feature-page', () => get(`/${NS}/feat`), has('marker:act:F1'), t0),
      settle('feature-action', () => call(f, 'feat'), has('act:F1'), t0)]);
    return [a, b];
  });
  S('dynamic-alias-import', async () => {
    // A server module that imports a sibling relatively, reached through a
    // dynamic `#` import (Crisp's provisioning does exactly this). A Bun
    // runtime onResolve turned that into a `file:/...` path (#1575 regression).
    write(`modules/${NS}d/types.ts`, `export const T = 'dyn-ok';\n`);
    write(`modules/${NS}d/engine.server.ts`, `import { T } from './types.ts';\nexport function eng() { return T; }\n`);
    write(`app/api/${NS}d/route.ts`, `export async function GET() {\n  const { eng } = await import('#modules/${NS}d/engine.server.ts');\n  return new Response('route:' + eng());\n}\n`);
    const t0 = performance.now();
    const r = await settle('dynamic-alias-import', () => get(`/api/${NS}d`), has('route:dyn-ok'), t0);
    rm(`modules/${NS}d`); rm(`app/api/${NS}d`);
    return r;
  });
  S('mass-churn', async () => {
    // a git-checkout-like burst: delete and recreate many files
    for (let i = 0; i < 12; i++) write(`app/${NS}/m${i}/page.ts`, page('m' + i));
    await sleep(50);
    rm(`app/${NS}`);
    await sleep(20);
    const t0 = performance.now();
    for (let i = 0; i < 12; i++) write(`app/${NS}/m${i}/page.ts`, page('mm' + i));
    write(ACT, action('ping', 'MC'));
    return Promise.all([
      settle('mass-page-0', () => get(`/${NS}/m0`), has('marker:mm0'), t0, 200),
      settle('mass-page-11', () => get(`/${NS}/m11`), has('marker:mm11'), t0, 200),
      settle('mass-action', () => call(ACT, 'ping'), has('act:MC'), t0, 200)]);
  });
  S('stable', async () => {
    const t0 = performance.now();
    return settle('home-still-200', () => get('/'), status(200), t0, 100);
  });


  try {
    for (const n of only.length ? only : Object.keys(scenarios)) {
      if (!scenarios[n]) throw new Error(`unknown scenario ${n}`);
      const r = await scenarios[n]();
      for (const x of [r].flat()) {
        if (x.name === 'pre') continue;
        results.push(x);
        log(`${x.ok ? (x.ms <= 200 ? 'PASS' : 'SLOW') : 'FAIL'} ${x.name.padEnd(28)} ${String(x.ms).padStart(5)}ms ${x.why || ''}`);
      }
    }
  } finally {
    rm(`app/${NS}`); rm(`app/api/${NS}`); rm(`modules/${NS}`); rm(`modules/${NS}f`); rm(`components/${NS}-badge.ts`);
  }
  return results;
}

/** One-line summary of a stress run. @param {StressResult[]} results */
export function summarizeStress(results) {
  const fail = results.filter((r) => !r.ok).length;
  const slow = results.filter((r) => r.ok && r.ms > 200).length;
  const okMs = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  return `${results.length} checks: ${results.length - fail - slow} pass, ${slow} slow (>200ms), ${fail} fail; p50 ${okMs[Math.floor(okMs.length / 2)] ?? '-'}ms max ${okMs.at(-1) ?? '-'}ms`;
}

/**
 * Edit one page `edits` times (every fifth edit an action instead), waiting
 * for each to be served, and sample the server's RSS.
 *
 * @param {{ appDir: string, base: string, edits: number, rssMb?: () => number, log?: (line: string) => void }} opts
 * @returns {Promise<{ fails: number, worstMs: number, rss: number[] }>}
 */
export async function runDevReloadSoak({ appDir, base, edits, rssMb = () => -1, log = () => {} }) {
  const pg = join(appDir, `app/${NS}soak/page.ts`);
  const act = join(appDir, `modules/${NS}soak/a.server.ts`);
  mkdirSync(dirname(pg), { recursive: true });
  mkdirSync(dirname(act), { recursive: true });
  const h = createHash('sha256').update(act).digest('hex').slice(0, 10);
  const origin = new URL(base).origin;
  let worstMs = 0, fails = 0;
  const rss = [];
  try {
    for (let i = 0; i < edits; i++) {
      const m = 'k' + i + '_' + Date.now().toString(36);
      const isAct = i % 5 === 4;
      if (isAct) writeFileSync(act, `'use server';\nexport async function a() { return 'act:${m}'; }\n`);
      else writeFileSync(pg, `import { html } from '@webjsdev/core';\nexport default function P() { return html\`<p>marker:${m}</p>\`; }\n`);
      const s = performance.now();
      let ok = false;
      while (performance.now() - s < 10000) {
        try {
          const r = isAct
            ? await fetch(`${base}/__webjs/action/${h}/a`, { method: 'POST', headers: { origin, 'content-type': 'application/vnd.webjs+json' }, body: '[]' })
            : await fetch(`${base}/${NS}soak`);
          const b = await r.text();
          if (r.status === 200 && b.includes(isAct ? 'act:' + m : 'marker:' + m)) { ok = true; break; }
        } catch {}
        await sleep(10);
      }
      const ms = Math.round(performance.now() - s);
      worstMs = Math.max(worstMs, ms);
      if (!ok) fails++;
      if (i % 25 === 0 || i === edits - 1) { const mb = rssMb(); rss.push(mb); log(`edit ${i} rss ${mb}MB last ${ms}ms worst ${worstMs}ms fails ${fails}`); }
      await sleep(20);
    }
  } finally {
    rmSync(dirname(pg), { recursive: true, force: true });
    rmSync(dirname(act), { recursive: true, force: true });
  }
  return { fails, worstMs, rss };
}

/** RSS in MB of the process listening on `port` (Linux), or -1. @param {number | string} port */
export function listenerRssMb(port) {
  try {
    const pid = execSync(`ss -ltnpH 'sport = :${port}'`, { encoding: 'utf8' }).match(/pid=(\d+)/)?.[1];
    if (!pid) return -1;
    return Math.round(Number(readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) / 1024);
  } catch { return -1; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [appDir, base] = process.argv.slice(2);
  if (!appDir || !base) {
    console.error('usage: node scripts/dev-reload-stress.mjs <appDir> <baseUrl> [--only=a,b] [--soak=N]');
    process.exit(2);
  }
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const soak = Number((process.argv.find((a) => a.startsWith('--soak=')) || '').slice(7) || 0);
  const results = await runDevReloadStress({ appDir, base, only, timeoutMs: Number(process.env.STRESS_TIMEOUT || 8000), log: console.log });
  console.log('\n' + summarizeStress(results));
  let failed = results.some((r) => !r.ok);
  if (soak) {
    const port = new URL(base).port || '80';
    const r = await runDevReloadSoak({ appDir, base, edits: soak, rssMb: () => listenerRssMb(port), log: console.log });
    console.log(`soak: ${soak} edits, ${r.fails} not served, worst ${r.worstMs}ms, rss ${r.rss.join(' -> ')}MB`);
    failed ||= r.fails > 0;
  }
  process.exit(failed ? 1 : 0);
}
