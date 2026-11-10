/**
 * The findings of the owner's sixth review of PR #1687, each pinned by a test
 * that fails without its fix.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createAuth, Credentials } from '../src/auth.js';
import { createRequestHandler } from '../src/dev.js';
import { invokeActionForTest } from '../src/testing.js';
import { runValidate } from '../src/actions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// A tmpdir fixture cannot resolve the bare specifiers, so it imports by URL.
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-review-r6-')); });
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

const identityOf = (html) => /name="__webjs_action" value="([^"]*)"/.exec(html)?.[1] ?? null;

function post(path, fields, headers = {}) {
  return new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

/** A page at /f whose form binds `fn` from a 'use server' module with `body`. */
async function formApp(body, extra = {}, handlerOpts = {}) {
  const appDir = makeApp({
    'modules/x/actions/act.server.ts': `'use server';\n${body}\n`,
    'app/f/page.ts': `
import { html } from ${CORE};
import { act } from '../../modules/x/actions/act.server.ts';
export default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p><form action=\${act}><button>go</button></form>\`;
`,
    ...extra,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet, ...handlerOpts });
  const id = identityOf(await (await app.handle(new Request('http://x/f'))).text());
  return { app, id };
}

const SECRET = 'review-1687-round6-secret-at-least-32-bytes';
const ORIGIN = 'https://app.example';

test('a same-origin URL whose path starts with // is not a protocol-relative redirect', async () => {
  const auth = createAuth({ secret: SECRET, providers: [Credentials({ authorize: async () => ({ id: '1' }) })] });
  const req = new Request(`${ORIGIN}/account`);
  const where = async (redirectTo) => (await auth.signOut({ redirectTo, req })).headers.get('location');
  assert.equal(await where(`${ORIGIN}//evil.com/x`), '/', '//evil.com is another host');
  assert.equal(await where(`${ORIGIN}/\\\\evil.com`), '/', 'and so is /\\\\evil.com');
  // What the previous fix protects: a same-origin URL still keeps its path.
  assert.equal(await where(`${ORIGIN}/bye?x=1#h`), '/bye?x=1#h');

  const routed = await auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
    body: `redirectTo=${encodeURIComponent(`${ORIGIN}//evil.com`)}`,
  }));
  assert.equal(routed.headers.get('location'), '/', 'the credentials route takes the same check');
});

test("the signIn callback's returned URL goes through callbacks.redirect and is header-safe", async () => {
  const providers = [Credentials({ authorize: async () => ({ id: '1' }) })];
  const signIn = async (callbacks) => {
    const auth = createAuth({ secret: SECRET, providers, callbacks });
    return auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
      body: 'email=a',
    }));
  };
  // An identity-provider URL the redirect callback allows is used, as in Auth.js.
  const allowed = await signIn({
    signIn: () => 'https://idp.example/verify',
    redirect: ({ url, baseUrl }) => (url.startsWith('https://idp.example/') ? url : baseUrl),
  });
  assert.equal(allowed.headers.get('location'), 'https://idp.example/verify');
  // A non-Latin-1 local path is encoded rather than thrown while building headers.
  const local = await signIn({ signIn: () => '/welcome/日本' });
  assert.equal(local.headers.get('location'), '/welcome/%E6%97%A5%E6%9C%AC');
  // What the previous rule protects: another origin, with the default, is still denied.
  const off = await signIn({ signIn: () => 'https://evil.example/' });
  assert.match(off.headers.get('location') || '', /error=AccessDenied/);
});

test("a successful action's redirect target with non-Latin-1 characters is encoded, not a 500", async () => {
  const { app, id } = await formApp(`export async function act() { return { success: true, redirect: '/posts/日本' }; }`);
  const res = await app.handle(post('/f', { __webjs_action: id }));
  assert.equal(res.status, 303, 'the write succeeded and redirects');
  assert.equal(res.headers.get('location'), '/posts/%E6%97%A5%E6%9C%AC');
});

test('an action that throws undefined renders the error page and reaches onError', async () => {
  const seen = [];
  const { app, id } = await formApp(`export async function act() { throw undefined; }`, {}, { onError: (e) => seen.push(e) });
  const quietErr = console.error;
  console.error = () => {};
  let res;
  try { res = await app.handle(post('/f', { __webjs_action: id })); } finally { console.error = quietErr; }
  assert.equal(res.status, 500, 'an error, not the page at 200');
  assert.ok(seen.some((e) => e instanceof Error && /threw undefined/.test(e.message)), 'onError hears it, as an Error');
});

