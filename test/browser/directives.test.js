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

  // --- keyed: renders + remount-on-key-change ---

  test('keyed: renders the wrapped template in the DOM', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${keyed('a', html`<span class="x">hi</span>`)}</div>`, el);
    assert.ok(el.querySelector('span.x'));
    assert.equal(el.querySelector('span.x').textContent, 'hi');
    el.remove();
  });

  test('keyed: same key preserves DOM identity across renders', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    // Stable factory so the outer html`` shares strings across calls.
    const make = (k, text) => html`<div>${keyed(k, html`<span class="x">${text}</span>`)}</div>`;
    render(make('a', 'hi'), el);
    const before = el.querySelector('span.x');
    render(make('a', 'hi again'), el);
    const after = el.querySelector('span.x');
    assert.strictEqual(before, after, 'Same key should preserve the span node');
    assert.equal(after.textContent, 'hi again');
    el.remove();
  });

  test('keyed: different key remounts the DOM', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const make = (k) => html`<div>${keyed(k, html`<span class="y">${k}</span>`)}</div>`;
    render(make('a'), el);
    const before = el.querySelector('span.y');
    render(make('b'), el);
    const after = el.querySelector('span.y');
    assert.notStrictEqual(before, after, 'Different key should remount');
    assert.equal(after.textContent, 'b');
    el.remove();
  });

  // --- guard: per-part memoization on shallow-equal deps ---

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

  test('guard: skips re-eval when deps array is shallow-equal', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let calls = 0;
    // Stable factory so the outer template strings are reused across
    // renders and the part state persists.
    const make = (deps) => html`<div>${guard(deps, () => { calls++; return html`<p>v${calls}</p>`; })}</div>`;
    render(make([1, 2]), el);
    assert.equal(calls, 1);
    assert.equal(el.querySelector('p').textContent, 'v1');

    render(make([1, 2]), el);
    assert.equal(calls, 1, 'fn skipped on identical deps');
    assert.equal(el.querySelector('p').textContent, 'v1');

    render(make([1, 3]), el);
    assert.equal(calls, 2, 'fn re-fired on changed deps');
    assert.equal(el.querySelector('p').textContent, 'v2');
    el.remove();
  });

  // --- cache: DOM retention across template toggles ---

  test('cache: toggling between templates preserves input state and DOM identity', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const tplA = (text) => html`<form><input class="a" value=${text}></form>`;
    const tplB = (text) => html`<section class="b"><p>${text}</p></section>`;
    const make = (which) => html`<div>${cache(which === 'a' ? tplA('A1') : tplB('B1'))}</div>`;

    render(make('a'), el);
    const inputA = el.querySelector('input.a');
    assert.ok(inputA);
    // User types into the input.
    inputA.value = 'user-typed';

    // Switch to template B. Template A is detached (not destroyed).
    render(make('b'), el);
    assert.ok(el.querySelector('section.b'));
    assert.equal(el.querySelector('input.a'), null);

    // Switch back to A. The detached node is re-attached with its
    // user-typed value still intact.
    render(make('a'), el);
    const inputAReturned = el.querySelector('input.a');
    assert.ok(inputAReturned);
    assert.strictEqual(inputAReturned, inputA, 'Re-attached node is the same identity');
    assert.equal(inputAReturned.value, 'user-typed', 'Input state preserved across detach/re-attach');
    el.remove();
  });

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
    // ref() is a no-op in child position; the bound binding happens at
    // element position. This test verifies child-position ref doesn't
    // disrupt sibling rendering.
    const r = createRef();
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<div>${ref(r)}<span>after</span></div>`, el);
    assert.equal(el.querySelector('span').textContent, 'after');
    el.remove();
  });

  test('ref at element position populates ref.value with the element', () => {
    const r = createRef();
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<input ${ref(r)}>`, el);
    const input = el.querySelector('input');
    assert.ok(input, 'input rendered');
    assert.strictEqual(r.value, input, 'ref.value points at the input');
    el.remove();
  });

  test('ref callback form receives the element', () => {
    let captured = null;
    const el = document.createElement('div');
    document.body.appendChild(el);
    render(html`<button ${ref((node) => { captured = node; })}>x</button>`, el);
    const btn = el.querySelector('button');
    assert.strictEqual(captured, btn);
    el.remove();
  });

  test('ref swap: prior ref is unbound (gets undefined) before new ref is bound', () => {
    const r1 = createRef();
    const r2 = createRef();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const make = (r) => html`<input ${ref(r)}>`;
    render(make(r1), el);
    assert.strictEqual(r1.value, el.querySelector('input'));
    assert.equal(r2.value, undefined);

    render(make(r2), el);
    // r1 should be unbound; r2 should be bound.
    assert.equal(r1.value, undefined, 'prior ref got undefined');
    assert.strictEqual(r2.value, el.querySelector('input'), 'new ref got the element');
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

  // --- asyncAppend: streams every yielded value, appending ---

  test('asyncAppend: streams every yielded value, appending', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const yields = [];
    let resolveAll;
    const allYielded = new Promise(r => { resolveAll = r; });
    async function* gen() {
      for (const v of ['one', 'two', 'three']) {
        yields.push(v);
        yield v;
        await Promise.resolve();
      }
      resolveAll();
    }
    render(html`<ul>${asyncAppend(gen(), (v, i) => html`<li>${i}:${v}</li>`)}</ul>`, el);
    await allYielded;
    // Allow microtasks to flush DOM updates.
    await new Promise(r => setTimeout(r, 10));
    const items = [...el.querySelectorAll('li')];
    assert.equal(items.length, 3);
    assert.equal(items[0].textContent, '0:one');
    assert.equal(items[1].textContent, '1:two');
    assert.equal(items[2].textContent, '2:three');
    el.remove();
  });

  test('asyncAppend: works without a mapper, rendering raw yielded values as text', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    async function* gen() { yield 'a'; yield 'b'; }
    render(html`<div>${asyncAppend(gen())}</div>`, el);
    await new Promise(r => setTimeout(r, 10));
    assert.ok(el.textContent.includes('a'));
    assert.ok(el.textContent.includes('b'));
    el.remove();
  });

  // --- asyncReplace: each yield replaces the prior content ---

  test('asyncReplace: each yield replaces the prior content', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    async function* gen() {
      yield 'first';
      await Promise.resolve();
      yield 'second';
      await Promise.resolve();
      yield 'third';
    }
    render(html`<output>${asyncReplace(gen(), (v) => html`<span>${v}</span>`)}</output>`, el);
    await new Promise(r => setTimeout(r, 10));
    const spans = el.querySelectorAll('span');
    assert.equal(spans.length, 1, 'Only the latest yielded span remains');
    assert.equal(spans[0].textContent, 'third');
    el.remove();
  });

  // --- async stream teardown: re-render with a different value aborts iteration ---

  test('async stream: re-rendering with a non-stream value tears down + iterator.return() unwinds finally blocks', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let canceled = false;
    // The generator awaits a settling Promise so iterator.return() can
    // unwind through its finally block. A non-settling await (e.g.
    // `await new Promise(() => {})`) is a spec-level dead end:
    // iterator.return() queues the Return completion but the await
    // never resolves, so the finally never runs. That's a generator
    // authoring caveat, not a bug in this implementation.
    async function* gen() {
      try {
        yield 'a';
        await new Promise(r => setTimeout(r, 50));
        yield 'b';
      } finally {
        canceled = true;
      }
    }
    const make = (val) => html`<div>${val}</div>`;
    render(make(asyncAppend(gen(), (v) => html`<i>${v}</i>`)), el);
    await new Promise(r => setTimeout(r, 10));
    assert.ok(el.querySelector('i'));

    // Replace the stream with a plain string. Teardown:
    //  1. removes the stream-rendered nodes
    //  2. calls iterator.return(), which puts a Return completion in
    //     the queue. When the awaited setTimeout settles (50ms), the
    //     generator unwinds via its finally block.
    render(make('plain'), el);
    assert.equal(el.querySelector('i'), null, 'Stream-rendered nodes were removed');
    // Wait long enough for the awaited setTimeout to settle and the
    // generator to unwind.
    await new Promise(r => setTimeout(r, 100));
    assert.ok(canceled, 'Generator finally block ran (iterator.return() unwound it)');
    el.remove();
  });

  // --- until: late-resolving promise should NOT overwrite newer DOM ---

  test('until: late Promise resolution after re-render does NOT overwrite new DOM', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let resolveP;
    const p = new Promise((r) => { resolveP = r; });
    const make = (val) => html`<div>${val}</div>`;

    // First render: until() with a never-yet-resolved Promise + fallback.
    render(make(until(p, 'fallback')), el);
    await new Promise(r => setTimeout(r, 5));
    assert.ok(el.textContent.includes('fallback'));

    // Re-render with a plain string. The until directive is replaced.
    render(make('replaced'), el);
    assert.ok(el.textContent.includes('replaced'));

    // NOW resolve the prior Promise. Without the abort fix, this would
    // call applyChild and overwrite 'replaced' with the Promise value.
    resolveP('SHOULD-NOT-APPEAR');
    await new Promise(r => setTimeout(r, 10));
    assert.ok(el.textContent.includes('replaced'), 'newer DOM survives');
    assert.ok(!el.textContent.includes('SHOULD-NOT-APPEAR'), 'late resolve did NOT overwrite');
    el.remove();
  });
});
