/**
 * A plain attribute hole that holds `null` / `undefined` / `false` (#1573).
 *
 * The server used to stringify it (`attr=""`, `attr="false"`) while the client
 * removed it, so a layout's `aria-current=${active ? 'page' : null}` served an
 * empty `aria-current` on every inactive link, and layouts never hydrate to
 * repair it. Both renderers now follow `attrHoleValue` in binding-prefixes.js:
 * nullish omits, `false` omits except on an aria-* name, where it is "false".
 *
 * Every server case runs through BOTH machines (the buffered `renderToString`
 * and the streaming `renderToStream(v, { ssr: false })`), since they are
 * independent hole dispatchers. The client half runs the real client renderer
 * over linkedom. Flat tests, no nested subtests: this file runs in the Bun
 * parity matrix, whose node:test shim refuses a nested subtest.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html } from '../../src/html.js';
import { renderToString, renderToStream } from '../../src/render-server.js';
import { attrHoleValue } from '../../src/binding-prefixes.js';

async function drain(stream) {
  let out = '';
  const reader = stream.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += typeof value === 'string' ? value : dec.decode(value);
  }
  return out;
}

async function bothServers(mk, assertOn) {
  assertOn(await renderToString(mk()), 'buffered');
  assertOn(await drain(renderToStream(mk(), { ssr: false })), 'streamed');
}

let render;
before(async () => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Node = window.Node;
  globalThis.Element = window.Element;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.HTMLElement = window.HTMLElement;
  ({ render } = await import('../../src/render-client.js'));
});

function clientEl(tpl) {
  const host = document.createElement('div');
  render(tpl, host);
  return host.firstElementChild;
}

test('attrHoleValue: the shared rule (#1573)', () => {
  assert.equal(attrHoleValue('title', null), null);
  assert.equal(attrHoleValue('title', undefined), null);
  assert.equal(attrHoleValue('hidden', false), null);
  assert.equal(attrHoleValue('aria-expanded', false), 'false');
  assert.equal(attrHoleValue('ARIA-Pressed', false), 'false');
  assert.equal(attrHoleValue('aria-current', null), null);
  assert.equal(attrHoleValue('title', 0), '0');
  assert.equal(attrHoleValue('title', ''), '');
  assert.equal(attrHoleValue('aria-expanded', true), 'true');
  // #1579: a boolean attribute takes `true` the way `?attr` does.
  assert.equal(attrHoleValue('checked', true), '');
  assert.equal(attrHoleValue('SELECTED', true), '');
  assert.equal(attrHoleValue('checked', false), null);
  assert.equal(attrHoleValue('data-on', true), 'true', 'a non-boolean attribute still stringifies true');
});

test('server: a null or undefined plain hole omits the attribute (#1573)', async () => {
  for (const v of [null, undefined]) {
    await bothServers(() => html`<a href="/x" aria-current=${v} title=${v}>x</a>`, (out, who) => {
      assert.doesNotMatch(out, /aria-current/, `${who}: aria-current=\${${v}} must be omitted, got ${out}`);
      assert.doesNotMatch(out, /title/, `${who}: title=\${${v}} must be omitted, got ${out}`);
      assert.match(out, /<a href="\/x"\s*>x<\/a>/, `${who}: the rest of the tag is intact, got ${out}`);
    });
  }
});

test('server: false omits a plain attribute but writes "false" on aria-* (#1573)', async () => {
  await bothServers(() => html`<button data-on=${false} aria-expanded=${false} aria-pressed=${true}>x</button>`, (out, who) => {
    assert.doesNotMatch(out, /data-on/, `${who}: data-on=\${false} must be omitted, got ${out}`);
    assert.match(out, /aria-expanded="false"/, `${who}: aria-expanded=\${false} must be "false", got ${out}`);
    assert.match(out, /aria-pressed="true"/, `${who}: got ${out}`);
  });
});

test('server: a present value, and a quoted or mixed hole, are unchanged (#1573)', async () => {
  await bothServers(() => html`<a aria-current=${'page'} title="${null}" class="a ${null}">x</a>`, (out, who) => {
    assert.match(out, /aria-current="page"/, `${who}: got ${out}`);
    assert.match(out, /title=""/, `${who}: a QUOTED hole keeps its statically written attribute, got ${out}`);
    assert.match(out, /class="a "/, `${who}: a mixed hole keeps the attribute, got ${out}`);
  });
});

test('client: the same rule, so hydration changes nothing (#1573)', () => {
  const a = clientEl(html`<a aria-current=${null} title=${undefined} data-on=${false} aria-expanded=${false}>x</a>`);
  assert.equal(a.hasAttribute('aria-current'), false);
  assert.equal(a.hasAttribute('title'), false);
  assert.equal(a.hasAttribute('data-on'), false);
  assert.equal(a.getAttribute('aria-expanded'), 'false', 'aria-* false is written, not removed');
});

test('client: an aria-* hole flipping true -> false keeps the attribute as "false" (#1573)', () => {
  const host = document.createElement('div');
  const tpl = (v) => html`<button aria-pressed=${v}>x</button>`;
  render(tpl(true), host);
  assert.equal(host.firstElementChild.getAttribute('aria-pressed'), 'true');
  render(tpl(false), host);
  assert.equal(host.firstElementChild.getAttribute('aria-pressed'), 'false');
  render(tpl(null), host);
  assert.equal(host.firstElementChild.hasAttribute('aria-pressed'), false, 'null is still the omit value on aria-*');
});

// #1579: the RSVP form from a generated app. Plain holes on boolean attributes
// served `checked="false"` / `selected="false"`, which HTML reads as PRESENT, so
// the last radio and the last option won. Each must now render like `?attr`.
const rsvp = () => html`<form>
  <input type="radio" name="a" value="yes" checked=${true}>
  <input type="radio" name="a" value="no" checked=${false}>
  <select name="n">${[1, 2, 3, 4].map((n, i) => html`<option value=${n} selected=${i === 0}>${n}</option>`)}</select>
  <button disabled=${false} hidden=${null}>Send</button>
</form>`;

test('server: a boolean in a plain hole on a boolean attribute renders like ?attr (#1579)', async () => {
  await bothServers(rsvp, (out, who) => {
    assert.match(out, /value="yes"\s+checked=""/, `${who}: checked=\${true} must be checked="", got ${out}`);
    assert.doesNotMatch(out, /="false"/, `${who}: no boolean attribute may serve "false", got ${out}`);
    assert.doesNotMatch(out, /="true"/, `${who}: no boolean attribute may serve "true", got ${out}`);
    assert.equal((out.match(/\bselected=""/g) || []).length, 1, `${who}: exactly one option selected, got ${out}`);
    assert.doesNotMatch(out, /\bdisabled|\bhidden/, `${who}: false / null omit, got ${out}`);
  });
});

test('client: the same boolean-attribute rule, so hydration agrees (#1579)', () => {
  const host = document.createElement('div');
  render(rsvp(), host);
  const radios = host.querySelectorAll('input');
  assert.equal(radios[0].getAttribute('checked'), '');
  assert.equal(radios[1].hasAttribute('checked'), false);
  const opts = host.querySelectorAll('option');
  assert.deepEqual([...opts].map((o) => o.hasAttribute('selected')), [true, false, false, false]);
  assert.equal(opts[0].getAttribute('selected'), '');
  const btn = host.querySelector('button');
  assert.equal(btn.hasAttribute('disabled'), false);
  assert.equal(btn.hasAttribute('hidden'), false);
});
