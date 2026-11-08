/**
 * Plain attribute hole and boolean attribute semantics aligned with Lit.
 *
 * In Lit, ordinary attribute holes stringify nullish values to empty strings
 * (`attr=""`) and stringify booleans (`attr="false"` / `attr="true"`). Attribute
 * omission is achieved using the `nothing` sentinel (or `noChange`). Boolean
 * attribute toggling is done using boolean attribute bindings (`?attr=${...}`).
 *
 * Every server case runs through BOTH machines (the buffered `renderToString`
 * and the streaming `renderToStream(v, { ssr: false })`). The client half
 * runs the real client renderer over linkedom.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html } from '../../src/html.js';
import { renderToString, renderToStream } from '../../src/render-server.js';
import { attrHoleValue } from '../../src/binding-prefixes.js';
import { nothing, noChange } from '../../src/sentinels.js';

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
  assert.equal(attrHoleValue('title', nothing), null);
  assert.equal(attrHoleValue('title', noChange), null);
  assert.equal(attrHoleValue('title', null), '');
  assert.equal(attrHoleValue('title', undefined), '');
  assert.equal(attrHoleValue('hidden', false), 'false');
  assert.equal(attrHoleValue('aria-expanded', false), 'false');
  assert.equal(attrHoleValue('ARIA-Pressed', false), 'false');
  assert.equal(attrHoleValue('aria-current', null), '');
  assert.equal(attrHoleValue('title', 0), '0');
  assert.equal(attrHoleValue('title', ''), '');
  assert.equal(attrHoleValue('aria-expanded', true), 'true');
  assert.equal(attrHoleValue('checked', true), 'true');
  assert.equal(attrHoleValue('SELECTED', true), 'true');
  assert.equal(attrHoleValue('checked', false), 'false');
  assert.equal(attrHoleValue('data-on', true), 'true');
});

test('server: a null or undefined plain hole renders empty string attribute', async () => {
  for (const v of [null, undefined]) {
    await bothServers(() => html`<a href="/x" aria-current=${v} title=${v}>x</a>`, (out, who) => {
      assert.match(out, /aria-current=""/, `${who}: aria-current=\${${v}} must be empty string, got ${out}`);
      assert.match(out, /title=""/, `${who}: title=\${${v}} must be empty string, got ${out}`);
      assert.match(out, /<a href="\/x"\s+aria-current="" title="">x<\/a>/, `${who}: the rest of the tag is intact, got ${out}`);
    });
  }
});

test('server: nothing omits the attribute', async () => {
  await bothServers(() => html`<a href="/x" aria-current=${nothing} title=${nothing}>x</a>`, (out, who) => {
    assert.doesNotMatch(out, /aria-current/, `${who}: aria-current=\${nothing} must be omitted, got ${out}`);
    assert.doesNotMatch(out, /title/, `${who}: title=\${nothing} must be omitted, got ${out}`);
    assert.match(out, /<a href="\/x"\s*>x<\/a>/, `${who}: the rest of the tag is intact, got ${out}`);
  });
});

test('server: false writes "false" on plain attributes and aria-*', async () => {
  await bothServers(() => html`<button data-on=${false} aria-expanded=${false} aria-pressed=${true}>x</button>`, (out, who) => {
    assert.match(out, /data-on="false"/, `${who}: data-on=\${false} must be "false", got ${out}`);
    assert.match(out, /aria-expanded="false"/, `${who}: aria-expanded=\${false} must be "false", got ${out}`);
    assert.match(out, /aria-pressed="true"/, `${who}: got ${out}`);
  });
});

test('server: a present value, and a quoted or mixed hole, are unchanged', async () => {
  await bothServers(() => html`<a aria-current=${'page'} title="${null}" class="a ${null}">x</a>`, (out, who) => {
    assert.match(out, /aria-current="page"/, `${who}: got ${out}`);
    assert.match(out, /title=""/, `${who}: a QUOTED hole keeps its statically written attribute, got ${out}`);
    assert.match(out, /class="a "/, `${who}: a mixed hole keeps the attribute, got ${out}`);
  });
});

test('client: nullish values write empty string; nothing omits', () => {
  const a = clientEl(html`<a aria-current=${null} title=${undefined} data-on=${false} aria-expanded=${false}>x</a>`);
  assert.equal(a.getAttribute('aria-current'), '');
  assert.equal(a.getAttribute('title'), '');
  assert.equal(a.getAttribute('data-on'), 'false');
  assert.equal(a.getAttribute('aria-expanded'), 'false');

  const b = clientEl(html`<a aria-current=${nothing} title=${nothing}>x</a>`);
  assert.equal(b.hasAttribute('aria-current'), false);
  assert.equal(b.hasAttribute('title'), false);
});

test('client: an aria-* hole flipping true -> false keeps the attribute as "false"', () => {
  const host = document.createElement('div');
  const tpl = (v) => html`<button aria-pressed=${v}>x</button>`;
  render(tpl(true), host);
  assert.equal(host.firstElementChild.getAttribute('aria-pressed'), 'true');
  render(tpl(false), host);
  assert.equal(host.firstElementChild.getAttribute('aria-pressed'), 'false');
  render(tpl(nothing), host);
  assert.equal(host.firstElementChild.hasAttribute('aria-pressed'), false, 'nothing omits attribute on aria-*');
});

// Lit boolean attributes use `?attr`
const rsvp = () => html`<form>
  <input type="radio" name="a" value="yes" ?checked=${true}>
  <input type="radio" name="a" value="no" ?checked=${false}>
  <select name="n">${[1, 2, 3, 4].map((n, i) => html`<option value=${n} ?selected=${i === 0}>${n}</option>`)}</select>
  <button ?disabled=${false} hidden=${nothing}>Send</button>
</form>`;

test('server: boolean attributes render like ?attr', async () => {
  await bothServers(rsvp, (out, who) => {
    assert.match(out, /value="yes"\s+checked=""/, `${who}: checked=\${true} must be checked="", got ${out}`);
    assert.doesNotMatch(out, /value="no"\s+checked/, `${who}: false bool attr must be omitted, got ${out}`);
    assert.equal((out.match(/\bselected=""/g) || []).length, 1, `${who}: exactly one option selected, got ${out}`);
    assert.doesNotMatch(out, /\bdisabled|\bhidden/, `${who}: false / nothing omit, got ${out}`);
  });
});

test('client: boolean attributes agree with ?attr', () => {
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
