/**
 * Cross-runtime proof that form-action dispatch (#1155) behaves identically on
 * Node and Bun. Run from the repo root:
 *
 *   node test/bun/form-action-dispatch.mjs
 *   bun  test/bun/form-action-dispatch.mjs
 *
 * Every layer this touches is one the two runtimes implement separately, which
 * is why it needs a parity proof rather than a Node test:
 *
 *   - the `'use server'` LOAD HOOK that registers action identity: Node uses
 *     `module.registerHooks`, Bun a `Bun.plugin` `onLoad`. A divergence here
 *     means a rendered form carries no identity, or a wrong one.
 *   - `FormData` / `multipart` parsing, a serializer surface with a measured
 *     history of Bun-specific bugs.
 *   - `crypto.subtle.digest`, which the identity hash is built on.
 *   - the whole request path through `createRequestHandler`.
 *
 * The strongest assertion here is the round trip: render the page, read the
 * identity the RENDERER emitted, submit it back, and require the DISPATCHER to
 * resolve it. Computing the identity in the test instead would let both halves
 * drift together and still pass.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { resetFormReportDedupe } from '../../packages/server/src/form-dispatch.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const CORE = JSON.stringify(pathToFileURL(resolve('packages/core/index.js')).toString());

const dir = mkdtempSync(join(tmpdir(), 'webjs-1155-bun-'));
function write(rel, body) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}

write('signup.server.js', `
'use server';
export async function signup(input) {
  // #1664: the input reads as properties (the RPC shape) AND through the
  // FormData readers, and a File field is a real File either way.
  const email = String(input.email || '').trim();
  if (input.get('email') !== input.email) return { success: false, error: 'reader and property disagree' };
  const file = input.avatar;
  // By name, not identity: Bun's FormData.get() hands back a fresh File each call.
  if (file && input.get('avatar').name !== file.name) return { success: false, error: 'file reader and property disagree' };
  if (!email.includes('@')) {
    return { success: false, fieldErrors: { email: 'bad email' }, values: { email }, status: 422 };
  }
  const suffix = file && typeof file.name === 'string' ? '/' + file.name + ':' + (await file.text()) : '';
  return { success: true, redirect: '/welcome?got=' + encodeURIComponent(email + suffix) };
}
`);
write('app/signup/page.js', `
import { html } from ${CORE};
import { signup } from '../../signup.server.js';
export default function Signup({ actionData }) {
  const err = actionData?.fieldErrors?.email || '';
  const val = actionData?.values?.email || '';
  return html\`<form action=\${signup}><input name="email" value="\${val}"><p class="e">\${err}</p></form>\`;
}
`);

const app = await createRequestHandler({ appDir: dir, dev: false });
await app.warmup();

const FIELD = '__webjs_action';

/** Render the page and read back the identity its bound form emitted. */
async function renderIdentity() {
  const body = await (await app.handle(new Request('http://x/signup'))).text();
  assert.ok(!body.includes('async function signup'), `[${runtime}] the action source must never ship`);
  const m = new RegExp(`name="${FIELD}" value="([^"]*)"`).exec(body);
  assert.ok(m, `[${runtime}] the rendered form must carry an identity field`);
  assert.match(body, /method="post"/, `[${runtime}] method is forced`);
  assert.doesNotMatch(body, /<form[^>]*\saction=/, `[${runtime}] the form posts to its own url`);
  return m[1];
}

const id = await renderIdentity();
assert.match(id, /^[0-9a-f]{10}\/signup$/, `[${runtime}] identity shape is <hash>/<fn>, got ${id}`);

// The identity is STABLE across renders. It is a content hash of the file path,
// computed through Web Crypto, so an unstable one would mean a form rendered
// now cannot be submitted a moment later.
assert.equal(await renderIdentity(), id, `[${runtime}] identity must be stable across renders`);

