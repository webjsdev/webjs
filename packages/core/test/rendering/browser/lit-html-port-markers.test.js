/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/lit-html_test.ts`
 * (suite 'lit-html' > 'marker insertion', Lit commit b17fb144, #1686 Lit
 * conformance): TypeScript types stripped and imports swapped to WebJs,
 * otherwise case for case. `stripExpressionComments` / `stripExpressionMarkers`
 * strip WebJs's own `wjm-` marker comments instead of Lit's `lit$N$` ones, so
 * an author's own comment is still compared. Lit's `DEV_MODE` branches take the
 * production path, since WebJs has no `render.setSanitizer`.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { nothing } from '../../../src/sentinels.js';
import { assert } from '../../../../../test/browser-assert.js';

const stripExpressionComments = (s) => s.replace(/<!--wjm-[\s\S]*?-->/g, '');
const stripExpressionMarkers = stripExpressionComments;

suite('lit-html (lit port): marker insertion', () => {
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

  test('only text', () => {
    assertRender(html`${'A'}`, 'A');
  });

  test('attribute-like text', () => {
    assertRender(html`a=${'A'}`, 'a=A');
  });

  test('< in text', () => {
    assertRender(html`a < ${'b'}`, 'a &lt; b');
  });

  test('after tag-like in text', () => {
    assertRender(html`a <1a> ${'b'}`, 'a &lt;1a&gt; b');
    assertRender(html`a <-a> ${'b'}`, 'a &lt;-a&gt; b');
    assertRender(html`a <:a> ${'b'}`, 'a &lt;:a&gt; b');
  });

  test('text child', () => {
    assertRender(html`<div>${'A'}</div>`, '<div>A</div>');
  });

  test('text child of various tag names', () => {
    assertRender(html`<x-foo>${'A'}</x-foo>`, '<x-foo>A</x-foo>');
    assertRender(html`<x=foo>${'A'}</x=foo>`, '<x=foo>A</x=foo>');
    assertRender(html`<x:foo>${'A'}</x:foo>`, '<x:foo>A</x:foo>');
    assertRender(html`<x1>${'A'}</x1>`, '<x1>A</x1>');
  });

  test('text after self-closing tag', () => {
    assertRender(html`<input />${'A'}`, '<input>A');
    assertRender(
      html`<!-- @ts-ignore --><x-foo />${'A'}`,
      '<!-- @ts-ignore --><x-foo>A</x-foo>'
    );
  });

  test('text child of element with unbound quoted attribute', () => {
    assertRender(html`<div a="b">${'d'}</div>`, '<div a="b">d</div>');

    render(html`<script a="b" type="foo">${'d'}</script>`, container);
    assert.include(
      [
        '<script a="b" type="foo">d</script>',
        '<script type="foo" a="b">d</script>',
      ],
      stripExpressionComments(container.innerHTML)
    );
  });

  test('text child of element with unbound unquoted attribute', () => {
    assertRender(html`<div a=b>${'d'}</div>`, '<div a="b">d</div>');

    render(html`<script a=b type="foo">${'d'}</script>`, container);
    assert.include(
      [
        '<script a="b" type="foo">d</script>',
        '<script type="foo" a="b">d</script>',
      ],
      stripExpressionComments(container.innerHTML)
    );
  });

  test('renders parts with whitespace after them', () => {
    assertRender(html`<div>${'foo'} </div>`, '<div>foo </div>');
  });

  test('renders parts that look like attributes', () => {
    assertRender(html`<div>foo bar=${'baz'}</div>`, '<div>foo bar=baz</div>');
  });

  test('renders multiple parts per element, preserving whitespace', () => {
    assertRender(html`<div>${'foo'} ${'bar'}</div>`, '<div>foo bar</div>');
  });

  test('renders templates with comments', () => {
    assertRender(
      html`
        <div>
          <!-- this is a comment -->
          <h1 class="${'foo'}">title</h1>
          <p>${'foo'}</p>
        </div>`,
      `
        <div>
          <!-- this is a comment -->
          <h1 class="foo">title</h1>
          <p>foo</p>
        </div>`
    );
  });

  test('text after element', () => {
    assertRender(html`<div></div>${'A'}`, '<div></div>A');
  });

  test('renders next templates with preceding elements', () => {
    assertRender(
      html`<a>${'foo'}</a>${html`<h1>${'bar'}</h1>`}`,
      '<a>foo</a><h1>bar</h1>'
    );
  });

  test('renders expressions with preceding elements', () => {
    // This is nearly the same test case as above, but was causing a
    // different stack trace
    assertRender(html`<a>${'foo'}</a>${'bar'}`, '<a>foo</a>bar');
  });

  test('text in raw text elements', () => {
    assertRender(
      html`<script type="foo">${'A'}</script>`,
      '<script type="foo">A</script>'
    );
    assertRender(html`<style>${'A'}</style>`, '<style>A</style>');
    assertRender(html`<title>${'A'}</title>`, '<title>A</title>');
    assertRender(html`<textarea>${'A'}</textarea>`, '<textarea>A</textarea>');
  });

  test('text in raw text element after <', () => {
    // It doesn't matter much what marker we use in <script>, <style> and
    // <textarea> since comments aren't parsed and we have to search the text
    // anyway.
    assertRender(
      html`<script type="foo">i < j ${'A'}</script>`,
      '<script type="foo">i < j A</script>'
    );
  });

  test('text in raw text element after >', () => {
    assertRender(
      html`<script type="foo">i > j ${'A'}</script>`,
      '<script type="foo">i > j A</script>'
    );
  });

  test('text in raw text element inside tag-like string', () => {
    assertRender(
      html`<script type="foo">"<div a=${'A'}></div>";</script>`,
      '<script type="foo">"<div a=A></div>";</script>'
    );
  });

  test('renders inside <script>: only node', () => {
    assertRender(
      html`<script type="foo">${'foo'}</script>`,
      '<script type="foo">foo</script>'
    );
  });

  test('renders inside <script>: first node', () => {
    assertRender(
      html`<script type="foo">${'foo'}A</script>`,
      '<script type="foo">fooA</script>'
    );
  });

  test('renders inside <script>: last node', () => {
    assertRender(
      html`<script type="foo">A${'foo'}</script>`,
      '<script type="foo">Afoo</script>'
    );
  });

  test('renders inside <script>: multiple bindings', () => {
    assertRender(
      html`<script type="foo">A${'foo'}B${'bar'}C</script>`,
      '<script type="foo">AfooBbarC</script>'
    );
  });

  test('renders inside <script>: attribute-like', () => {
    assertRender(
      html`<script type="foo">a=${'foo'}</script>`,
      '<script type="foo">a=foo</script>'
    );
  });

  test('text after script element', () => {
    assertRender(html`<script></script>${'A'}`, '<script></script>A');
  });

  test('text after script element with binding', () => {
    assertRender(
      html`<script type="foo">${'A'}</script>${'B'}`,
      '<script type="foo">A</script>B'
    );
    assertRender(
      html`<script type="foo">1${'A'}</script>${'B'}`,
      '<script type="foo">1A</script>B'
    );
    assertRender(
      html`<script type="foo">${'A'}1</script>${'B'}`,
      '<script type="foo">A1</script>B'
    );
    assertRender(
      html`<script type="foo">${'A'}${'B'}</script>${'C'}`,
      '<script type="foo">AB</script>C'
    );
    assertRender(
      html`<script type="foo">${'A'}</script><p>${'B'}</p>`,
      '<script type="foo">A</script><p>B</p>'
    );
  });

  test('text after style element', () => {
    assertRender(html`<style></style>${'A'}`, '<style></style>A');
  });

  test('text inside raw text element, after different raw tag', () => {
    assertRender(
      html`<script type="foo"><style></style>"<div a=${'A'}></div>"</script>`,
      '<script type="foo"><style></style>"<div a=A></div>"</script>'
    );
  });

  test('text inside raw text element, after different raw end tag', () => {
    assertRender(
      html`<script type="foo"></style>"<div a=${'A'}></div>"</script>`,
      '<script type="foo"></style>"<div a=A></div>"</script>'
    );
  });

  test('renders inside raw-like element', () => {
    assertRender(html`<scriptx>${'foo'}</scriptx>`, '<scriptx>foo</scriptx>');
  });

  test('attribute after raw text element', () => {
    assertRender(
      html`<script></script><div a=${'A'}></div>`,
      '<script></script><div a="A"></div>'
    );
  });

  test('unquoted attribute', () => {
    assertRender(html`<div a=${'A'}></div>`, '<div a="A"></div>');
    assertRender(html`<div abc=${'A'}></div>`, '<div abc="A"></div>');
    assertRender(html`<div abc = ${'A'}></div>`, '<div abc="A"></div>');
    assertRender(html`<input value=${'A'}/>`, '<input value="A">');
    assertRender(html`<input value=${'A'}${'B'}/>`, '<input value="AB">');
  });

  test('quoted attribute', () => {
    assertRender(html`<div a="${'A'}"></div>`, '<div a="A"></div>');
    assertRender(html`<div abc="${'A'}"></div>`, '<div abc="A"></div>');
    assertRender(html`<div abc = "${'A'}"></div>`, '<div abc="A"></div>');
    assertRender(html`<div abc="${'A'}/>"></div>`, [
      '<div abc="A/>"></div>',
      '<div abc="A/&gt;"></div>',
    ]);
    assertRender(html`<input value="${'A'}"/>`, '<input value="A">');
  });

  test('second quoted attribute', () => {
    assertRender(
      html`<div a="b" c="${'A'}"></div>`,
      '<div a="b" c="A"></div>'
    );
  });

  test('two quoted attributes', () => {
    assertRender(
      html`<div a="${'A'}" b="${'A'}"></div>`,
      '<div a="A" b="A"></div>'
    );
  });

  test('two unquoted attributes', () => {
    assertRender(
      html`<div a=${'A'} b=${'A'}></div>`,
      '<div a="A" b="A"></div>'
    );
  });

  test('quoted attribute multi', () => {
    assertRender(html`<div a="${'A'} ${'A'}"></div>`, '<div a="A A"></div>');
  });

  test('quoted attribute with markup', () => {
    assertRender(html`<div a="<table>${'A'}"></div>`, [
      '<div a="<table>A"></div>',
      '<div a="&lt;table&gt;A"></div>',
    ]);
  });

  test('text after quoted bound attribute', () => {
    assertRender(html`<div a="${'A'}">${'A'}</div>`, '<div a="A">A</div>');
    assertRender(
      html`<script type="foo" a="${'A'}">${'A'}</script>`,
      '<script type="foo" a="A">A</script>'
    );
  });

  test('text after unquoted bound attribute', () => {
    assertRender(html`<div a=${'A'}>${'A'}</div>`, '<div a="A">A</div>');
    assertRender(
      html`<script type="foo" a=${'A'}>${'A'}</script>`,
      '<script type="foo" a="A">A</script>'
    );
  });

  test('inside start tag', () => {
    assertRender(html`<div ${`a`}></div>`, '<div></div>');
  });

  test('inside start tag x2', () => {
    // We don't support multiple attribute-position bindings yet, so just
    // ensure this parses ok
    assertRender(html`<div ${`a`} ${`a`}></div>`, '<div></div>');
  });

  test('inside start tag after quoted attribute', () => {
    assertRender(html`<div a="b" ${`c`}></div>`, '<div a="b"></div>');
    assertRender(
      html`<script a="b" ${`c`}></script>`,
      '<script a="b"></script>'
    );
  });

  test('inside start tag after unquoted attribute', () => {
    // prettier-ignore
    assertRender(html`<div a=b ${`c`}></div>`, '<div a="b"></div>');
  });

  test('inside start tag before unquoted attribute', () => {
    // bound attributes always appear after static attributes
    assertRender(html`<div ${`c`} a="b"></div>`, '<div a="b"></div>');
  });

  test('inside start tag before quoted attribute', () => {
    // bound attributes always appear after static attributes
    assertRender(html`<div ${`c`} a="b"></div>`, '<div a="b"></div>');
  });

  // Lit's own note on this suite calls the output for these malformed
  // templates undefined, and its production build answers `<></>`, which is
  // its `lit$N$` tag name with the marker stripped. WebJs binds nothing there
  // and the static markup parses the way the HTML parser reads it, so these
  // assert that parse: no crash, no rendered value, no leaked marker.
  test('"dynamic" tag name', () => {
    const template = html`<${'A'}></${'A'}>`;
    render(template, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '&lt;&gt;');
  });

  test('malformed "dynamic" tag name', () => {
    // `</ ` starts a comment
    const template = html`<${'A'}></ ${'A'}>`;
    render(template, container);
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '&lt;&gt;<!-- -->'
    );
  });

  test('binding after end tag name', () => {
    // we don't really care what the syntax position is here
    assertRender(html`<div></div ${'A'}>`, '<div></div>');
  });

  test('comment', () => {
    render(html`<!--${'A'}-->`, container);
    // Lit leaves an empty comment where the binding sat, plus its own part
    // marker; WebJs drops a hole inside a comment, so only the author's
    // (now empty) comment is left once the markers are stripped.
    assert.equal(stripExpressionMarkers(container.innerHTML), '<!---->');
  });

  test('comment with attribute-like content', () => {
    render(html`<!-- a=${'A'}-->`, container);
    assert.equal(stripExpressionMarkers(container.innerHTML), '<!-- a=-->');
  });

  test('comment with element-like content', () => {
    render(html`<!-- <div>${'A'}</div> -->`, container);
    assert.equal(
      stripExpressionMarkers(container.innerHTML),
      '<!-- <div></div> -->'
    );
  });

  test('text after comment', () => {
    assertRender(html`<!-- -->${'A'}`, '<!-- -->A');
  });

  // TODO real divergence: render() owns the whole container (replaceChildren), so it neither keeps existing children nor supports options.renderBefore.
  test.skip('renders after existing content', () => {
    container.appendChild(document.createElement('div'));
    assertRender(html`<span></span>`, '<div></div><span></span>');
  });

  // TODO real divergence: render() owns the whole container (replaceChildren), so it neither keeps existing children nor supports options.renderBefore.
  test.skip('renders/updates before `renderBefore`, if specified', () => {
    const renderBefore = container.appendChild(document.createElement('div'));
    const template = html`<span></span>`;
    assertRender(template, '<span></span><div></div>', {
      renderBefore,
    });
    // Ensure re-render updates rather than re-rendering.
    const containerChildNodes = Array.from(container.childNodes);
    assertRender(template, '<span></span><div></div>', {
      renderBefore,
    });
    assert.sameMembers(Array.from(container.childNodes), containerChildNodes);
  });

  // TODO real divergence: render() owns the whole container (replaceChildren), so it neither keeps existing children nor supports options.renderBefore.
  test.skip('renders/updates same template before different `renderBefore` nodes', () => {
    const renderBefore1 = container.appendChild(document.createElement('div'));
    const renderBefore2 = container.appendChild(document.createElement('div'));
    const template = html`<span></span>`;
    assertRender(template, '<span></span><div></div><div></div>', {
      renderBefore: renderBefore1,
    });
    const renderedNode1 = container.querySelector('span');
    assertRender(
      template,
      '<span></span><div></div><span></span><div></div>',
      { renderBefore: renderBefore2 }
    );
    const renderedNode2 = container.querySelector('span:last-of-type');
    // Ensure updates are handled as expected.
    assertRender(
      template,
      '<span></span><div></div><span></span><div></div>',
      { renderBefore: renderBefore1 }
    );
    assert.equal(container.querySelector('span'), renderedNode1);
    assert.equal(container.querySelector('span:last-of-type'), renderedNode2);
    assertRender(
      template,
      '<span></span><div></div><span></span><div></div>',
      { renderBefore: renderBefore2 }
    );
    assert.equal(container.querySelector('span'), renderedNode1);
    assert.equal(container.querySelector('span:last-of-type'), renderedNode2);
  });

  // TODO real divergence: render() owns the whole container (replaceChildren), so it neither keeps existing children nor supports options.renderBefore.
  test.skip('renders/updates when specifying `renderBefore` node or not', () => {
    const template = html`<span></span>`;
    const renderBefore = container.appendChild(document.createElement('div'));
    assertRender(template, '<div></div><span></span>');
    const containerRenderedNode = container.querySelector('span');
    assertRender(template, '<span></span><div></div><span></span>', {
      renderBefore,
    });
    const beforeRenderedNode = container.querySelector('span');
    // Ensure re-render updates rather than re-rendering.
    assertRender(template, '<span></span><div></div><span></span>');
    assert.equal(
      container.querySelector('span:last-of-type'),
      containerRenderedNode
    );
    assert.equal(container.querySelector('span'), beforeRenderedNode);
    assertRender(template, '<span></span><div></div><span></span>', {
      renderBefore,
    });
    assert.equal(
      container.querySelector('span:last-of-type'),
      containerRenderedNode
    );
    assert.equal(container.querySelector('span'), beforeRenderedNode);
  });

  test('back-to-back expressions', () => {
    const template = (a, b) => html`${html`${a}`}${html`${b}`}`;
    assertRender(template('a', 'b'), 'ab');
    assertRender(template(nothing, 'b'), 'b');
    assertRender(template(nothing, nothing), '');
    assertRender(template('a', 'b'), 'ab');
  });
});
