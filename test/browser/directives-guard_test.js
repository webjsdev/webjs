/**
 * Ported from lit-html's `guard` directive test suite
 * (packages/lit-html/src/test/directives/guard_test.ts).
 *
 * Guard memoizes a sub-template by its dependency array. The deps live
 * on the part as `part.__guardDeps`; on each render they're shallow-
 * compared against the new deps, and the producer fn is skipped when
 * they match. The deps state persists across renders only when the
 * outer template literal's `strings` array is reused, so all tests
 * here keep a stable factory.
 *
 * Skipped tests:
 *   - "renders with nothing the first time" uses lit's `nothing`
 *     sentinel which webjs does not ship.
 *   - "guards directive from running" uses lit's Directive subclass
 *     API + `directive()` factory; webjs's directives are plain
 *     tagged values, no constructor / render() class lifecycle.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';
import { guard } from '../../packages/core/src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

function stripExpressionComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '');
}

suite('guard directive (lit parity port)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    container.remove();
  });

  // Stable factory so the outer template strings are reused across
  // renders. The webjs guard state lives on the child part; if the
  // outer template's strings change per call, the part is fresh and
  // there is no prior __guardDeps to compare against.
  function renderGuarded(value, f) {
    render(html`<div>${guard(value, f)}</div>`, container);
  }

  test('re-renders only on identity changes', () => {
    let callCount = 0;
    let renderCount = 0;

    const guardedTemplate = () => {
      callCount += 1;
      return html`Template ${renderCount}`;
    };

    renderCount += 1;
    renderGuarded('foo', guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>Template 1</div>',
    );

    renderCount += 1;
    renderGuarded('foo', guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>Template 1</div>',
    );

    renderCount += 1;
    renderGuarded('bar', guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div>Template 3</div>',
    );

    assert.equal(callCount, 2);
  });

  test('renders with undefined the first time', () => {
    let callCount = 0;
    let renderCount = 0;

    const guardedTemplate = () => {
      callCount += 1;
      return html`${renderCount}`;
    };

    renderCount += 1;
    renderGuarded(undefined, guardedTemplate);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>1</div>');

    renderCount += 1;
    renderGuarded(undefined, guardedTemplate);
    assert.equal(stripExpressionComments(container.innerHTML), '<div>1</div>');

    assert.equal(callCount, 1);
  });

  test('dirty checks array values', () => {
    let callCount = 0;
    let items = ['foo', 'bar'];

    const guardedTemplate = () => {
      callCount += 1;
      return html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    };

    renderGuarded([items], guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li></ul></div>',
    );

    items.push('baz');
    renderGuarded([items], guardedTemplate);
    // Identity-equal items array, so guard skips re-evaluation. The
    // pushed 'baz' is invisible to the rendered DOM.
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li></ul></div>',
    );

    items = [...items];
    renderGuarded([items], guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li><li>baz</li></ul></div>',
    );

    assert.equal(callCount, 2);
  });

  test('dirty checks arrays of values', () => {
    let callCount = 0;
    const items = ['foo', 'bar'];

    const guardedTemplate = () => {
      callCount += 1;
      return html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    };

    renderGuarded(items, guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li></ul></div>',
    );

    renderGuarded(['foo', 'bar'], guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li></ul></div>',
    );

    items.push('baz');
    renderGuarded(items, guardedTemplate);
    assert.equal(
      stripExpressionComments(container.innerHTML),
      '<div><ul><li>foo</li><li>bar</li><li>baz</li></ul></div>',
    );

    assert.equal(callCount, 2);
  });
});
