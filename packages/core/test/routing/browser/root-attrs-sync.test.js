/**
 * The root layout's `<html>` / `<body>` attributes follow the server across a
 * soft navigation (#1686). A theme cookie the root layout reads into
 * `<html class>` used to show only after a reload, because a swap replaces
 * content inside `<body>`. Only attributes the server lists in
 * `data-wj-html` / `data-wj-body` change, so one a script set in the browser
 * stays, and a response without the list (a reduced fragment) changes nothing.
 */
import { enableClientRouter, navigate } from '../../../src/router-client.js';
import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const page = (htmlAttrs, bodyAttrs, text) => '<!doctype html>' +
  `<html${htmlAttrs}><head></head><body${bodyAttrs}>` +
  `<!--wj:children:/:/-->${text}<!--/wj:children:/--></body></html>`;

suite('Client router: <html> and <body> attributes follow the server (#1686)', () => {
  let origFetch, navGuard, origHref, nextBody;
  const html = document.documentElement;
  const saved = [...html.attributes].map((a) => [a.name, a.value]);

  setup(() => {
    origHref = location.href;
    enableClientRouter();
    navGuard = installNavGuard();
    document.body.innerHTML = '<!--wj:children:/:/-->before<!--/wj:children:/-->';
    origFetch = window.fetch;
    window.fetch = () => Promise.resolve(new Response(nextBody, { headers: { 'content-type': 'text/html', 'x-webjs-build': '' } }));
  });

  teardown(() => {
    window.fetch = origFetch;
    if (navGuard) navGuard.remove();
    document.body.innerHTML = '';
    for (const a of [...html.attributes]) html.removeAttribute(a.name);
    for (const [n, v] of saved) html.setAttribute(n, v);
    for (const a of [...document.body.attributes]) document.body.removeAttribute(a.name);
    history.replaceState(null, '', origHref);
  });

  test('a server-rendered attribute is set, changed and removed; a script-set one stays', async () => {
    html.setAttribute('class', 'dark');
    html.setAttribute('data-wj-html', 'lang class');
    html.setAttribute('data-client', 'set-by-a-script');

    nextBody = page(' lang="fr" data-wj-html="lang"', ' class="pg" data-wj-body="class"', 'light');
    await navigate(location.origin + '/root-attrs-1');
    assert.equal(navGuard.hardNavigations.length, 0, 'no hard navigation');
    assert.equal(html.getAttribute('class'), null, 'the class the server stopped rendering is removed');
    assert.equal(html.getAttribute('lang'), 'fr', 'a changed attribute is updated');
    assert.equal(html.getAttribute('data-client'), 'set-by-a-script', 'an attribute the server never rendered is left alone');
    assert.equal(document.body.getAttribute('class'), 'pg', '<body> attributes follow too');

    nextBody = page(' lang="fr" class="dark" data-wj-html="lang class"', ' data-wj-body=""', 'dark again');
    await navigate(location.origin + '/root-attrs-2');
    assert.equal(html.getAttribute('class'), 'dark', 'a newly rendered attribute is added');
    assert.equal(document.body.getAttribute('class'), null, 'a body attribute the server dropped is removed');
  });

  test('a response with no attribute list leaves the root attributes alone', async () => {
    html.setAttribute('class', 'dark');
    html.setAttribute('data-wj-html', 'class');
    nextBody = page(' class="other"', '', 'fragment');
    await navigate(location.origin + '/root-attrs-3');
    assert.equal(html.getAttribute('class'), 'dark');
  });
});
