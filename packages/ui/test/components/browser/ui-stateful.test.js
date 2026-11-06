/**
 * Browser tests for stateful Tier-2 @webjsdev/ui custom elements: those
 * with internal state that mutates on interaction. Runs in real Chromium
 * via WTR + Playwright.
 *
 * Covers: tabs, accordion, collapsible, toggle-group, sonner.
 *
 * Tier-1 components (switch, checkbox, radio-group, toggle, progress)
 * are class helpers, not custom elements: their assertions live in
 * `packages/ui/test/class-helpers.test.js`.
 */
import { html } from '../../../../core/src/html.js';
import { render } from '../../../../core/src/render-client.js';

import { assert } from '../../../../../test/browser-assert.js';

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

  // The Lit-idiomatic refactor renders each compound subcomponent's
  // ARIA role + interactive element inside its slot output. ARIA tooling
  // finds role="tablist" / "tab" / "tabpanel" on the inner elements,
  // not on the <ui-*> hosts. Tests query the inner elements accordingly.

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
    await tick();
    const list = root.querySelector('ui-tabs-list [role="tablist"]');
    assert.ok(list, 'tablist role on inner element');
    const triggers = root.querySelectorAll('ui-tabs-trigger [role="tab"]');
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
    const triggerA = root.querySelector('ui-tabs-trigger[value="a"] [role="tab"]');
    const triggerB = root.querySelector('ui-tabs-trigger[value="b"] [role="tab"]');
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
    // Click the inner button (the actual interactive element); the host
    // is just a slot wrapper now.
    root.querySelector('ui-tabs-trigger[value="b"] [role="tab"]').click();
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
    const contentB = root.querySelector('ui-tabs-content[value="b"]');
    const panelB = contentB.querySelector('[role="tabpanel"]');
    assert.equal(panelB.getAttribute('role'), 'tabpanel');
    // The host element gets `hidden` (so its rendered content is removed
    // from layout); the inner panel still carries the role for ARIA.
    assert.ok(contentB.hasAttribute('hidden'), 'inactive pane host has hidden attr');
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
    root.querySelector('ui-tabs-trigger[value="b"] [role="tab"]').click();
    await tick();
    assert.equal(detail?.value, 'b');
    root.remove();
  });
});

