/**
 * Cross-runtime proof that a bound form action (`action.bind(null, x)`) renders
 * and dispatches identically on Node and Bun. Run from the repo root:
 *
 *   node test/bun/bound-form-action.mjs
 *   bun  test/bun/bound-form-action.mjs
 *
 * The `.bind` that keeps the identity is installed by the 'use server' load
 * hook's wrapper, which is `module.registerHooks` on Node and a `Bun.plugin` on
 * Bun, so a divergence there is a bound form that refuses to render on one
 * runtime. The bound arguments go through the rich serializer and the form
 * body parser, both with a history of runtime-specific bugs.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { submitForm } from '../../packages/server/src/testing.js';

const runtime = process.versions.bun ? 'bun' : 'node';
const here = dirname(fileURLToPath(import.meta.url));
const url = (p) => JSON.stringify(pathToFileURL(resolve(here, p)).toString());

const dir = mkdtempSync(join(tmpdir(), 'webjs-bound-bun-'));
mkdirSync(join(dir, 'app/e/[slug]'), { recursive: true });
mkdirSync(join(dir, 'modules'), { recursive: true });
writeFileSync(join(dir, 'modules/rsvp.server.ts'), `'use server';
export async function rsvp(slug, when, input) {
  return { success: true, redirect: '/ok/' + slug + '/' + (when instanceof Date ? when.getUTCFullYear() : 'nodate') + '/' + input.email };
}
`);
writeFileSync(join(dir, 'app/e/[slug]/page.ts'), `import { html } from ${url('../../packages/core/index.js')};
import { rsvp } from '../../../modules/rsvp.server.ts';
export default ({ params }) => html\`<form action=\${rsvp.bind(null, params.slug, new Date('2027-05-01T00:00:00Z'))}><input name="email"></form>\`;
`);

try {
  const app = await createRequestHandler({ appDir: dir, dev: true });
  const res = await submitForm(app.handle, '/e/meetup', { email: 'ada@example.com' });
  assert.equal(res.status, 303, `[${runtime}] the bound form submits`);
  assert.equal(res.headers.get('location'), '/ok/meetup/2027/ada@example.com', `[${runtime}] bound args (a Date included) arrive before the input`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`[bound-form-action] action.bind(null, ...) forms dispatch on ${runtime}`);