/** The `name=value` pairs a response sets, merged over the cookies a request sent. */
function nextCookie(prev, res) {
  const jar = new Map(prev ? prev.split('; ').map((kv) => [kv.split('=')[0], kv]) : []);
  for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; jar.set(kv.split('=')[0], kv); }
  return [...jar.values()].join('; ');
}

test('a flash whose page redirects on is retired there, never shown on the page the chain ends on', async () => {
  const { app, id } = await formApp(
    `export async function act() { return { success: true, message: 'SAVED_MSG', redirect: '/posts' }; }`,
    {
      'package.json': JSON.stringify({ name: 'chain', type: 'module', webjs: { redirects: [{ source: '/posts', destination: '/en/posts', permanent: false }] } }),
      'app/en/posts/page.ts': `import { html } from ${CORE};\nexport default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p>\`;\n`,
      'app/other/page.ts': `import { html } from ${CORE};\nexport default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p>\`;\n`,
    },
  );
  const done = await app.handle(post('/f', { __webjs_action: id }));
  assert.equal(done.status, 303);
  let cookie = nextCookie('', done);
  // What the path binding protects: another page leaves it.
  assert.match(await (await app.handle(new Request('http://x/other', { headers: { cookie } }))).text(), /<p id="r">none<\/p>/);
  // The redirect target is itself redirected on: as in Next.js, a redirect
  // after the action discards its result, so the chain's end shows nothing.
  const hop = await app.handle(new Request('http://x/posts', { headers: { cookie } }));
  assert.equal(hop.status, 307);
  cookie = nextCookie(cookie, hop);
  const landing = await app.handle(new Request('http://x/en/posts', { headers: { cookie } }));
  assert.match(await landing.text(), /<p id="r">none<\/p>/, 'not shown where the chain ends');
  // And it does not turn up later on the page it was bound to.
  const later = await app.handle(new Request('http://x/en/posts', { headers: { cookie } }));
  assert.match(await later.text(), /<p id="r">none<\/p>/);
});

test('a flash bound to a redirect written with the basePath mount prefix is shown there', async () => {
  const { app, id } = await formApp(
    `export async function act() { return { success: true, message: 'MOUNTED_MSG', redirect: '/app/done' }; }`,
    {
      'package.json': JSON.stringify({ name: 'mounted', type: 'module', webjs: { basePath: '/app' } }),
      'app/done/page.ts': `import { html } from ${CORE};\nexport default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p>\`;\n`,
    },
  );
  // Under a mount the app is reached at /app/...
  const html = await (await app.handle(new Request('http://x/app/f'))).text();
  const done = await app.handle(post('/app/f', { __webjs_action: identityOf(html) || id }));
  assert.equal(done.status, 303);
  const landing = await app.handle(new Request('http://x/app/done', { headers: { cookie: nextCookie('', done) } }));
  assert.match(await landing.text(), /<p id="r">MOUNTED_MSG<\/p>/, 'the mounted target shows it');
});

test('a schema validator that throws issues is invalid input on the RPC path too, not a thrown error', async () => {
  const throwIssues = () => { const e = new Error('raw'); /** @type any */ (e).issues = [{ path: ['email'], message: 'EMAIL_MSG' }]; throw e; };
  // runValidate, shared by the form, RPC and route() paths, maps it once.
  const v = await runValidate(throwIssues, {});
  assert.equal(v.ok, false);
  assert.equal(v.invalid, true);
  assert.deepEqual(v.result, { success: false, fieldErrors: { email: 'EMAIL_MSG' }, status: 422 });

  // RPC: the client stub returns the failure envelope instead of throwing.
  const { app } = await formApp(`export function validate() { const e = new Error('raw'); e.issues = [{ path: ['email'], message: 'EMAIL_MSG' }]; throw e; }
export async function act(input) { return { success: true }; }`);
  const result = await invokeActionForTest(app, join(app.appDir, 'modules/x/actions/act.server.ts'), 'act', [{ email: 'x' }]);
  assert.equal(result.success, false);
  assert.deepEqual(result.fieldErrors, { email: 'EMAIL_MSG' });

  // What the crash path protects: any other validator throw is still an error over RPC.
  const { app: crash } = await formApp(`export function validate() { throw new Error('VALIDATOR_CRASH'); }
export async function act(input) { return { success: true }; }`, {}, { onError: () => {} });
  await assert.rejects(
    invokeActionForTest(crash, join(crash.appDir, 'modules/x/actions/act.server.ts'), 'act', [{ email: 'x' }]),
    'a crashing validator still throws on the client',
  );
});
