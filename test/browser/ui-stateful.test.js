/**
 * Browser tests for stateful Tier-2 @webjskit/ui custom elements: those
 * with internal state that mutates on interaction. Runs in real Chromium
 * via WTR + Playwright.
 *
 * Covers: tabs, toggle-group, sonner.
 *
 * Tier-1 components (switch, checkbox, radio-group, toggle, progress,
 * dialog, alert-dialog, tooltip, hover-card, popover, accordion,
 * collapsible) are class helpers, not custom elements: their assertions
 * live in `packages/ui/test/class-helpers.test.js`.
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

suite('ui-toggle-group', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/toggle-group.ts`);
  });

  test('host gets role="group" + data-slot="toggle-group"', async () => {
    const root = await mount(html`
      <ui-toggle-group type="single">
        <ui-toggle-group-item value="a">A</ui-toggle-group-item>
        <ui-toggle-group-item value="b">B</ui-toggle-group-item>
      </ui-toggle-group>
    `);
    const tg = root.querySelector('ui-toggle-group');
    assert.equal(tg.getAttribute('role'), 'group');
    assert.equal(tg.getAttribute('data-slot'), 'toggle-group');
    root.remove();
  });

  test('items reflect data-state from initial value (single)', async () => {
    const root = await mount(html`
      <ui-toggle-group type="single" value="b">
        <ui-toggle-group-item value="a">A</ui-toggle-group-item>
        <ui-toggle-group-item value="b">B</ui-toggle-group-item>
      </ui-toggle-group>
    `);
    await tick();
    const items = root.querySelectorAll('ui-toggle-group-item');
    assert.equal(items[0].getAttribute('data-state'), 'off');
    assert.equal(items[1].getAttribute('data-state'), 'on');
    assert.equal(items[1].getAttribute('aria-pressed'), 'true');
    root.remove();
  });

  test('items reflect data-state from initial value (multiple, comma-separated)', async () => {
    const root = await mount(html`
      <ui-toggle-group type="multiple" value="a,c">
        <ui-toggle-group-item value="a">A</ui-toggle-group-item>
        <ui-toggle-group-item value="b">B</ui-toggle-group-item>
        <ui-toggle-group-item value="c">C</ui-toggle-group-item>
      </ui-toggle-group>
    `);
    await tick();
    const items = root.querySelectorAll('ui-toggle-group-item');
    assert.equal(items[0].getAttribute('data-state'), 'on');
    assert.equal(items[1].getAttribute('data-state'), 'off');
    assert.equal(items[2].getAttribute('data-state'), 'on');
    root.remove();
  });

  test('clicking an item updates value + fires ui-value-change (single)', async () => {
    const root = await mount(html`
      <ui-toggle-group type="single" value="a">
        <ui-toggle-group-item value="a">A</ui-toggle-group-item>
        <ui-toggle-group-item value="b">B</ui-toggle-group-item>
      </ui-toggle-group>
    `);
    const tg = root.querySelector('ui-toggle-group');
    let detail = null;
    tg.addEventListener('ui-value-change', (e) => { detail = e.detail; });
    root.querySelector('ui-toggle-group-item[value="b"]').click();
    await tick();
    assert.equal(tg.getAttribute('value'), 'b');
    assert.equal(detail?.value, 'b');
    root.remove();
  });
});

suite('ui-sonner', () => {
  let toastModule;
  suiteSetup(async () => {
    toastModule = await import(`${COMPONENTS_DIR}/sonner.ts`);
  });

  test('mounting <ui-sonner> sets data-slot + fixed positioning class', async () => {
    const root = await mount(html`<ui-sonner position="top-right"></ui-sonner>`);
    const son = root.querySelector('ui-sonner');
    assert.equal(son.getAttribute('data-slot'), 'sonner');
    // position="top-right" → top-4 right-4
    assert.match(son.className, /top-4/);
    assert.match(son.className, /right-4/);
    assert.match(son.className, /fixed/);
    root.remove();
  });

  test('toast() adds a toast element rendered into the sonner', async () => {
    const root = await mount(html`<ui-sonner></ui-sonner>`);
    const { toast } = toastModule;
    const id = toast('Saved');
    await tick();
    const items = root.querySelectorAll('ui-sonner [data-slot="sonner-toast"], ui-sonner [data-slot="toast"], ui-sonner > div');
    assert.ok(items.length >= 1, 'at least one toast rendered');
    // Cleanup so the toast doesn't bleed into the next test.
    toast.dismiss(id);
    root.remove();
  });

  test('toast.error / toast.success render with their type wired up', async () => {
    const root = await mount(html`<ui-sonner></ui-sonner>`);
    const { toast } = toastModule;
    const a = toast.success('OK');
    const b = toast.error('Boom');
    await tick();
    const html_ = root.querySelector('ui-sonner').innerHTML;
    assert.match(html_, /OK/);
    assert.match(html_, /Boom/);
    toast.dismiss(a);
    toast.dismiss(b);
    root.remove();
  });

  test('toast.dismiss(id) removes the toast', async () => {
    const root = await mount(html`<ui-sonner></ui-sonner>`);
    const { toast } = toastModule;
    const id = toast('Will dismiss');
    await tick();
    const before = root.querySelector('ui-sonner').children.length;
    assert.ok(before >= 1);
    toast.dismiss(id);
    await tick();
    const after = root.querySelector('ui-sonner').children.length;
    assert.ok(after < before, 'child count must decrease after dismiss');
    root.remove();
  });
});
