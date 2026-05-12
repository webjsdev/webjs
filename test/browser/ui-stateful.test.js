/**
 * Browser tests for stateful Tier-2 @webjskit/ui custom elements — those
 * with internal state that mutates on interaction. Runs in real Chromium
 * via WTR + Playwright.
 *
 * Covers: tabs, accordion, collapsible, progress.
 *
 * Tier-1 components (switch, checkbox, radio-group, toggle) are class
 * helpers, not custom elements — their assertions live in
 * `packages/ui/test/class-helpers.test.js`.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${s} to match ${re}`); },
};

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

/** Tick: wait two RAFs so connectedCallback and queueMicrotask settle. */
const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

suite('ui-tabs', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/tabs.ts`);
  });

  test('renders tablist + triggers + contents', async () => {
    const root = await mount(html`
      <ui-tabs value="a">
        <ui-tabs-list>
          <ui-tabs-trigger value="a">A</ui-tabs-trigger>
          <ui-tabs-trigger value="b">B</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="a">PANE A</ui-tabs-content>
        <ui-tabs-content value="b">PANE B</ui-tabs-content>
      </ui-tabs>
    `);
    // <ui-tabs-list> sets role="tablist" on the host itself, not a descendant.
    const list = root.querySelector('ui-tabs-list[role="tablist"]');
    assert.ok(list, 'tablist role on ui-tabs-list host');
    const triggers = root.querySelectorAll('ui-tabs-trigger[role="tab"]');
    assert.equal(triggers.length, 2);
    root.remove();
  });

  test('initial active tab has data-state="active"', async () => {
    const root = await mount(html`
      <ui-tabs value="a">
        <ui-tabs-list>
          <ui-tabs-trigger value="a">A</ui-tabs-trigger>
          <ui-tabs-trigger value="b">B</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="a">PANE A</ui-tabs-content>
        <ui-tabs-content value="b">PANE B</ui-tabs-content>
      </ui-tabs>
    `);
    await tick();
    const triggerA = root.querySelector('ui-tabs-trigger[value="a"]');
    const triggerB = root.querySelector('ui-tabs-trigger[value="b"]');
    assert.equal(triggerA.getAttribute('data-state'), 'active');
    assert.equal(triggerB.getAttribute('data-state'), 'inactive');
    root.remove();
  });

  test('clicking trigger b switches active state', async () => {
    const root = await mount(html`
      <ui-tabs value="a">
        <ui-tabs-list>
          <ui-tabs-trigger value="a">A</ui-tabs-trigger>
          <ui-tabs-trigger value="b">B</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="a">PANE A</ui-tabs-content>
        <ui-tabs-content value="b">PANE B</ui-tabs-content>
      </ui-tabs>
    `);
    await tick();
    const triggerB = root.querySelector('ui-tabs-trigger[value="b"]');
    triggerB.click();
    await tick();
    const root_ = root.querySelector('ui-tabs');
    assert.equal(root_.getAttribute('value'), 'b', 'tabs root updates value');
    root.remove();
  });

  test('inactive tab content is hidden', async () => {
    const root = await mount(html`
      <ui-tabs value="a">
        <ui-tabs-list>
          <ui-tabs-trigger value="a">A</ui-tabs-trigger>
          <ui-tabs-trigger value="b">B</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="a">PANE A</ui-tabs-content>
        <ui-tabs-content value="b">PANE B</ui-tabs-content>
      </ui-tabs>
    `);
    await tick();
    // role="tabpanel" is set on the host <ui-tabs-content> itself.
    const contentB = root.querySelector('ui-tabs-content[value="b"]');
    assert.equal(contentB.getAttribute('role'), 'tabpanel');
    assert.ok(contentB.hasAttribute('hidden'), 'inactive pane has hidden attr');
    root.remove();
  });

  test('active triggers fire a ui-value-change event on tabs root', async () => {
    const root = await mount(html`
      <ui-tabs value="a">
        <ui-tabs-list>
          <ui-tabs-trigger value="a">A</ui-tabs-trigger>
          <ui-tabs-trigger value="b">B</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="a">A</ui-tabs-content>
        <ui-tabs-content value="b">B</ui-tabs-content>
      </ui-tabs>
    `);
    await tick();
    const tabs = root.querySelector('ui-tabs');
    let detail = null;
    tabs.addEventListener('ui-value-change', (e) => { detail = e.detail; });
    root.querySelector('ui-tabs-trigger[value="b"]').click();
    await tick();
    assert.equal(detail?.value, 'b');
    root.remove();
  });
});

suite('ui-accordion', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/accordion.ts`);
  });

  test('renders items and triggers', async () => {
    const root = await mount(html`
      <ui-accordion type="single" collapsible>
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Q1</ui-accordion-trigger>
          <ui-accordion-content>A1</ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
    `);
    assert.ok(root.querySelector('ui-accordion'));
    // ui-accordion-trigger decorates itself with role="button"; no inner <button>.
    assert.ok(root.querySelector('ui-accordion-trigger[role="button"]'));
    root.remove();
  });

  test('initial value opens matching item', async () => {
    const root = await mount(html`
      <ui-accordion type="single" value="item-1">
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Q1</ui-accordion-trigger>
          <ui-accordion-content>A1</ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
    `);
    await tick();
    const trigger = root.querySelector('ui-accordion-trigger');
    assert.equal(trigger.getAttribute('data-state'), 'open');
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    root.remove();
  });

  test('clicking a trigger opens the item', async () => {
    const root = await mount(html`
      <ui-accordion type="single" collapsible>
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Q1</ui-accordion-trigger>
          <ui-accordion-content>A1</ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
    `);
    await tick();
    const trigger = root.querySelector('ui-accordion-trigger');
    trigger.click();
    await tick();
    const acc = root.querySelector('ui-accordion');
    assert.equal(acc.getAttribute('value'), 'item-1');
    root.remove();
  });

  test('clicking same trigger twice in collapsible mode closes it', async () => {
    const root = await mount(html`
      <ui-accordion type="single" collapsible>
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Q1</ui-accordion-trigger>
          <ui-accordion-content>A1</ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
    `);
    await tick();
    const trigger = root.querySelector('ui-accordion-trigger');
    trigger.click();
    await tick();
    trigger.click();
    await tick();
    const acc = root.querySelector('ui-accordion');
    assert.equal(acc.getAttribute('value'), '');
    root.remove();
  });

  test('multiple mode allows comma-separated values', async () => {
    const root = await mount(html`
      <ui-accordion type="multiple">
        <ui-accordion-item value="a">
          <ui-accordion-trigger>A</ui-accordion-trigger>
          <ui-accordion-content>A1</ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="b">
          <ui-accordion-trigger>B</ui-accordion-trigger>
          <ui-accordion-content>B1</ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
    `);
    await tick();
    const triggers = root.querySelectorAll('ui-accordion-trigger');
    triggers[0].click();
    await tick();
    triggers[1].click();
    await tick();
    const acc = root.querySelector('ui-accordion');
    const vals = (acc.getAttribute('value') || '').split(',').sort();
    assert.equal(vals.join(','), 'a,b');
    root.remove();
  });
});

