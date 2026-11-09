/**
 * Cross-runtime proof for the muscle-memory corpus (test/muscle-memory/). Run
 * from the repo root:
 *
 *   node test/bun/muscle-memory.mjs
 *   bun  test/bun/muscle-memory.mjs
 *
 * The corpus is TypeScript, stripped by Node's built-in stripper or by amaro on
 * Bun, and its refusals depend on how each runtime fails a module: Node rejects
 * a decorator with a bare SyntaxError while Bun runs legacy decorators and
 * throws a ReferenceError for the undefined decorator, and the two word a
 * missing export differently. So on whichever runtime executes it, this asserts
 * the Lit-idiom page renders the same markers and every dev-time refusal still
 * names its fix.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { REFUSED } from '../muscle-memory/refused-cases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

// The works half renders identically.
{
  const h = await createRequestHandler({ appDir: join(ROOT, 'test/muscle-memory/works'), dev: false, logger: quiet });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200, `${runtime}: the corpus page renders`);
  const html = await res.text();
  for (const needle of [
    '<button >Count: 3</button>',
    'shadowrootmode="open" shadowrootdelegatesfocus',
    'h2 { color: rgb(255, 0, 0); }',
    '<p>Light root</p>',
    '<p>Waiting</p>',
    '<li>apple</li><li>pear</li>',
    'APPLE, PEAR',
    '<p>HELLO!</p>',
    '<button >Clicks: 0</button>',
  ]) {
    assert.ok(html.includes(needle), `${runtime}: the corpus render contains ${JSON.stringify(needle)}`);
  }
}

// Every dev-time refusal names its fix.
for (const c of REFUSED.filter((x) => x.load && !(process.versions.bun && x.serverLoadsOnBun))) {
  const appDir = mkdtempSync(join(tmpdir(), `webjs-bun-refused-${c.id}-`));
  try {
    const files = {
      'package.json': JSON.stringify({ name: `refused-${c.id}`, private: true, type: 'module' }),
      'app/page.ts': `import { html } from '@webjsdev/core';\nimport '../${c.file}';\nexport default function Page() { return html\`<main><${c.tag}></${c.tag}></main>\`; }\n`,
      [c.file]: c.source,
    };
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(appDir, rel)), { recursive: true });
      writeFileSync(join(appDir, rel), body);
    }
    symlinkSync(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));

    const logged = [];
    const sink = (...args) => logged.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    const saved = { error: console.error, warn: console.warn, log: console.log };
    console.error = sink; console.warn = sink; console.log = () => {};
    let text;
    try {
      const h = await createRequestHandler({ appDir, dev: true, logger: { info() {}, debug() {}, warn: sink, error: sink } });
      await h.warmup?.();
      const body = await (await h.handle(new Request('http://localhost' + c.load.path))).text();
      const status = await (await h.handle(new Request('http://localhost/__webjs/dev/status'))).text();
      text = `${body}\n${status}\n${logged.join('\n')}`;
    } finally {
      Object.assign(console, saved);
    }
    assert.match(text, c.load.match, `${runtime}: ${c.idiom} names its fix`);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
}

console.log(`muscle-memory: ok on ${runtime}`);
