/**
 * Hydrating a light-DOM host must leave its SSR-projected children in the
 * document (#1666). Moving one out and back is not free: the HTML spec
 * navigates a re-inserted iframe again (and `loading="lazy"` only defers the
 * FIRST insertion, so a hidden lazy frame loads), and a nested custom element
 * disconnects and reconnects. Each case below SSR-renders a host whose slot
 * already holds the authored nodes, hydrates it, and asserts the projected
 * nodes were never removed (a MutationObserver sees every removal) and a
 * projected custom element connected exactly once.
 *
 * Runs in a REAL browser via WTR + Playwright.
 */
import { html } from '../../../src/html.js';
import { WebComponent } from '../../../src/component.js';
import { installSlotPolyfills } from '../../../src/slot.js';

installSlotPolyfills();

import { assert } from '../../../../../test/browser-assert.js';

function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

let n = 0;
const tagName = (base) => `x-nr-${base}-${++n}`;

/** A custom element that counts its connects and disconnects. */
const countTag = tagName('count');
class Counter extends HTMLElement {
  constructor() { super(); this.connects = 0; this.disconnects = 0; }
  connectedCallback() { this.connects++; }
  disconnectedCallback() { this.disconnects++; }
}
customElements.define(countTag, Counter);

/**
 * Put `ssr` into a fresh host BEFORE the host's class is defined, so the
 * nested counter connects once with the SSR markup, then watch every removal
 * while the host upgrades and hydrates. A node left the document when a
 * removal record names it or one of the ancestors it had BEFORE hydration
 * (read later, a re-inserted node's new ancestors would hide the removal).
 * Returns the ids of the `[id]` nodes that left.
 */
async function hydrate(tag, Ctor, ssr) {
  const box = document.createElement('div');
  document.body.appendChild(box);
  box.innerHTML = `<${tag}>${ssr}</${tag}>`;
  const host = box.firstElementChild;
  /** @type {Map<Node, string[]>} */
  const watched = new Map();
  for (const el of host.querySelectorAll('[id]')) {
    for (let n = el; n && n !== host; n = n.parentNode) {
      if (!watched.has(n)) watched.set(n, []);
      watched.get(n).push(el.id);
    }
  }
  const left = new Set();
  const note = (records) => {
    for (const r of records) for (const node of r.removedNodes) for (const id of watched.get(node) || []) left.add(id);
  };
  const mo = new MutationObserver(note);
  mo.observe(host, { childList: true, subtree: true });
  Ctor.register(tag);
  await tick();
  await tick();
  note(mo.takeRecords());
  mo.disconnect();
  return { box, host, left };
}

