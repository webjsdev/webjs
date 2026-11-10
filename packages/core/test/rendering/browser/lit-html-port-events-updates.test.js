/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/lit-html_test.ts`
 * (suites 'events' and 'updates', Lit commit b17fb144, #1686 Lit
 * conformance): TypeScript types stripped and imports swapped to WebJs,
 * otherwise case for case. `assertContent` strips WebJs's own `wjm-` marker
 * comments instead of Lit's. Lit's `{host}` render option is WebJs's too: a
 * function listener is called with it as `this`.
 *
 * Not ported: the whole 'compiled' suite (five tests), which renders Lit's
 * precompiled `_$litType$` template objects, a Lit-internal format.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { assert } from '../../../../../test/browser-assert.js';

const stripExpressionComments = (s) => s.replace(/<!--wjm-[\s\S]*?-->/g, '');

suite('lit-html (lit port): events, updates', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    container.id = 'container';
  });

  const assertContent = (expected) => {
    assert.equal(stripExpressionComments(container.innerHTML), expected);
  };

  suite('events', () => {
    setup(() => {
      document.body.appendChild(container);
    });

    teardown(() => {
      document.body.removeChild(container);
    });

    test('adds event listener functions, calls with right this value', () => {
      let thisValue;
      let event = undefined;
      const listener = function (e) {
        event = e;
        thisValue = this;
      };
      const host = {};
      render(html`<div @click=${listener}></div>`, container, { host });
      const div = container.querySelector('div');
      div.click();
      if (event === undefined) {
        throw new Error(`Event listener never fired!`);
      }
      assert.equal(thisValue, host);
      assert.instanceOf(event, MouseEvent);
    });

    test('adds event listener objects, calls with right this value', () => {
      let thisValue;
      const listener = {
        handleEvent(_e) {
          thisValue = this;
        },
      };
      const host = {};
      render(html`<div @click=${listener}></div>`, container, {
        host,
      });
      const div = container.querySelector('div');
      div.click();
      assert.equal(thisValue, listener);
    });

    test('only adds event listener once', () => {
      let count = 0;
      const listener = () => {
        count++;
      };
      render(html`<div @click=${listener}></div>`, container);
      render(html`<div @click=${listener}></div>`, container);

      const div = container.querySelector('div');
      div.click();
      assert.equal(count, 1);
    });

    test('adds event listeners on self-closing tags', () => {
      let count = 0;
      const listener = () => {
        count++;
      };
      render(html`<div @click=${listener}/></div>`, container);

      const div = container.querySelector('div');
      div.click();
      assert.equal(count, 1);
    });

    test('allows updating event listener', () => {
      let count1 = 0;
      const listener1 = () => {
        count1++;
      };
      let count2 = 0;
      const listener2 = () => {
        count2++;
      };
      const t = (listener) => html`<div @click=${listener}></div>`;
      render(t(listener1), container);
      render(t(listener2), container);

      const div = container.querySelector('div');
      div.click();
      assert.equal(count1, 0);
      assert.equal(count2, 1);
    });

    test('allows updating event listener without extra calls to remove/addEventListener', () => {
      let listener;
      const t = () => html`<div @click=${listener}></div>`;
      render(t(), container);
      const div = container.querySelector('div');

      let addCount = 0;
      let removeCount = 0;
      div.addEventListener = () => addCount++;
      div.removeEventListener = () => removeCount++;

      listener = () => {};
      render(t(), container);
      assert.equal(addCount, 1);
      assert.equal(removeCount, 0);

      listener = () => {};
      render(t(), container);
      assert.equal(addCount, 1);
      assert.equal(removeCount, 0);

      listener = null;
      render(t(), container);
      assert.equal(addCount, 1);
      assert.equal(removeCount, 1);

      listener = () => {};
      render(t(), container);
      assert.equal(addCount, 2);
      assert.equal(removeCount, 1);

      listener = () => {};
      render(t(), container);
      assert.equal(addCount, 2);
      assert.equal(removeCount, 1);
    });

    test('removes event listeners', () => {
      let target;
      let listener = (e) => (target = e.target);
      const t = () => html`<div @click=${listener}></div>`;
      render(t(), container);
      const div = container.querySelector('div');
      div.click();
      assert.equal(target, div);

      listener = null;
      target = undefined;
      render(t(), container);
      div.click();
      assert.equal(target, undefined);
    });

    test('allows capturing events', () => {
      let event;
      let eventPhase;
      const listener = {
        handleEvent(e) {
          event = e;
          // read here because it changes
          eventPhase = event.eventPhase;
        },
        capture: true,
      };
      render(
        html`
          <div id="outer" @test=${listener}>
            <div id="inner"><div></div></div>
          </div>
        `,
        container
      );
      const inner = container.querySelector('#inner');
      inner.dispatchEvent(new Event('test'));
      assert.isOk(event);
      assert.equal(eventPhase, Event.CAPTURING_PHASE);
    });

    test('event listeners can see events fired by dynamic children', () => {
      // This tests that node directives are called in the commit phase, not
      // the setValue phase
      class TestElement1 extends HTMLElement {
        connectedCallback() {
          this.dispatchEvent(
            new CustomEvent('test-event', {
              bubbles: true,
            })
          );
        }
      }
      customElements.define('test-element-1', TestElement1);

      let event = undefined;
      const listener = (e) => {
        event = e;
      };
      document.body.appendChild(container);
      render(
        html`<div @test-event=${listener}>
          ${html`<test-element-1></test-element-1>`}
        </div>`,
        container
      );
      assert.isOk(event);
    });
  });

  suite('updates', () => {
    test('dirty checks simple values', () => {
      const foo = 'aaa';

      const t = () => html`<div>${foo}</div>`;

      render(t(), container);
      assertContent('<div>aaa</div>');
      const text = container.querySelector('div');
      assert.equal(text.textContent, 'aaa');

      // Set textContent manually (without disturbing the part marker node).
      // Since lit-html doesn't dirty check against actual DOM, but again
      // previous part values, this modification should persist through the
      // next render with the same value.
      // Lit's marker comes before its text node and WebJs's after it, so the
      // text node is found by type rather than as `lastChild`.
      [...text.childNodes].find((n) => n.nodeType === Node.TEXT_NODE).textContent = 'bbb';
      assert.equal(text.textContent, 'bbb');
      assertContent('<div>bbb</div>');

      // Re-render with the same content, should be a no-op
      render(t(), container);
      assertContent('<div>bbb</div>');
      const text2 = container.querySelector('div');

      // The next node should be the same too
      assert.strictEqual(text, text2);
    });

    test('dirty checks node values', async () => {
      const node = document.createElement('div');
      const t = () => html`${node}`;

      const observer = new MutationObserver(() => {});
      observer.observe(container, { childList: true, subtree: true });

      assertContent('');
      render(t(), container);
      assertContent('<div></div>');

      const elementNodes = [];
      let mutationRecords = observer.takeRecords();
      for (const record of mutationRecords) {
        elementNodes.push(
          ...Array.from(record.addedNodes).filter(
            (n) => n.nodeType === Node.ELEMENT_NODE
          )
        );
      }
      assert.equal(elementNodes.length, 1);

      mutationRecords = [];
      render(t(), container);
      assertContent('<div></div>');
      mutationRecords = observer.takeRecords();
      assert.equal(mutationRecords.length, 0);
    });

    test('renders to and updates a container', () => {
      let foo = 'aaa';

      const t = () => html`<div>${foo}</div>`;

      render(t(), container);
      assertContent('<div>aaa</div>');
      const div = container.querySelector('div');
      assert.equal(div.tagName, 'DIV');

      foo = 'bbb';
      render(t(), container);
      assertContent('<div>bbb</div>');
      const div2 = container.querySelector('div');
      // check that only the part changed
      assert.equal(div, div2);
    });

    test('renders to and updates sibling parts', () => {
      let foo = 'foo';
      const bar = 'bar';

      const t = () => html`<div>${foo}${bar}</div>`;

      render(t(), container);
      assertContent('<div>foobar</div>');

      foo = 'bbb';
      render(t(), container);
      assertContent('<div>bbbbar</div>');
    });

    test('renders and updates attributes', () => {
      let foo = 'foo';
      const bar = 'bar';

      const t = () => html`<div a="${foo}:${bar}"></div>`;

      render(t(), container);
      assertContent('<div a="foo:bar"></div>');

      foo = 'bbb';
      render(t(), container);
      assertContent('<div a="bbb:bar"></div>');
    });

    test('updates nested templates', () => {
      let foo = 'foo';
      const bar = 'bar';
      const baz = 'baz';

      const t = (x) => {
        let partial;
        if (x) {
          partial = html`<h1>${foo}</h1>`;
        } else {
          partial = html`<h2>${bar}</h2>`;
        }

        return html`${partial}${baz}`;
      };

      render(t(true), container);
      assertContent('<h1>foo</h1>baz');

      foo = 'bbb';
      render(t(true), container);
      assertContent('<h1>bbb</h1>baz');

      render(t(false), container);
      assertContent('<h2>bar</h2>baz');
    });

    test('updates an element', () => {
      let child = document.createElement('p');
      const t = () => html`<div>${child}<div></div></div>`;
      render(t(), container);
      assertContent('<div><p></p><div></div></div>');

      child = undefined;
      render(t(), container);
      assertContent('<div><div></div></div>');

      child = document.createTextNode('foo');
      render(t(), container);
      assertContent('<div>foo<div></div></div>');
    });

    test(
      'overwrites an existing TemplateInstance if one exists and does ' +
        'not have a matching Template',
      () => {
        render(html`<div>foo</div>`, container);

        assert.equal(container.children.length, 1);
        const fooDiv = container.children[0];
        assert.equal(fooDiv.textContent, 'foo');

        render(html`<div>bar</div>`, container);

        assert.equal(container.children.length, 1);
        const barDiv = container.children[0];
        assert.equal(barDiv.textContent, 'bar');

        assert.notEqual(fooDiv, barDiv);
      }
    );
  });
});
