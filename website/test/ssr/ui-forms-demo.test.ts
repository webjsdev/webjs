/**
 * The live form on /ui/docs/forms (#1666, D12). Its bound action posts to the
 * docs page itself, and the docs route hands the 422 re-render's actionData
 * to the page body, so a failed submission comes back with the field errors
 * and the typed values in the form. The identity is read back from the
 * rendered page, never computed here, so the renderer and the dispatcher are
 * both on the path.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = '/ui/docs/forms';
const FIELD = '__webjs_action';

let app: Awaited<ReturnType<typeof createRequestHandler>>;

before(async () => {
  app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
});

async function identity(): Promise<string> {
  const res = await app.handle(new Request('http://localhost' + PAGE));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.doesNotMatch(body, /async function submitBugReport/, 'the action source never ships');
  const m = new RegExp(`name="${FIELD}" value="([^"]*/submitBugReport)"`).exec(body);
  assert.ok(m, 'the demo form carries the bound action identity');
  return m[1];
}

async function submit(fields: Record<string, string>): Promise<Response> {
  return app.handle(new Request('http://localhost' + PAGE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams(fields).toString(),
  }));
}

test('an invalid submission re-renders the docs page at 422 with the errors and the typed values', async () => {
  const id = await identity();
  const res = await submit({ [FIELD]: id, title: 'Bug', description: 'It breaks.' });
  assert.equal(res.status, 422);
  const body = await res.text();
  assert.match(body, /<h1[^>]*>Forms<\/h1>/, 'the whole docs page re-renders');
  // Matched with their element ids: the page's code samples quote the same
  // messages as text, so the bare strings would pass with no error rendered.
  assert.match(body, /id="bug-report-title-error"[^>]*>Bug title must be at least 5 characters\.</, 'the title error is shown');
  assert.match(body, /id="bug-report-description-error"[^>]*>Description must be at least 20 characters\.</, 'the description error is shown');
  assert.match(body, /id="bug-report-title"[^>]*value="Bug"|value="Bug"[^>]*id="bug-report-title"/, 'the typed title is kept');
  assert.match(body, />It breaks\.<\/textarea>/, 'the typed description is kept');
  assert.match(body, /id="bug-report-title"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*id="bug-report-title"/, 'the invalid control is marked');
});

test('a plain GET renders the form empty, with no errors', async () => {
  const res = await app.handle(new Request('http://localhost' + PAGE));
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.doesNotMatch(body, /id="bug-report-title-error"/);
  assert.doesNotMatch(body, /id="bug-report-description-error"/);
  const input = /<input[^>]*id="bug-report-title"[^>]*>/.exec(body)?.[0] ?? '';
  assert.ok(input, 'the demo form is on the page');
  assert.doesNotMatch(input, /aria-invalid/, 'no control is marked invalid');
  assert.match(input, /value=""/, 'the title starts empty');
});

test('a valid submission redirects back to the page, so the form renders empty', async () => {
  const id = await identity();
  const res = await submit({
    [FIELD]: id,
    title: 'Login button broken',
    description: 'Tapping login on mobile does nothing at all.',
  });
  assert.equal(res.status, 303);
  assert.equal(new URL(res.headers.get('location') ?? '', 'http://localhost').pathname, PAGE);
});
