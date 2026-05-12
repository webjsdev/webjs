/**
 * Browser tests for overlay @webjskit/ui components — components that
 * portal their content to document.body and use positioning. Runs in
 * real Chromium via WTR + Playwright.
 *
 * Covers: dialog, popover, tooltip, dropdown-menu, select.
 *
 * Note: overlay content is rendered into document.body via portal, so
 * we query document.body (not the root container) for the floating UI.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

/** Clean up any leftover portals from prior tests. */
function cleanupPortals() {
  document.body.querySelectorAll(
    '[data-slot="dialog-overlay"], [data-slot="dialog-content"], [data-slot="popover-content"], [data-slot="tooltip-content"], [data-slot="dropdown-menu-content"], [data-slot="select-content"]'
  ).forEach((el) => el.remove());
}

suite('ui-dialog', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dialog.ts`);
  });

  teardown(() => { cleanupPortals(); });

  test('trigger click opens dialog content', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-header>
            <ui-dialog-title>T</ui-dialog-title>
            <ui-dialog-description>D</ui-dialog-description>
          </ui-dialog-header>
        </ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const trigger = root.querySelector('ui-dialog-trigger');
    trigger.click();
    await tick();
    const dialog = root.querySelector('ui-dialog');
    assert.ok(dialog.open, 'dialog.open=true');
    const content = root.querySelector('[data-slot="dialog-content"]');
    assert.ok(content, 'dialog content rendered');
    root.remove();
  });

  test('escape key closes the dialog', async () => {
    const root = await mount(html`
      <ui-dialog open>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
        </ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const dialog = root.querySelector('ui-dialog');
    // First explicitly toggle open via the API to set up listeners
    dialog.setOpen(true);
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    assert.equal(dialog.open, false, 'escape closes dialog');
    root.remove();
  });

  test('clicking the overlay closes the dialog', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
        </ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const dialog = root.querySelector('ui-dialog');
    dialog.setOpen(true);
    await tick();
    const overlay = root.querySelector('[data-slot="dialog-overlay"]');
    assert.ok(overlay, 'overlay rendered when open');
    overlay.click();
    await tick();
    assert.equal(dialog.open, false);
    root.remove();
  });

  test('fires open-change event when toggling', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
        </ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const dialog = root.querySelector('ui-dialog');
    let detail = null;
    dialog.addEventListener('open-change', (e) => { detail = e.detail; });
    dialog.setOpen(true);
    await tick();
    assert.equal(detail?.open, true);
    root.remove();
  });

  test('dialog-content renders nothing when closed', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>O</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
        </ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const content = root.querySelector('[data-slot="dialog-content"]');
    assert.ok(!content, 'no content rendered when closed');
    root.remove();
  });
});