suite('ui-toggle-group', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/toggle-group.ts`);
  });

  test('inner wrapper has role="group" + data-slot="toggle-group"', async () => {
    const root = await mount(html`
      <ui-toggle-group type="single">
        <ui-toggle-group-item value="a">A</ui-toggle-group-item>
        <ui-toggle-group-item value="b">B</ui-toggle-group-item>
      </ui-toggle-group>
    `);
    // The Lit-idiomatic refactor renders a wrapping <div role="group">
    // inside the host's slot output, so ARIA tooling finds the role on
    // the inner element rather than the host. Same with data-slot.
    const inner = root.querySelector('ui-toggle-group > div[data-slot="toggle-group"]');
    assert.ok(inner, 'inner wrapper rendered');
    assert.equal(inner.getAttribute('role'), 'group');
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
    await tick();
    const tg = root.querySelector('ui-toggle-group');
    let detail = null;
    tg.addEventListener('ui-value-change', (e) => { detail = e.detail; });
    // toggle-group-item is host-styled (the host element carries the
    // visual class + data-state, so CSS sibling selectors like
    // data-[spacing=0]:first:rounded-l-md target it correctly). Click
    // events go to the host's slot, which has the @click handler.
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

  test('mounting <ui-sonner> renders inner wrapper with data-slot + fixed positioning class', async () => {
    const root = await mount(html`<ui-sonner position="top-right"></ui-sonner>`);
    await tick();
    // The Lit refactor renders an inner <div data-slot="sonner"> that
    // carries the positioning classes; the host stays untouched so the
    // user's own class attribute on <ui-sonner> is preserved.
    const inner = root.querySelector('ui-sonner [data-slot="sonner"]');
    assert.ok(inner, 'inner wrapper rendered');
    assert.equal(inner.getAttribute('data-slot'), 'sonner');
    assert.match(inner.className, /top-4/);
    // Logical side since #1666, so top-right sits at the inline end and
    // flips under dir="rtl".
    assert.match(inner.className, /end-4/);
    assert.match(inner.className, /fixed/);
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
    // Toasts now render into the inner [data-slot="sonner"] wrapper.
    const inner = root.querySelector('ui-sonner [data-slot="sonner"]');
    const before = inner.children.length;
    assert.ok(before >= 1);
    toast.dismiss(id);
    await tick();
    const after = inner.children.length;
    assert.ok(after < before, 'child count must decrease after dismiss');
    root.remove();
  });
});

suite('ui-slider', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/slider.ts`);
  });

  const range = () => html`
    <form>
      <label for="lo">Minimum</label>
      <ui-slider style="width: 200px">
        <input type="range" id="lo" name="lo" min="0" max="100" step="5" value="20">
        <input type="range" name="hi" min="0" max="100" step="5" value="80" aria-label="Maximum">
      </ui-slider>
    </form>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-slider');
    const inputs = [...el.querySelectorAll('input[type="range"]')];
    const thumbs = () => [...el.querySelectorAll('[data-slot="slider-thumb"]')];
    return { el, inputs, thumbs };
  };
  const key = (target, k, opts = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  test('it hides the inputs visually, keeps them in the form, and draws one slider thumb per input', async () => {
    const root = await mount(range());
    await tick();
    const { inputs, thumbs } = parts(root);
    assert.equal(thumbs().length, 2);
    for (const input of inputs) {
      assert.equal(getComputedStyle(input).opacity, '0');
      assert.equal(input.getAttribute('aria-hidden'), 'true');
    }
    const [a, b] = thumbs();
    assert.equal(a.getAttribute('role'), 'slider');
    assert.equal(a.getAttribute('aria-valuemin'), '0');
    assert.equal(a.getAttribute('aria-valuemax'), '100');
    assert.equal(a.getAttribute('aria-valuenow'), '20');
    assert.equal(b.getAttribute('aria-valuenow'), '80');
    assert.equal(a.getAttribute('aria-orientation'), 'horizontal');
    assert.equal(a.tabIndex, 0);
    const data = new FormData(root.querySelector('form'));
    assert.deepEqual([data.get('lo'), data.get('hi')], ['20', '80']);
    root.remove();
  });

  test('a thumb is named by its input\'s label or aria-label, and a label click focuses it', async () => {
    const root = await mount(range());
    await tick();
    const { thumbs } = parts(root);
    const label = root.querySelector('label');
    assert.equal(thumbs()[0].getAttribute('aria-labelledby'), label.id);
    assert.equal(thumbs()[1].getAttribute('aria-label'), 'Maximum');
    label.click();
    await tick();
    assert.equal(document.activeElement, thumbs()[0]);
    root.remove();
  });

  test('keys move a thumb by the step, ten steps with Shift or Page keys, to the ends with Home / End', async () => {
    const root = await mount(range());
    await tick();
    const { el, inputs, thumbs } = parts(root);
    const seen = [];
    inputs[0].addEventListener('input', () => seen.push('input'));
    inputs[0].addEventListener('change', () => seen.push('change'));
    el.addEventListener('ui-value-change', (e) => seen.push(`v:${e.detail.value.join(',')}`));
    el.addEventListener('ui-value-commit', (e) => seen.push(`c:${e.detail.value.join(',')}`));
    key(thumbs()[0], 'ArrowRight');
    assert.equal(inputs[0].value, '25');
    assert.deepEqual(seen, ['input', 'v:25,80', 'change', 'c:25,80']);
    key(thumbs()[0], 'ArrowUp', { shiftKey: true });
    assert.equal(inputs[0].value, '75');
    key(thumbs()[0], 'PageDown');
    assert.equal(inputs[0].value, '25');
    key(thumbs()[0], 'Home');
    assert.equal(inputs[0].value, '0');
    await tick();
    assert.equal(thumbs()[0].getAttribute('aria-valuenow'), '0', 'the thumb reflects it');
    root.remove();
  });

  test('a thumb never passes its neighbour', async () => {
    const root = await mount(range());
    await tick();
    const { inputs, thumbs } = parts(root);
    key(thumbs()[0], 'End');
    assert.equal(inputs[0].value, '80', 'the lower thumb stops at the upper one');
    key(thumbs()[1], 'Home');
    assert.equal(inputs[1].value, '80', 'the upper thumb stops at the lower one');
    root.remove();
  });

  test('ArrowLeft and ArrowRight swap under dir="rtl"', async () => {
    const root = await mount(html`<div dir="rtl">${range()}</div>`);
    await tick();
    const { inputs, thumbs } = parts(root);
    key(thumbs()[0], 'ArrowLeft');
    assert.equal(inputs[0].value, '25', 'left is up in RTL');
    root.remove();
  });

  test('a press on the track moves the nearest thumb there, a drag follows, and the release commits', async () => {
    // This suite loads no stylesheet; give the track the box a style gives it.
    const root = await mount(html`<style>[data-slot="slider"]{display:flex;align-items:center;position:relative}[data-slot="slider-track"]{display:block;flex:1;height:6px;position:relative}</style>${range()}`);
    await tick();
    const { el, inputs, thumbs } = parts(root);
    const commits = [];
    el.addEventListener('ui-value-commit', (e) => commits.push(e.detail.value.join(',')));
    const track = el.querySelector('[data-slot="slider-track"]').getBoundingClientRect();
    const at = (pct) => track.left + (track.width * pct) / 100;
    const root2 = el.querySelector('[data-slot="slider"]');
    const y = track.top + track.height / 2;
    root2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: at(72), clientY: y, button: 0, pointerId: 1 }));
    assert.equal(inputs[1].value, '70', 'the upper thumb was nearer, and 72 snaps to the step of 5');
    assert.equal(document.activeElement, thumbs()[1], 'and takes focus');
    // The native input would snap a raw 71 to 70 by itself, so what the
    // element's own snap buys is no event for a move within one step.
    let changes = 0;
    el.addEventListener('ui-value-change', () => changes++);
    root2.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: at(71), clientY: y, pointerId: 1 }));
    assert.equal(changes, 0, 'a move inside one step fires nothing');
    root2.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: at(88), clientY: y, pointerId: 1 }));
    assert.equal(inputs[1].value, '90');
    assert.equal(commits.length, 0, 'no commit mid-drag');
    root2.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: at(90), clientY: y, pointerId: 1 }));
    assert.deepEqual(commits, ['20,90']);
    root.remove();
  });

  test('the range spans the two thumbs and each thumb sits at its value, inside the track', async () => {
    const root = await mount(range());
    await tick();
    const { el, thumbs } = parts(root);
    const r = el.querySelector('[data-slot="slider-range"]');
    assert.ok(r.style.insetInlineStart === '20%' && r.style.insetInlineEnd === '20%', `range ${r.getAttribute('style')}`);
    const wrap = thumbs()[1].parentElement.style;
    assert.equal(wrap.insetInlineStart, '80%');
    assert.equal(wrap.transform, 'translateX(-80%)');
    root.remove();
  });

  test('a disabled input disables its thumb, and a form reset restores the values', async () => {
    const root = await mount(range());
    await tick();
    const { inputs, thumbs } = parts(root);
    key(thumbs()[0], 'ArrowRight');
    await tick();
    assert.equal(thumbs()[0].getAttribute('aria-valuenow'), '25');
    root.querySelector('form').reset();
    await tick();
    assert.equal(inputs[0].value, '20');
    assert.equal(thumbs()[0].getAttribute('aria-valuenow'), '20', 'the thumb follows the reset');
    inputs[1].disabled = true;
    await tick();
    assert.equal(thumbs()[1].getAttribute('aria-disabled'), 'true');
    assert.equal(thumbs()[1].tabIndex, -1);
    key(thumbs()[1], 'ArrowLeft');
    assert.equal(inputs[1].value, '80', 'a disabled thumb does not move');
    root.remove();
  });
});

suite('ui-input-otp', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/input-otp.ts`);
  });

  const otp = () => html`
    <form>
      <label for="otp">Code</label>
      <ui-input-otp>
        <input id="otp" name="otp" maxlength="4" pattern="[0-9]*" inputmode="numeric" autocomplete="one-time-code">
        <ui-input-otp-group>
          <ui-input-otp-slot index="0"></ui-input-otp-slot>
          <ui-input-otp-slot index="1" class="authored"></ui-input-otp-slot>
        </ui-input-otp-group>
        <ui-input-otp-separator></ui-input-otp-separator>
        <ui-input-otp-group>
          <ui-input-otp-slot index="2"></ui-input-otp-slot>
          <ui-input-otp-slot index="3"></ui-input-otp-slot>
        </ui-input-otp-group>
      </ui-input-otp>
    </form>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-input-otp');
    const input = el.querySelector('input');
    const slots = [...el.querySelectorAll('ui-input-otp-slot')];
    const chars = () => slots.map((s) => s.textContent.trim());
    return { el, input, slots, chars };
  };
  const type = (input, value) => {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  test('the input stays the named, focusable control, laid transparent over the drawn slots', async () => {
    const root = await mount(otp());
    await tick();
    const { el, input, slots } = parts(root);
    assert.equal(getComputedStyle(input).position, 'absolute');
    assert.equal(getComputedStyle(input).color, 'rgba(0, 0, 0, 0)');
    assert.equal(input.labels[0].textContent, 'Code', 'still labelled');
    assert.equal(slots.length, 4);
    for (const s of slots) {
      assert.equal(s.hidden, false, 'slots show once enhanced');
      assert.equal(s.getAttribute('aria-hidden'), 'true', 'and are decoration');
      assert.ok(s.classList.contains('cn-input-otp-slot'), 'the slot styles its own host');
    }
    assert.ok(slots[1].classList.contains('authored'), 'keeping the author\'s classes');
    assert.equal(el.querySelector('[data-slot="input-otp-separator"]').hidden, false);
    root.remove();
  });

  test('typed characters land in their slots, the caret slot is active, and the form submits the input', async () => {
    const root = await mount(otp());
    await tick();
    const { input, slots, chars } = parts(root);
    input.focus();
    type(input, '12');
    await tick();
    assert.deepEqual(chars(), ['1', '2', '', '']);
    assert.deepEqual(slots.map((s) => s.getAttribute('data-active')), ['false', 'false', 'true', 'false']);
    assert.ok(slots[2].querySelector('.cn-input-otp-caret'), 'the empty active slot draws a caret');
    assert.equal(new FormData(root.querySelector('form')).get('otp'), '12');
    input.blur();
    await tick();
    assert.ok(slots.every((s) => s.getAttribute('data-active') === 'false'), 'nothing is active without focus');
    root.remove();
  });

  test('a keystroke that breaks the pattern is refused', async () => {
    const root = await mount(otp());
    await tick();
    const { el, input, chars } = parts(root);
    let changes = 0;
    el.addEventListener('ui-value-change', () => changes++);
    input.focus();
    type(input, '1');
    type(input, '1a');
    await tick();
    assert.equal(input.value, '1');
    assert.deepEqual(chars(), ['1', '', '', '']);
    assert.equal(changes, 1, 'only the accepted edit is reported');
    root.remove();
  });

  test('filling every slot fires ui-complete once with the code', async () => {
    const root = await mount(otp());
    await tick();
    const { el, input } = parts(root);
    const done = [];
    el.addEventListener('ui-complete', (e) => done.push(e.detail.value));
    input.focus();
    type(input, '123');
    type(input, '1234');
    assert.deepEqual(done, ['1234']);
    root.remove();
  });

  test('a form reset clears the slots', async () => {
    const root = await mount(otp());
    await tick();
    const { input, chars } = parts(root);
    type(input, '98');
    await tick();
    root.querySelector('form').reset();
    await tick();
    assert.deepEqual(chars(), ['', '', '', '']);
    root.remove();
  });

  test('aria-invalid on the input reaches the slots, and a disabled input marks the row', async () => {
    const root = await mount(otp());
    await tick();
    const { el, input, slots } = parts(root);
    input.setAttribute('aria-invalid', 'true');
    input.disabled = true;
    await tick();
    assert.ok(slots.every((s) => s.getAttribute('aria-invalid') === 'true'));
    assert.ok(el.querySelector('[data-slot="input-otp"]').hasAttribute('data-disabled'));
    root.remove();
  });
});

suite('ui-calendar', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/calendar.ts`);
  });

  const btn = (el, iso) => el.querySelector(`button[data-day="${iso}"]`);
  const cell = (el, iso) => el.querySelector(`td[data-day="${iso}"]`);
  const key = (target, k, opts = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  test('single: a click picks and reports the day, a second click on it clears', async () => {
    const root = await mount(html`<form><ui-calendar mode="single" month="2025-06" name="day" locale="en-US"></ui-calendar></form>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    const seen = [];
    el.addEventListener('ui-value-change', (e) => seen.push(e.detail.value));
    btn(el, '2025-06-12').click();
    await tick();
    assert.deepEqual(seen, ['2025-06-12']);
    assert.equal(cell(el, '2025-06-12').getAttribute('aria-selected'), 'true');
    assert.equal(btn(el, '2025-06-12').getAttribute('data-selected-single'), 'true');
    assert.equal(new FormData(root.querySelector('form')).get('day'), '2025-06-12');
    btn(el, '2025-06-12').click();
    await tick();
    assert.equal(seen[1], '');
    root.remove();
  });

  test('multiple: clicks toggle days in and out', async () => {
    const root = await mount(html`<ui-calendar mode="multiple" month="2025-06" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    btn(el, '2025-06-03').click();
    btn(el, '2025-06-01').click();
    await tick();
    assert.deepEqual(el.selected, ['2025-06-01', '2025-06-03']);
    btn(el, '2025-06-03').click();
    await tick();
    assert.deepEqual(el.selected, ['2025-06-01']);
    assert.equal(el.querySelector('[role="grid"]').getAttribute('aria-multiselectable'), 'true');
    root.remove();
  });

  test('range: the ends are drawn as start and end, the days between as the middle', async () => {
    const root = await mount(html`<form><ui-calendar mode="range" value="2025-06-10/2025-06-13" name="stay" locale="en-US"></ui-calendar></form>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    assert.equal(btn(el, '2025-06-10').getAttribute('data-range-start'), 'true');
    assert.equal(btn(el, '2025-06-11').getAttribute('data-range-middle'), 'true');
    assert.equal(btn(el, '2025-06-13').getAttribute('data-range-end'), 'true');
    assert.equal(cell(el, '2025-06-14').hasAttribute('aria-selected'), false);
    const data = new FormData(root.querySelector('form'));
    assert.deepEqual([data.get('stay[from]'), data.get('stay[to]')], ['2025-06-10', '2025-06-13']);
    btn(el, '2025-06-20').click();
    await tick();
    assert.deepEqual(el.selected, { from: '2025-06-20', to: '' }, 'a pick on a complete range starts a new one');
    btn(el, '2025-06-18').click();
    await tick();
    assert.deepEqual(el.selected, { from: '2025-06-18', to: '2025-06-20' }, 'an earlier end swaps');
    root.remove();
  });

  test('the arrows, Home / End and PageDown move focus through days and months, Enter picks', async () => {
    const root = await mount(html`<ui-calendar mode="single" month="2025-06" value="2025-06-12" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    btn(el, '2025-06-12').focus();
    key(document.activeElement, 'ArrowRight');
    await tick();
    assert.equal(document.activeElement, btn(el, '2025-06-13'));
    key(document.activeElement, 'ArrowDown');
    await tick();
    assert.equal(document.activeElement, btn(el, '2025-06-20'));
    key(document.activeElement, 'Home');
    await tick();
    assert.equal(document.activeElement, btn(el, '2025-06-15'), 'the week starts on Sunday');
    key(document.activeElement, 'PageDown');
    await tick();
    assert.ok(el.textContent.includes('July 2025'), 'the page turned');
    assert.equal(document.activeElement, btn(el, '2025-07-15'));
    assert.equal(btn(el, '2025-07-15').tabIndex, 0, 'the focused day holds the tab stop');
    key(document.activeElement, 'Enter');
    await tick();
    assert.equal(el.selected, '2025-07-15');
    root.remove();
  });

  test('ArrowLeft moves forward under dir="rtl"', async () => {
    const root = await mount(html`<div dir="rtl"><ui-calendar mode="single" month="2025-06" value="2025-06-12" locale="en-US"></ui-calendar></div>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    btn(el, '2025-06-12').focus();
    key(document.activeElement, 'ArrowLeft');
    await tick();
    assert.equal(document.activeElement, btn(el, '2025-06-13'));
    root.remove();
  });

  test('min and max disable the days outside them and the buttons that would pass them', async () => {
    const root = await mount(html`<ui-calendar mode="single" month="2025-06" min="2025-06-05" max="2025-06-25" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    assert.ok(btn(el, '2025-06-04').disabled);
    assert.equal(btn(el, '2025-06-05').disabled, false);
    assert.ok(btn(el, '2025-06-26').disabled);
    btn(el, '2025-06-04').click();
    await tick();
    assert.equal(el.selected, '', 'a disabled day cannot be picked');
    assert.equal(el.querySelector('[aria-label="Go to the Previous Month"]').getAttribute('aria-disabled'), 'true');
    assert.equal(el.querySelector('[aria-label="Go to the Next Month"]').getAttribute('aria-disabled'), 'true');
    root.remove();
  });

  test('the next button turns the page and reports the month; two months show side by side', async () => {
    const root = await mount(html`<ui-calendar mode="range" month="2025-06" number-of-months="2" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    assert.equal(el.querySelectorAll('[role="grid"]').length, 2);
    const months = [];
    el.addEventListener('ui-month-change', (e) => months.push(e.detail.month));
    el.querySelector('[aria-label="Go to the Next Month"]').click();
    await tick();
    assert.deepEqual(months, ['2025-07']);
    assert.ok(el.textContent.includes('July 2025') && el.textContent.includes('August 2025'));
    root.remove();
  });

  test('show-outside-days="false" leaves the neighbouring months blank', async () => {
    const root = await mount(html`<ui-calendar month="2025-06" show-outside-days="false" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    assert.equal(btn(el, '2025-07-01'), null);
    assert.ok(btn(el, '2025-06-30'));
    root.remove();
  });

  test('caption-layout="dropdown" picks the month and year from selects', async () => {
    const root = await mount(html`<ui-calendar month="2025-06" caption-layout="dropdown" locale="en-US"></ui-calendar>`);
    await tick();
    const el = root.querySelector('ui-calendar');
    const [monthSel, yearSel] = el.querySelectorAll('select');
    assert.equal(monthSel.getAttribute('aria-label'), 'Choose the Month');
    monthSel.value = '1';
    monthSel.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    yearSel.value = '2024';
    el.querySelectorAll('select')[1].value = '2024';
    el.querySelectorAll('select')[1].dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    assert.ok(btn(el, '2024-02-29'), 'February 2024 is shown');
    root.remove();
  });
});

suite('ui-questionnaire', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/questionnaire.ts`);
  });

  const flow = (shortcuts = '') => html`
    <ui-questionnaire shortcuts=${shortcuts}>
      <ui-questionnaire-progress></ui-questionnaire-progress>
      <ui-questionnaire-item name="direction" required>
        <ui-questionnaire-title>What next?</ui-questionnaire-title>
        <ui-questionnaire-description>Pick one.</ui-questionnaire-description>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="delegation">Delegation</ui-questionnaire-choice>
          <ui-questionnaire-choice value="questions">Questions</ui-questionnaire-choice>
          <ui-questionnaire-input aria-label="Another answer"></ui-questionnaire-input>
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>
      <ui-questionnaire-item name="tags" multiple>
        <ui-questionnaire-title>Tags?</ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="a">A</ui-questionnaire-choice>
          <ui-questionnaire-choice value="b">B</ui-questionnaire-choice>
        </ui-questionnaire-choices>
      </ui-questionnaire-item>
      <ui-questionnaire-item name="skipped" disabled>
        <ui-questionnaire-title>Not asked</ui-questionnaire-title>
      </ui-questionnaire-item>
      <ui-questionnaire-item name="detail">
        <ui-questionnaire-title>Detail?</ui-questionnaire-title>
        <ui-questionnaire-choices>
          <ui-questionnaire-choice value="focused">Focused</ui-questionnaire-choice>
        </ui-questionnaire-choices>
      </ui-questionnaire-item>
      <ui-questionnaire-actions>
        <ui-questionnaire-previous></ui-questionnaire-previous>
        <ui-questionnaire-skip></ui-questionnaire-skip>
        <ui-questionnaire-next></ui-questionnaire-next>
        <ui-questionnaire-submit></ui-questionnaire-submit>
      </ui-questionnaire-actions>
    </ui-questionnaire>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-questionnaire');
    const form = el.querySelector('form');
    const fieldset = (name) => el.querySelector(`ui-questionnaire-item[name="${name}"] fieldset`);
    const button = (part) => el.querySelector(`[data-slot="questionnaire-${part}"]`);
    const shownButtons = () => ['previous', 'skip', 'next', 'submit'].filter((p) => !button(p).hidden);
    const radio = (name, value) => el.querySelector(`input[name="${name}"][value="${value}"]`);
    const progress = () => el.querySelector('[role="progressbar"]');
    return { el, form, fieldset, button, shownButtons, radio, progress };
  };

  test('one question shows at a time, named and described, with progress over the questions in the flow', async () => {
    const root = await mount(flow());
    await tick();
    const { el, fieldset, shownButtons, progress } = parts(root);
    assert.equal(fieldset('direction').hidden, false);
    assert.equal(fieldset('tags').hidden, true);
    assert.ok(fieldset('tags').inert, 'an off-screen question is inert');
    assert.equal(progress().textContent.trim(), 'Question 1 of 3', 'the disabled question is left out');
    assert.equal(progress().getAttribute('aria-valuenow'), '1');
    const fs = fieldset('direction');
    assert.equal(document.getElementById(fs.getAttribute('aria-labelledby')).textContent, 'What next?');
    assert.equal(document.getElementById(fs.getAttribute('aria-describedby')).textContent, 'Pick one.');
    assert.deepEqual(shownButtons(), ['next'], 'a required first question offers only Next');
    assert.ok(el.querySelector('form').noValidate, 'the element validates once it runs');
    root.remove();
  });

  test('Next refuses an unanswered required question, announcing the error; an answer clears it', async () => {
    const root = await mount(flow());
    await tick();
    const { el, fieldset, button, radio } = parts(root);
    button('next').click();
    await tick();
    const fs = fieldset('direction');
    assert.equal(fs.hidden, false, 'still on the first question');
    assert.equal(fs.getAttribute('aria-invalid'), 'true');
    const error = el.querySelector('[data-slot="questionnaire-error"]');
    assert.equal(error.hidden, false);
    assert.equal(error.getAttribute('role'), 'alert');
    assert.equal(error.textContent.trim(), 'Choose an answer to continue.');
    assert.ok(fs.getAttribute('aria-describedby').includes(error.id));
    radio('direction', 'questions').click();
    await tick();
    assert.equal(fs.hasAttribute('aria-invalid'), false, 'answering clears it');
    button('next').click();
    await tick();
    assert.equal(fieldset('tags').hidden, false, 'on to the next question');
    root.remove();
  });

  test('Previous goes back, Skip clears an optional question, the disabled one is skipped, and Submit ends it', async () => {
    const root = await mount(flow());
    await tick();
    const { el, form, fieldset, button, radio, shownButtons } = parts(root);
    radio('direction', 'delegation').click();
    button('next').click();
    await tick();
    assert.deepEqual(shownButtons(), ['previous', 'skip', 'next']);
    radio('tags', 'a').click();
    button('skip').click();
    await tick();
    assert.equal(radio('tags', 'a').checked, false, 'Skip leaves it unanswered');
    assert.equal(fieldset('detail').hidden, false, 'the disabled question is passed over');
    assert.deepEqual(shownButtons(), ['previous', 'skip', 'submit'], 'Submit on the last question');
    button('previous').click();
    await tick();
    assert.equal(fieldset('tags').hidden, false);
    const answers = new FormData(form);
    assert.equal(answers.get('direction'), 'delegation');
    let submitted = 0;
    form.addEventListener('submit', (e) => { submitted++; e.preventDefault(); });
    button('next').click();
    await tick();
    button('submit').click();
    await tick();
    assert.equal(submitted, 1, 'the last question submits the form');
    root.remove();
  });

  test('Enter submits the form, which steps forward until the last question', async () => {
    const root = await mount(flow());
    await tick();
    const { el, form, fieldset, radio } = parts(root);
    // Seen after the element's own handler (the event bubbles to the host),
    // and always cancelled so a real submit cannot navigate the suite away.
    const prevented = [];
    el.addEventListener('submit', (e) => { prevented.push(e.defaultPrevented); e.preventDefault(); });
    radio('direction', 'delegation').click();
    form.requestSubmit();
    await tick();
    assert.deepEqual(prevented, [true], 'the element held the submit back');
    assert.equal(fieldset('tags').hidden, false, 'a submit before the end goes to the next question');
    root.remove();
  });

  test('a multiple question takes several answers, and a typed answer clears a single question\'s choices', async () => {
    const root = await mount(flow());
    await tick();
    const { el, form, radio, button } = parts(root);
    radio('direction', 'questions').click();
    const text = el.querySelector('input[data-slot="questionnaire-input"]');
    text.value = 'Something else';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    assert.equal(radio('direction', 'questions').checked, false, 'the typed answer replaces the choice');
    assert.deepEqual(new FormData(form).getAll('direction'), ['Something else']);
    radio('direction', 'delegation').click();
    await tick();
    assert.equal(text.value, '', 'and a choice replaces the typed answer');
    button('next').click();
    await tick();
    assert.equal(radio('tags', 'a').type, 'checkbox');
    radio('tags', 'a').click();
    radio('tags', 'b').click();
    await tick();
    assert.deepEqual(new FormData(form).getAll('tags'), ['a', 'b']);
    assert.ok(radio('tags', 'a').closest('label').hasAttribute('data-checked'), 'a checked answer is marked for the styles');
    root.remove();
  });

  test('shortcuts: a letter picks the matching answer and the key is shown', async () => {
    const root = await mount(flow('letters'));
    await tick();
    const { el, radio } = parts(root);
    const shortcut = el.querySelector('ui-questionnaire-choice [data-slot="questionnaire-choice-shortcut"]');
    assert.equal(shortcut.textContent.trim(), 'A');
    assert.equal(shortcut.hidden, false);
    el.querySelector('form').dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    await tick();
    assert.equal(radio('direction', 'questions').checked, true);
    root.remove();
  });
});

suite('ui-carousel', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/carousel.ts`);
  });

  // This suite loads no stylesheet; these are the rules the classes give a
  // carousel, which scrolling and snapping need to exist at all.
  const LAYOUT = html`<style>
    [data-slot="carousel-content"] { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    [data-slot="carousel-content"] > div { display: flex; margin-inline-start: -16px; }
    ui-carousel-item { flex: 0 0 100%; min-width: 0; padding-inline-start: 16px; display: block; position: relative; box-sizing: border-box; }
    [data-carousel-snap] { position: absolute; width: 1px; height: 1px; scroll-snap-align: start; }
    .slide { height: 80px; }
  </style>`;
  const carousel = (attrs = '') => html`${LAYOUT}
    <div style="width: 300px; margin: 0 60px">
      <ui-carousel aria-label="Featured" ?loop=${attrs === 'loop'}>
        <ui-carousel-content>
          <ui-carousel-item><div class="slide">1</div></ui-carousel-item>
          <ui-carousel-item><div class="slide">2</div></ui-carousel-item>
          <ui-carousel-item class="authored"><div class="slide">3</div></ui-carousel-item>
        </ui-carousel-content>
        <ui-carousel-previous></ui-carousel-previous>
        <ui-carousel-next></ui-carousel-next>
      </ui-carousel>
    </div>`;
  const parts = (root) => {
    const el = root.querySelector('ui-carousel');
    const scroller = el.querySelector('[data-slot="carousel-content"]');
    const items = [...el.querySelectorAll('ui-carousel-item')];
    const prev = el.querySelector('[data-slot="carousel-previous"]');
    const next = el.querySelector('[data-slot="carousel-next"]');
    return { el, scroller, items, prev, next };
  };
  const until = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return fn();
  };

  test('a named region of slides, each a group, with the buttons named and disabled at the start', async () => {
    const root = await mount(carousel());
    await tick();
    const { el, items, prev, next } = parts(root);
    const region = el.querySelector('[data-slot="carousel"]');
    assert.equal(region.getAttribute('role'), 'region');
    assert.equal(region.getAttribute('aria-roledescription'), 'carousel');
    assert.equal(region.getAttribute('aria-label'), 'Featured');
    for (const item of items) {
      assert.equal(item.getAttribute('role'), 'group');
      assert.equal(item.getAttribute('aria-roledescription'), 'slide');
    }
    assert.ok(items[2].classList.contains('authored') && items[2].classList.contains('basis-full'), 'the author\'s classes are kept');
    assert.equal(prev.textContent.trim(), 'Previous slide');
    await until(() => prev.disabled && !next.disabled);
    assert.ok(prev.disabled, 'nothing before the first slide');
    assert.equal(next.disabled, false);
    root.remove();
  });

  test('Next steps one slide, resting where the first one does, and reports it', async () => {
    const root = await mount(carousel());
    await tick();
    const { el, scroller, items, prev, next } = parts(root);
    const changes = [];
    el.addEventListener('ui-slide-change', (e) => changes.push(e.detail.index));
    const restLeft = items[0].querySelector('[data-carousel-snap]').getBoundingClientRect().left;
    await until(() => !next.disabled);
    next.click();
    const mark = () => items[1].querySelector('[data-carousel-snap]').getBoundingClientRect().left;
    await until(() => Math.abs(mark() - restLeft) <= 1);
    assert.equal(el.selectedIndex, 1);
    await until(() => changes.length > 0);
    assert.deepEqual(changes.slice(-1), [1]);
    await until(() => !prev.disabled);
    assert.equal(prev.disabled, false);
    const snapLeft = items[1].querySelector('[data-carousel-snap]').getBoundingClientRect().left;
    assert.ok(Math.abs(snapLeft - restLeft) <= 1, `the slide rests where the first did (${snapLeft} vs ${restLeft})`);
    void scroller;
    root.remove();
  });

  test('the arrow keys step while focus is inside, and Next is disabled at the end', async () => {
    const root = await mount(carousel());
    await tick();
    const { el, next } = parts(root);
    const region = el.querySelector('[data-slot="carousel"]');
    await until(() => !next.disabled);
    next.focus();
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await until(() => el.selectedIndex === 1);
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await until(() => el.selectedIndex === 2);
    assert.equal(el.selectedIndex, 2);
    await until(() => next.disabled);
    assert.ok(next.disabled, 'nothing after the last slide');
    region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await until(() => el.selectedIndex === 1);
    assert.equal(el.selectedIndex, 1);
    root.remove();
  });

  test('the ends are re-measured when the strip resizes, not only when it scrolls', async () => {
    const root = await mount(carousel());
    await tick();
    const { items, next } = parts(root);
    await until(() => !next.disabled);
    // Removing slides connects nothing and scrolls nothing; only the strip
    // shrinking says there is no longer anywhere to go.
    items[1].remove();
    items[2].remove();
    await until(() => next.disabled);
    assert.ok(next.disabled, 'one slide left, so Next is disabled');
    root.remove();
  });

  test('the ends are re-measured when the container resizes', async () => {
    const root = await mount(html`${LAYOUT}<div data-testid="box" style="width: 250px; margin: 0 60px"><ui-carousel>
      <ui-carousel-content>
        <ui-carousel-item style="flex-basis: 100px"><div class="slide">1</div></ui-carousel-item>
        <ui-carousel-item style="flex-basis: 100px"><div class="slide">2</div></ui-carousel-item>
        <ui-carousel-item style="flex-basis: 100px"><div class="slide">3</div></ui-carousel-item>
      </ui-carousel-content>
      <ui-carousel-next></ui-carousel-next>
    </ui-carousel></div>`);
    await tick();
    const next = root.querySelector('[data-slot="carousel-next"]');
    await until(() => !next.disabled);
    assert.equal(next.disabled, false, 'three 100px slides overflow 250px');
    // No scroll and no window resize: only the strip's own size changes.
    root.querySelector('[data-testid="box"]').style.width = '600px';
    await until(() => next.disabled);
    assert.ok(next.disabled, 'they fit in 600px, so there is nowhere to go');
    root.remove();
  });

  test('loop wraps from the last slide to the first and keeps both buttons enabled', async () => {
    const root = await mount(carousel('loop'));
    await tick();
    const { el, prev, next } = parts(root);
    await tick();
    assert.equal(prev.disabled, false, 'loop never runs out');
    el.scrollTo(2);
    await until(() => el.selectedIndex === 2);
    next.click();
    await until(() => el.selectedIndex === 0);
    assert.equal(el.selectedIndex, 0);
    root.remove();
  });
});
