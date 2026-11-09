/**
 * The muscle-memory corpus, "works" half: code written the way an agent trained
 * on Lit and the Next.js App Router writes it (with WebJs imports), which must
 * be clean under `webjs check` and render correctly with no WebJs-specific
 * adjustment. Each fixture file names the idiom it carries in its header.
 *
 * This file covers the check verdict and the server render. The same components
 * are exercised after hydration in `browser/works.test.js`, where the idioms
 * that only act in the browser (`renderRoot`, a Task resolving, context, a
 * signal write) prove themselves. `test/bun/muscle-memory.mjs` repeats the
 * render on Bun. The refusal half lives in `refused.test.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkConventions } from '@webjsdev/server/check';
import { createRequestHandler } from '@webjsdev/server';

const APP = join(dirname(fileURLToPath(import.meta.url)), 'works');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

test('the corpus is clean under webjs check', async () => {
  const violations = await checkConventions(APP);
  assert.deepEqual(violations.map((v) => `[${v.rule}] ${v.file}: ${v.message}`), []);
});

test('the corpus renders every Lit idiom on the server', async () => {
  const h = await createRequestHandler({ appDir: APP, dev: false, logger: quiet });
  await h.warmup?.();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  const has = (needle, why) => assert.ok(html.includes(needle), `${why}: expected ${JSON.stringify(needle)}`);

  has('<title>Muscle memory</title>', 'static metadata');
  has('<div class="shell">', 'the root layout wraps the page');
  has('<button >Count: 3</button>', '`static properties` with `declare` reads the attribute');
  has('shadowrootmode="open" shadowrootdelegatesfocus', '`static shadowRootOptions` reaches the declarative shadow root');
  has('h2 { color: rgb(255, 0, 0); }', 'composed `static styles` with `unsafeCSS`');
  has('<p>Light root</p>', '`createRenderRoot() { return this; }` renders light DOM');
  has('<p>Waiting</p>', 'a Task renders its initial state on the server');
  has('<span>Theme: none</span>', 'a context consumer renders before any provider answers');
  has('<li>apple</li><li>pear</li>', 'two-argument `repeat`');
  has('APPLE, PEAR', '`join` over `map`');
  has('<b>0</b><b>1</b><b>2</b>', '`range`');
  has('<p>Has fruit</p>', '`when`');
  has('<p>Short mode</p>', '`choose`');
  assert.match(html, /<p class="\s*active\s*">Mode flag<\/p>/, '`classMap`');
  has('<p>HELLO!</p>', 'a custom directive');
  has('<button >Clicks: 0</button>', 'a bare signal in a child hole');
});
