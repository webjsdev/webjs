/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's styling suites to WebJs: `static styles` on a shadow-DOM
 * component, CSS custom properties across shadow roots, and the `css` tag.
 *
 * Upstream (lit commit b17fb144):
 *   lit/packages/reactive-element/src/test/reactive-element_styling_test.ts
 *   lit/packages/reactive-element/src/test/css-tag_test.ts
 *
 * Lit's `RenderingElement` (a ReactiveElement that renders an `html` template
 * into a shadow root) is a WebJs component with `static shadow = true`, the
 * only mode `static styles` applies in. `getComputedStyleValue` is
 * `getComputedStyle(el).getPropertyValue(prop)`, its non-ShadyCSS branch.
 * chai's `assert.throws` / `assert.isDefined` are spelled with try / catch and
 * `assert.ok(x !== undefined)`, which this suite's assert helper lacks.
 *
 * Not ported (polyfill-only paths, skipped by Lit itself in a browser with
 * adoptedStyleSheets and no ShadyCSS):
 *   - "when an array is returned from `static get styles`, one style is
 *     generated per array item"
 *   - "CSSStyleSheet is flattened where ShadyCSS is enabled yet
 *     adoptedStyleSheets are supported"
 */
import { html } from '../../../src/html.js';
import { css, unsafeCSS, CSSResult } from '../../../src/css.js';
import { WebComponent } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `re-port-style-${++__ctr}`;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const getComputedStyleValue = (el, prop) => getComputedStyle(el).getPropertyValue(prop);

/** Lit's test `RenderingElement`: a component that renders into a shadow root. */
class RenderingElement extends WebComponent {
  static shadow = true;
}

