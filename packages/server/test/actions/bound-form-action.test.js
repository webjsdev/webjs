/**
 * `<form action=${rsvp.bind(null, slug)}>`, Next.js's way to give a form action
 * an extra argument. The server's action wrapper gives every action a `.bind`
 * that keeps its identity, the renderer writes the bound arguments into the
 * hidden identity field, and the dispatcher calls `rsvp(slug, input)`, with no
 * JavaScript involved. An agent building an app on the scaffold wrote exactly
 * this and had to fall back to a hidden input.
 *
 * Counterfactual: drop the `installActionBind(orig)` call from `__actionWrap`
 * (src/action-seed.js) and the page refuses to render the bound form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

import { createRequestHandler } from '../../src/dev.js';
import { submitForm, testRequest } from '../../src/testing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-bound-action-'));
  for (const d of ['app/events/[slug]', 'app/counter', 'app/tagged', 'modules']) await mkdir(join(dir, d), { recursive: true });
  await writeFile(join(dir, 'modules/rsvp.server.ts'),
    `'use server';
export async function rsvp(slug, input) {
  const email = String(input.email || '');
  if (!email.includes('@')) return { success: false, error: 'bad email for ' + slug };
  return { success: true, redirect: '/joined/' + slug + '/' + email };
}
// Next's useActionState shape with a bound argument: (bound, prevState, formData).
export async function bump(label, prev, input) {
  const n = (prev && prev.n) || 0;
  return { success: false, n: n + 1, label, note: String(input.note || '') };
}
export async function twice(a, b, input) {
  return { success: true, redirect: '/got/' + a + '/' + b + '/' + String(input.x || '') };
}
`);
  await writeFile(join(dir, 'app/events/[slug]/page.ts'),
    `import { html } from ${CORE};
import { rsvp } from '../../../modules/rsvp.server.ts';
export default ({ params, actionData }) => html\`<form action=\${rsvp.bind(null, params.slug)}><input name="email"></form><p id="err">\${actionData?.error ?? ''}</p>\`;
`);
  await writeFile(join(dir, 'app/counter/page.ts'),
    `import { html } from ${CORE};
import { bump } from '../../modules/rsvp.server.ts';
export default ({ actionData }) => html\`<form action=\${bump.bind(null, 'clicks')}><input name="note"></form><p id="n">\${actionData ? actionData.label + ':' + actionData.n + ':' + actionData.note : 'none'}</p>\`;
`);
  await writeFile(join(dir, 'app/tagged/page.ts'),
    `import { html } from ${CORE};
import { twice } from '../../modules/rsvp.server.ts';
const once = twice.bind(null, 'a');
export default () => html\`<form action=\${once.bind(null, 'b')}><input name="x"></form>\`;
`);
  return dir;
}

let app;
async function handler() {
  if (!app) {
    app = await createRequestHandler({ appDir: await makeApp(), dev: true });
    await app.warmup();
  }
  return app;
}

test('a bound action renders and receives its bound argument before the input', async () => {
  const a = await handler();
  const page = await testRequest(a.handle, '/events/meetup');
  assert.equal(page.status, 200, 'the bound form renders');
  const res = await submitForm(a.handle, '/events/meetup', { email: 'ada@example.com' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/joined/meetup/ada@example.com');
});

test('a failure re-renders with the bound argument the action saw', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/events/workshop', { email: 'nope' });
  assert.equal(res.status, 422);
  assert.match(await res.text(), /bad email for workshop/);
});

test('a bound action declaring prevState gets it after the bound parameters', async () => {
  const a = await handler();
  const first = await submitForm(a.handle, '/counter', { note: 'hi' });
  assert.equal(first.status, 422);
  assert.match(await first.text(), /clicks:1:hi/, 'bound label, first count, the input');
});

test('binding a bound action appends, as Function.prototype.bind does', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/tagged', { x: 'z' });
  assert.equal(res.headers.get('location'), '/got/a/b/z');
});

test('a mangled argument list is a 400, not a call with garbage', async () => {
  const a = await handler();
  const page = await testRequest(a.handle, '/events/meetup');
  const id = (await page.text()).match(/name="__webjs_action" value="([^"#]*)#/)[1];
  const res = await a.handle(new Request('http://localhost/events/meetup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost' },
    body: new URLSearchParams({ __webjs_action: id + '#%7Bnot-json', email: 'a@b.co' }).toString(),
  }));
  assert.equal(res.status, 400);
});
