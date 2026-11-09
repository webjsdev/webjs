/**
 * Cross-runtime proof that a Lit decorator is refused LOUDLY, with the WebJs
 * fix, under whichever runtime executes this file. Run it under both:
 *
 *   node test/bun/decorator-detection.mjs
 *   bun  test/bun/decorator-detection.mjs
 *
 * The two runtimes fail a decorated module differently, which is why this is
 * runtime-sensitive: Node's type stripper passes the decorator through and the
 * module dies with a bare `SyntaxError: Invalid or unexpected token` carrying
 * no location, while Bun (whose stripper is `amaro`) runs legacy decorators
 * and throws a `ReferenceError` for the undefined decorator function with a
 * real stack frame. Both must end at the same three surfaces:
 *   - `webjs check` flags it under `no-non-erasable-typescript` with the fix,
 *   - the dev server refuses to serve the module to the browser (a 500 stub
 *     naming the decorator), and
 *   - a page whose SSR import fails on it pushes a dev frame with the hint.
 *
 * A plain assert script (not `*.test.mjs`); it throws on failure.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequestHandler } from '../../packages/server/src/dev.js';
import { checkConventions } from '../../packages/server/src/check.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const root = mkdtempSync(join(tmpdir(), 'webjs-decorator-'));
function makeApp(name, files) {
  const appDir = join(root, name);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

try {
  const decorated =
    "import { WebComponent, html } from '@webjsdev/core';\n" +
    'export class DecEl extends WebComponent {\n' +
    '  @property({ type: Number }) count = 0;\n' +
    '  render() { return html`<p @click=${() => 1}>x</p>`; }\n' +
    '}\n';

  // 1. webjs check names the decorator and its fix.
  const checkApp = makeApp('check', { 'components/dec.ts': decorated, 'components/dec2.js': "@customElement('x-y')\nexport class X {}\n" });
  const violations = await checkConventions(checkApp);
  const ts = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('dec.ts'));
  const js = violations.find((v) => v.rule === 'no-non-erasable-typescript' && v.file.endsWith('dec2.js'));
  assert.ok(ts && /`@property` at line 3/.test(ts.message) && /static properties/.test(ts.fix), `[${runtime}] check flags @property`);
  assert.ok(js && /\.register\(/.test(js.fix), `[${runtime}] check flags @customElement in .js`);

  // 2. The dev server refuses to serve the decorated module to the browser.
  const serveApp = makeApp('serve', {
    'app/page.js': "import '../components/dec.ts';\nexport default function P() { return 'ok'; }\n",
    'components/dec.ts': decorated,
  });
  const frames = [];
  const app = await createRequestHandler({ appDir: serveApp, dev: true, onDevError: (f) => frames.push(f) });
  await app.warmup();
  const res = await app.handle(new Request('http://x/components/dec.ts'));
  assert.equal(res.status, 500, `[${runtime}] decorated module is a 500 stub`);
  assert.match(await res.text(), /static properties/, `[${runtime}] the stub names the fix`);
  assert.ok(frames.some((f) => f.kind === 'ts-strip' && /static properties/.test(f.hint || '')), `[${runtime}] a ts-strip frame carries the fix`);

  // 3. An SSR import that fails on the decorator surfaces the hint, whichever
  //    error class this runtime throws for it.
  const ssrApp = makeApp('ssr', {
    'app/page.ts': "import { DecEl } from '../components/dec.ts';\nexport default function P() { return String(DecEl); }\n",
    'components/dec.ts': 'export class DecEl {\n  @state() open = false;\n}\n',
  });
  const ssrFrames = [];
  const ssr = await createRequestHandler({ appDir: ssrApp, dev: true, onDevError: (f) => ssrFrames.push(f) });
  const page = await ssr.handle(new Request('http://x/'));
  assert.equal(page.status, 500, `[${runtime}] the page fails`);
  assert.ok(
    ssrFrames.some((f) => /state: true/.test(f.hint || '')),
    `[${runtime}] the render frame carries the @state fix: ${JSON.stringify(ssrFrames.map((f) => [f.message, f.file, f.hint]))}`,
  );

  console.log(`[${runtime}] decorator detection OK`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