suite('light-DOM hydration keeps projected children in place (#1666)', () => {
  test('a projected iframe and custom element are never removed or reconnected', async () => {
    const tag = tagName('frame-host');
    class C extends WebComponent {
      render() { return html`<div class="wrap"><slot></slot></div>`; }
    }
    const ssr =
      '<!--webjs-hydrate--><div class="wrap"><slot data-webjs-light data-projection="actual">' +
      `<iframe id="f" loading="lazy" src="about:blank"></iframe><${countTag} id="c"></${countTag}>` +
      '</slot></div>';
    const { box, host, left } = await hydrate(tag, C, ssr);
    const frame = host.querySelector('#f');
    const counter = /** @type {any} */ (host.querySelector('#c'));
    assert.ok(frame && counter, 'projected nodes are still in the host');
    assert.ok(!left.has('f'), 'the iframe never left the document');
    assert.ok(!left.has('c'), 'the custom element never left the document');
    assert.equal(counter.connects, 1, 'connected once, at parse');
    assert.equal(counter.disconnects, 0, 'never disconnected');
    // The slot API still reads the projection.
    const slot = host.querySelector('slot');
    assert.deepEqual(slot.assignedElements(), [frame, counter], 'assignedElements reads the projected nodes');
    assert.equal(host.querySelector('.wrap > slot'), slot, 'the slot sits in the rendered template');
    box.remove();
  });

  test('named and default slots both keep their nodes, and fallback still renders', async () => {
    const tag = tagName('named');
    class C extends WebComponent {
      render() {
        return html`<header><slot name="title"></slot></header><main><slot></slot></main><footer><slot name="foot">fallback text</slot></footer>`;
      }
    }
    const ssr =
      '<!--webjs-hydrate-->' +
      `<header><slot data-webjs-light data-projection="actual" name="title"><${countTag} id="t" slot="title"></${countTag}></slot></header>` +
      `<main><slot data-webjs-light data-projection="actual"><${countTag} id="d"></${countTag}></slot></main>` +
      '<footer><slot data-webjs-light data-projection="fallback" name="foot">fallback text</slot></footer>';
    const { box, host, left } = await hydrate(tag, C, ssr);
    const t = /** @type {any} */ (host.querySelector('#t'));
    const d = /** @type {any} */ (host.querySelector('#d'));
    assert.deepEqual([...left], [], 'no projected node left the document');
    assert.equal(t.connects + d.connects, 2, 'each connected once');
    assert.equal(t.disconnects + d.disconnects, 0, 'neither disconnected');
    assert.equal(t.parentElement, host.querySelector('header > slot[name="title"]'), 'named child in its slot');
    assert.equal(d.parentElement, host.querySelector('main > slot:not([name])'), 'default child in its slot');
    const foot = host.querySelector('footer > slot[name="foot"]');
    assert.equal(foot.textContent, 'fallback text', 'the unassigned slot shows its fallback');
    assert.deepEqual(foot.assignedNodes(), [], 'and reports nothing assigned');
    box.remove();
  });

  test('parts on a kept ancestor bind to the live element, and sibling holes render', async () => {
    const tag = tagName('parts');
    let clicks = 0;
    let changes = 0;
    class C extends WebComponent {
      render() {
        return html`<section class=${'box on'} data-n=${2} @click=${() => { clicks++; }}><h2>${'Title'}</h2><slot @slotchange=${() => { changes++; }}></slot><p>${'tail'}</p></section>`;
      }
    }
    const ssr =
      '<!--webjs-hydrate--><section class="box on" data-n="2" data-stale="x"><h2>Title</h2>' +
      `<slot data-webjs-light data-projection="actual"><${countTag} id="k"></${countTag}></slot><p>tail</p></section>`;
    const { box, host, left } = await hydrate(tag, C, ssr);
    const k = /** @type {any} */ (host.querySelector('#k'));
    assert.deepEqual([...left], [], 'the projected node never left');
    assert.equal(k.connects, 1, 'connected once');
    const section = host.querySelector('section');
    assert.equal(section.className, 'box on', 'the attribute part wrote the live element');
    assert.equal(section.getAttribute('data-n'), '2');
    assert.ok(!section.hasAttribute('data-stale'), 'an attribute the template does not write is dropped');
    assert.equal(section.querySelectorAll('h2').length, 1, 'one heading, not the SSR copy plus a fresh one');
    assert.equal(section.querySelector('h2').textContent, 'Title');
    assert.equal(section.querySelector('p').textContent, 'tail');
    assert.equal(changes, 1, 'the initial projection fires one slotchange, as before');
    k.click();
    assert.equal(clicks, 1, 'the event part listens on the live element');
    box.remove();
  });

  test('listener options survive the move onto a kept ancestor (#1682)', async () => {
    const tag = tagName('options');
    let captured = 0;
    let once = 0;
    // Lit listener objects: the object is also the options bag. A retarget that
    // registered the dispatcher without options left a bubble registration
    // beside the capture one (two calls per click) and dropped `once`.
    const capture = { handleEvent() { captured++; }, capture: true };
    const single = { handleEvent() { once++; }, once: true };
    class C extends WebComponent {
      render() {
        return html`<section @click=${capture}><div @click=${single}><slot></slot></div></section>`;
      }
    }
    const ssr =
      '<!--webjs-hydrate--><section><div>' +
      `<slot data-webjs-light data-projection="actual"><${countTag} id="o"></${countTag}></slot></div></section>`;
    const { box, host, left } = await hydrate(tag, C, ssr);
    assert.deepEqual([...left], [], 'the projected node never left, so the ancestors were adopted');
    const target = /** @type {any} */ (host.querySelector('#o'));
    target.click();
    target.click();
    assert.equal(captured, 2, 'the capture listener runs once per click');
    assert.equal(once, 1, 'the once listener runs once in total');
    box.remove();
  });

  test('firstUpdated already reads the projection on a hydrated host', async () => {
    const tag = tagName('first');
    let seen = -1;
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
      firstUpdated() { seen = this.querySelector('slot').assignedNodes().length; }
    }
    const ssr = `<!--webjs-hydrate--><div><slot data-webjs-light data-projection="actual"><${countTag}></${countTag}><p>x</p></slot></div>`;
    const { box } = await hydrate(tag, C, ssr);
    assert.equal(seen, 2, 'the projected nodes never left the slot, so they are assigned at firstUpdated');
    box.remove();
  });

  test('a post-hydration append still projects and fires slotchange', async () => {
    const tag = tagName('live');
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    const ssr = `<!--webjs-hydrate--><div><slot data-webjs-light data-projection="actual"><${countTag} id="a"></${countTag}></slot></div>`;
    const { box, host } = await hydrate(tag, C, ssr);
    const slot = host.querySelector('slot');
    let changes = 0;
    slot.addEventListener('slotchange', () => { changes++; });
    const b = document.createElement('p');
    host.appendChild(b);
    await tick();
    assert.equal(b.parentElement, slot, 'appended child projects into the slot');
    assert.equal(slot.assignedNodes().length, 2, 'both nodes assigned');
    assert.equal(changes, 1, 'one slotchange');
    box.remove();
  });
});
