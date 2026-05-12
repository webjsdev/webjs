/**
 * Browser tests for visual-only @webjskit/ui components — no internal state,
 * just attribute → DOM reflection. Runs in real Chromium via WTR + Playwright.
 *
 * Covers: button, badge, separator, skeleton, spinner, label, kbd, aspect-ratio.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${s} to match ${re}`); },
  notMatch: (s, re, msg) => { if (re.test(s)) throw new Error(msg || `Expected ${s} NOT to match ${re}`); },
};

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

/** Mount a template into the document, wait for component upgrade, return root. */
async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  // Wait two RAFs so connectedCallback + first render flushes.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return root;
}

suite('ui-button', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/button.ts`);
  });

  test('renders an inner <button> with default variant classes', async () => {
    const root = await mount(html`<ui-button>Click</ui-button>`);
    const host = root.querySelector('ui-button');
    assert.ok(host, 'ui-button host exists');
    const inner = host.querySelector('button');
    assert.ok(inner, 'inner <button> rendered');
    assert.match(inner.className, /bg-primary/);
    assert.equal(inner.getAttribute('data-slot'), 'button');
    root.remove();
  });

  test('variant attribute is reflected on the inner button class', async () => {
    const root = await mount(html`<ui-button variant="destructive">x</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.match(inner.className, /bg-destructive/);
    assert.equal(inner.getAttribute('data-variant'), 'destructive');
    root.remove();
  });

  test('size attribute is reflected via data-size and class string', async () => {
    const root = await mount(html`<ui-button size="lg">L</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.equal(inner.getAttribute('data-size'), 'lg');
    assert.match(inner.className, /h-10/);
    root.remove();
  });

  test('outline variant produces outline classes', async () => {
    const root = await mount(html`<ui-button variant="outline">o</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.match(inner.className, /border/);
    root.remove();
  });

  test('ghost variant produces hover classes only (no bg-primary)', async () => {
    const root = await mount(html`<ui-button variant="ghost">g</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.match(inner.className, /hover:bg-accent/);
    assert.notMatch(inner.className, /bg-primary/);
    root.remove();
  });

  test('clicking inner button bubbles a click event from the host', async () => {
    const root = await mount(html`<ui-button>Click</ui-button>`);
    const host = root.querySelector('ui-button');
    let clicks = 0;
    host.addEventListener('click', () => { clicks++; });
    host.querySelector('button').click();
    assert.equal(clicks, 1, 'click bubbles to host');
    root.remove();
  });

  test('disabled attribute disables inner button', async () => {
    const root = await mount(html`<ui-button disabled>off</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.ok(inner.hasAttribute('disabled'));
    root.remove();
  });

  test('size icon-sm produces square sizing classes', async () => {
    const root = await mount(html`<ui-button size="icon-sm">x</ui-button>`);
    const inner = root.querySelector('ui-button button');
    assert.equal(inner.getAttribute('data-size'), 'icon-sm');
    assert.match(inner.className, /size-8/);
    root.remove();
  });
});

