/**
 * Browser tests for stateful @webjskit/ui components — components with
 * internal state that mutates on interaction. Runs in real Chromium via
 * WTR + Playwright.
 *
 * Covers: switch, checkbox, tabs, accordion, collapsible, radio-group,
 * toggle, slider, progress.
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

suite('ui-switch', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/switch.ts`);
  });

  test('renders with role="switch" and aria-checked="false" by default', async () => {
    const root = await mount(html`<ui-switch></ui-switch>`);
    const btn = root.querySelector('ui-switch button');
    assert.ok(btn);
    assert.equal(btn.getAttribute('role'), 'switch');
    assert.equal(btn.getAttribute('aria-checked'), 'false');
    assert.equal(btn.getAttribute('data-state'), 'unchecked');
    root.remove();
  });

  test('checked attribute reflects to data-state="checked" + aria-checked="true"', async () => {
    const root = await mount(html`<ui-switch checked></ui-switch>`);
    const btn = root.querySelector('ui-switch button');
    assert.equal(btn.getAttribute('data-state'), 'checked');
    assert.equal(btn.getAttribute('aria-checked'), 'true');
    root.remove();
  });

  test('click toggles checked + fires `change` event', async () => {
    const root = await mount(html`<ui-switch></ui-switch>`);
    const host = root.querySelector('ui-switch');
    let changed = 0;
    let detail = null;
    host.addEventListener('change', (e) => { changed++; detail = e.detail; });
    host.querySelector('button').click();
    await tick();
    assert.equal(changed, 1, 'change event fired');
    assert.equal(host.checked, true, 'host.checked flipped');
    assert.equal(detail?.checked, true);
    root.remove();
  });

  test('disabled switch does not toggle on click', async () => {
    const root = await mount(html`<ui-switch disabled></ui-switch>`);
    const host = root.querySelector('ui-switch');
    let changed = 0;
    host.addEventListener('change', () => { changed++; });
    host.querySelector('button').click();
    await tick();
    assert.equal(changed, 0);
    assert.equal(host.checked, false);
    root.remove();
  });

  test('size="sm" reflects to data-size="sm"', async () => {
    const root = await mount(html`<ui-switch size="sm"></ui-switch>`);
    const btn = root.querySelector('ui-switch button');
    assert.equal(btn.getAttribute('data-size'), 'sm');
    root.remove();
  });
});

suite('ui-checkbox', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/checkbox.ts`);
  });

  test('renders role="checkbox" with aria-checked="false" default', async () => {
    const root = await mount(html`<ui-checkbox></ui-checkbox>`);
    const btn = root.querySelector('ui-checkbox button');
    assert.ok(btn);
    assert.equal(btn.getAttribute('role'), 'checkbox');
    assert.equal(btn.getAttribute('aria-checked'), 'false');
    root.remove();
  });

  test('checked attribute renders the check indicator SVG', async () => {
    const root = await mount(html`<ui-checkbox checked></ui-checkbox>`);
    const svg = root.querySelector('ui-checkbox svg');
    assert.ok(svg, 'check svg present when checked');
    root.remove();
  });

  test('click toggles checked + fires change with detail', async () => {
    const root = await mount(html`<ui-checkbox></ui-checkbox>`);
    const host = root.querySelector('ui-checkbox');
    let detail = null;
    host.addEventListener('change', (e) => { detail = e.detail; });
    host.querySelector('button').click();
    await tick();
    assert.equal(host.checked, true);
    assert.equal(detail?.checked, true);
    root.remove();
  });

  test('disabled checkbox does not toggle', async () => {
    const root = await mount(html`<ui-checkbox disabled></ui-checkbox>`);
    const host = root.querySelector('ui-checkbox');
    let changed = 0;
    host.addEventListener('change', () => { changed++; });
    host.querySelector('button').click();
    await tick();
    assert.equal(changed, 0);
    root.remove();
  });

  test('data-state attribute reflects checked state', async () => {
    const root = await mount(html`<ui-checkbox checked></ui-checkbox>`);
    const btn = root.querySelector('ui-checkbox button');
    assert.equal(btn.getAttribute('data-state'), 'checked');
    root.remove();
  });
});

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
    const list = root.querySelector('ui-tabs-list [role="tablist"]');
    assert.ok(list, 'tablist rendered');
    const triggers = root.querySelectorAll('ui-tabs-trigger button');
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
    const triggerA = root.querySelector('ui-tabs-trigger[value="a"] button');
    const triggerB = root.querySelector('ui-tabs-trigger[value="b"] button');
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
    const contentB = root.querySelector('ui-tabs-content[value="b"] [role="tabpanel"]');
    assert.ok(contentB?.hasAttribute('hidden'), 'inactive pane has hidden attr');
    root.remove();
  });

  test('active triggers fire a `change` event on tabs root', async () => {
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
    tabs.addEventListener('change', (e) => { detail = e.detail; });
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
    assert.ok(root.querySelector('ui-accordion-trigger button'));
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
    const trigger = root.querySelector('ui-accordion-trigger button');
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

  test('fires `open-change` event on toggle', async () => {
    const root = await mount(html`
      <ui-collapsible>
        <ui-collapsible-trigger><button>Toggle</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    const host = root.querySelector('ui-collapsible');
    let detail = null;
    host.addEventListener('open-change', (e) => { detail = e.detail; });
    root.querySelector('ui-collapsible-trigger').click();
    await tick();
    assert.equal(detail?.open, true);
    root.remove();
  });

  test('disabled collapsible does not toggle', async () => {
    const root = await mount(html`
      <ui-collapsible disabled>
        <ui-collapsible-trigger><button>X</button></ui-collapsible-trigger>
        <ui-collapsible-content>Body</ui-collapsible-content>
      </ui-collapsible>
    `);
    await tick();
    root.querySelector('ui-collapsible-trigger').click();
    await tick();
    const c = root.querySelector('ui-collapsible');
    assert.ok(!c.hasAttribute('open'));
    root.remove();
  });
});

suite('ui-radio-group', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/radio-group.ts`);
  });

  test('renders role="radiogroup" with items', async () => {
    const root = await mount(html`
      <ui-radio-group>
        <ui-radio-group-item value="a"></ui-radio-group-item>
        <ui-radio-group-item value="b"></ui-radio-group-item>
      </ui-radio-group>
    `);
    await tick();
    assert.ok(root.querySelector('[role="radiogroup"]'));
    const items = root.querySelectorAll('ui-radio-group-item button');
    assert.equal(items.length, 2);
    root.remove();
  });

  test('clicking an item updates parent value', async () => {
    const root = await mount(html`
      <ui-radio-group>
        <ui-radio-group-item value="apple"></ui-radio-group-item>
        <ui-radio-group-item value="banana"></ui-radio-group-item>
      </ui-radio-group>
    `);
    await tick();
    const group = root.querySelector('ui-radio-group');
    root.querySelector('ui-radio-group-item[value="banana"] button').click();
    await tick();
    assert.equal(group.value, 'banana');
    root.remove();
  });

  test('selected item reflects aria-checked="true"', async () => {
    const root = await mount(html`
      <ui-radio-group value="apple">
        <ui-radio-group-item value="apple"></ui-radio-group-item>
        <ui-radio-group-item value="banana"></ui-radio-group-item>
      </ui-radio-group>
    `);
    await tick();
    const apple = root.querySelector('ui-radio-group-item[value="apple"] button');
    const banana = root.querySelector('ui-radio-group-item[value="banana"] button');
    assert.equal(apple.getAttribute('aria-checked'), 'true');
    assert.equal(banana.getAttribute('aria-checked'), 'false');
    root.remove();
  });

  test('change event fires when selection changes', async () => {
    const root = await mount(html`
      <ui-radio-group>
        <ui-radio-group-item value="apple"></ui-radio-group-item>
        <ui-radio-group-item value="banana"></ui-radio-group-item>
      </ui-radio-group>
    `);
    await tick();
    const group = root.querySelector('ui-radio-group');
    let detail = null;
    group.addEventListener('change', (e) => { detail = e.detail; });
    root.querySelector('ui-radio-group-item[value="banana"] button').click();
    await tick();
    assert.equal(detail?.value, 'banana');
    root.remove();
  });
});

suite('ui-toggle', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/toggle.ts`);
  });

  test('renders aria-pressed="false" by default', async () => {
    const root = await mount(html`<ui-toggle>Bold</ui-toggle>`);
    const btn = root.querySelector('ui-toggle button');
    assert.equal(btn.getAttribute('aria-pressed'), 'false');
    assert.equal(btn.getAttribute('data-state'), 'off');
    root.remove();
  });

  test('pressed attribute reflects data-state="on" + aria-pressed="true"', async () => {
    const root = await mount(html`<ui-toggle pressed>Bold</ui-toggle>`);
    const btn = root.querySelector('ui-toggle button');
    assert.equal(btn.getAttribute('data-state'), 'on');
    assert.equal(btn.getAttribute('aria-pressed'), 'true');
    root.remove();
  });

  test('click toggles pressed and fires change', async () => {
    const root = await mount(html`<ui-toggle>Bold</ui-toggle>`);
    const host = root.querySelector('ui-toggle');
    let detail = null;
    host.addEventListener('change', (e) => { detail = e.detail; });
    host.querySelector('button').click();
    await tick();
    assert.equal(host.pressed, true);
    assert.equal(detail?.pressed, true);
    root.remove();
  });

  test('variant="outline" reflects via data-variant', async () => {
    const root = await mount(html`<ui-toggle variant="outline">B</ui-toggle>`);
    const btn = root.querySelector('ui-toggle button');
    assert.equal(btn.getAttribute('data-variant'), 'outline');
    assert.match(btn.className, /border/);
    root.remove();
  });

  test('disabled toggle does not flip on click', async () => {
    const root = await mount(html`<ui-toggle disabled>B</ui-toggle>`);
    const host = root.querySelector('ui-toggle');
    host.querySelector('button').click();
    await tick();
    assert.equal(host.pressed, false);
    root.remove();
  });
});

suite('ui-slider', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/slider.ts`);
  });

  test('renders an input[type=range] plus track/range divs', async () => {
    const root = await mount(html`<ui-slider min="0" max="100"></ui-slider>`);
    const input = root.querySelector('ui-slider input[type="range"]');
    assert.ok(input);
    assert.equal(input.getAttribute('min'), '0');
    assert.equal(input.getAttribute('max'), '100');
    assert.ok(root.querySelector('[data-slot="slider-track"]'));
    assert.ok(root.querySelector('[data-slot="slider-range"]'));
    root.remove();
  });

  test('value attribute initializes the range and percentage', async () => {
    const root = await mount(html`<ui-slider min="0" max="100" value="50"></ui-slider>`);
    await tick();
    const input = root.querySelector('ui-slider input');
    assert.equal(Number(input.value), 50);
    const range = root.querySelector('[data-slot="slider-range"]');
    assert.match(range.getAttribute('style') || '', /50%/);
    root.remove();
  });

  test('input event updates value', async () => {
    const root = await mount(html`<ui-slider min="0" max="100" value="0"></ui-slider>`);
    const host = root.querySelector('ui-slider');
    let detail = null;
    host.addEventListener('input', (e) => { detail = e.detail; });
    const input = root.querySelector('ui-slider input');
    input.value = '42';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    assert.equal(host.value, 42);
    assert.equal(detail?.value, 42);
    root.remove();
  });

  test('orientation="vertical" reflects to data-orientation', async () => {
    const root = await mount(html`<ui-slider orientation="vertical"></ui-slider>`);
    const wrap = root.querySelector('ui-slider [data-slot="slider"]');
    assert.equal(wrap.getAttribute('data-orientation'), 'vertical');
    root.remove();
  });

  test('disabled slider has disabled input', async () => {
    const root = await mount(html`<ui-slider disabled></ui-slider>`);
    const input = root.querySelector('ui-slider input');
    assert.ok(input.hasAttribute('disabled'));
    root.remove();
  });
});

suite('ui-progress', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/progress.ts`);
  });

  test('renders with role="progressbar"', async () => {
    const root = await mount(html`<ui-progress value="0"></ui-progress>`);
    const bar = root.querySelector('ui-progress [role="progressbar"]');
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
