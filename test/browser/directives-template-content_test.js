/**
 * Ported from lit-html's `templateContent` directive test suite
 * (packages/lit-html/src/test/directives/template-content_test.ts).
 *
 * `templateContent(tpl)` clones the contents of a real <template>
 * element into the host part position. webjs implements this via
 * `applyChild` (`isTemplateContent` branch), which tears down any
 * prior child and inserts `tpl.content.cloneNode(true)` before the
 * marker.
 *
 * NOTE on lit's "clones a template only once" test: lit caches the
 * cloned fragment and reuses it across renders so the same <div>
 * node is preserved. webjs's current implementation does NOT cache;
 * it tears down + re-clones on every call. We still port the test
 * but with the webjs-correct expectation that the cloned node IS
 * a fresh instance on re-render. If/when webjs adopts caching the
 * test can flip its assertion. The reference comment below records
 * the deviation.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';
import { templateContent } from '../../packages/core/src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notStrictEqual: (a, b, msg) => { if (a === b) throw new Error(msg || 'Expected different references'); },
  strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || 'Expected strict equal'); },
};

function stripExpressionComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

suite('templateContent directive (lit parity port)', () => {
  let container;
  const template = document.createElement('template');
  template.innerHTML = '<div>aaa</div>';

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    container.remove();
  });

  test('renders a template', () => {
    render(html`<div>${templateContent(template)}</div>`, container);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><div>aaa</div></div>',
    );
  });

  test('clones a template (lit caches; webjs re-clones per render)', () => {
    const go = () =>
      render(html`<div>${templateContent(template)}</div>`, container);
    go();
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><div>aaa</div></div>',
    );
    const templateDiv = container.querySelector('div > div');

    go();
    const templateDiv2 = container.querySelector('div > div');
    // Lit's identical assertion: strictEqual(templateDiv, templateDiv2).
    // webjs's applyChild's templateContent branch tears down + clones
    // anew on every render, so a different node is expected. The HTML
    // shape is identical either way.
    assert.notStrictEqual(
      templateDiv,
      templateDiv2,
      'webjs re-clones; lit caches. Both render the same HTML.',
    );
    assert.equal(templateDiv2.tagName, 'DIV');
    assert.equal(templateDiv2.textContent, 'aaa');
  });

  test('renders a new template over a previous one', () => {
    const go = (t) =>
      render(html`<div>${templateContent(t)}</div>`, container);
    go(template);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><div>aaa</div></div>',
    );

    const newTemplate = document.createElement('template');
    newTemplate.innerHTML = '<span>bbb</span>';
    go(newTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><span>bbb</span></div>',
    );
  });

  test('re-renders a template over a non-templateContent value', () => {
    const go = (v) => render(html`<div>${v}</div>`, container);
    go(templateContent(template));
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><div>aaa</div></div>',
    );

    go('ccc');
    assert.equal(stripExpressionComments(container.innerHTML), '<div>ccc</div>');

    go(templateContent(template));
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><div>aaa</div></div>',
    );
  });
});
