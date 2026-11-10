/**
 * Directives and nested arrays inside an array child hole render on the client
 * as they do on the server and in Lit (#1686). `items.map((i) => keyed(...))`,
 * `[until(promise, 'loading')]` and a nested array are ordinary Lit code.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { keyed, until, guard, cache } from '../../../src/directives.js';
import { repeat } from '../../../src/repeat.js';
import { assert } from '../../../../../test/browser-assert.js';

const text = (el) => el.textContent.replace(/\s+/g, '');

suite('directives inside an array child hole', () => {
  test('keyed() items from map()', () => {
    const el = document.createElement('div');
    render(html`<ul>${[1, 2].map((i) => keyed(i, html`<li>${i}</li>`))}</ul>`, el);
    assert.equal(el.querySelectorAll('li').length, 2);
    assert.equal(text(el), '12');
  });

  test('until() in an array shows its placeholder, then the value', async () => {
    const el = document.createElement('div');
    let resolve;
    const p = new Promise((r) => { resolve = r; });
    render(html`<p>${[until(p, 'wait')]}</p>`, el);
    assert.equal(text(el), 'wait');
    resolve('done');
    await p;
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(text(el), 'done');
  });

  test('a nested array renders each item', () => {
    const el = document.createElement('div');
    render(html`<p>${[[1, 2], [3]]}</p>`, el);
    assert.equal(text(el), '123');
  });

  test('repeat(), guard() and cache() inside an array', () => {
    const el = document.createElement('div');
    render(html`<div>${[
      repeat([1, 2], (i) => i, (i) => html`<i>${i}</i>`),
      guard([1], () => html`<b>g</b>`),
      cache(html`<u>c</u>`),
    ]}</div>`, el);
    assert.equal(text(el), '12gc');
  });

  test('an array of keyed items re-renders in the new order', () => {
    const el = document.createElement('div');
    const view = (ids) => html`<ul>${ids.map((i) => keyed(i, html`<li>${i}</li>`))}</ul>`;
    render(view([1, 2, 3]), el);
    render(view([3, 1]), el);
    assert.equal(text(el), '31');
  });
});
