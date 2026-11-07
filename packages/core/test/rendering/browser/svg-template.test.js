/**
 * The `svg` template tag, real browser via WTR.
 *
 * A template is parsed through `<template>.innerHTML`, so an `html` fragment
 * whose root is `<rect>` comes out as an HTML element and never paints. An
 * `svg` fragment is parsed inside an `<svg>` wrapper, so its elements are SVG
 * elements wherever the fragment is rendered: on a fresh client render, on a
 * re-render, and after hydrating server-rendered markup.
 */
import { html, svg } from '../../../src/html.js';
import { WebComponent, prop } from '../../../src/component.js';
import { render } from '../../../src/render-client.js';
import { renderToString } from '../../../src/render-server.js';
import { ssrFixture } from '../../../src/testing.js';

import { assert } from '../../../../../test/browser-assert.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function bars(values) {
  return values.map((v, i) => svg`<rect class="bar" data-i=${i} x=${i * 10} width="8" height=${v}></rect>`);
}

function assertAllSvg(root, selector, count) {
  const nodes = [...root.querySelectorAll(selector)];
  assert.equal(nodes.length, count, `${count} ${selector} rendered`);
  for (const n of nodes) assert.equal(n.namespaceURI, SVG_NS, `${selector} is an SVG element`);
}

class SvgBars extends WebComponent({ values: prop(Array) }) {
  constructor() {
    super();
    this.values = [];
  }
  render() {
    return html`<svg viewBox="0 0 100 100">${bars(this.values)}</svg>`;
  }
}
SvgBars.register('svg-bars-test');

suite('svg template tag', () => {
  test('renders a fragment as SVG elements on a client render and a re-render', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    try {
      render(html`<svg>${bars([5, 7])}</svg>`, el);
      assertAllSvg(el, 'rect', 2);
      assert.equal(el.querySelector('rect').getAttribute('height'), '5', 'an attribute hole is applied');
      render(html`<svg>${bars([1, 2, 3])}</svg>`, el);
      assertAllSvg(el, 'rect', 3);
      assert.equal(el.querySelectorAll('rect')[2].getAttribute('x'), '20');
      assert.ok(el.querySelector('rect').getBBox().height > 0, 'the rect lays out, so it paints');
    } finally {
      el.remove();
    }
  });

  test('an html fragment with the same markup is not SVG (why the tag exists)', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    try {
      render(html`<svg>${[html`<rect width="8" height="5"></rect>`]}</svg>`, el);
      assert.notEqual(el.querySelector('rect').namespaceURI, SVG_NS);
    } finally {
      el.remove();
    }
  });

  test('nests, and carries event and property parts', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let clicked = -1;
    const dot = (i) => svg`<circle data-i=${i} r="2" @click=${() => { clicked = i; }} .webjsTag=${'dot'}></circle>`;
    try {
      render(html`<svg>${svg`<g class="layer">${[0, 1].map(dot)}<text x="1" y="1">${'label'}</text></g>`}</svg>`, el);
      assertAllSvg(el, 'g', 1);
      assertAllSvg(el, 'circle', 2);
      assertAllSvg(el, 'text', 1);
      assert.equal(el.querySelector('text').textContent, 'label');
      el.querySelectorAll('circle')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      assert.equal(clicked, 1, 'the event part is bound');
      assert.equal(el.querySelector('circle').webjsTag, 'dot', 'the property part is set');
    } finally {
      el.remove();
    }
  });

  test('renders on the server exactly as html does', async () => {
    const a = await renderToString(html`<svg>${svg`<rect width=${4}></rect>`}</svg>`);
    const b = await renderToString(html`<svg>${html`<rect width=${4}></rect>`}</svg>`);
    assert.equal(a, b);
  });

  test('hydrates server-rendered markup and stays SVG when the component re-renders', async () => {
    const el = await ssrFixture(html`<svg-bars-test .values=${[3, 4]}></svg-bars-test>`);
    await el.updateComplete;
    assertAllSvg(el, 'rect', 2);
    el.values = [9, 8, 7];
    await el.updateComplete;
    assertAllSvg(el, 'rect', 3);
    assert.equal(el.querySelectorAll('rect')[0].getAttribute('height'), '9');
  });
});