function urlencoded(fields) {
  const p = new URLSearchParams(fields);
  return new Request('http://x/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
    body: p.toString(),
  });
}

// Success: 303 Post/Redirect/Get, with the action's own target.
{
  const res = await app.handle(urlencoded({ [FIELD]: id, email: 'a@b.com' }));
  assert.equal(res.status, 303, `[${runtime}] a successful submission PRG-redirects`);
  assert.equal(res.headers.get('location'), '/welcome?got=a%40b.com', `[${runtime}] redirect target`);
  // The result rides the 303 in the signed flash cookie (node:crypto HMAC +
  // rich serializer, both runtime-sensitive), and decodes back on this runtime.
  const flash = res.headers.getSetCookie().find((c) => c.startsWith('__webjs_flash='));
  assert.ok(flash && /HttpOnly; SameSite=Lax/.test(flash), `[${runtime}] the flash cookie is set`);
  const { decodeFlash } = await import('../../packages/server/src/action-flash.js');
  const decoded = await decodeFlash(flash.split(';')[0].slice('__webjs_flash='.length));
  assert.equal(decoded && decoded.id, id, `[${runtime}] the flash names the action`);
  assert.equal(decoded.result.redirect, undefined, `[${runtime}] the redirect is not carried`);
  assert.equal(decoded.result.success, true);
}

// Failure: 422 re-render carrying the field error and the typed value.
{
  const res = await app.handle(urlencoded({ [FIELD]: id, email: 'nope' }));
  assert.equal(res.status, 422, `[${runtime}] a failing submission re-renders`);
  const body = await res.text();
  assert.match(body, /bad email/, `[${runtime}] the field error is rendered`);
  assert.match(body, /value="nope"/, `[${runtime}] the typed value is repopulated`);
}

// A multipart submission carrying a FILE. The serializer's File handling has
// diverged on Bun before (a fresh-Blob-identity crash), and the no-JS upload
// path runs entirely through it.
{
  const fd = new FormData();
  fd.append(FIELD, id);
  fd.append('email', 'c@d.com');
  fd.append('avatar', new File(['pixels'], 'me.png', { type: 'image/png' }));
  const res = await app.handle(new Request('http://x/signup', {
    method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: fd,
  }));
  assert.equal(res.status, 303, `[${runtime}] a multipart submission runs the action`);
  assert.equal(res.headers.get('location'), '/welcome?got=c%40d.com%2Fme.png%3Apixels',
    `[${runtime}] the uploaded file reaches the action intact`);
}

// A cross-origin submission is refused on both runtimes: the check reads
// fetch-metadata headers, which the two request implementations expose
// separately.
{
  const res = await app.handle(new Request('http://x/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'sec-fetch-site': 'cross-site',
      origin: 'https://evil.example.com',
    },
    body: new URLSearchParams({ [FIELD]: id, email: 'a@b.com' }).toString(),
  }));
  assert.equal(res.status, 403, `[${runtime}] a cross-origin submission is refused`);
}

// An unknown hash is deploy skew: a 422 re-render, never a silent no-op.
{
  const res = await app.handle(urlencoded({ [FIELD]: 'deadbeef00/signup', email: 'a@b.com' }));
  assert.equal(res.status, 422, `[${runtime}] deploy skew re-renders`);
}

// A page-path POST that binds nothing is a 405, not a 404: the url exists.
{
  const res = await app.handle(urlencoded({ email: 'a@b.com' }));
  assert.equal(res.status, 405, `[${runtime}] a submission with no identity is a 405`);
}

