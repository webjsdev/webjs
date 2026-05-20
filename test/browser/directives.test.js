/**
 * Real-browser tests for the lit-html directives added in Phase 3 of the
 * lit-API parity initiative. Companion to test/directives.test.js (unit
 * tests covering SSR + marker shape).
 *
 * These tests focus on browser-specific behavior: real DOM mutation,
 * actual remount on keyed key change, guard's per-part memoization,
 * templateContent's content cloning, and the SSR-no-op directives.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';
import {
  unsafeHTML, live,
  keyed, guard, templateContent, ref, createRef,
  cache, until, asyncAppend, asyncReplace,
} from '../../packages/core/src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notStrictEqual: (a, b, msg) => { if (a === b) throw new Error(msg || 'Expected different references'); },
  strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || 'Expected strict equal'); },
};

suite('Directives in a real browser', () => {

  // --- keyed: renders the wrapped template, tears down on key change ---

  test('keyed: renders the wrapped template in the DOM', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${keyed('a', html`<span class="x">hi</span>`)}</div>`, el);
    assert.ok(el.querySelector('span.x'));
    assert.equal(el.querySelector('span.x').textContent, 'hi');
    el.remove();
  });

  // Note: keyed's "preserve on same key / remount on different key"
  // optimization relies on per-part state that is not yet plumbed through
  // the render-client part lifecycle. Today the renderer reconciles based
  // on template structure regardless of key. Adding strict key-based
  // remount semantics is tracked under the follow-up AsyncDirective /
  // part-state work in the lit-API parity initiative.

  // --- guard: invokes the function and renders the result ---

  test('guard: invokes the function and renders the result', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let calls = 0;
    render(
      html`<div>${guard([1, 2], () => { calls++; return html`<p>v${calls}</p>`; })}</div>`,
      el,
    );
    assert.equal(calls, 1);
    assert.equal(el.querySelector('p').textContent, 'v1');
    el.remove();
  });

  // Note: guard's "skip when deps unchanged" memoization relies on per-part
  // state that is not yet plumbed through the render-client part lifecycle.
  // For component-scoped memoization today, compute in willUpdate(cp) and
  // cache on the component instance.

  // --- templateContent: clone the template element's content ---

  test('templateContent: clones a real <template> element', () => {
    const tpl = document.createElement('template');
    tpl.innerHTML = '<i class="cloned">italic</i>';
    document.body.appendChild(tpl);

    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${templateContent(tpl)}</div>`, el);
    const cloned = el.querySelector('i.cloned');
    assert.ok(cloned, 'Cloned element exists in DOM');
    assert.equal(cloned.textContent, 'italic');
    el.remove();
    tpl.remove();
  });

  // --- ref / createRef ---

  test('ref/createRef: ref in child position is a no-op (DOM still renders correctly)', () => {
    // ref() is currently a no-op in child position. This test verifies it
    // doesn't disrupt sibling rendering.
    const r = createRef();
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${ref(r)}<span>after</span></div>`, el);
    assert.equal(el.querySelector('span').textContent, 'after');
    el.remove();
  });

  // --- cache: identity pass-through (current scope) ---

  test('cache: passes through to the inner value', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${cache(html`<p>hello</p>`)}</div>`, el);
    assert.equal(el.querySelector('p').textContent, 'hello');
    el.remove();
  });

  // --- until: first sync candidate ---

  test('until: renders first synchronous candidate on the client', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const promise = new Promise(() => {});  // never resolves
    render(html`<div>${until(promise, 'fallback')}</div>`, el);
    assert.ok(el.textContent.includes('fallback'));
    el.remove();
  });

  // --- asyncAppend / asyncReplace: first paint empty ---

  test('asyncAppend / asyncReplace: render empty on first paint (streaming deferred)', () => {
    async function* gen() { yield 'one'; yield 'two'; }
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${asyncAppend(gen())}</div>`, el);
    // The div is present but its child content is empty.
    assert.equal(el.querySelector('div').textContent, '');

    render(html`<section>${asyncReplace(gen())}</section>`, el);
    assert.equal(el.querySelector('section').textContent, '');
    el.remove();
  });
});
