/**
 * Browser tests for overlay Tier-2 @webjskit/ui custom elements: dialog,
 * popover, tooltip, dropdown-menu. Runs in real Chromium via WTR + Playwright.
 *
 * API conventions across all four (mirror what they actually implement, not
 * what shadcn's React API looks like):
 *   - `el.isOpen`: boolean getter (popover, dialog, tooltip). For dropdown-
 *     menu and collapsible the state lives on the `open` HTML attribute, so
 *     `el.hasAttribute('open')` is the canonical read.
 *   - `el.show()` / `el.hide()` / `el.toggle()`: programmatic control.
 *   - Event `ui-open-change` with `detail: { open }`: fires from dialog,
 *     popover, and collapsible. Tooltip and dropdown-menu do NOT emit this
 *     today, so tests for those use post-action state assertions instead.
 *   - Content is rendered INLINE as `:scope > ui-X-content` (not portaled to
 *     document.body). Visibility is controlled by CSS:
 *     `ui-X:not([open]) ui-X-content { display: none !important; }`. So
 *     queries always go through the host element / root, not document.body.
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

suite('ui-dialog', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dialog.ts`);
  });

  test('trigger click opens dialog', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
          <ui-dialog-description>D</ui-dialog-description>
        </ui-dialog-content>
      </ui-dialog>
    `);
    const trigger = root.querySelector('ui-dialog-trigger');
    trigger.click();
    await tick();
    const dialog = root.querySelector('ui-dialog');
    assert.equal(dialog.isOpen, true, 'dialog.isOpen=true after trigger click');
    assert.equal(dialog.getAttribute('data-state'), 'open');
    dialog.hide();
    root.remove();
  });

  test('native close event on the inner <dialog> closes the host (escape path)', async () => {
    // The WebComponent dialog wires the host's open state to the native
    // <dialog> element's `close` event. In a real browser, pressing Escape
    // while the modal is open fires `cancel` then `close` on the native
    // dialog. We simulate that final close (the UA-internal step) by
    // dispatching a synthetic close event on the native dialog element.
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    const dialog = root.querySelector('ui-dialog');
    dialog.show();
    await tick();
    const nativeDialog = dialog.querySelector('dialog[data-slot="dialog-native"]');
    nativeDialog.dispatchEvent(new Event('close'));
    await tick();
    assert.equal(dialog.isOpen, false, 'host closes when native dialog fires close');
    root.remove();
  });

  test('fires ui-open-change event when toggling', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    const dialog = root.querySelector('ui-dialog');
    let detail = null;
    dialog.addEventListener('ui-open-change', (e) => { detail = e.detail; });
    dialog.show();
    await tick();
    assert.equal(detail?.open, true);
    dialog.hide();
    await tick();
    assert.equal(detail?.open, false);
    root.remove();
  });

  test('dialog-content has data-state="closed" when host is not open', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>O</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    const dialog = root.querySelector('ui-dialog');
    const content = dialog.querySelector('ui-dialog-content');
    assert.ok(content, 'content element exists in DOM');
    assert.equal(content.getAttribute('data-state'), 'closed');
    // Content is hidden by CSS (display:none): visible via computed style.
    assert.equal(getComputedStyle(content).display, 'none', 'content is display:none when closed');
    root.remove();
  });
});

suite('ui-tooltip', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/tooltip.ts`);
  });

  test('tooltip is closed initially', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    assert.equal(tip.isOpen, false);
    assert.equal(tip.getAttribute('data-state'), 'closed');
    root.remove();
  });

  test('show() opens the tooltip and reflects via data-state', async () => {
    // `delay-duration="0"` skips the default 700ms open delay so the
    // setTimeout fires effectively immediately.
    const root = await mount(html`
      <ui-tooltip delay-duration="0">
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    // setTimeout(0) fires on the next macrotask: wait a beat past microtasks.
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(tip.isOpen, true);
    assert.equal(tip.getAttribute('data-state'), 'open');
    const content = tip.querySelector('ui-tooltip-content');
    assert.ok(content, 'tooltip content element rendered');
    assert.equal(content.getAttribute('role'), 'tooltip');
    root.remove();
  });

  test('mouseleave on trigger closes after open', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    await tick();
    const trigger = root.querySelector('ui-tooltip-trigger');
    trigger.dispatchEvent(new Event('mouseleave', { bubbles: true }));
    await tick();
    assert.equal(tip.isOpen, false);
    root.remove();
  });

  test('content has tooltip-content styling classes', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>TipText</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    await tick();
    const content = tip.querySelector('ui-tooltip-content');
    assert.ok(content);
    assert.match(content.className, /bg-foreground/);
    tip.hide();
    root.remove();
  });
});

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
    const content = dm.querySelector('ui-dropdown-menu-content');
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

suite('ui-alert-dialog', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/alert-dialog.ts`);
  });

  test('trigger click opens via show(); content has role="alertdialog"', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>Delete</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>Are you sure?</ui-alert-dialog-title>
          <ui-alert-dialog-cancel><button>Cancel</button></ui-alert-dialog-cancel>
          <ui-alert-dialog-action><button>Delete</button></ui-alert-dialog-action>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    root.querySelector('ui-alert-dialog-trigger').click();
    await tick();
    assert.ok(ad.hasAttribute('open'), 'host gets [open] attribute');
    const content = ad.querySelector('ui-alert-dialog-content');
    assert.equal(content.getAttribute('role'), 'alertdialog');
    ad.hide();
    root.remove();
  });

  test('cancel trigger closes the dialog (no escape close, unlike ui-dialog)', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>Delete</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>T</ui-alert-dialog-title>
          <ui-alert-dialog-cancel><button>Cancel</button></ui-alert-dialog-cancel>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    ad.show();
    await tick();
    root.querySelector('ui-alert-dialog-cancel').click();
    await tick();
    assert.equal(ad.hasAttribute('open'), false, 'cancel closes');
    root.remove();
  });

  test('action trigger closes the dialog', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>X</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-action><button>Confirm</button></ui-alert-dialog-action>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    ad.show();
    await tick();
    root.querySelector('ui-alert-dialog-action').click();
    await tick();
    assert.equal(ad.hasAttribute('open'), false);
    root.remove();
  });

  test('content hidden when host has no [open] attribute', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>X</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>T</ui-alert-dialog-title>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    const content = ad.querySelector('ui-alert-dialog-content');
    assert.ok(content, 'content stays in DOM when closed');
    assert.equal(getComputedStyle(content).display, 'none', 'CSS hides content when not [open]');
    root.remove();
  });
});

suite('ui-hover-card', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/hover-card.ts`);
  });

  test('hover-card is closed initially; data-state="closed"', async () => {
    const root = await mount(html`
      <ui-hover-card>
        <ui-hover-card-trigger><span>Hover me</span></ui-hover-card-trigger>
        <ui-hover-card-content>Profile preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const hc = root.querySelector('ui-hover-card');
    assert.equal(hc.hasAttribute('open'), false);
    assert.equal(hc.getAttribute('data-state'), 'closed');
    root.remove();
  });

  test('show() with open-delay=0 opens immediately on next macrotask', async () => {
    // Default open-delay is 700ms: too long for a tick(). Set to 0 to
    // make the setTimeout fire on the next macrotask.
    const root = await mount(html`
      <ui-hover-card open-delay="0" close-delay="0">
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const hc = root.querySelector('ui-hover-card');
    hc.show();
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(hc.hasAttribute('open'));
    assert.equal(hc.getAttribute('data-state'), 'open');
    hc.hide();
    root.remove();
  });

  test('hide() closes after close-delay', async () => {
    const root = await mount(html`
      <ui-hover-card open-delay="0" close-delay="0">
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const hc = root.querySelector('ui-hover-card');
    hc.show();
    await new Promise((r) => setTimeout(r, 5));
    hc.hide();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(hc.hasAttribute('open'), false);
    root.remove();
  });

  test('content has role="dialog" for screen-reader semantics', async () => {
    const root = await mount(html`
      <ui-hover-card>
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const content = root.querySelector('ui-hover-card-content');
    assert.equal(content.getAttribute('role'), 'dialog');
    root.remove();
  });
});
