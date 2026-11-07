/**
 * A Hugeicon's `data-icon` is shadcn's placement hint and nothing else
 * (#1666). shadcn writes `<HugeiconsIcon icon={...} data-icon="inline-end" />`
 * inside a button, and the button's style reads `[data-icon=inline-end]` to
 * tighten its padding on that side. The helpers used to stamp the icon's own
 * name there, which left no way to pass the hint and gave every icon a value
 * no style matches.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToString } from '@webjsdev/core/server';
import { createRequestHandler } from '@webjsdev/server';
import { ArrowRight02Icon, Search01Icon } from '#lib/ui/hugeicons.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('a Hugeicon carries data-icon only when given a placement', async () => {
  const plain = await renderToString(Search01Icon('size-4', 2));
  assert.doesNotMatch(plain, /data-icon/, plain.slice(0, 200));
  const placed = await renderToString(ArrowRight02Icon('', 2, { icon: 'inline-end' }));
  assert.match(placed, /<svg[^>]*\sdata-icon="inline-end"/);
});

let handle: (path: string) => Promise<Response>;
before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

test('the /ui home page button places its arrow inline-end, as shadcn\'s does', async () => {
  const res = await handle('/ui');
  assert.equal(res.status, 200);
  const html = await res.text();
  const button = html.match(/<button[^>]*data-slot="button"[^>]*>Button <svg[^>]*>/)?.[0];
  assert.ok(button, 'the UI elements card renders its "Button" button');
  assert.match(button, /<svg[^>]*\sdata-icon="inline-end"/);
  assert.doesNotMatch(html, /data-icon="[A-Z]\w*Icon"/, 'no icon names itself in data-icon');
});
