/**
 * An array item that is a directive or a nested array is a child part of its
 * own (#1686), so every cleanup path a hole takes must reach it too: removing
 * the item, disconnecting the root, and replacing the region that holds the
 * array. Found by the third review of PR #1687.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { directive } from '../../../src/directive.js';
import { AsyncDirective } from '../../../src/async-directive.js';
import { signal } from '../../../src/signal.js';
import { assert } from '../../../../../test/browser-assert.js';

/** @type {string[]} */
let log = [];

class Tracked extends AsyncDirective {
  render(name) { this.name = name; return name; }
  disconnected() { log.push(`off:${this.name}`); }
  reconnected() { log.push(`on:${this.name}`); }
}
const tracked = directive(Tracked);

suite('array items that are parts of their own are cleaned up', () => {
  setup(() => { log = []; });

  test('removing an item disconnects its directive', () => {
    const el = document.createElement('div');
    const view = (names) => html`<ul>${names.map((n) => tracked(n))}</ul>`;
    render(view(['a', 'b']), el);
    render(view(['a']), el);
    assert.deepEqual(log, ['off:b'], JSON.stringify(log));
    assert.equal(el.textContent, 'a');
  });

  test('disconnecting the root reaches an item\'s directive, and reconnecting it too', () => {
    const el = document.createElement('div');
    const root = render(html`<ul>${['a'].map((n) => tracked(n))}</ul>`, el);
    root.setConnected(false);
    root.setConnected(true);
    assert.deepEqual(log, ['off:a', 'on:a']);
  });

  test('replacing the region that holds the array releases the items\' directives', () => {
    const el = document.createElement('div');
    render(html`<section>${html`<ul>${['a'].map((n) => tracked(n))}</ul>`}</section>`, el);
    render(html`<section>${html`<p>other</p>`}</section>`, el);
    assert.deepEqual(log, ['off:a']);
  });

  test('a removed signal item stops writing', () => {
    const el = document.createElement('div');
    const s = signal('x');
    const view = (items) => html`<p>${items}</p>`;
    render(view([s]), el);
    assert.equal(el.textContent, 'x');
    render(view([]), el);
    s.set('y');
    assert.equal(el.textContent, '');
  });
});
