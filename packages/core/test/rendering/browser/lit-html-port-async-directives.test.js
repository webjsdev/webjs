/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/lit-html_test.ts`
 * (suite 'async directives', plus the top-level `don't render simple spoof
 * template results`, Lit commit b17fb144, #1686 Lit conformance): TypeScript
 * types stripped by Node's `stripTypeScriptTypes` and imports swapped to
 * WebJs, otherwise case for case. `assertContent` strips WebJs's own `wjm-`
 * marker comments instead of Lit's.
 *
 * Not ported: the 'enhanced security hooks' and 'warnings' suites, which run
 * only in Lit's dev build against `render.setSanitizer` and its dev warnings,
 * and the commented-out 'spread' suite.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing, noChange } from '../../../src/sentinels.js';
import { directive, Directive } from '../../../src/directive.js';
import { AsyncDirective } from '../../../src/async-directive.js';
import { repeat } from '../../../src/repeat.js';
import { assert } from '../../../../../test/browser-assert.js';

const stripExpressionComments = (s) => s.replace(/<!--wjm-[\s\S]*?-->/g, '');
const stripExpressionMarkers = stripExpressionComments;

suite('lit-html (lit port): async directives', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    container.id = 'container';
  });

  const assertRender = (r, expected, options) => {
    const part = render(r, container, options);
    if (Array.isArray(expected)) {
      assert.include(expected, stripExpressionComments(container.innerHTML));
    } else {
      assert.equal(stripExpressionComments(container.innerHTML), expected);
    }
    return part;
  };

  const assertContent = (expected) => {
    assert.equal(stripExpressionComments(container.innerHTML), expected);
  };

  suite('async directives', () => {
    class ADirective extends AsyncDirective {
      value;
      promise;
      render(_promise) {
        return 'initial';
      }
      update(_part, [promise]) {
        aDirectiveInst = this;
        if (promise !== this.promise) {
          this.promise = promise;
          promise.then((value) => this.setValue((this.value = value)));
        }
        return this.value ?? this.render(promise);
      }
    }
    const aDirective = directive(ADirective);
    let aDirectiveInst;

    const bDirective = directive(
      class extends Directive {
        count = 0;
        render(v) {
          return `[B:${this.count++}:${v}]`;
        }
      }
    );

    const syncAsyncDirective = directive(
      class extends AsyncDirective {
        render(x) {
          this.setValue(x);
          return noChange;
        }
      }
    );

    test('async directive can call setValue synchronously', () => {
      assertRender(
        html`<div foo=${syncAsyncDirective('test')}>${syncAsyncDirective(
          'test'
        )}</div>`,
        '<div foo="test">test</div>'
      );
    });

    test('async directives in ChildPart', async () => {
      const template = (promise) =>
        html`<div>${aDirective(promise)}</div>`;
      let promise = Promise.resolve('resolved1');
      assertRender(template(promise), `<div>initial</div>`);
      await promise;
      assertContent(`<div>resolved1</div>`);
      promise = Promise.resolve('resolved2');
      assertRender(template(promise), `<div>resolved1</div>`);
      await promise;
      assertContent(`<div>resolved2</div>`);
    });

    test('async directives change to disconnected in ChildPart', async () => {
      const template = (promise) =>
        html`<div>${aDirective(promise)}</div>`;
      const promise = Promise.resolve('resolved1');
      const part = assertRender(template(promise), `<div>initial</div>`);
      assert.isTrue(aDirectiveInst.isConnected);
      part.setConnected(false);
      assertContent(`<div>initial</div>`);
      await promise;
      assert.isFalse(aDirectiveInst.isConnected);
      assertContent(`<div>resolved1</div>`);
      part.setConnected(true);
      assert.isTrue(aDirectiveInst.isConnected);
      assertContent(`<div>resolved1</div>`);
    });

    test('async directives render while disconnected in ChildPart', async () => {
      const template = (v) => html`<div>${v}</div>`;
      const promise = Promise.resolve('resolved1');
      const part = assertRender(template('initial'), `<div>initial</div>`);
      part.setConnected(false);
      assertRender(template(aDirective(promise)), `<div>initial</div>`);
      assert.isFalse(aDirectiveInst.isConnected);
      await promise;
      assertContent(`<div>resolved1</div>`);
      assert.isFalse(aDirectiveInst.isConnected);
      part.setConnected(true);
      assert.isTrue(aDirectiveInst.isConnected);
      assertRender(template(aDirective(promise)), `<div>resolved1</div>`);
    });

    test('async directives while disconnected in ChildPart clears its value', async () => {
      const log = [];
      const template = (promise) =>
        html`<div>${aDirective(promise)}</div>`;
      // Async render a TemplateResult containing a AsyncDirective
      let promise = Promise.resolve(
        html`${disconnectingDirective(log, 'dd', 'dd')}`
      );
      const part = assertRender(template(promise), `<div>initial</div>`);
      await promise;
      assertContent(`<div>dd</div>`);
      // Eneuque an async clear of the TemplateResult+AsyncDirective
      promise = Promise.resolve(nothing);
      assertRender(template(promise), `<div>dd</div>`);
      assert.deepEqual(log, []);
      // Disconnect the tree before the clear is committed
      part.setConnected(false);
      assert.isFalse(aDirectiveInst.isConnected);
      assert.deepEqual(log, ['disconnected-dd']);
      await promise;
      assert.deepEqual(log, ['disconnected-dd']);
      assertContent(`<div></div>`);
      // Re-connect the tree, which should clear the part but not reconnect
      // the AsyncDirective that was cleared
      part.setConnected(true);
      assert.isTrue(aDirectiveInst.isConnected);
      assertRender(template(promise), `<div></div>`);
      assert.deepEqual(log, ['disconnected-dd']);
    });

    test('async nested directives in ChildPart', async () => {
      const template = (promise) =>
        html`<div>${aDirective(promise)}</div>`;
      let promise = Promise.resolve(bDirective('X'));
      assertRender(template(promise), `<div>initial</div>`);
      await promise;
      assertContent(`<div>[B:0:X]</div>`);
      assertRender(template(promise), `<div>[B:1:X]</div>`);
      promise = Promise.resolve(bDirective('Y'));
      assertRender(template(promise), `<div>[B:2:X]</div>`);
      await promise;
      assertContent(`<div>[B:3:Y]</div>`);
    });

    test('async directives in AttributePart', async () => {
      const template = (promise) =>
        html`<div a="${'**'}${aDirective(promise)}${'##'}"></div>`;
      let promise = Promise.resolve('resolved1');
      assertRender(template(promise), `<div a="**initial##"></div>`);
      await promise;
      assertContent(`<div a="**resolved1##"></div>`);
      promise = Promise.resolve('resolved2');
      assertRender(template(promise), `<div a="**resolved1##"></div>`);
      await promise;
      assertContent(`<div a="**resolved2##"></div>`);
    });

    test('async directives while disconnected in AttributePart', async () => {
      const template = (promise) =>
        html`<div a="${'**'}${aDirective(promise)}${'##'}"></div>`;
      const promise = Promise.resolve('resolved1');
      const part = assertRender(
        template(promise),
        `<div a="**initial##"></div>`
      );
      part.setConnected(false);
      assert.isFalse(aDirectiveInst.isConnected);
      await promise;
      assertContent(`<div a="**resolved1##"></div>`);
      part.setConnected(true);
      assert.isTrue(aDirectiveInst.isConnected);
      assertContent(`<div a="**resolved1##"></div>`);
    });

    test('async nested directives in AttributePart', async () => {
      const template = (promise) =>
        html`<div a="${'**'}${aDirective(promise)}${'##'}"></div>`;
      let promise = Promise.resolve(bDirective('X'));
      assertRender(template(promise), `<div a="**initial##"></div>`);
      await promise;
      assertContent(`<div a="**[B:0:X]##"></div>`);
      promise = Promise.resolve(bDirective('Y'));
      assertRender(template(promise), `<div a="**[B:1:X]##"></div>`);
      await promise;
      assertContent(`<div a="**[B:2:Y]##"></div>`);
    });

    const disconnectingDirective = directive(
      class extends AsyncDirective {
        log;
        id;

        render(log, id = '', value, bool = true) {
          this.log = log;
          this.id = id;
          return bool ? value : nothing;
        }

        disconnected() {
          this.log.push('disconnected' + (this.id ? `-${this.id}` : ''));
        }
        reconnected() {
          this.log.push('reconnected' + (this.id ? `-${this.id}` : ''));
        }
      }
    );

    const passthroughDirective = directive(
      class extends Directive {
        render(value, bool = true) {
          return bool ? value : nothing;
        }
      }
    );

    test('directives can be disconnected from ChildParts', () => {
      const log = [];
      const go = (x) =>
        render(html`${x ? disconnectingDirective(log) : nothing}`, container);
      go(true);
      assert.isEmpty(log);
      go(false);
      assert.deepEqual(log, ['disconnected']);
    });

    test('directives are disconnected when their template is', () => {
      const log = [];
      const go = (x) =>
        render(x ? html`${disconnectingDirective(log)}` : nothing, container);
      go(true);
      assert.isEmpty(log);
      go(false);
      assert.deepEqual(log, ['disconnected']);
    });

    test('directives are disconnected when their nested template is', () => {
      const log = [];
      const go = (x) =>
        render(
          x ? html`${html`${disconnectingDirective(log)}`}` : nothing,
          container
        );
      go(true);
      assert.isEmpty(log);
      go(false);
      assert.deepEqual(log, ['disconnected']);
    });

    test('directives in different subtrees can be disconnected in separate renders', () => {
      const log = [];
      const go = (left, right) =>
        render(
          html`
            ${html`${html`${
              left ? disconnectingDirective(log, 'left') : nothing
            }`}`}
            ${html`${html`${
              right ? disconnectingDirective(log, 'right') : nothing
            }`}`}
          `,
          container
        );
      go(true, true);
      assert.isEmpty(log);
      go(true, false);
      assert.deepEqual(log, ['disconnected-right']);
      log.length = 0;
      go(false, false);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      go(true, true);
      assert.isEmpty(log);
      go(false, true);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      go(false, false);
      assert.deepEqual(log, ['disconnected-right']);
    });

    test('directives returned from other directives can be disconnected', () => {
      const log = [];
      const go = (clearAll, left, right) =>
        render(
          clearAll
            ? nothing
            : html`
            ${html`${html`${passthroughDirective(
              disconnectingDirective(log, 'left'),
              left
            )}`}`}
            ${html`${html`${passthroughDirective(
              disconnectingDirective(log, 'right'),
              right
            )}`}`}
          `,
          container
        );
      go(false, true, true);
      assert.isEmpty(log);
      go(true, true, true);
      assert.deepEqual(log, ['disconnected-left', 'disconnected-right']);
      log.length = 0;
      go(false, true, true);
      assert.isEmpty(log);
      go(false, true, false);
      assert.deepEqual(log, ['disconnected-right']);
      log.length = 0;
      go(false, false, false);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      go(false, true, true);
      assert.isEmpty(log);
      go(false, false, true);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      go(false, false, false);
      assert.deepEqual(log, ['disconnected-right']);
    });

    test('directives returned from other AsyncDirectives can be disconnected', () => {
      const log = [];
      const go = (
        clearAll,
        leftOuter,
        leftInner,
        rightOuter,
        rightInner
      ) =>
        render(
          clearAll
            ? nothing
            : html`
            ${html`${html`${
              leftOuter
                ? disconnectingDirective(
                    log,
                    'left-outer',
                    disconnectingDirective(log, 'left-inner'),
                    leftInner
                  )
                : nothing
            }`}`}
            ${html`${html`${
              rightOuter
                ? disconnectingDirective(
                    log,
                    'right-outer',
                    disconnectingDirective(log, 'right-inner'),
                    rightInner
                  )
                : nothing
            }`}`}
          `,
          container
        );
      go(false, true, true, true, true);
      assert.isEmpty(log);
      go(true, true, true, true, true);
      assert.deepEqual(log, [
        'disconnected-left-outer',
        'disconnected-left-inner',
        'disconnected-right-outer',
        'disconnected-right-inner',
      ]);
      log.length = 0;
      go(false, true, true, true, true);
      assert.isEmpty(log);
      go(false, false, true, true, true);
      assert.deepEqual(log, [
        'disconnected-left-outer',
        'disconnected-left-inner',
      ]);
      log.length = 0;
      go(false, true, true, true, true);
      assert.isEmpty(log);
      go(false, true, true, false, true);
      assert.deepEqual(log, [
        'disconnected-right-outer',
        'disconnected-right-inner',
      ]);
      log.length = 0;
      go(false, true, true, true, true);
      assert.isEmpty(log);
      go(false, true, false, true, true);
      assert.deepEqual(log, ['disconnected-left-inner']);
      log.length = 0;
      go(false, true, false, true, false);
      assert.deepEqual(log, ['disconnected-right-inner']);
    });

    test('directives can be disconnected from AttributeParts', () => {
      const log = [];
      const go = (x) =>
        render(
          x ? html`<div foo=${disconnectingDirective(log)}></div>` : nothing,
          container
        );
      go(true);
      assert.isEmpty(log);
      go(false);
      assert.deepEqual(log, ['disconnected']);
    });

    test('deeply nested directives can be disconnected from AttributeParts', () => {
      const log = [];
      const go = (x) =>
        render(
          x
            ? html`${html`<div foo=${disconnectingDirective(log)}></div>`}`
            : nothing,
          container
        );
      go(true);
      assert.isEmpty(log);
      go(false);
      assert.deepEqual(log, ['disconnected']);
    });

    test('directives can be disconnected from iterables', () => {
      const log = [];
      const go = (items) =>
        render(
          items
            ? items.map(
                (item) =>
                  html`<div foo=${disconnectingDirective(log, item)}></div>`
              )
            : nothing,
          container
        );
      go(['0', '1', '2', '3']);
      assert.isEmpty(log);
      go(['0', '2']);
      assert.deepEqual(log, ['disconnected-2', 'disconnected-3']);
      log.length = 0;
      go(undefined);
      assert.deepEqual(log, ['disconnected-0', 'disconnected-2']);
    });

    test('directives can be disconnected from repeat', () => {
      const log = [];
      const go = (items) =>
        render(
          items
            ? repeat(
                items,
                (item) => item,
                (item) =>
                  html`<div foo=${disconnectingDirective(log, item)}></div>`
              )
            : nothing,
          container
        );
      go(['0', '1', '2', '3']);
      assert.isEmpty(log);
      go(['0', '2']);
      assert.deepEqual(log, ['disconnected-1', 'disconnected-3']);
      log.length = 0;
      go(undefined);
      assert.deepEqual(log, ['disconnected-0', 'disconnected-2']);
    });

    test('directives in ChildParts can be reconnected', () => {
      const log = [];
      const go = (left, right) => {
        return render(
          html`
            ${html`${html`${
              left ? disconnectingDirective(log, 'left') : nothing
            }`}`}
            ${html`${html`${
              right ? disconnectingDirective(log, 'right') : nothing
            }`}`}
          `,
          container
        );
      };
      const part = go(true, true);
      assert.isEmpty(log);
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left', 'disconnected-right']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left', 'reconnected-right']);
      log.length = 0;
      go(true, false);
      assert.deepEqual(log, ['disconnected-right']);
      log.length = 0;
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left']);
    });

    test('directives in AttributeParts can be reconnected', () => {
      const log = [];
      const go = (left, right) => {
        return render(
          html`
            ${html`${html`<div a=${
              left ? disconnectingDirective(log, 'left') : nothing
            }></div>`}`}
            ${html`${html`<div a=${
              right ? disconnectingDirective(log, 'right') : nothing
            }></div>`}`}
          `,
          container
        );
      };
      const part = go(true, true);
      assert.isEmpty(log);
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left', 'disconnected-right']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left', 'reconnected-right']);
      log.length = 0;
      go(true, false);
      assert.deepEqual(log, ['disconnected-right']);
      log.length = 0;
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left']);
    });

    test('directives in iterables can be reconnected', () => {
      const log = [];
      const go = (left, right) => {
        return render(
          html`
            ${html`${html`${left.map(
              (i) =>
                html`<div>${disconnectingDirective(log, `left-${i}`)}</div>`
            )}`}`}
            ${html`${html`${right.map(
              (i) =>
                html`<div>${disconnectingDirective(log, `right-${i}`)}</div>`
            )}`}`}
          `,
          container
        );
      };
      const part = go([0, 1], [0, 1]);
      assert.isEmpty(log);
      part.setConnected(false);
      assert.deepEqual(log, [
        'disconnected-left-0',
        'disconnected-left-1',
        'disconnected-right-0',
        'disconnected-right-1',
      ]);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, [
        'reconnected-left-0',
        'reconnected-left-1',
        'reconnected-right-0',
        'reconnected-right-1',
      ]);
      log.length = 0;
      go([0], []);
      assert.deepEqual(log, [
        'disconnected-left-1',
        'disconnected-right-0',
        'disconnected-right-1',
      ]);
      log.length = 0;
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left-0']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left-0']);
    });

    test('directives in repeat can be reconnected', () => {
      const log = [];
      const go = (left, right) => {
        return render(
          html`
            ${html`${html`${repeat(
              left,
              (i) =>
                html`<div>${disconnectingDirective(log, `left-${i}`)}</div>`
            )}`}`}
            ${html`${html`${repeat(
              right,
              (i) =>
                html`<div>${disconnectingDirective(log, `right-${i}`)}</div>`
            )}`}`}
          `,
          container
        );
      };
      const part = go([0, 1], [0, 1]);
      assert.isEmpty(log);
      part.setConnected(false);
      assert.deepEqual(log, [
        'disconnected-left-0',
        'disconnected-left-1',
        'disconnected-right-0',
        'disconnected-right-1',
      ]);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, [
        'reconnected-left-0',
        'reconnected-left-1',
        'reconnected-right-0',
        'reconnected-right-1',
      ]);
      log.length = 0;
      go([0], []);
      assert.deepEqual(log, [
        'disconnected-left-1',
        'disconnected-right-0',
        'disconnected-right-1',
      ]);
      log.length = 0;
      part.setConnected(false);
      assert.deepEqual(log, ['disconnected-left-0']);
      log.length = 0;
      part.setConnected(true);
      assert.deepEqual(log, ['reconnected-left-0']);
    });
  });

  // WebJs brands a template result with `_$webjs: 'template'` where Lit uses
  // `_$litType$`, so the spoof carries WebJs's brand: an object that arrived as
  // JSON must never render as markup.
  test(`don't render simple spoof template results`, () => {
    const spoof = {
      ['_$webjs']: 'template',
      strings: ['<div>spoofed string</div>'],
      values: [],
    };
    const template = html`<div>${spoof}</div>`;
    let threwError = false;
    try {
      render(template, container);
    } catch {
      threwError = true;
    }
    assert.equal(stripExpressionMarkers(container.innerHTML), '');
    assert.isTrue(
      threwError,
      `Expected an error when rendering a spoofed template result`
    );
  });
});
