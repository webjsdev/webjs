/**
 * The SSR scanner's memos (#1644): the registered-tag regex is built once per
 * registry version rather than per render, and the per-tag close regexes once
 * per tag name. The output must not move, a tag registered after a render
 * must be picked up by the next one, and nested same-name elements must still
 * close correctly through the cached, stateful regexes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, WebComponent } from '../../index.js';
import { renderToString } from '../../src/render-server.js';
import { tagPattern } from '../../src/render-server/dsd.js';
import { registryVersion } from '../../src/registry.js';
import { tagRegexes, findClosingTagInString, closingTagLength } from '../../src/render-server/html-scan.js';

class MemoBadge extends WebComponent({ label: String }) {
  constructor() { super(); this.label = ''; }
  render() { return html`<span>${this.label}</span>`; }
}
MemoBadge.register('memo-badge');

test('the tag pattern is one object per registry version, and a new registration rebuilds it', async () => {
  const a = await renderToString(html`<div><memo-badge label="one"></memo-badge></div>`);
  const p1 = tagPattern();
  const b = await renderToString(html`<div><memo-badge label="one"></memo-badge></div>`);
  assert.equal(a, b, 'two renders are byte-identical');
  assert.equal(tagPattern(), p1, 'the same regex object serves every render of a build');
  assert.ok(a.includes('<span>one</span>'), 'the component rendered');

  const before = registryVersion();
  class MemoLate extends WebComponent({}) {
    render() { return html`<em>late</em>`; }
  }
  MemoLate.register('memo-late');
  assert.ok(registryVersion() > before, 'a first-time registration bumps the version');
  const c = await renderToString(html`<memo-late></memo-late>`);
  assert.ok(c.includes('<em>late</em>'), 'counterfactual: a stale memo would leave the new tag unrendered');
  assert.notEqual(tagPattern(), p1, 'the pattern was rebuilt for the new tag set');
  // Re-registering an existing tag (a dev re-import) does not move the version.
  const v = registryVersion();
  MemoLate.register('memo-late');
  assert.equal(registryVersion(), v);
});

test('cached per-tag regexes still find the right closing tag through nesting, from any start', () => {
  const doc = '<x-a><x-a>inner</x-a>tail</x-a><x-a>second</x-a>';
  assert.equal(tagRegexes('x-a'), tagRegexes('x-a'), 'compiled once per tag name');
  const firstInner = '<x-a>'.length;
  const close1 = findClosingTagInString(doc, firstInner, 'x-a');
  assert.equal(doc.slice(close1), '</x-a><x-a>second</x-a>', 'the outer element closes after the nested one');
  const secondInner = doc.indexOf('<x-a>second') + '<x-a>'.length;
  const close2 = findClosingTagInString(doc, secondInner, 'x-a');
  assert.equal(doc.slice(close2), '</x-a>', 'a later search from a later index is not confused by the earlier lastIndex');
  assert.equal(closingTagLength('</x-a  >rest', 'x-a'), '</x-a  >'.length);
  assert.equal(closingTagLength('<not-a-close>', 'x-a'), '</x-a>'.length, 'falls back to the canonical length');
});