suite('ui-badge', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/badge.ts`);
  });

  test('renders an inner <span> with default variant', async () => {
    const root = await mount(html`<ui-badge>new</ui-badge>`);
    const inner = root.querySelector('ui-badge span');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-slot'), 'badge');
    assert.match(inner.className, /bg-primary/);
    root.remove();
  });

  test('variant="secondary" reflects via class string', async () => {
    const root = await mount(html`<ui-badge variant="secondary">s</ui-badge>`);
    const inner = root.querySelector('ui-badge span');
    assert.match(inner.className, /bg-secondary/);
    root.remove();
  });

  test('variant="destructive" reflects via class string', async () => {
    const root = await mount(html`<ui-badge variant="destructive">d</ui-badge>`);
    const inner = root.querySelector('ui-badge span');
    assert.match(inner.className, /bg-destructive/);
    root.remove();
  });

  test('variant="outline" omits bg-primary', async () => {
    const root = await mount(html`<ui-badge variant="outline">o</ui-badge>`);
    const inner = root.querySelector('ui-badge span');
    assert.notMatch(inner.className, /bg-primary/);
    root.remove();
  });

  test('slotted text content survives capture/re-emit', async () => {
    const root = await mount(html`<ui-badge>hello world</ui-badge>`);
    const inner = root.querySelector('ui-badge span');
    assert.match(inner.textContent, /hello world/);
    root.remove();
  });
});

suite('ui-separator', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/separator.ts`);
  });

  test('default orientation is horizontal', async () => {
    const root = await mount(html`<ui-separator></ui-separator>`);
    const inner = root.querySelector('ui-separator div');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-orientation'), 'horizontal');
    assert.equal(inner.getAttribute('aria-orientation'), 'horizontal');
    root.remove();
  });

  test('orientation="vertical" reflects to data-orientation', async () => {
    const root = await mount(html`<ui-separator orientation="vertical"></ui-separator>`);
    const inner = root.querySelector('ui-separator div');
    assert.equal(inner.getAttribute('data-orientation'), 'vertical');
    assert.equal(inner.getAttribute('aria-orientation'), 'vertical');
    root.remove();
  });

  test('decorative (default true) uses role="none"', async () => {
    const root = await mount(html`<ui-separator></ui-separator>`);
    const inner = root.querySelector('ui-separator div');
    assert.equal(inner.getAttribute('role'), 'none');
    root.remove();
  });

  test('renders an inner div with bg-border class', async () => {
    const root = await mount(html`<ui-separator></ui-separator>`);
    const inner = root.querySelector('ui-separator div');
    assert.match(inner.className, /bg-border/);
    root.remove();
  });
});

suite('ui-skeleton', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/skeleton.ts`);
  });

  test('renders an empty animated div', async () => {
    const root = await mount(html`<ui-skeleton></ui-skeleton>`);
    const inner = root.querySelector('ui-skeleton div');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-slot'), 'skeleton');
    root.remove();
  });

  test('div has animate-pulse class', async () => {
    const root = await mount(html`<ui-skeleton></ui-skeleton>`);
    const inner = root.querySelector('ui-skeleton div');
    assert.match(inner.className, /animate-pulse/);
    root.remove();
  });

  test('div has rounded-md class', async () => {
    const root = await mount(html`<ui-skeleton></ui-skeleton>`);
    const inner = root.querySelector('ui-skeleton div');
    assert.match(inner.className, /rounded-md/);
    root.remove();
  });

  test('div has bg-accent class', async () => {
    const root = await mount(html`<ui-skeleton></ui-skeleton>`);
    const inner = root.querySelector('ui-skeleton div');
    assert.match(inner.className, /bg-accent/);
    root.remove();
  });
});

suite('ui-spinner', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/spinner.ts`);
  });

  test('renders an SVG with role="status"', async () => {
    const root = await mount(html`<ui-spinner></ui-spinner>`);
    const svg = root.querySelector('ui-spinner svg');
    assert.ok(svg);
    assert.equal(svg.getAttribute('role'), 'status');
    root.remove();
  });

  test('svg has data-slot="spinner"', async () => {
    const root = await mount(html`<ui-spinner></ui-spinner>`);
    const svg = root.querySelector('ui-spinner svg');
    assert.equal(svg.getAttribute('data-slot'), 'spinner');
    root.remove();
  });

  test('svg has animate-spin class', async () => {
    const root = await mount(html`<ui-spinner></ui-spinner>`);
    const svg = root.querySelector('ui-spinner svg');
    assert.match(svg.getAttribute('class') || '', /animate-spin/);
    root.remove();
  });

  test('svg has aria-label="Loading" for accessibility', async () => {
    const root = await mount(html`<ui-spinner></ui-spinner>`);
    const svg = root.querySelector('ui-spinner svg');
    assert.equal(svg.getAttribute('aria-label'), 'Loading');
    root.remove();
  });

  test('renders inner <path> describing the arc', async () => {
    const root = await mount(html`<ui-spinner></ui-spinner>`);
    const path = root.querySelector('ui-spinner svg path');
    assert.ok(path);
    root.remove();
  });
});