suite('ui-collapsible', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/collapsible.ts`);
  });

  test('renders trigger and content closed by default', async () => {
    const root = await mount(html`
      <ui-collapsible>
        <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    const c = root.querySelector('ui-collapsible');
    assert.equal(c.getAttribute('data-state') || (c.hasAttribute('open') ? 'open' : 'closed'), 'closed');
    root.remove();
  });

  test('clicking trigger flips open attribute', async () => {
    const root = await mount(html`
      <ui-collapsible>
        <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    const trigger = root.querySelector('ui-collapsible-trigger');
    trigger.click();
    await tick();
    const c = root.querySelector('ui-collapsible');
    assert.ok(c.hasAttribute('open'));
    root.remove();
  });

  test('open=true reflects to content data-state="open"', async () => {
    const root = await mount(html`
      <ui-collapsible open>
        <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    const content = root.querySelector('ui-collapsible-content');
    assert.equal(content.getAttribute('data-state'), 'open');
    root.remove();
  });

  test('fires `ui-open-change` event on toggle', async () => {
    const root = await mount(html`
      <ui-collapsible>
        <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    const host = root.querySelector('ui-collapsible');
    let detail = null;
    host.addEventListener('ui-open-change', (e) => { detail = e.detail; });
    root.querySelector('ui-collapsible-trigger').click();
    await tick();
    assert.equal(detail?.open, true);
    root.remove();
  });
});
suite('ui-progress', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/progress.ts`);
  });

  test('renders with role="progressbar" on the host', async () => {
    const root = await mount(html`<ui-progress value="0"></ui-progress>`);
    // ui-progress sets role="progressbar" on itself, not a descendant.
    const bar = root.querySelector('ui-progress[role="progressbar"]');
    assert.ok(bar);
    root.remove();
  });

  test('value attribute reflects to inner indicator transform', async () => {
    const root = await mount(html`<ui-progress value="40"></ui-progress>`);
    const indicator = root.querySelector('[data-slot="progress-indicator"]');
    assert.ok(indicator);
    // value=40 → offset=60 → transform: translateX(-60%)
    assert.match(indicator.getAttribute('style') || '', /-60%/);
    root.remove();
  });

  test('aria-valuenow reflects current value', async () => {
    const root = await mount(html`<ui-progress value="75"></ui-progress>`);
    const bar = root.querySelector('[role="progressbar"]');
    assert.equal(bar.getAttribute('aria-valuenow'), '75');
    root.remove();
  });

  test('aria-valuemax reflects max attribute', async () => {
    const root = await mount(html`<ui-progress value="50" max="200"></ui-progress>`);
    const bar = root.querySelector('[role="progressbar"]');
    assert.equal(bar.getAttribute('aria-valuemax'), '200');
    root.remove();
  });

  test('value=0 yields full negative offset (translateX(-100%))', async () => {
    const root = await mount(html`<ui-progress value="0"></ui-progress>`);
    const indicator = root.querySelector('[data-slot="progress-indicator"]');
    assert.match(indicator.getAttribute('style') || '', /-100%/);
    root.remove();
  });
});