suite('Styling port (reactive-element_styling_test.ts)', () => {
  suite('Static get styles', () => {
    let container;

    setup(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    teardown(() => {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    });

    test('content shadowRoot is styled via static get styles in multiple instances', async () => {
      const name = tag();
      customElements.define(name, class extends RenderingElement {
        static get styles() {
          return [
            css`
              div {
                border: 2px solid blue;
              }
            `,
            css`
              span {
                display: block;
                border: 3px solid blue;
              }
            `,
          ];
        }
        render() {
          return html` <div>Testing1</div>
            <span>Testing2</span>`;
        }
      });
      const testInstance = async () => {
        const el = document.createElement(name);
        container.appendChild(el);
        await el.updateComplete;
        const div = el.shadowRoot.querySelector('div');
        assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
        const span = el.shadowRoot.querySelector('span');
        assert.equal(getComputedStyleValue(span, 'border-top-width').trim(), '3px');
      };
      // test multiple instances
      await testInstance();
      await testInstance();
      await testInstance();
    });

    test('static get styles can be a single CSSResult', async () => {
      const name = tag();
      customElements.define(name, class extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: 2px solid blue;
            }
          `;
        }
        render() { return html` <div>Testing</div>`; }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
    });

    test('static get styles allows composition via `css` values', async () => {
      const name = tag();
      customElements.define(name, class extends RenderingElement {
        static get styles() {
          // Alias avoids syntax highlighting issues in editors
          const cssValue = css;
          return [
            css`
              div {
                border: ${cssValue`2px solid blue`};
              }
            `,
            css`
              span {
                display: block;
                border: ${cssValue`3px solid blue`};
              }
            `,
          ];
        }
        render() {
          return html` <div>Testing1</div>
            <span>Testing2</span>`;
        }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
      const span = el.shadowRoot.querySelector('span');
      assert.equal(getComputedStyleValue(span, 'border-top-width').trim(), '3px');
    });

    test('Any value can be used in `css` when included with `unsafeCSS`', async () => {
      const name = tag();
      const someVar = `2px solid blue`;
      customElements.define(name, class extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: ${unsafeCSS(someVar)};
            }
          `;
        }
        render() { return html` <div>Testing</div>`; }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
    });

    test('unsafeCSS can be used standalone', async () => {
      const name = tag();
      customElements.define(name, class extends RenderingElement {
        static get styles() { return unsafeCSS('div {border: 2px solid blue}'); }
        render() { return html` <div>Testing</div>`; }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
    });

    test('`static get styles` applies last instance of style', async () => {
      const name = tag();
      const s1 = css`
        div {
          border: 2px solid blue;
        }
      `;
      const s2 = css`
        div {
          border: 3px solid blue;
        }
      `;
      customElements.define(name, class extends RenderingElement {
        static get styles() { return [s1, s2, s1]; }
        render() { return html` <div>Testing1</div>`; }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
    });

    test('`static get styles` array is flattened', async () => {
      const name = tag();
      const styles = [
        css`.level1 { border: 1px solid blue; }`,
        [
          css`.level2 { border: 2px solid blue; }`,
          [css`.level3 { border: 3px solid blue; }`, [css`.level4 { border: 4px solid blue; }`]],
        ],
      ];
      customElements.define(name, class extends RenderingElement {
        static get styles() { return [styles]; }
        render() {
          return html` <div class="level1">Testing1</div>
            <div class="level2">Testing2</div>
            <div class="level3">Testing3</div>
            <div class="level4">Testing4</div>`;
        }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      for (const n of [1, 2, 3, 4]) {
        const level = el.shadowRoot.querySelector(`.level${n}`);
        assert.equal(getComputedStyleValue(level, 'border-top-width').trim(), `${n}px`);
      }
    });

    test('`styles` can be a static field', async () => {
      const name = tag();
      customElements.define(name, class extends RenderingElement {
        static styles = [
          css`
            div {
              border: 2px solid blue;
            }
          `,
          css`
            span {
              display: block;
              border: 3px solid blue;
            }
          `,
        ];
        render() {
          return html` <div>Testing1</div>
            <span>Testing2</span>`;
        }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
      const span = el.shadowRoot.querySelector('span');
      assert.equal(getComputedStyleValue(span, 'border-top-width').trim(), '3px');
    });

    test('can extend and augment `styles`', async () => {
      const base = tag();
      class BaseClass extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: 2px solid blue;
            }
          `;
        }
        render() { return html` <div>Testing1</div>`; }
      }
      customElements.define(base, BaseClass);
      const sub = tag();
      customElements.define(sub, class extends BaseClass {
        static get styles() {
          return [
            super.styles,
            css`
              span {
                display: block;
                border: 3px solid blue;
              }
            `,
          ];
        }
        render() {
          return html` ${super.render()}
            <span>Testing2</span>`;
        }
      });
      const subsub = tag();
      customElements.define(subsub, class extends BaseClass {
        static get styles() {
          return [
            BaseClass.styles,
            css`
              p {
                display: block;
                border: 4px solid blue;
              }
            `,
          ];
        }
        render() {
          return html` ${super.render()}
            <p>Testing3</p>`;
        }
      });
      let el = document.createElement(base);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
      el = document.createElement(sub);
      container.appendChild(el);
      await el.updateComplete;
      const span = el.shadowRoot.querySelector('span');
      assert.equal(getComputedStyleValue(span, 'border-top-width').trim(), '3px');
      el = document.createElement(subsub);
      container.appendChild(el);
      await el.updateComplete;
      const p = el.shadowRoot.querySelector('p');
      assert.equal(getComputedStyleValue(p, 'border-top-width').trim(), '4px');
    });

    test('can extend and override `styles`', async () => {
      const base = tag();
      class BaseClass extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: 2px solid blue;
            }
          `;
        }
        render() { return html` <div>Testing1</div>`; }
      }
      customElements.define(base, BaseClass);
      const sub = tag();
      customElements.define(sub, class extends BaseClass {
        static get styles() {
          return css`
            div {
              border: 3px solid blue;
            }
          `;
        }
      });
      const subsub = tag();
      customElements.define(subsub, class extends BaseClass {
        static get styles() {
          return css`
            div {
              border: 4px solid blue;
            }
          `;
        }
      });
      let el = document.createElement(base);
      container.appendChild(el);
      await el.updateComplete;
      let div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
      el = document.createElement(sub);
      container.appendChild(el);
      await el.updateComplete;
      div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '3px');
      el = document.createElement(subsub);
      container.appendChild(el);
      await el.updateComplete;
      div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '4px');
    });

    test('elements should inherit `styles` by default', async () => {
      const base = tag();
      class BaseClass extends RenderingElement {
        static styles = css`
          div {
            border: 4px solid black;
          }
        `;
      }
      customElements.define(base, BaseClass);
      const sub = tag();
      customElements.define(sub, class extends BaseClass {
        render() { return html`<div></div>`; }
      });
      const el = document.createElement(sub);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyle(div).getPropertyValue('border-top-width').trim(), '4px');
    });

    test('element class only gathers styles once', async () => {
      const base = tag();
      let getStylesCounter = 0;
      let stylesCounter = 0;
      customElements.define(base, class extends RenderingElement {
        static finalizeStyles(styles) {
          getStylesCounter++;
          return super.finalizeStyles(styles);
        }
        static get styles() {
          stylesCounter++;
          return css`
            :host {
              border: 10px solid black;
            }
          `;
        }
        render() { return html`<div>styled</div>`; }
      });
      const el1 = document.createElement(base);
      const el2 = document.createElement(base);
      container.appendChild(el1);
      container.appendChild(el2);
      await Promise.all([el1.updateComplete, el2.updateComplete]);
      assert.equal(getComputedStyle(el1).getPropertyValue('border-top-width').trim(), '10px', 'el1 styled correctly');
      assert.equal(getComputedStyle(el2).getPropertyValue('border-top-width').trim(), '10px', 'el2 styled correctly');
      assert.equal(stylesCounter, 1, 'styles property should only be accessed once');
      assert.equal(getStylesCounter, 1, 'getStyles() should be called once');
    });

    test('Styles are not removed if the first rendered value is undefined.', async () => {
      const localName = tag();
      class SomeCustomElement extends RenderingElement {
        static styles = css`
          :host {
            border: 4px solid black;
          }
        `;
        static get properties() {
          return { renderUndefined: { type: Boolean, value: true } };
        }
        constructor() {
          super();
          this.renderUndefined = true;
        }
        render() {
          if (this.renderUndefined) return undefined;
          return html`Some text.`;
        }
      }
      customElements.define(localName, SomeCustomElement);
      const element = document.createElement(localName);
      document.body.appendChild(element);
      await element.updateComplete;
      assert.equal(getComputedStyle(element).getPropertyValue('border-top-width').trim(), '4px');
      element.renderUndefined = false;
      await element.updateComplete;
      assert.equal(getComputedStyle(element).getPropertyValue('border-top-width').trim(), '4px');
      document.body.removeChild(element);
    });

    test('Can return CSSStyleSheet where adoptedStyleSheets are natively supported', async () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div { border: 4px solid red; }');
      const normal = css`
        span {
          border: 4px solid blue;
        }
      `;
      const base = tag();
      customElements.define(base, class extends RenderingElement {
        static styles = [sheet, normal];
        render() {
          return html`<div></div>
            <span></span>`;
        }
      });
      const el = document.createElement(base);
      container.appendChild(el);
      await el.updateComplete;
      const div = el.shadowRoot.querySelector('div');
      assert.equal(getComputedStyle(div).getPropertyValue('border-top-width').trim(), '4px');
      const span = el.shadowRoot.querySelector('span');
      assert.equal(getComputedStyle(span).getPropertyValue('border-top-width').trim(), '4px');
      // No ShadyCSS here, so the adopted sheet is live: updating it restyles.
      sheet.replaceSync('div { border: 2px solid red; }');
      assert.equal(getComputedStyle(div).getPropertyValue('border-top-width').trim(), '2px');
    });
  });

  suite('CSS Custom Properties', () => {
    let container;

    setup(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    teardown(() => {
      if (container && container.parentNode) container.parentNode.removeChild(container);
    });

    test('custom properties render', async () => {
      const name = tag();
      const testStyle = (el) => {
        const div = el.shadowRoot.querySelector('div');
        assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '8px');
      };
      customElements.define(name, class extends RenderingElement {
        static get styles() {
          return css`
            :host {
              --border: 8px solid red;
            }
            div {
              border: var(--border);
            }
          `;
        }
        render() { return html`<div>Testing...</div>`; }
        firstUpdated() { testStyle(this); }
      });
      const el = document.createElement(name);
      container.appendChild(el);
      await el.updateComplete;
      testStyle(el);
    });

    test('custom properties flow to nested elements', async () => {
      customElements.define('x-inner', class extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: var(--border);
            }
          `;
        }
        render() { return html`<div>Testing...</div>`; }
      });
      const name = tag();
      class E extends RenderingElement {
        inner = null;
        static get styles() {
          return css`
            x-inner {
              --border: 8px solid red;
            }
          `;
        }
        render() { return html`<x-inner></x-inner>`; }
        firstUpdated() { this.inner = this.shadowRoot.querySelector('x-inner'); }
      }
      customElements.define(name, E);
      const el = document.createElement(name);
      container.appendChild(el);
      // Workaround for Safari 9 Promise timing bugs.
      (await el.updateComplete) && (await el.inner.updateComplete);
      await nextFrame();
      const div = el.inner.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '8px');
    });

    test('elements with custom properties can move between elements', async () => {
      customElements.define('x-inner1', class extends RenderingElement {
        static get styles() {
          return css`
            div {
              border: var(--border);
            }
          `;
        }
        render() { return html`<div>Testing...</div>`; }
      });
      const name1 = tag();
      customElements.define(name1, class extends RenderingElement {
        inner = null;
        static get styles() {
          return css`
            x-inner1 {
              --border: 2px solid red;
            }
          `;
        }
        render() { return html`<x-inner1></x-inner1>`; }
        firstUpdated() { this.inner = this.shadowRoot.querySelector('x-inner1'); }
      });
      const name2 = tag();
      customElements.define(name2, class extends RenderingElement {
        static get styles() {
          return css`
            x-inner1 {
              --border: 8px solid red;
            }
          `;
        }
        render() { return html``; }
      });
      const el = document.createElement(name1);
      const el2 = document.createElement(name2);
      container.appendChild(el);
      container.appendChild(el2);
      // Workaround for Safari 9 Promise timing bugs.
      await el.updateComplete;
      await nextFrame();
      const inner = el.shadowRoot.querySelector('x-inner1');
      const div = inner.shadowRoot.querySelector('div');
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '2px');
      el2.shadowRoot.appendChild(inner);
      // Workaround for Safari 9 Promise timing bugs.
      await el.updateComplete;
      await nextFrame();
      assert.equal(getComputedStyleValue(div, 'border-top-width').trim(), '8px');
    });
  });
});

suite('Styling port: css tag (css-tag_test.ts)', () => {
  test('stylesheet from same template literal without expressions are cached', () => {
    // Alias avoids syntax highlighting issues in editors
    const cssValue = css;
    const makeStyle = () => cssValue`foo`;
    const style1 = makeStyle();
    assert.ok(style1.styleSheet !== undefined);
    assert.strictEqual(style1.styleSheet, style1.styleSheet);
    const style2 = makeStyle();
    // Equal because we cache stylesheets based on TemplateStringArrays
    assert.strictEqual(style1.styleSheet, style2.styleSheet);
  });

  test('stylesheet from same template literal with expressions are not cached', () => {
    const cssValue = css;
    const makeStyle = () => cssValue`background: ${cssValue`blue`}`;
    const style1 = makeStyle();
    assert.ok(style1.styleSheet !== undefined);
    assert.strictEqual(style1.styleSheet, style1.styleSheet);
    const style2 = makeStyle();
    assert.notStrictEqual(style1.styleSheet, style2.styleSheet);
  });

  test('unsafeCSS() always produces a new stylesheet', () => {
    const makeStyle = () => unsafeCSS(`foo`);
    const style1 = makeStyle();
    assert.ok(style1.styleSheet !== undefined);
    assert.strictEqual(style1.styleSheet, style1.styleSheet);
    const style2 = makeStyle();
    assert.notStrictEqual(style1.styleSheet, style2.styleSheet);
  });

  test('`css` get styles throws when unsafe values are used', () => {
    let threw = false;
    try {
      css`
        div {
          border: ${`2px solid blue;`};
        }
      `;
    } catch {
      threw = true;
    }
    assert.isTrue(threw);
  });

  test('`css` allows real JavaScript numbers', () => {
    const spacer = 2;
    const cssValue = css;
    const result = cssValue`
      div {
        margin: ${spacer * 2}px;
      }
    `;
    assert.equal(result.cssText.replace(/\s/g, ''), 'div{margin:4px;}');
  });

  test('`CSSResult` cannot be constructed', () => {
    // Note, this is done for security, instead use `css` or `unsafeCSS`
    let threw = false;
    try {
      new CSSResult('throw', Symbol());
    } catch {
      threw = true;
    }
    assert.isTrue(threw);
  });

  test('`CSSResult` allows for String type coercion via toString()', () => {
    const cssModule = css`
      .my-module {
        color: yellow;
      }
    `;
    // Coercion allows for reusage of css-tag outcomes in regular strings.
    const bodyStyles = `${cssModule}`;
    assert.equal(bodyStyles.replace(/\s/g, ''), '.my-module{color:yellow;}');
  });
});