suite('ui-label', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/label.ts`);
  });

  test('renders a <label> element', async () => {
    const root = await mount(html`<ui-label>Name</ui-label>`);
    const lab = root.querySelector('ui-label label');
    assert.ok(lab);
    assert.equal(lab.getAttribute('data-slot'), 'label');
    root.remove();
  });

  test('htmlFor attribute (as "for") reflects to inner for=', async () => {
    const root = await mount(html`<ui-label for="email">Email</ui-label>`);
    const lab = root.querySelector('ui-label label');
    assert.equal(lab.getAttribute('for'), 'email');
    root.remove();
  });

  test('when no for is set, inner label has no for attribute', async () => {
    const root = await mount(html`<ui-label>just text</ui-label>`);
    const lab = root.querySelector('ui-label label');
    assert.ok(!lab.hasAttribute('for'));
    root.remove();
  });

  test('slotted text content survives capture/re-emit', async () => {
    const root = await mount(html`<ui-label>Hello</ui-label>`);
    const lab = root.querySelector('ui-label label');
    assert.match(lab.textContent, /Hello/);
    root.remove();
  });
});

suite('ui-kbd', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/kbd.ts`);
  });

  test('renders an inner <kbd> element with data-slot="kbd"', async () => {
    const root = await mount(html`<ui-kbd>K</ui-kbd>`);
    const k = root.querySelector('ui-kbd kbd');
    assert.ok(k);
    assert.equal(k.getAttribute('data-slot'), 'kbd');
    root.remove();
  });

  test('renders text content from slot', async () => {
    const root = await mount(html`<ui-kbd>Ctrl+K</ui-kbd>`);
    const k = root.querySelector('ui-kbd kbd');
    assert.match(k.textContent, /Ctrl\+K/);
    root.remove();
  });

  test('has bg-muted styling class', async () => {
    const root = await mount(html`<ui-kbd>K</ui-kbd>`);
    const k = root.querySelector('ui-kbd kbd');
    assert.match(k.className, /bg-muted/);
    root.remove();
  });

  test('ui-kbd-group renders with data-slot="kbd-group"', async () => {
    const root = await mount(html`<ui-kbd-group><ui-kbd>A</ui-kbd></ui-kbd-group>`);
    const g = root.querySelector('ui-kbd-group kbd');
    assert.ok(g);
    assert.equal(g.getAttribute('data-slot'), 'kbd-group');
    root.remove();
  });
});

suite('ui-aspect-ratio', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/aspect-ratio.ts`);
  });

  test('renders an inner div with style.aspectRatio set', async () => {
    const root = await mount(html`<ui-aspect-ratio ratio="1.7777"><img src="" alt=""/></ui-aspect-ratio>`);
    const inner = root.querySelector('ui-aspect-ratio div');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-slot'), 'aspect-ratio');
    // style.aspectRatio is parsed; the inline style attribute contains 1.7777
    assert.match(inner.getAttribute('style') || '', /aspect-ratio/);
    root.remove();
  });

  test('default ratio is 1 (square)', async () => {
    const root = await mount(html`<ui-aspect-ratio></ui-aspect-ratio>`);
    const inner = root.querySelector('ui-aspect-ratio div');
    assert.match(inner.getAttribute('style') || '', /aspect-ratio:\s*1/);
    root.remove();
  });

  test('renders children via slotted content', async () => {
    const root = await mount(html`<ui-aspect-ratio ratio="2"><span class="inside">hi</span></ui-aspect-ratio>`);
    const child = root.querySelector('ui-aspect-ratio .inside');
    assert.ok(child);
    root.remove();
  });

  test('has w-full class on inner div', async () => {
    const root = await mount(html`<ui-aspect-ratio></ui-aspect-ratio>`);
    const inner = root.querySelector('ui-aspect-ratio div');
    assert.match(inner.className, /w-full/);
    root.remove();
  });
});
