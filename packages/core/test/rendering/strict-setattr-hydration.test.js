/**
 * Generalized guard for the #730 class (tracked by #747).
 *
 * #730: the client renderer built part-sentinel ATTRIBUTE names as
 * `data-${MARKER}${i}` and applied them via `setAttribute` in discoverSlots.
 * The old `MARKER = 'w$'` produced `data-w$0`, whose `$` is invalid in an XML
 * qualified name. iOS WebKit enforces the rule and threw, crashing
 * createInstance for EVERY slot template; Chromium, desktop WebKit, and linkedom
 * all TOLERATE it (verified). So no engine in CI catches this, and a browser
 * test cannot catch what the browser accepts.
 *
 * This asserts the invariant directly: patch `setAttribute` to enforce the XML
 * Name production (as strict iOS WebKit does), then run real templates through
 * the client render path. If the renderer ever emits an invalid attribute name
 * again, the strict wrapper throws and this fails, on ordinary CI hardware.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

// XML Name production (ASCII subset), the rule Element.setAttribute() enforces.
const VALID_XML_NAME = /^[A-Za-z_:][A-Za-z0-9_:.\-]*$/;

let html, render, ElementProto, origSetAttribute;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.customElements = window.customElements;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.MutationObserver = window.MutationObserver;

  // Make setAttribute strict like iOS WebKit: reject names that violate the
  // XML Name production with an InvalidCharacterError.
  ElementProto = window.Element.prototype;
  origSetAttribute = ElementProto.setAttribute;
  ElementProto.setAttribute = function (name, value) {
    if (!VALID_XML_NAME.test(String(name))) {
      const err = new Error(`Invalid qualified name: '${name}'`);
      err.name = 'InvalidCharacterError';
      throw err;
    }
    return origSetAttribute.call(this, name, value);
  };

  ({ html, render } = await import('../../index.js'));
});

after(() => {
  if (ElementProto && origSetAttribute) ElementProto.setAttribute = origSetAttribute;
});

test('the strict setAttribute wrapper has teeth (rejects the historic data-w$0) (#747)', () => {
  const el = document.createElement('div');
  assert.throws(() => el.setAttribute('data-w$0', ''), /Invalid qualified name/);
  // ...and accepts a valid name, so it is not rejecting everything.
  assert.doesNotThrow(() => el.setAttribute('data-wjm-0', ''));
});

test('the renderer emits only valid attribute names (slot + @click + attrs) (#730/#747)', () => {
  // The slot sentinel is applied via setAttribute in discoverSlots, the exact
  // path that crashed iOS. Several representative templates, all with a <slot>.
  const templates = [
    () => html`<button type="button" class="x" @click=${() => {}}><slot></slot></button>`,
    () => html`<div role="dialog" aria-label="x" @pointerenter=${() => {}}><slot></slot><slot name="end"></slot></div>`,
    () => html`<section .value=${{ a: 1 }} ?hidden=${false}><span>x</span><slot></slot></section>`,
  ];
  for (const make of templates) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    assert.doesNotThrow(
      () => render(make(), container),
      'renderer must not emit an attribute name a strict (iOS) setAttribute rejects'
    );
    assert.ok(container.querySelector('button, div, section'), 'template rendered');
  }
});
