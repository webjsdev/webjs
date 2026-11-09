/**
 * Built-in directives in an ATTRIBUTE position (#1686, Lit conformance): as in
 * Lit, `until` renders its first non-promise argument and then the promise's
 * value, and `guard` renders its callback's result, in an attribute exactly as
 * in a child position. The server renderer used to stringify both to
 * "[object Object]"; the client renderer must agree with it.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { until, guard } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

suite('Directives in attribute position (Lit conformance)', () => {
  test('until: the placeholder, then the resolved value', async () => {
    const host = document.createElement('div');
    let resolve;
    const p = new Promise((r) => { resolve = r; });
    render(html`<img alt="" src=${until(p, '/placeholder.png')}>`, host);
    assert.equal(host.querySelector('img').getAttribute('src'), '/placeholder.png');
    resolve('/real.png');
    await p; await tick();
    assert.equal(host.querySelector('img').getAttribute('src'), '/real.png');
  });

  test('guard: the callback\'s result', () => {
    const host = document.createElement('div');
    render(html`<a href=${guard([1], () => '/guarded')}>x</a>`, host);
    assert.equal(host.querySelector('a').getAttribute('href'), '/guarded');
  });
});
