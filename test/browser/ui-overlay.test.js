/**
 * Browser tests for overlay Tier-2 @webjskit/ui custom elements that
 * remain: dropdown-menu. Runs in real Chromium via WTR + Playwright.
 *
 * What moved to Tier 1 (and is now covered by
 * packages/ui/test/class-helpers.test.js, not here):
 *   popover, dialog, alert-dialog, tooltip, hover-card, progress, toggle.
 *
 * API conventions for the remaining Tier-2 component:
 *   - State lives on the `open` HTML attribute, so `el.hasAttribute('open')`
 *     is the canonical read.
 *   - `el.show()` / `el.hide()` / `el.toggle()`: programmatic control.
 *   - Content is rendered INLINE as `:scope > ui-X-content` (not portaled to
 *     document.body). Visibility is controlled by the native Popover API
 *     plus the registered display rule for the pre-hydration window.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${s} to match ${re}`); },
};

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

suite('ui-dropdown-menu', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
  });

  test('show() opens content and content has role="menu"', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    assert.ok(dm.hasAttribute('open'));
    const content = dm.querySelector(':scope > ui-dropdown-menu-content');
    assert.ok(content);
    assert.equal(content.getAttribute('role'), 'menu');
    dm.hide();
    root.remove();
  });

  test('ArrowDown cycles focus across items', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Three</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    const items = root.querySelectorAll('ui-dropdown-menu-item');
    assert.ok(items.length >= 2);
    items[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await tick();
    assert.equal(document.activeElement, items[1]);
    dm.hide();
    root.remove();
  });

  test('escape closes the dropdown', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });

  test('clicking an item closes the menu', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    const item = root.querySelector('ui-dropdown-menu-item');
    item.click();
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });

  test('trigger click toggles open', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    const trigger = root.querySelector('ui-dropdown-menu-trigger');
    trigger.click();
    await tick();
    assert.equal(dm.hasAttribute('open'), true);
    trigger.click();
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });
});

