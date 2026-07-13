/**
 * End-to-end serving test for on-request dev regeneration (#967): a GET to a
 * stale `/public/tailwind.css` triggers the declared regenerate command and
 * serves the FRESH bytes, with no `--watch` process anywhere. This is the
 * headline behaviour: a newly added utility class is never served stale.
 *
 * The regenerate command is a portable `node -e` writer standing in for the
 * Tailwind CLI, so the test needs no compiler on PATH.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-regen-serve-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

// A regenerate command that "compiles" tailwind.css by emitting a rule for
// whatever class the page source currently references (read from app/page.ts).
// Stands in for `tailwindcss -i input.css -o tailwind.css`.
const COMPILE = `node -e "const fs=require('fs');const src=fs.readFileSync('app/page.ts','utf8');const m=src.match(/[a-z-]+-[0-9]+/);fs.writeFileSync('public/tailwind.css','.'+(m?m[0]:'none')+'{display:grid}')"`;

test('GET /public/tailwind.css recompiles when a source is newer, serving the fresh class', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'home';`,
    'public/input.css': `@import "tailwindcss";`,
    'public/tailwind.css': `.old-1{display:block}`, // a stale prior build
    'package.json': JSON.stringify({
      name: 'regen-serve',
      webjs: {
        dev: {
          regenerate: [
            { output: 'public/tailwind.css', command: COMPILE, inputs: ['app', 'public/input.css'] },
          ],
        },
      },
    }),
  });

  // Make the existing output OLD and then add a brand-new utility class to a
  // source, edited NOW: this is the exact "added a class, watch not running" case.
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(appDir, 'public', 'tailwind.css'), past, past);
  utimesSync(join(appDir, 'public', 'input.css'), past, past);
  writeFileSync(join(appDir, 'app', 'page.ts'), `export default () => 'grid-cols-4';`);

  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/public/tailwind.css'));
  assert.equal(resp.status, 200);
  const css = await resp.text();
  assert.match(css, /grid-cols-4/, 'served CSS reflects the newly added class');
  assert.doesNotMatch(css, /old-1/, 'stale rule was replaced by the fresh compile');
  // And it landed on disk (a real build output, PE-safe).
  assert.match(readFileSync(join(appDir, 'public', 'tailwind.css'), 'utf8'), /grid-cols-4/);
});

test('GET /public/tailwind.css does NOT recompile when the output is already fresh', async () => {
  const appDir = makeApp({
    'app/page.ts': `export default () => 'grid-cols-4';`,
    'public/input.css': `@import "tailwindcss";`,
    // A command that would OVERWRITE with a sentinel if it ever ran; it must not.
    'package.json': JSON.stringify({
      name: 'regen-fresh',
      webjs: {
        dev: {
          regenerate: [
            {
              output: 'public/tailwind.css',
              command: `node -e "require('fs').writeFileSync('public/tailwind.css','.RECOMPILED{x:1}')"`,
              inputs: ['app', 'public/input.css'],
            },
          ],
        },
      },
    }),
  });
  writeFileSync(join(appDir, 'public', 'tailwind.css'), `.grid-cols-4{display:grid}`);
  // Sources old, output new (fresh).
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(appDir, 'app', 'page.ts'), past, past);
  utimesSync(join(appDir, 'public', 'input.css'), past, past);

  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/public/tailwind.css'));
  assert.equal(resp.status, 200);
  const css = await resp.text();
  assert.doesNotMatch(css, /RECOMPILED/, 'fresh output must not be rebuilt');
  assert.match(css, /grid-cols-4/);
});
