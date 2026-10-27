/**
 * The SSR renderer's memo (#1646): a template is tokenized ONCE per
 * `TemplateStringsArray` identity and the ops are reused by every later
 * render, with no coupling to the component registry, so a tag registered
 * (or primed by the prod component scan) AFTER the template compiled still
 * expands on the next render. These replace the #1644 regex memos, which the
 * one-pass walk made unnecessary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, WebComponent } from '../../index.js';
import { renderToString } from '../../src/render-server.js';
import { compile, compileRaw, _compileCount, TEXT, OPEN, TAG_END, CLOSE, HOLE, CHILD, ATTR, RAW, VALUE, DROP } from '../../src/render-server/compile.js';
import { primeModuleUrl } from '../../src/registry.js';

class MemoBadge extends WebComponent({ label: String }) {
  constructor() { super(); this.label = ''; }
  render() { return html`<span>${this.label}</span>`; }
}
MemoBadge.register('memo-badge');

test('a template is tokenized once per strings identity and its renders are byte-identical', async () => {
  const page = (label) => html`<div><memo-badge label=${label}></memo-badge></div>`;
  const a = await renderToString(page('one'));
  const n = _compileCount();
  const b = await renderToString(page('one'));
  const c = await renderToString(page('two'));
  assert.equal(a, b, 'two renders are byte-identical');
  assert.ok(a.includes('<span>one</span>') && c.includes('<span>two</span>'), 'the component rendered from the cached ops');
  assert.equal(_compileCount(), n, 'counterfactual: a second render of the same template tokenizes nothing');
  // A fresh strings identity (a new tagged literal site) compiles exactly once.
  const other = (x) => html`<p>${x}</p>`;
  await renderToString(other(1));
  const m = _compileCount();
  await renderToString(other(2));
  assert.equal(_compileCount(), m);
  assert.ok(m > n, 'a new template site tokenizes once');
});

test('compile() returns the same op array for the same strings and a fresh one for a raw string', () => {
  const tr = html`<i>${1}</i>`;
  assert.equal(compile(tr.strings), compile(tr.strings), 'cached per identity');
  assert.notEqual(compileRaw('<i>1</i>'), compileRaw('<i>1</i>'), 'raw strings are never cached');
});

test('a tag registered after its template compiled still expands (no registry coupling)', async () => {
  const page = () => html`<memo-late></memo-late>`;
  const before = await renderToString(page());
  assert.equal(before, '<memo-late></memo-late>', 'an unregistered tag is text');
  class MemoLate extends WebComponent({}) {
    render() { return html`<em>late</em>`; }
  }
  MemoLate.register('memo-late');
  const after = await renderToString(page());
  assert.ok(after.includes('<em>late</em>'), 'counterfactual: ops keyed on the registry would leave the tag bare');
});

test('a tag primed by the component scan before its class arrives expands once the class registers (the prod order)', async () => {
  // In prod the scanner primes every component tag with its module url at
  // warm-up and the class registers later, when the page module imports it.
  // The #1644 regression came from a memo keyed on the registry that was
  // built in between; the ops carry no registry state at all.
  const page = () => html`<memo-primed></memo-primed>`;
  await renderToString(page());
  primeModuleUrl('memo-primed', '/components/memo-primed.ts');
  assert.equal(await renderToString(page()), '<memo-primed></memo-primed>', 'a primed tag with no class is still text');
  class MemoPrimed extends WebComponent({}) {
    render() { return html`<b>primed</b>`; }
  }
  MemoPrimed.register('memo-primed');
  const out = await renderToString(page());
  assert.ok(out.includes('<b>primed</b>'), 'the late-registered class renders through the cached ops');
});

test('the ops record where every hole sits and where every element opens and closes', () => {
  const tr = html`<a class=${1} @click=${2} ?x=${3} .p=${4} title="${5}">${6}<br>${7}</a><!-- ${8} --><script>${9}</script>`;
  const ops = compile(tr.strings);
  const kinds = ops.filter((o) => o.t === HOLE).map((o) => o.k);
  assert.deepEqual(kinds, [ATTR, ATTR, ATTR, ATTR, VALUE, CHILD, CHILD, RAW, RAW]);
  const attrKinds = ops.filter((o) => o.t === HOLE && o.k === ATTR).map((o) => `${o.kind}:${o.name}:${o.lead}`);
  assert.deepEqual(attrKinds, ['plain:class:class=', 'event:click:@click=', 'bool:x:?x=', 'prop:p:.p=']);
  const tags = ops.filter((o) => o.t === OPEN || o.t === CLOSE).map((o) => `${o.t === OPEN ? '<' : '</'}${o.tag}`);
  assert.deepEqual(tags, ['<a', '<br', '</a', '<script', '</script']);
  assert.equal(ops.filter((o) => o.t === TAG_END).length, 3);
  assert.ok(ops.some((o) => o.t === TEXT));
  // A hole in a tag name or between attributes is a DROP, as before.
  const dropped = compile(html`<div ${1} class${2}>`.strings).filter((o) => o.t === HOLE).map((o) => o.k);
  assert.deepEqual(dropped, [DROP, DROP]);
});

test('a text-only or raw-text element emits no element ops for the tags inside it', () => {
  const ops = compileRaw('<title><x-y></x-y></title><textarea><x-y></textarea><script>"<x-y>"</script><style>/*<x-y>*/</style><!-- <x-y> --><p title="<x-y>">t</p>');
  const opened = ops.filter((o) => o.t === OPEN).map((o) => o.tag);
  assert.deepEqual(opened, ['title', 'textarea', 'script', 'style', 'p']);
});
