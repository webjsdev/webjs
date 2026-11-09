/**
 * The muscle-memory corpus, "refused" half (cases in `refused-cases.mjs`): a
 * habit WebJs cannot honour is refused by `webjs check` with the fix in the
 * message, and fails at load or render time in dev naming the same fix, rather
 * than misbehaving silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { checkConventions } from '@webjsdev/server/check';
import { createRequestHandler } from '@webjsdev/server';
import { REFUSED } from './refused-cases.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, erasableSyntaxOnly: true, verbatimModuleSyntax: true } });

async function makeApp(c) {
  const appDir = await mkdtemp(join(tmpdir(), `webjs-refused-${c.id}-`));
  const files = {
    'package.json': JSON.stringify({ name: `refused-${c.id}`, private: true, type: 'module' }),
    'tsconfig.json': TSCONFIG,
    'app/page.ts': `import { html } from '@webjsdev/core';\nimport '../${c.file}';\nexport default function Page() { return html\`<main><${c.tag}></${c.tag}></main>\`; }\n`,
    [c.file]: c.source,
  };
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(dirname(join(appDir, rel)), { recursive: true });
    await writeFile(join(appDir, rel), body);
  }
  await symlink(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));
  return appDir;
}

/** Everything a dev request logs, through the logger and the console. */
async function devRequest(appDir, path) {
  const logged = [];
  const sink = (...args) => logged.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  const logger = { info() {}, debug() {}, warn: sink, error: sink };
  const saved = { error: console.error, warn: console.warn, log: console.log };
  console.error = sink; console.warn = sink; console.log = () => {};
  try {
    const h = await createRequestHandler({ appDir, dev: true, logger });
    await h.warmup?.();
    const res = await h.handle(new Request('http://localhost' + path));
    const body = await res.text();
    // The dev error frame (what `webjs status` and the overlay show) carries
    // the WebJs hint for a module that failed to load during the render.
    const status = await (await h.handle(new Request('http://localhost/__webjs/dev/status'))).text();
    return { status: res.status, text: `${body}\n${status}\n${logged.join('\n')}` };
  } finally {
    Object.assign(console, saved);
  }
}

for (const c of REFUSED) {
  test(`refused: ${c.idiom}`, async () => {
    const appDir = await makeApp(c);
    try {
      const violations = await checkConventions(appDir);
      const hit = violations.find((v) => v.rule === c.rule && v.file.replaceAll('\\', '/').endsWith(c.file));
      assert.ok(hit, `${c.rule} did not fire on ${c.file}; got ${JSON.stringify(violations.map((v) => v.rule))}`);
      assert.match(`${hit.message} ${hit.fix || ''}`, c.fix, 'the check report carries the fix');

      if (c.load) {
        const { text } = await devRequest(appDir, c.load.path);
        assert.match(text, c.load.match, `requesting ${c.load.path} in dev names the fix`);
      }
    } finally {
      await rm(appDir, { recursive: true, force: true });
    }
  });
}