suite('ui-popover', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/popover.ts`);
  });

  teardown(() => { cleanupPortals(); });

  test('trigger click opens popover content (portal to body)', async () => {
    const root = await mount(html`
      <ui-popover>
        <ui-popover-trigger><button>Open</button></ui-popover-trigger>
        <ui-popover-content>Body</ui-popover-content>
      </ui-popover>
    `);
    await tick();
    root.querySelector('ui-popover-trigger').click();
    await tick();
    const pop = root.querySelector('ui-popover');
    assert.equal(pop.open, true);
    // portal lives in document.body, not root
    const portal = document.body.querySelector('[data-slot="popover-content"]');
    assert.ok(portal, 'popover portal rendered to body');
    root.remove();
  });

  test('clicking outside closes the popover', async () => {
    const root = await mount(html`
      <ui-popover>
        <ui-popover-trigger><button>Open</button></ui-popover-trigger>
        <ui-popover-content>Body</ui-popover-content>
      </ui-popover>
    `);
    await tick();
    const pop = root.querySelector('ui-popover');
    pop.setOpen(true);
    await tick();
    // Click an unrelated location
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await tick();
    assert.equal(pop.open, false);
    outside.remove();
    root.remove();
  });

  test('escape key closes the popover', async () => {
    const root = await mount(html`
      <ui-popover>
        <ui-popover-trigger><button>Open</button></ui-popover-trigger>
        <ui-popover-content>Body</ui-popover-content>
      </ui-popover>
    `);
    await tick();
    const pop = root.querySelector('ui-popover');
    pop.setOpen(true);
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    assert.equal(pop.open, false);
    root.remove();
  });

  test('open-change event fires on toggle', async () => {
    const root = await mount(html`
      <ui-popover>
        <ui-popover-trigger><button>Open</button></ui-popover-trigger>
        <ui-popover-content>Body</ui-popover-content>
      </ui-popover>
    `);
    await tick();
    const pop = root.querySelector('ui-popover');
    let detail = null;
    pop.addEventListener('open-change', (e) => { detail = e.detail; });
    pop.setOpen(true);
    await tick();
    assert.equal(detail?.open, true);
    root.remove();
  });

  test('trigger toggles open state', async () => {
    const root = await mount(html`
      <ui-popover>
        <ui-popover-trigger><button>Open</button></ui-popover-trigger>
        <ui-popover-content>Body</ui-popover-content>
      </ui-popover>
    `);
    await tick();
    const trigger = root.querySelector('ui-popover-trigger');
    const pop = root.querySelector('ui-popover');
    trigger.click();
    await tick();
    assert.equal(pop.open, true);
    trigger.click();
    await tick();
    assert.equal(pop.open, false);
    root.remove();
  });
});

suite('ui-tooltip', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/tooltip.ts`);
  });

  teardown(() => { cleanupPortals(); });

  test('tooltip is closed initially', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    await tick();
    const tip = root.querySelector('ui-tooltip');
    assert.equal(tip.open, false);
    root.remove();
  });

  test('setOpen(true) renders tooltip portal', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    await tick();
    const tip = root.querySelector('ui-tooltip');
    tip.setOpen(true);
    await tick();
    const portal = document.body.querySelector('[data-slot="tooltip-content"]');
    assert.ok(portal, 'tooltip portal rendered');
    assert.equal(portal.getAttribute('role'), 'tooltip');
    root.remove();
  });

  test('mouseleave/hide closes after open', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    await tick();
    const tip = root.querySelector('ui-tooltip');
    tip.setOpen(true);
    await tick();
    const trigger = root.querySelector('ui-tooltip-trigger');
    trigger.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    await tick();
    assert.equal(tip.open, false);
    root.remove();
  });

  test('content has tooltip styling classes', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>TipText</ui-tooltip-content>
      </ui-tooltip>
    `);
    await tick();
    root.querySelector('ui-tooltip').setOpen(true);
    await tick();
    const portal = document.body.querySelector('[data-slot="tooltip-content"]');
    assert.ok(portal);
    assert.match(portal.className, /bg-foreground/);
    root.remove();
  });

  test('provider passthrough does not block descendants', async () => {
    const root = await mount(html`
      <ui-tooltip-provider>
        <ui-tooltip>
          <ui-tooltip-trigger><button>x</button></ui-tooltip-trigger>
          <ui-tooltip-content>Tip</ui-tooltip-content>
        </ui-tooltip>
      </ui-tooltip-provider>
    `);
    await tick();
    const tip = root.querySelector('ui-tooltip');
    assert.ok(tip);
    tip.setOpen(true);
    await tick();
    assert.ok(document.body.querySelector('[data-slot="tooltip-content"]'));
    root.remove();
  });
});

suite('ui-dropdown-menu', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
  });

  teardown(() => { cleanupPortals(); });

  test('trigger click opens dropdown content (portal)', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    await tick();
    const dm = root.querySelector('ui-dropdown-menu');
    dm.setOpen(true);
    await tick();
    const portal = document.body.querySelector('[data-slot="dropdown-menu-content"]');
    assert.ok(portal);
    assert.equal(portal.getAttribute('role'), 'menu');
    root.remove();
  });

  test('arrow keys cycle highlighted item', async () => {
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
    await tick();
    const dm = root.querySelector('ui-dropdown-menu');
    dm.setOpen(true);
    await tick();
    const portal = document.body.querySelector('[data-slot="dropdown-menu-content"]');
    const items = portal.querySelectorAll('[data-slot="dropdown-menu-item"]');
    assert.ok(items.length >= 2);
    // First item should be focused after open
    items[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await tick();
    // Active element should now be items[1]
    assert.equal(document.activeElement, items[1]);
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
    await tick();
    const dm = root.querySelector('ui-dropdown-menu');
    dm.setOpen(true);
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    assert.equal(dm.open, false);
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
    await tick();
    const dm = root.querySelector('ui-dropdown-menu');
    dm.setOpen(true);
    await tick();
    const portal = document.body.querySelector('[data-slot="dropdown-menu-content"]');
    const item = portal.querySelector('[data-slot="dropdown-menu-item"]');
    item.click();
    await tick();
    assert.equal(dm.open, false);
    root.remove();
  });

  test('open-change event fires on toggle', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    await tick();
    const dm = root.querySelector('ui-dropdown-menu');
    let detail = null;
    dm.addEventListener('open-change', (e) => { detail = e.detail; });
    dm.setOpen(true);
    await tick();
    assert.equal(detail?.open, true);
    root.remove();
  });
});
