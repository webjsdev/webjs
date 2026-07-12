/**
 * Regression guard for the host display:block default's CASCADE behavior.
 *
 * The framework injects one head rule so a component host is not the default
 * `display: inline` (which collapses a block-container component):
 *
 *   @layer webjs-host { :where([data-wj-host]) { display: block } }
 *
 * It MUST live in a dedicated `@layer` declared FIRST, so it is the lowest
 * cascade layer. The original version was UNLAYERED, and unlayered declarations
 * beat layered ones regardless of specificity, so `:where([data-wj-host])`
 * (zero specificity) silently overrode Tailwind's `class="flex"` (which lives in
 * `@layer utilities`), collapsing every flex/grid component host to block. A
 * node test cannot catch this (no real cascade), so this browser test pins it:
 *
 *   1. an unstyled host still defaults to block (beats the UA `inline`),
 *   2. a host with a LAYERED utility (`.flex` in `@layer utilities`) renders
 *      flex (the utility layer beats webjs-host), and
 *   3. an explicit author `display` (unlayered / inline style) wins.
 *
 * This is the exact shape the framework head rule + Tailwind v4 produce.
 */

const assert = {
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('host display:block default (cascade layer)', () => {
  let style;
  setup(() => {
    // Reproduce the real document: the framework's layered host rule declared
    // FIRST (lowest layer), then Tailwind-style layered utilities.
    style = document.createElement('style');
    // The exact shipped rule (layered host default + [hidden] carve-out) declared
    // FIRST (lowest layer), then Tailwind-style layered utilities.
    style.textContent = `
      @layer webjs-host { :where([data-wj-host]) { display: block } :where([data-wj-host][hidden]) { display: none } }
      @layer utilities { .flex { display: flex } .hidden { display: none } }
    `;
    document.head.appendChild(style);
  });
  teardown(() => { style.remove(); });

  function hostWith(attrs) {
    const el = document.createElement('x-cascade-host');
    el.setAttribute('data-wj-host', '');
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    document.body.appendChild(el);
    const display = getComputedStyle(el).display;
    el.remove();
    return display;
  }

  test('an unstyled host defaults to block (beats the UA inline default)', () => {
    assert.equal(hostWith({}), 'block', 'unstyled host should be block');
  });

  test('a LAYERED utility on the host wins over the host default (the bug)', () => {
    assert.equal(hostWith({ class: 'flex' }), 'flex', 'class="flex" must win, not collapse to block');
    assert.equal(hostWith({ class: 'hidden' }), 'none', 'class="hidden" must win');
  });

  test('an explicit author display (inline style) wins', () => {
    assert.equal(hostWith({ style: 'display:inline' }), 'inline', 'author inline style must win');
  });

  test('a [hidden] host is still hidden (the carve-out)', () => {
    // display:none from the same-layer [hidden] carve-out must win over the block
    // default, so `?hidden=${cond}` / el.hidden actually hides a component host.
    assert.equal(hostWith({ hidden: '' }), 'none', 'a hidden host must be display:none');
  });

  test("a shadow host (NOT marked) keeps its own :host{display}", () => {
    // Shadow hosts are deliberately NOT stamped with data-wj-host, so the document
    // rule never applies and the shadow tree's :host wins. Simulate: an UNMARKED
    // host with a shadow :host{display:flex}. If the framework wrongly marked it,
    // the document rule would clobber :host to block.
    const el = document.createElement('x-shadow-host');
    const root = el.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:flex}</style><span>x</span>';
    document.body.appendChild(el);
    const marked = el.hasAttribute('data-wj-host');
    const display = getComputedStyle(el).display;
    el.remove();
    assert.equal(marked, false, 'a shadow host must not carry data-wj-host');
    assert.equal(display, 'flex', "the shadow tree's :host{display:flex} must win");
  });
});
