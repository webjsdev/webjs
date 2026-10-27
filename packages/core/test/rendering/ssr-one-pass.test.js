/**
 * The one-pass renderer's own contracts (#1646), beyond the goldens:
 *
 *   - every component instance renders exactly once per page render (the
 *     three-pass walk rendered a nested instance once per chain depth and
 *     discarded all but the innermost result);
 *   - the inert contexts hold on the COMPILED path too, where a nested
 *     TemplateResult value sits inside a comment, raw text, a text-only
 *     element or an attribute value of the enclosing template;
 *   - the structural slot partition routes every top-level child shape
 *     (void, self-closed, unclosed, text, comment, a nested component) the
 *     way the string partition did;
 *   - a text-only or raw-text element entered through a hole still keeps its
 *     content text for the rest of the enclosing template.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString, WebComponent } from '../../index.js';
import { unsafeHTML } from '../../src/directives.js';

let renders = 0;
class OnceLeaf extends WebComponent({ n: Number }) {
  constructor() { super(); this.n = 0; }
  render() { renders += 1; return html`<em>leaf ${this.n}</em>`; }
}
OnceLeaf.register('once-leaf');

class OnceMid extends WebComponent {
  render() { renders += 1; return html`<section><once-leaf n="2"></once-leaf><slot></slot></section>`; }
}
OnceMid.register('once-mid');

class OnceRoot extends WebComponent {
  render() { renders += 1; return html`<div><once-mid><once-leaf n="3"></once-leaf></once-mid></div>`; }
}
OnceRoot.register('once-root');

class Probe extends WebComponent {
  render() { return html`<b>PROBE</b>`; }
}
Probe.register('once-probe');

class Shell extends WebComponent {
  render() { return html`<header><slot name="head">NO-HEAD</slot></header><main><slot></slot></main>`; }
}
Shell.register('once-shell');

test('every instance renders exactly once, however deep it nests', async () => {
  renders = 0;
  const out = await renderToString(html`<once-root></once-root>`);
  assert.match(out, /leaf 2/);
  assert.match(out, /leaf 3/);
  // root + mid + two leaves. The three-pass walk rendered the mid once per
  // chain depth and each leaf up to three times.
  assert.equal(renders, 4, 'counterfactual: a rescan-and-discard walk renders nested instances more than once');
});

test('a nested template value inside a comment, raw text or a text-only element is text', async () => {
  const inner = html`<once-probe></once-probe>`;
  const out = await renderToString(html`<!-- ${inner} --><script>${inner}</script><title>${inner}</title><textarea>${inner}</textarea><p>${inner}</p>`);
  const probes = out.match(/PROBE/g) || [];
  assert.equal(probes.length, 1, 'only the probe in the paragraph renders');
  // A template value renders its markup wherever it sits (a string would be
  // escaped); inside a text-only element that markup is text, so the tag is
  // not expanded. A comment or raw-text hole stringifies the value as before.
  assert.match(out, /<title><once-probe><\/once-probe><\/title>/, 'the title hole keeps the markup, unexpanded');
  assert.match(out, /<textarea><once-probe><\/once-probe><\/textarea>/);
  assert.match(out, /<!-- \[object Object\] --><script>\[object Object\]<\/script>/, 'comment and raw-text holes stringify');
});

test('a tag inside an attribute value of the enclosing template is text on the compiled path', async () => {
  const out = await renderToString(html`<p title="<once-probe>" data-x=${'<once-probe></once-probe>'}>t</p><once-probe></once-probe>`);
  assert.equal((out.match(/PROBE/g) || []).length, 1);
  assert.match(out, /data-x="&lt;once-probe>&lt;\/once-probe>"/);
});

test('a raw string value with components expands them, with its own inert contexts honoured', async () => {
  const out = await renderToString(html`<div>${unsafeHTML('<!-- <once-probe></once-probe> --><once-probe></once-probe><p title="<once-probe>">x</p>')}</div>`);
  assert.equal((out.match(/PROBE/g) || []).length, 1);
});

test('the structural partition routes every top-level child shape', async () => {
  const out = await renderToString(html`<once-shell>
    text <!-- c -->
    <input slot="head" name="i">
    <custom-x slot="head"/>
    <p slot="head">p</p>
    <once-probe slot="head"></once-probe>
    <span>default</span>
  </once-shell>`);
  const head = /name="head">([\s\S]*?)<\/slot>/.exec(out);
  assert.ok(head, 'the head slot rendered');
  assert.match(head[1], /<input slot="head" name="i">/, 'a void child');
  assert.match(head[1], /<custom-x slot="head"\/>/, 'a self-closed child');
  assert.match(head[1], /<p slot="head">p<\/p>/, 'an ordinary child');
  assert.match(head[1], /<once-probe slot="head" data-wj-host><!--webjs-hydrate--><b>PROBE<\/b><\/once-probe>/, 'a component child, expanded');
  const def = /data-projection="actual" data-wj-slot-owner="once-shell">([\s\S]*?)<\/slot><\/main>/.exec(out);
  assert.ok(def, 'the default slot rendered');
  assert.match(def[1], /text <!-- c -->/, 'text and comments route to the default slot');
  assert.match(def[1], /<span>default<\/span>/);
  assert.doesNotMatch(def[1], /slot="head"/, 'named children are not in the default slot');
});

test('an unclosed top-level child runs to the end of the authored children', async () => {
  const out = await renderToString(html`<once-shell><div slot="head">open<p>deep</once-shell><once-probe></once-probe>`);
  assert.match(out, /name="head"><div slot="head">open<p>deep<\/slot>/);
  assert.match(out, /<\/once-shell><once-probe data-wj-host>/, 'the shell closes where its end tag is');
});

test('a self-closed component has no children and a late end tag is text', async () => {
  const out = await renderToString(html`<p><once-probe/> after</p>`);
  assert.equal(out, '<p><once-probe data-wj-host><!--webjs-hydrate--><b>PROBE</b></once-probe> after</p>');
});

test('the value of a plain hole after whitespace-padded = still binds', async () => {
  const out = await renderToString(html`<a title= ${'x'} href = ${'/y'}>t</a>`);
  assert.equal(out, '<a title= "x" href = "/y">t</a>');
});