// #1307: both fingerprints of a form that posts nowhere reach the `onError`
// sink with a groupable code, and neither changes the response. Cross-runtime
// by construction: the code paths are `url.searchParams.has()`,
// `formData.keys()`, and `Error` property assignment, all of which Node and Bun
// implement separately.
{
  resetFormReportDedupe();
  /** @type {any[]} */
  const seen = [];
  const reporting = await createRequestHandler({
    appDir: dir, dev: false, onError: (e) => seen.push(e),
  });
  await reporting.warmup();

  // A page GET carrying the reserved field in the QUERY STRING: the fingerprint
  // of a bound submitter submitted through an UNBOUND form.
  const got = await reporting.handle(new Request(`http://x/signup?${FIELD}=abc123%2Fsignup`));
  assert.equal(got.status, 200, `[${runtime}] the GET still renders (detect only)`);
  assert.equal(seen.length, 1, `[${runtime}] the query-string GET is reported once`);
  assert.equal(seen[0].code, 'WEBJS_FORM_SUBMITTED_AS_GET', `[${runtime}] with a groupable code`);

  // Deduplicated per process on method + pathname, so a crafted flood cannot
  // amplify into a paid APM sink.
  await reporting.handle(new Request(`http://x/signup?${FIELD}=abc123%2Fsignup`));
  assert.equal(seen.length, 1, `[${runtime}] a second identical request adds no report`);

  // A submission carrying no identity: still a 405, now with a report naming
  // the submitted field NAMES and none of the values.
  const missing = await reporting.handle(new Request('http://x/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://x' },
    body: new URLSearchParams({ email: 'a@b.com' }).toString(),
  }));
  assert.equal(missing.status, 405, `[${runtime}] the 405 is unchanged`);
  const bodyless = seen.find((e) => e.code === 'WEBJS_FORM_ACTION_MISSING');
  assert.ok(bodyless, `[${runtime}] the bind-nothing 405 is reported`);
  assert.deepEqual(bodyless.fields, ['email'], `[${runtime}] field names ride, values do not`);
  assert.ok(!JSON.stringify(bodyless.fields).includes('a@b.com'), `[${runtime}] no user data`);
}

// A prevState with a default (#1686). Its `fn.length` is 0, so the dispatcher
// counts the parameters the action declares, read from its source through the
// load-hook facade, which differs per runtime: the default supplies the first
// state and the second submission receives the first one's result.
{
  const pdir = mkdtempSync(join(tmpdir(), 'webjs-1686-prev-'));
  const put = (rel, body) => { mkdirSync(dirname(join(pdir, rel)), { recursive: true }); writeFileSync(join(pdir, rel), body); };
  put('count.server.js', `'use server';\nexport async function count(prev = { n: 10 }, input) { const n = prev.n + Number(input.get('by')); return n < 12 ? { success: false, error: 'more', n } : { success: true, n }; }\n`);
  put('app/count/page.js', `import { html } from ${CORE};\nimport { count } from '../../count.server.js';\nexport default ({ actionData }) => html\`<form action=\${count}></form><p id="n">\${actionData?.n ?? 0}</p>\`;\n`);
  const papp = await createRequestHandler({ appDir: pdir, dev: false });
  await papp.warmup();
  const page = await (await papp.handle(new Request('http://x/count'))).text();
  const pid = new RegExp(`name="${FIELD}" value="([^"]*)"`).exec(page)[1];
  const post = (cookie) => new Request('http://x/count', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams({ [FIELD]: pid, by: '1' }).toString(),
  });
  const first = await papp.handle(post());
  assert.equal(first.status, 422, `[${runtime}] the first submission fails (10 + 1 < 12)`);
  assert.match(await first.text(), /<p id="n">11<\/p>/, `[${runtime}] the default supplied the first state`);
  const flash = first.headers.getSetCookie().find((c) => c.startsWith('__webjs_flash=')).split(';')[0];
  const second = await papp.handle(post(flash));
  assert.equal(second.status, 303, `[${runtime}] prevState carried 11, so 11 + 1 succeeds`);
  rmSync(pdir, { recursive: true, force: true });
}

rmSync(dir, { recursive: true, force: true });
console.log(`[form-action-dispatch] #1155 dispatch + #1307 reporting OK on ${runtime} (identity ${id})`);
