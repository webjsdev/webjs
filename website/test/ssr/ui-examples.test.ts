/**
 * The /ui example apps (#1666): /ui/examples/{dashboard,tasks,playground,
 * authentication,rtl}, shadcn's five examples. Each renders inside the
 * examples shell with its own nav link current. The tasks table's state is
 * the query string, applied on the server, and the authentication form binds
 * a real action, so both are covered here with no browser.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { EXAMPLES } from '#lib/ui/examples-shell.ts';
import { parseState, hrefFor, applyState } from '#modules/ui/example-apps/tasks/state.ts';
import { TASKS } from '#modules/ui/example-apps/tasks/tasks-data.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string, init?: RequestInit) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path, init) => app.handle(new Request('http://localhost' + path, init));
});

async function page(path: string) {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} renders`);
  return res.text();
}

const KEY_CONTENT: Record<string, RegExp[]> = {
  dashboard: [/<ui-sidebar-provider/, /Total Revenue/, /<svg[^>]*role="application"|<svg/, /Cover page/],
  tasks: [/Welcome back!/, /TASK-8782/, /Page 1 of 4/, /of 100 row\(s\) selected/],
  playground: [/Playground/, /Temperature/, /Maximum Length/, /Top P/],
  authentication: [/Create an account/, /Sofia Davis/, /name="__webjs_action"/],
  rtl: [/data-slot="rtl-components"/, /dir="rtl"/, /<link rel="stylesheet" href="\/rtl-fonts\.css/],
};

test('every example renders in the shell with its own nav link current', async () => {
  for (const { slug, name } of EXAMPLES) {
    const html = await page(`/ui/examples/${slug}`);
    assert.match(html, /The Foundation for your Design System/, `${slug} has the examples header`);
    assert.match(html, new RegExp(`<a href="/ui/examples/${slug}"[^>]*data-active="true"[^>]*aria-current="page"[^>]*>${name}`), `${slug} is current`);
    for (const re of KEY_CONTENT[slug]) assert.ok(re.test(html), `${slug} carries ${re}`);
  }
});

test('below md the four examples shadcn pictures show their picture, and rtl shows itself', async () => {
  for (const { slug } of EXAMPLES) {
    const html = await page(`/ui/examples/${slug}`);
    const picture = /<img src="\/images\/examples\/[a-z]+-light\.png[^"]*" width="2668"/.test(html);
    assert.equal(picture, slug !== 'rtl', `${slug} picture below md`);
  }
});

test('the examples nav carries the theme selector, and ?theme= themes the region below it', async () => {
  const plain = await page('/ui/examples/dashboard');
  assert.ok(/<theme-selector[^>]*>/.test(plain), 'the selector renders');
  assert.ok(/<option value="neutral"[^>]*selected/.test(plain), 'neutral is the default');
  assert.ok(!/data-theme-target class="[^"]*theme-(?!container)/.test(plain), 'the default theme adds no class');
  const blue = await page('/ui/examples/dashboard?theme=blue');
  assert.ok(/data-theme-target class="[^"]*\btheme-blue\b/.test(blue), 'the region wears theme-blue');
  assert.ok(/href="\/ui\/examples\/tasks\?theme=blue"/.test(blue), 'the nav links carry the theme');
  assert.ok(/<option value="blue"[^>]*selected/.test(blue), 'the select shows it');
  const tasks = await page('/ui/examples/tasks?theme=blue');
  assert.ok(/<input type="hidden" name="theme" value="blue" data-theme-field>/.test(tasks), 'the tasks filter form carries the theme');
  assert.ok(/href="\/ui\/examples\/tasks\?page=2&amp;theme=blue"/.test(tasks), 'the tasks table links carry it');
  const unknown = await page('/ui/examples/dashboard?theme=nope');
  assert.ok(/<option value="neutral"[^>]*selected/.test(unknown), 'an unknown theme falls back to neutral');
});

test('the tasks state round-trips through the query string, leaving out the defaults', () => {
  const s = parseState(new URLSearchParams('q=pixel&status=todo&status=done&sort=title.desc&hide=priority&size=10&page=2'));
  assert.deepEqual(s, { q: 'pixel', status: ['todo', 'done'], priority: [], sort: { id: 'title', desc: true }, hide: ['priority'], size: 10, page: 2, theme: 'neutral' });
  assert.equal(hrefFor(s), '/ui/examples/tasks?q=pixel&status=todo&status=done&sort=title.desc&hide=priority&size=10&page=2');
  assert.equal(hrefFor(parseState(new URLSearchParams('size=25&page=1&sort=bogus.asc&hide=id'))), '/ui/examples/tasks');
});

test('the tasks view filters, sorts, pages and counts each facet under the other filters', () => {
  const v = applyState(TASKS, parseState(new URLSearchParams('status=backlog&sort=title.asc&size=10')));
  const backlog = TASKS.filter((t) => t.status === 'backlog');
  assert.equal(v.filtered, backlog.length);
  assert.equal(v.pageCount, Math.ceil(backlog.length / 10));
  assert.deepEqual(v.rows.map((r) => r.title), backlog.map((t) => t.title).sort((a, b) => a.localeCompare(b)).slice(0, 10));
  // The status facet ignores the status filter itself; the priority facet honours it.
  assert.equal([...v.facets.status.values()].reduce((a, b) => a + b, 0), TASKS.length);
  assert.equal([...v.facets.priority.values()].reduce((a, b) => a + b, 0), backlog.length);
});

test('the tasks page applies its query string on the server', async () => {
  const html = await page('/ui/examples/tasks?status=done&hide=priority&sort=title.desc');
  const done = TASKS.filter((t) => t.status === 'done');
  assert.match(html, new RegExp(`of ${done.length} row\\(s\\) selected`));
  assert.doesNotMatch(html, /popovertarget="sort-priority"/, 'the hidden column has no header');
  assert.match(html, /<input type="checkbox" name="status" value="done"[^>]*checked/, 'the facet shows its checked value');
  assert.match(html, /<input type="hidden" name="sort" value="title.desc">/, 'the form keeps the sort');
  assert.ok(/href="\/ui\/examples\/tasks\?sort=title\.desc&amp;hide=priority"[^>]*>Reset/.test(html), 'Reset drops only the filters');
});

test('the authentication form posts to its action, with no JavaScript', async () => {
  const html = await page('/ui/examples/authentication');
  const action = html.match(/name="__webjs_action" value="([^"]+)"/)?.[1];
  assert.ok(action, 'the form carries its action identity');
  const post = (email: string) => handle('/ui/examples/authentication', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ __webjs_action: action, email }),
    redirect: 'manual',
  });
  const bad = await post('nope');
  assert.equal(bad.status, 422);
  const body = await bad.text();
  assert.match(body, /Enter a valid email address\./);
  assert.match(body, /value="nope"/, 'the typed value comes back');
  const good = await post('ada@example.com');
  assert.equal(good.status, 303);
  assert.equal(good.headers.get('location'), '/ui/examples/authentication?sent=1');
  assert.match(await page('/ui/examples/authentication?sent=1'), /Check your email/);
});

test('no example shows shadcn\'s avatar', async () => {
  for (const { slug } of EXAMPLES) {
    const html = await page(`/ui/examples/${slug}`);
    const hit = html.match(/.{0,80}(github\.com\/shadcn\.png|avatars\/shadcn\.)/)?.[0];
    assert.equal(hit, undefined, `${slug} uses the WebJs avatar`);
  }
});
