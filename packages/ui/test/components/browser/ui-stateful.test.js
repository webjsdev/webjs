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

suite('ui-resizable', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/resizable.ts`);
  });

  // This suite loads no stylesheet; the group needs the flex its class gives.
  const LAYOUT = html`<style>
    [data-slot="resizable-panel-group"] { display: flex; width: 400px; height: 120px; }
    [data-slot="resizable-panel-group"][aria-orientation="vertical"] { flex-direction: column; }
    ui-resizable-handle { display: block; flex: 0 0 4px; }
  </style>`;
  const group = (orientation = 'horizontal') => html`${LAYOUT}
    <ui-resizable-panel-group orientation=${orientation}>
      <ui-resizable-panel default-size="30" min-size="20" max-size="70">A</ui-resizable-panel>
      <ui-resizable-handle with-handle></ui-resizable-handle>
      <ui-resizable-panel>B</ui-resizable-panel>
    </ui-resizable-panel-group>`;
  const parts = (root) => {
    const el = root.querySelector('ui-resizable-panel-group');
    const [a, b] = el.querySelectorAll('ui-resizable-panel');
    const handle = el.querySelector('ui-resizable-handle');
    const size = (p) => Number(p.getAttribute('data-panel-size'));
    return { el, a, b, handle, size };
  };
  const key = (target, k) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  test('the default layout: a sized panel keeps its share and the other takes the rest', async () => {
    const root = await mount(group());
    await tick();
    const { a, b, size } = parts(root);
    assert.equal(size(a), 30);
    assert.equal(size(b), 70);
    assert.ok(Math.abs(a.getBoundingClientRect().width / (a.getBoundingClientRect().width + b.getBoundingClientRect().width) - 0.3) < 0.02, 'drawn at 30%');
    root.remove();
  });

  test('the handle is a focusable separator reporting the panel before it', async () => {
    const root = await mount(group());
    await tick();
    const { a, handle } = parts(root);
    assert.equal(handle.getAttribute('role'), 'separator');
    assert.equal(handle.tabIndex, 0);
    assert.equal(handle.getAttribute('aria-orientation'), 'vertical', 'a row of panels has an upright separator');
    assert.equal(handle.getAttribute('aria-controls'), a.id);
    assert.equal(handle.getAttribute('aria-valuenow'), '30');
    assert.equal(handle.getAttribute('aria-valuemin'), '20');
    assert.equal(handle.getAttribute('aria-valuemax'), '70');
    assert.ok(handle.querySelector('.cn-resizable-handle-icon'), 'with-handle draws the grip');
    root.remove();
  });

  test('the arrows move the boundary 10 points, Home and End to the limits, and report the layout', async () => {
    const root = await mount(group());
    await tick();
    const { el, a, b, handle, size } = parts(root);
    const layouts = [];
    el.addEventListener('ui-layout-change', (e) => layouts.push(e.detail.sizes));
    key(handle, 'ArrowRight');
    await tick();
    assert.deepEqual([size(a), size(b)], [40, 60]);
    assert.equal(handle.getAttribute('aria-valuenow'), '40');
    key(handle, 'End');
    await tick();
    assert.equal(size(a), 70, 'stops at the max-size');
    key(handle, 'Home');
    await tick();
    assert.equal(size(a), 20, 'stops at the min-size');
    assert.deepEqual(layouts[0], [40, 60]);
    root.remove();
  });

  test('ArrowLeft grows the panel before under dir="rtl"', async () => {
    const root = await mount(html`<div dir="rtl">${group()}</div>`);
    await tick();
    const { a, handle, size } = parts(root);
    key(handle, 'ArrowLeft');
    await tick();
    assert.equal(size(a), 40);
    root.remove();
  });

  test('a vertical group moves with Up / Down and draws a flat separator', async () => {
    const root = await mount(group('vertical'));
    await tick();
    const { a, handle, size } = parts(root);
    assert.equal(handle.getAttribute('aria-orientation'), 'horizontal');
    key(handle, 'ArrowDown');
    await tick();
    assert.equal(size(a), 40);
    key(handle, 'ArrowRight');
    await tick();
    assert.equal(size(a), 40, 'the cross arrows do nothing');
    root.remove();
  });

  test('dragging the handle moves the boundary with the pointer', async () => {
    const root = await mount(group());
    await tick();
    const { a, handle, size } = parts(root);
    const r = handle.getBoundingClientRect();
    const y = r.top + r.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left, clientY: y, pointerId: 1 }));
    // 40px of a 400px group is 10 points.
    handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 40, clientY: y, pointerId: 1 }));
    handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + 40, clientY: y, pointerId: 1 }));
    await tick();
    assert.ok(Math.abs(size(a) - 40) < 1.5, `about 40 after the drag (${size(a)})`);
    assert.equal(document.activeElement, handle, 'the dragged handle takes focus');
    root.remove();
  });
});

suite('ui-message-scroller', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/message-scroller.ts`);
  });

  // This suite loads no stylesheet; the viewport needs a height and a scroll.
  const LAYOUT = html`<style>
    [data-slot="message-scroller"] { position: relative; height: 200px; display: flex; flex-direction: column; }
    [data-slot="message-scroller-viewport"] { height: 200px; overflow-y: auto; }
    [data-slot="message-scroller-viewport"][data-pending-scroll] { visibility: hidden; }
    .msg { height: 60px; }
  </style>`;
  const messages = (n) => Array.from({ length: n }, (_, i) => html`<ui-message-scroller-item message-id=${`m${i + 1}`} ?scroll-anchor=${i === 2}><div class="msg">Message ${i + 1}</div></ui-message-scroller-item>`);
  const scroller = (attrs = {}) => html`${LAYOUT}
    <ui-message-scroller ?auto-scroll=${!!attrs.auto} default-scroll-position=${attrs.pos ?? 'end'}>
      <ui-message-scroller-viewport>
        <ui-message-scroller-content aria-label="Conversation">${messages(attrs.n ?? 8)}</ui-message-scroller-content>
      </ui-message-scroller-viewport>
      <ui-message-scroller-button></ui-message-scroller-button>
    </ui-message-scroller>`;
  const parts = (root) => {
    const el = root.querySelector('ui-message-scroller');
    const viewport = el.querySelector('[data-slot="message-scroller-viewport"]');
    const button = el.querySelector('[data-slot="message-scroller-button"]');
    const atEnd = () => viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 2;
    return { el, viewport, button, atEnd };
  };
  const until = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return fn();
  };

  test('it opens at the newest message and only then shows the viewport', async () => {
    const root = await mount(scroller());
    await tick();
    const { viewport, button, atEnd } = parts(root);
    await until(() => !viewport.hasAttribute('data-pending-scroll'));
    assert.equal(viewport.hasAttribute('data-pending-scroll'), false, 'revealed once placed');
    assert.ok(atEnd(), 'at the end');
    assert.equal(button.getAttribute('data-active'), 'false', 'nothing further to go');
    assert.equal(button.tabIndex, -1);
    const log = root.querySelector('[role="log"]');
    assert.equal(log.getAttribute('aria-relevant'), 'additions');
    assert.equal(log.getAttribute('aria-label'), 'Conversation');
    root.remove();
  });

  test('default-scroll-position="start" opens at the top, and the button takes the reader to the end', async () => {
    const root = await mount(scroller({ pos: 'start' }));
    await tick();
    const { viewport, button, atEnd } = parts(root);
    await until(() => !viewport.hasAttribute('data-pending-scroll'));
    assert.equal(viewport.scrollTop, 0);
    await until(() => button.getAttribute('data-active') === 'true');
    assert.equal(button.getAttribute('data-active'), 'true');
    assert.equal(button.textContent.trim(), 'Scroll to end');
    button.click();
    await until(atEnd);
    assert.ok(atEnd());
    root.remove();
  });

  test('last-anchor opens with the last anchored message at the top', async () => {
    const root = await mount(scroller({ pos: 'last-anchor' }));
    await tick();
    const { viewport } = parts(root);
    await until(() => !viewport.hasAttribute('data-pending-scroll'));
    const anchor = root.querySelector('ui-message-scroller-item[message-id="m3"]');
    assert.ok(Math.abs(anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top) <= 1);
    root.remove();
  });

  test('auto-scroll follows a new message at the end, and not once the reader has scrolled up', async () => {
    const root = await mount(scroller({ auto: true }));
    await tick();
    const { viewport, atEnd } = parts(root);
    await until(() => !viewport.hasAttribute('data-pending-scroll'));
    const content = root.querySelector('[data-slot="message-scroller-content"]');
    const add = (id) => {
      const item = document.createElement('ui-message-scroller-item');
      item.setAttribute('message-id', id);
      item.innerHTML = '<div class="msg">new</div>';
      content.appendChild(item);
    };
    // Wait for the new message to lay out first; until then the list has not
    // grown and "at the end" is trivially true.
    const grown = viewport.scrollHeight;
    add('n1');
    await until(() => viewport.scrollHeight > grown);
    await until(atEnd);
    assert.ok(viewport.scrollHeight > grown, 'the list grew');
    assert.ok(atEnd(), 'followed the new message');
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    await tick();
    add('n2');
    await tick();
    await tick();
    assert.equal(viewport.scrollTop, 0, 'left the reader where they were');
    root.remove();
  });

  test('scrollToMessage brings a message to the top, and the visible messages are reported', async () => {
    const root = await mount(scroller({ pos: 'start' }));
    await tick();
    const { el, viewport } = parts(root);
    await until(() => !viewport.hasAttribute('data-pending-scroll'));
    await until(() => el.visibleMessageIds.length > 0);
    assert.ok(el.visibleMessageIds.includes('m1'));
    el.scrollToMessage('m5', { behavior: 'auto' });
    const m5 = root.querySelector('ui-message-scroller-item[message-id="m5"]');
    await until(() => Math.abs(m5.getBoundingClientRect().top - viewport.getBoundingClientRect().top) <= 1);
    assert.ok(Math.abs(m5.getBoundingClientRect().top - viewport.getBoundingClientRect().top) <= 1);
    await until(() => el.visibleMessageIds.includes('m5') && !el.visibleMessageIds.includes('m1'));
    assert.ok(el.visibleMessageIds.includes('m5'));
    root.remove();
  });

  // shadcn's scrollEdgeThreshold: how near the end still counts as at it.
  test('scroll-edge-threshold decides how near the end still counts as at it', async () => {
    for (const [threshold, active] of [[null, 'true'], ['40', 'false']]) {
      const root = await mount(html`${LAYOUT}
        <ui-message-scroller default-scroll-position="start" scroll-edge-threshold=${threshold}>
          <ui-message-scroller-viewport><ui-message-scroller-content aria-label="C">${messages(8)}</ui-message-scroller-content></ui-message-scroller-viewport>
          <ui-message-scroller-button></ui-message-scroller-button>
        </ui-message-scroller>`);
      const { viewport, button } = parts(root);
      await until(() => !viewport.hasAttribute('data-pending-scroll'));
      // 20px short of the end: past shadcn's 8, inside a threshold of 40.
      viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight - 20;
      // The button was already active at the top, so wait for the scroll to
      // be measured rather than for a state it may already be in.
      await new Promise((r) => viewport.addEventListener('scroll', r, { once: true }));
      await tick();
      assert.equal(button.getAttribute('data-active'), active, `threshold ${threshold ?? 'default (8)'}`);
      root.remove();
    }
  });

  test('a label names the scroll button, and children replace its arrow', async () => {
    const root = await mount(html`${LAYOUT}
      <ui-message-scroller default-scroll-position="start">
        <ui-message-scroller-viewport><ui-message-scroller-content aria-label="C">${messages(8)}</ui-message-scroller-content></ui-message-scroller-viewport>
        <ui-message-scroller-button label="Zum Ende"></ui-message-scroller-button>
        <ui-message-scroller-button direction="start"><span class="own-icon">Up</span><span class="sr-only">Nach oben</span></ui-message-scroller-button>
      </ui-message-scroller>`);
    try {
      await tick();
      const [end, start] = root.querySelectorAll('[data-slot="message-scroller-button"]');
      assert.equal(end.getAttribute('aria-label'), 'Zum Ende');
      assert.equal(end.textContent.includes('Scroll to end'), false, 'the default name is not read beside the label');
      assert.ok(start.querySelector('.own-icon'), 'authored children render in the button');
      assert.equal(start.querySelector('svg'), null, 'in place of the arrow');
      assert.equal(start.textContent.includes('Scroll to start'), false);
    } finally {
      root.remove();
    }
  });
});

suite('ui-code-block-copy-button', () => {
  let copied = [];
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/code-block.ts`);
    // A headless run cannot rely on clipboard permission, so the clipboard is
    // stubbed; what is under test is what the button hands it.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t) => { copied.push(t); } },
    });
  });

  test('it copies its block\'s code, says Copied, and announces it', async () => {
    copied = [];
    const root = await mount(html`<div data-slot="code-block"><ui-code-block-copy-button></ui-code-block-copy-button><pre><code data-slot="code-block-code">npm run dev
npm run build</code></pre></div>`);
    await tick();
    const el = root.querySelector('ui-code-block-copy-button');
    const events = [];
    el.addEventListener('ui-copy', (e) => events.push(e.detail.text));
    const button = el.querySelector('button');
    assert.equal(button.getAttribute('aria-label'), 'Copy');
    button.click();
    await tick();
    assert.deepEqual(copied, ['npm run dev\nnpm run build']);
    assert.equal(button.getAttribute('aria-label'), 'Copied');
    assert.ok(button.hasAttribute('data-copied'));
    assert.equal(el.querySelector('[aria-live="polite"]').textContent, 'Copied');
    assert.deepEqual(events, ['npm run dev\nnpm run build']);
    root.remove();
  });

  test('a value overrides the block\'s code', async () => {
    copied = [];
    const root = await mount(html`<div data-slot="code-block"><ui-code-block-copy-button value="pnpm dlx webjs"></ui-code-block-copy-button><pre><code>ignored</code></pre></div>`);
    await tick();
    root.querySelector('ui-code-block-copy-button button').click();
    await tick();
    assert.deepEqual(copied, ['pnpm dlx webjs']);
    root.remove();
  });
});

suite('ui-sidebar', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/sidebar.ts`);
  });

  const layout = (defaultOpen = 'true') => html`
    <ui-sidebar-provider default-open=${defaultOpen}>
      <ui-sidebar collapsible="icon"><nav aria-label="Main"><a href="#inbox">Inbox</a></nav><ui-sidebar-rail></ui-sidebar-rail></ui-sidebar>
      <ui-sidebar-inset><ui-sidebar-trigger></ui-sidebar-trigger></ui-sidebar-inset>
    </ui-sidebar-provider>`;
  const parts = (root) => {
    const provider = root.querySelector('ui-sidebar-provider');
    const sidebar = root.querySelector('ui-sidebar');
    const trigger = root.querySelector('[data-slot="sidebar-trigger"]');
    const rail = root.querySelector('[data-slot="sidebar-rail"]');
    return { provider, sidebar, trigger, rail };
  };

  test('the trigger collapses the sidebar to icons, keeps the choice in the cookie, and reports it', async () => {
    const root = await mount(layout());
    await tick();
    const { provider, sidebar, trigger } = parts(root);
    assert.equal(sidebar.getAttribute('data-state'), 'expanded');
    assert.equal(sidebar.getAttribute('data-collapsible'), '');
    const seen = [];
    provider.addEventListener('ui-open-change', (e) => seen.push(e.detail.open));
    trigger.click();
    await tick();
    assert.equal(sidebar.getAttribute('data-state'), 'collapsed');
    assert.equal(sidebar.getAttribute('data-collapsible'), 'icon');
    assert.deepEqual(seen, [false]);
    assert.ok(document.cookie.includes('sidebar_state=false'), 'the cookie remembers it');
    trigger.click();
    await tick();
    assert.equal(sidebar.getAttribute('data-state'), 'expanded');
    root.remove();
  });

  test('Ctrl+B and the rail toggle it too', async () => {
    const root = await mount(layout());
    await tick();
    const { sidebar, rail } = parts(root);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }));
    await tick();
    assert.equal(sidebar.getAttribute('data-state'), 'collapsed');
    rail.click();
    await tick();
    assert.equal(sidebar.getAttribute('data-state'), 'expanded');
    assert.equal(rail.getAttribute('aria-label'), 'Toggle Sidebar');
    root.remove();
  });

  test('default-open="false" starts collapsed', async () => {
    const root = await mount(layout('false'));
    await tick();
    const { sidebar } = parts(root);
    assert.equal(sidebar.getAttribute('data-state'), 'collapsed');
    root.remove();
  });

  test('the sidebar is the peer the inset follows, and the inset is the main landmark', async () => {
    const root = await mount(layout());
    await tick();
    const { sidebar } = parts(root);
    const inset = root.querySelector('ui-sidebar-inset');
    assert.ok(sidebar.classList.contains('peer') && sidebar.classList.contains('group'));
    let next = sidebar.nextElementSibling;
    while (next && next !== inset) next = next.nextElementSibling;
    assert.equal(next, inset, 'the inset follows the sidebar as a sibling, so peer-data-* reaches it');
    assert.equal(inset.getAttribute('role'), 'main');
    root.remove();
  });

  test('on a phone it opens as a modal sheet named Sidebar, holding the same content', async () => {
    const root = await mount(layout());
    await tick();
    const { provider, sidebar, trigger } = parts(root);
    provider.isMobile = true;
    await tick();
    await tick();
    const dialog = sidebar.querySelector('dialog');
    assert.ok(dialog, 'a sheet is drawn');
    assert.ok(sidebar.querySelector('a[href="#inbox"]'), 'with the authored content inside');
    trigger.click();
    await tick();
    await tick();
    assert.ok(dialog.open, 'the trigger opens it');
    assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent, 'Sidebar');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    dialog.close();
    await tick();
    await tick();
    assert.equal(provider.openMobile, false, 'closing the sheet closes the phone sidebar');
    root.remove();
  });

  test('the phone sheet is --sidebar-width-mobile wide, 18rem when nothing sets it', async () => {
    for (const [style, want] of [[null, '18rem'], ['--sidebar-width-mobile: 20rem', '20rem']]) {
      const root = await mount(layout());
      const { provider, sidebar } = parts(root);
      if (style) provider.setAttribute('style', style);
      provider.isMobile = true;
      await tick();
      await tick();
      const sheet = sidebar.querySelector('[data-mobile="true"]');
      assert.ok(sheet, 'the phone sheet is drawn');
      assert.equal(getComputedStyle(sheet).getPropertyValue('--sidebar-width').trim(), want, `the sheet's width with ${style ?? 'nothing set'}`);
      root.remove();
    }
  });
});

suite('ui-switch', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/switch.ts`);
  });

  test('a click toggles the real checkbox, and the root and thumb follow', async () => {
    const root = await mount(html`<ui-switch name="wifi" aria-label="Wi-Fi"></ui-switch>`);
    try {
      const sw = root.querySelector('ui-switch');
      const input = root.querySelector('input[role="switch"]');
      const changes = [];
      sw.addEventListener('ui-checked-change', (e) => changes.push(e.detail.checked));
      assert.equal(input.checked, false);
      input.click();
      await tick();
      assert.equal(input.checked, true, 'the checkbox is checked');
      assert.equal(root.querySelector('[data-slot="switch"]').dataset.state, 'checked', 'the root says checked');
      assert.equal(root.querySelector('[data-slot="switch-thumb"]').dataset.state, 'checked', 'and so does the thumb');
      assert.deepEqual(changes, [true], 'ui-checked-change reports it');
    } finally {
      root.remove();
    }
  });

  test('a wrapping label names and toggles it, and it submits with its form', async () => {
    const root = await mount(html`<form><label><ui-switch name="notify" value="yes"></ui-switch> Notifications</label></form>`);
    try {
      const input = root.querySelector('input[role="switch"]');
      root.querySelector('label').click();
      await tick();
      assert.equal(input.checked, true, 'the label toggles it');
      assert.equal(new FormData(root.querySelector('form')).get('notify'), 'yes', 'and the form submits its value');
      assert.equal(root.querySelector('[data-slot="switch"]').dataset.state, 'checked');
    } finally {
      root.remove();
    }
  });
});

suite('ui-select: an unlabelled optgroup', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/select.ts`);
  });

  test('is shadcn\'s SelectGroup with no SelectLabel: a group of the options, with no heading', async () => {
    const root = await mount(html`<ui-select><select aria-label="Currency"><optgroup><option value="usd" selected>USD</option><option value="eur">EUR</option></optgroup></select></ui-select>`);
    try {
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const group = root.querySelector('[data-slot="select-group"]');
      assert.ok(group, 'the options sit in a group, which carries the style\'s spacing');
      assert.equal(group.querySelectorAll('[role="option"]').length, 2);
      assert.equal(root.querySelector('[data-slot="select-label"]'), null, 'with no heading row');
      assert.equal(group.hasAttribute('aria-labelledby'), false, 'and no reference to a missing label');
    } finally {
      root.remove();
    }
  });
});

suite('ui-select: an item with more in it than its label', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/select.ts`);
  });

  // shadcn's /colors format picker: each SelectItem is a name over a muted
  // value, while the trigger names the format alone. Parsed from markup, as a
  // server-rendered page is, since that is the parser path a <template> inside
  // an <option> has to survive.
  test('a <template> in an option fills its item, and the trigger and the native select keep the label', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    root.innerHTML = '<ui-select><select aria-label="Format">'
      + '<option value="hex" class="gap-2 rounded-lg" selected><template><span class="font-medium">hex</span><span class="font-mono text-xs">#3b82f6</span></template>hex</option>'
      + '<option value="rgb">rgb</option>'
      + '</select></ui-select>';
    try {
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const select = root.querySelector('select');
      assert.equal(select.options[0].text, 'hex', 'the template adds no text to the option');
      const items = () => root.querySelectorAll('[data-slot="select-item"]');
      const hexText = items()[0].lastElementChild;
      assert.equal(hexText.children.length, 2, 'the item renders the template\'s two parts');
      assert.equal(hexText.querySelector('.font-mono')?.textContent, '#3b82f6');
      assert.ok(items()[0].classList.contains('rounded-lg'), 'the option\'s class lands on its item');
      assert.ok(items()[0].classList.contains('cn-select-item'), 'beside the item\'s own classes');
      assert.equal(items()[1].lastElementChild.textContent, 'rgb', 'an option with no template shows its label');
      const value = () => root.querySelector('[data-slot="select-value"]').textContent.trim();
      assert.equal(value(), 'hex', 'the trigger shows the label alone');

      items()[1].click();
      await tick();
      assert.equal(select.value, 'rgb');
      items()[0].click();
      await tick();
      assert.equal(select.value, 'hex');
      assert.equal(value(), 'hex', 'chosen again, the trigger still shows the label alone');
      assert.equal(items()[0].lastElementChild.querySelector('.font-mono')?.textContent, '#3b82f6', 'and the item keeps its content');
    } finally {
      root.remove();
    }
  });
});

suite('ui-select: trigger content, panel class and align', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/select.ts`);
  });

  // shadcn's /colors format picker: SelectTrigger children "Format: hex", a
  // rounded-xl SelectContent, align="end" under position="popper".
  test('a trigger template renders with the value filled in, hidden from assistive technology beside the label', async () => {
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;justify-content:center;padding:40px';
    document.body.appendChild(root);
    // The kit suite loads no Tailwind, so give the content-class its width here.
    root.innerHTML = '<style>.w-64 { width: 16rem; }</style><ui-select position="popper" align="end" content-class="rounded-xl w-64">'
      + '<template data-select-trigger><span class="fmt-prefix">Format: </span><span data-slot="select-value" class="fmt-value"></span></template>'
      + '<select aria-label="Format"><option value="hex" selected>hex</option><option value="rgb">rgb</option></select>'
      + '</ui-select>';
    try {
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const trigger = root.querySelector('[data-slot="select-trigger"]');
      const custom = trigger.querySelector('[data-slot="select-trigger-content"]');
      assert.ok(custom, 'the template renders in the trigger');
      assert.equal(custom.getAttribute('aria-hidden'), 'true');
      assert.equal(custom.querySelector('.fmt-prefix')?.textContent, 'Format: ');
      assert.equal(custom.querySelector('.fmt-value')?.textContent, 'hex', 'the value slot carries the label');
      assert.equal(trigger.querySelector('.sr-only')?.textContent, 'hex', 'the trigger still reads as the label');
      assert.equal(root.querySelector('select').options[0].text, 'hex', 'the native select is untouched');

      root.querySelectorAll('[data-slot="select-item"]')[1].click();
      await tick();
      assert.equal(trigger.querySelector('.fmt-value')?.textContent, 'rgb', 'a new choice refills the value slot');
      assert.equal(trigger.querySelector('.sr-only')?.textContent, 'rgb');

      const panel = root.querySelector('[data-slot="select-content"]');
      assert.ok(panel.classList.contains('rounded-xl') && panel.classList.contains('cn-select-content'), 'content-class lands on the panel beside its own classes');
      assert.equal(panel.dataset.align, 'end');
      trigger.click();
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      // The kit suite loads no stylesheet, so the panel keeps the UA popover
      // insets; read the left the element placed it at rather than its box.
      const t = trigger.getBoundingClientRect();
      const width = panel.getBoundingClientRect().width;
      const left = parseFloat(panel.style.left);
      assert.ok(Math.abs(left + width - t.right) < 2, `align="end" lines the panel's end up with the trigger's (${left + width} vs ${t.right})`);
      assert.ok(Math.abs(left - t.left) > 2, 'which is not where align="start" would put it');
    } finally {
      root.remove();
    }
  });
});

suite('ui-message-scroller: the parts render the boxes, not their hosts', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/message-scroller.ts`);
  });

  test('the viewport is a flex item of the frame, so it scrolls at the frame\'s height', async () => {
    // Only what the base classes say: the frame is a column (flex, size-full,
    // min-h-0, overflow-hidden), the viewport is size-full min-h-0 with
    // overflow-y-auto, and the button is absolute. Nothing gives the viewport
    // a height of its own, so it scrolls only if no block host sits between
    // it and the frame.
    const root = await mount(html`<style>
        .ms-box { height: 200px; }
        .ms-box .contents { display: contents; }
        [data-slot="message-scroller"] { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
        [data-slot="message-scroller-viewport"] { height: 100%; min-height: 0; overflow-y: auto; }
        .ms-row { height: 60px; }
        [data-slot="message-scroller-button"] { position: absolute; }
      </style>
      <div class="ms-box">
        <ui-message-scroller class="ms-authored">
          <ui-message-scroller-viewport class="vp-authored">
            <ui-message-scroller-content aria-label="Conversation" class="p-4">
              ${Array.from({ length: 8 }, (_, i) => html`<ui-message-scroller-item message-id=${`r${i}`}><div class="ms-row">Row ${i}</div></ui-message-scroller-item>`)}
            </ui-message-scroller-content>
          </ui-message-scroller-viewport>
          <ui-message-scroller-button class="btn-authored"></ui-message-scroller-button>
        </ui-message-scroller>
      </div>`);
    try {
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const el = root.querySelector('ui-message-scroller');
      const viewport = el.querySelector('[data-slot="message-scroller-viewport"]');
      assert.equal(Math.round(viewport.clientHeight), 200, 'the viewport is as tall as the frame');
      assert.ok(viewport.scrollHeight > 400, 'and its messages overflow it');
      for (const tag of ['ui-message-scroller', 'ui-message-scroller-viewport', 'ui-message-scroller-content', 'ui-message-scroller-button']) {
        assert.equal(el.matches(tag) ? el.getAttribute('class') : el.querySelector(tag).getAttribute('class'), 'contents', `<${tag}> lays out its children directly`);
      }
      assert.match(el.querySelector('[data-slot="message-scroller"]').className, /\bms-authored\b/, 'the class written on the root lands on the frame');
      assert.match(viewport.className, /\bvp-authored\b/);
      assert.match(el.querySelector('[data-slot="message-scroller-content"]').className, /\bp-4\b/, 'and on the content, the list (shadcn\'s p-(--card-spacing))');
      assert.match(el.querySelector('button[data-slot="message-scroller-button"]').className, /\bbtn-authored\b/);
    } finally {
      root.remove();
    }
  });
});

suite('ui-message-scroller: a new anchored turn settles near the top', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/message-scroller.ts`);
  });

  const until = async (fn, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return fn();
  };

  test('it sits 64px below the top, and stays there while the reply grows under it', async () => {
    // Only what the base classes say, as in the suite above, plus a list
    // padding the anchoring has to account for.
    const root = await mount(html`<style>
        .an-box { height: 300px; }
        .an-box .contents { display: contents; }
        .an-box [data-slot="message-scroller"] { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
        .an-box [data-slot="message-scroller-viewport"] { height: 100%; min-height: 0; overflow-y: auto; }
        .an-box [data-slot="message-scroller-content"] { display: flex; flex-direction: column; gap: 10px; padding-top: 20px; }
        .an-box [data-slot="message-scroller-button"] { position: absolute; }
        .an-row { height: 100px; }
      </style>
      <div class="an-box">
        <ui-message-scroller>
          <ui-message-scroller-viewport>
            <ui-message-scroller-content aria-label="Conversation">
              <ui-message-scroller-item message-id="q1" scroll-anchor><div class="an-row">Question</div></ui-message-scroller-item>
              <ui-message-scroller-item message-id="a1"><div class="an-row">Answer</div></ui-message-scroller-item>
            </ui-message-scroller-content>
          </ui-message-scroller-viewport>
          <ui-message-scroller-button></ui-message-scroller-button>
        </ui-message-scroller>
      </div>`);
    try {
      const el = root.querySelector('ui-message-scroller');
      await until(() => !el.pending);
      const viewport = el.querySelector('[data-slot="message-scroller-viewport"]');
      const list = el.querySelector('ui-message-scroller-content');
      assert.equal(viewport.scrollTop, 0, 'two turns fit, nothing to scroll yet');

      const ask = (id, tag) => {
        const item = document.createElement('ui-message-scroller-item');
        item.setAttribute('message-id', id);
        if (tag) item.setAttribute('scroll-anchor', '');
        const row = document.createElement('div');
        row.className = 'an-row';
        item.append(row);
        list.append(item);
        return { item, row };
      };
      const { item: q2 } = ask('q2', true);
      // q2's top in the list: padding 20 + two 100px rows + two 10px gaps.
      const target = 20 + 2 * 100 + 2 * 10 - 20 - 64;
      assert.ok(await until(() => Math.abs(viewport.scrollTop - target) <= 1), `scrolled to ${target} (at ${viewport.scrollTop})`);
      const spacer = el.querySelector('[data-message-scroller-spacer]');
      assert.equal(spacer.hidden, false, 'a tail spacer makes the room to scroll that far');
      assert.equal(getComputedStyle(spacer).overflowAnchor, 'none', 'and is never the browser\'s scroll anchor');
      const spacerBefore = spacer.getBoundingClientRect().height;
      const turnTop = () => Math.round(q2.getBoundingClientRect().top - viewport.getBoundingClientRect().top);
      // Let a smooth scroll finish its last pixel.
      await until(() => turnTop() === 84);
      assert.equal(turnTop(), 84, 'the question sits the padding plus a 64px peek below the top');

      // The reply arrives and grows a little at a time.
      const { row } = ask('a2', false);
      row.style.height = '20px';
      for (const h of [40, 60, 80]) {
        await tick();
        row.style.height = `${h}px`;
        await tick();
        await tick();
        assert.ok(Math.abs(turnTop() - 84) <= 1, `the question stays put while the reply is ${h}px (at ${turnTop()})`);
      }
      assert.ok(spacer.getBoundingClientRect().height < spacerBefore, 'the spacer gives up the room the reply took');
    } finally {
      root.remove();
    }
  });
});

suite('ui-command: a class on a part lands on the element it renders', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/command.ts`);
  });

  test('as shadcn\'s className does on Command, CommandInput, CommandList, CommandEmpty, CommandGroup and CommandItem', async () => {
    const root = await mount(html`<ui-command label="Search" class="c-root">
      <ui-command-input class="c-input" placeholder="Search"></ui-command-input>
      <ui-command-list class="c-list">
        <ui-command-empty class="c-empty">No results.</ui-command-empty>
        <ui-command-group heading="Pages" class="c-group">
          <ui-command-item class="c-item">Home</ui-command-item>
        </ui-command-group>
      </ui-command-list>
    </ui-command>`);
    try {
      await tick();
      await tick();
      const pairs = [
        ['ui-command', '[data-slot="command"]', 'c-root'],
        ['ui-command-input', 'input[data-slot="command-input"]', 'c-input'],
        ['ui-command-list', '[data-slot="command-list"]', 'c-list'],
        ['ui-command-empty', '[data-slot="command-empty"]', 'c-empty'],
        ['ui-command-group', '[data-slot="command-group"]', 'c-group'],
        ['ui-command-item', '[data-slot="command-item"]', 'c-item'],
      ];
      for (const [host, part, cls] of pairs) {
        assert.match(root.querySelector(part).className, new RegExp(`\\b${cls}\\b`), `${host}'s class is on ${part}`);
        assert.equal(root.querySelector(host).getAttribute('class'), null, `and ${host} is left bare`);
      }
    } finally {
      root.remove();
    }
  });
});

suite('base form: a part whose box shadcn renders is the box here too', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/command.ts`);
    await import(`${COMPONENTS_DIR}/resizable.ts`);
    await import(`${COMPONENTS_DIR}/select.ts`);
    await import(`${COMPONENTS_DIR}/questionnaire.ts`);
  });

  test('a command shortcut is the item\'s flex item, so its auto start margin ends the row', async () => {
    const root = await mount(html`<style>
        [data-slot="command-item"] { display: flex; width: 300px; }
        [data-slot="command-item"] > svg { display: none; }
        [data-slot="command-shortcut"] { margin-inline-start: auto; }
      </style>
      <ui-command label="Menu">
        <ui-command-list>
          <ui-command-item>Profile<ui-command-shortcut class="sc-authored">P</ui-command-shortcut></ui-command-item>
        </ui-command-list>
      </ui-command>`);
    try {
      await tick();
      const host = root.querySelector('ui-command-shortcut');
      const span = host.querySelector('[data-slot="command-shortcut"]');
      const item = root.querySelector('[data-slot="command-item"]');
      assert.equal(getComputedStyle(host).display, 'contents', 'the host draws no box');
      assert.match(span.className, /\bsc-authored\b/, 'the class written on the host lands on the span');
      assert.ok(Math.abs(span.getBoundingClientRect().right - item.getBoundingClientRect().right) < 1, 'the shortcut ends the row');
    } finally {
      root.remove();
    }
  });

  test('the command box sizes against its parent, as shadcn\'s Command does', async () => {
    const root = await mount(html`<style>
        .cmd-row { display: flex; justify-content: center; width: 600px; }
        [data-slot="command"] { width: 100%; }
        .cmd-max { max-width: 384px; }
      </style>
      <div class="cmd-row"><ui-command label="Menu" class="cmd-max"><ui-command-list></ui-command-list></ui-command></div>`);
    try {
      await tick();
      assert.equal(getComputedStyle(root.querySelector('ui-command')).display, 'contents');
      assert.equal(Math.round(root.querySelector('[data-slot="command"]').getBoundingClientRect().width), 384);
    } finally {
      root.remove();
    }
  });

  test('a panel group\'s class sizes the group box, and a nested group fills its panel', async () => {
    const root = await mount(html`<style>
        .rz-row { display: flex; justify-content: center; width: 800px; height: 240px; }
        .rz-max { max-width: 384px; }
        [data-slot="resizable-panel-group"] { display: flex; width: 100%; height: 100%; }
        [data-slot="resizable-panel-group"][aria-orientation="vertical"] { flex-direction: column; }
        .rz-tall { height: 200px; }
      </style>
      <div class="rz-row">
        <ui-resizable-panel-group orientation="horizontal" class="rz-max">
          <ui-resizable-panel default-size="50"><div class="rz-tall">One</div></ui-resizable-panel>
          <ui-resizable-handle></ui-resizable-handle>
          <ui-resizable-panel default-size="50">
            <ui-resizable-panel-group orientation="vertical">
              <ui-resizable-panel default-size="25">Two</ui-resizable-panel>
              <ui-resizable-handle></ui-resizable-handle>
              <ui-resizable-panel default-size="75">Three</ui-resizable-panel>
            </ui-resizable-panel-group>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
      </div>`);
    try {
      await tick();
      await tick();
      const outer = root.querySelector('ui-resizable-panel-group');
      const box = outer.querySelector('[data-slot="resizable-panel-group"]');
      assert.equal(getComputedStyle(outer).display, 'contents', 'the host draws no box');
      assert.match(box.className, /\brz-max\b/, 'the class written on the host lands on the group box');
      assert.equal(Math.round(box.getBoundingClientRect().width), 384, 'and the box takes the row\'s width up to its max');
      const [two, three] = outer.querySelector('ui-resizable-panel-group').querySelectorAll('ui-resizable-panel');
      assert.equal(Math.round(two.getBoundingClientRect().height), 60, 'the nested panels share the panel\'s height');
      assert.equal(Math.round(three.getBoundingClientRect().height), 180);
    } finally {
      root.remove();
    }
  });

  test('the select trigger is the flex item, so a full width sizes against the row', async () => {
    const root = await mount(html`<style>
        .sel-row { display: flex; justify-content: center; width: 600px; }
        .sel-row .contents { display: contents; }
        .sel-w { width: 100%; max-width: 192px; }
      </style>
      <div class="sel-row">
        <ui-select placeholder="Fruit">
          <select aria-label="Fruit" class="sel-w"><option value="" disabled selected hidden>Fruit</option><option value="a">Apple</option></select>
        </ui-select>
      </div>`);
    try {
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const host = root.querySelector('ui-select');
      const trigger = host.querySelector('[data-slot="select-trigger"]');
      assert.ok(trigger, 'the select upgraded');
      assert.equal(getComputedStyle(host).display, 'contents', 'the host draws no box');
      assert.equal(Math.round(trigger.getBoundingClientRect().width), 192);
    } finally {
      root.remove();
    }
  });

  test('questionnaire hosts draw no box, so a hidden question adds no gap and the root\'s class lands on the form', async () => {
    const root = await mount(html`<style>
        [data-slot="questionnaire"] { display: flex; flex-direction: column; gap: 16px; }
      </style>
      <ui-questionnaire class="q-authored">
        <ui-questionnaire-item name="one">
          <ui-questionnaire-title>One?</ui-questionnaire-title>
          <ui-questionnaire-choices><ui-questionnaire-choice value="a">A</ui-questionnaire-choice></ui-questionnaire-choices>
        </ui-questionnaire-item>
        <ui-questionnaire-item name="two">
          <ui-questionnaire-title>Two?</ui-questionnaire-title>
          <ui-questionnaire-choices><ui-questionnaire-choice value="b">B</ui-questionnaire-choice></ui-questionnaire-choices>
        </ui-questionnaire-item>
        <ui-questionnaire-item name="three">
          <ui-questionnaire-title>Three?</ui-questionnaire-title>
          <ui-questionnaire-choices><ui-questionnaire-choice value="c">C</ui-questionnaire-choice></ui-questionnaire-choices>
        </ui-questionnaire-item>
        <ui-questionnaire-actions><ui-questionnaire-next></ui-questionnaire-next></ui-questionnaire-actions>
      </ui-questionnaire>`);
    try {
      await tick();
      await tick();
      const el = root.querySelector('ui-questionnaire');
      const form = el.querySelector('form');
      assert.match(form.className, /\bq-authored\b/, 'the root\'s class lands on the form');
      for (const host of [el, ...el.querySelectorAll('ui-questionnaire-item, ui-questionnaire-title, ui-questionnaire-choices, ui-questionnaire-choice, ui-questionnaire-actions, ui-questionnaire-next')]) {
        assert.equal(getComputedStyle(host).display, 'contents', `<${host.localName}> draws no box`);
      }
      const shown = el.querySelector('ui-questionnaire-item[name="one"] fieldset');
      const actions = el.querySelector('[data-slot="questionnaire-actions"]');
      assert.equal(shown.hidden, false);
      assert.equal(Math.round(actions.getBoundingClientRect().top - shown.getBoundingClientRect().bottom), 16, 'one gap between the shown question and the actions');
    } finally {
      root.remove();
    }
  });
});

// --------------------------------------------------------------------------
// A part that moves its authored class to the element it renders keeps it
// across server render plus hydration: the HTML the server sends is put in
// the document and the elements upgrade from it, as on a page load.
// --------------------------------------------------------------------------

suite('host class: server render plus hydration', () => {
  let renderToString;
  suiteSetup(async () => {
    ({ renderToString } = await import('../../../../core/src/render-server.js'));
    for (const name of ['tabs', 'message-scroller', 'command', 'dialog', 'alert-dialog', 'resizable', 'context-menu', 'hover-card', 'questionnaire', 'dropdown-menu']) {
      await import(`${COMPONENTS_DIR}/${name}.ts`);
    }
  });

  /** Render on the server, put the HTML in the document, let it upgrade. */
  async function hydrate(tpl) {
    const out = await renderToString(tpl);
    const root = document.createElement('div');
    root.innerHTML = out;
    document.body.appendChild(root);
    await tick();
    await tick();
    return root;
  }
  const classes = (el) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

  const CASES = [
    ['ui-tabs-list', '[role="tablist"]', 'cn-tabs-list', html`<ui-tabs value="a"><ui-tabs-list class="w-full tl-authored"><ui-tabs-trigger value="a" class="tt-authored">A</ui-tabs-trigger></ui-tabs-list><ui-tabs-content value="a">A</ui-tabs-content></ui-tabs>`, 'tl-authored'],
    ['ui-tabs-trigger', '[role="tab"]', 'cn-tabs-trigger', html`<ui-tabs value="a"><ui-tabs-list><ui-tabs-trigger value="a" class="tt-authored">A</ui-tabs-trigger></ui-tabs-list></ui-tabs>`, 'tt-authored'],
    ['ui-message-scroller', '[data-slot="message-scroller"]', 'cn-message-scroller', html`<ui-message-scroller class="ms-authored"><ui-message-scroller-viewport><ui-message-scroller-content aria-label="Log"></ui-message-scroller-content></ui-message-scroller-viewport></ui-message-scroller>`, 'ms-authored'],
    ['ui-command-input', 'input[data-slot="command-input"]', 'cn-command-input', html`<ui-command label="Menu" class="c-root"><ui-command-input class="ci-authored" placeholder="Search"></ui-command-input><ui-command-list><ui-command-item class="it-authored">A<ui-command-shortcut class="sc-authored">P</ui-command-shortcut></ui-command-item></ui-command-list></ui-command>`, 'ci-authored'],
    ['ui-command', '[data-slot="command"]', 'cn-command', html`<ui-command label="Menu" class="c-root"><ui-command-list></ui-command-list></ui-command>`, 'c-root'],
    ['ui-command-shortcut', '[data-slot="command-shortcut"]', 'cn-command-shortcut', html`<ui-command label="Menu"><ui-command-list><ui-command-item>A<ui-command-shortcut class="sc-authored">P</ui-command-shortcut></ui-command-item></ui-command-list></ui-command>`, 'sc-authored'],
    ['ui-dialog-content', '[data-slot="dialog-content"]', 'cn-dialog-content', html`<ui-dialog><ui-dialog-content class="dc-authored"><h2 data-slot="dialog-title">T</h2></ui-dialog-content></ui-dialog>`, 'dc-authored'],
    ['ui-alert-dialog-content', '[data-slot="alert-dialog-content"]', 'cn-alert-dialog-content', html`<ui-alert-dialog><ui-alert-dialog-content class="ad-authored"><h2 data-slot="alert-dialog-title">T</h2></ui-alert-dialog-content></ui-alert-dialog>`, 'ad-authored'],
    ['ui-resizable-panel-group', '[data-slot="resizable-panel-group"]', 'cn-resizable-panel-group', html`<ui-resizable-panel-group class="rz-authored"><ui-resizable-panel default-size="100">A</ui-resizable-panel></ui-resizable-panel-group>`, 'rz-authored'],
    ['ui-context-menu-trigger', '[data-slot="context-menu-trigger"]', 'cn-context-menu-trigger', html`<ui-context-menu><ui-context-menu-trigger class="ct-authored">Area</ui-context-menu-trigger><ui-context-menu-content><ui-context-menu-item>A</ui-context-menu-item></ui-context-menu-content></ui-context-menu>`, 'ct-authored'],
    ['ui-hover-card-content', '[data-slot="hover-card-content"]', 'cn-hover-card-content', html`<ui-hover-card><ui-hover-card-trigger><a href="#x">x</a></ui-hover-card-trigger><ui-hover-card-content class="hc-authored">Card</ui-hover-card-content></ui-hover-card>`, 'hc-authored'],
    ['ui-dropdown-menu-content', '[role="menu"]', 'cn-dropdown-menu-content', html`<ui-dropdown-menu><ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger><ui-dropdown-menu-content class="dm-authored"><ui-dropdown-menu-item>A</ui-dropdown-menu-item></ui-dropdown-menu-content></ui-dropdown-menu>`, 'dm-authored'],
    ['ui-questionnaire', 'form[data-slot="questionnaire"]', 'cn-questionnaire', html`<ui-questionnaire class="q-authored"><ui-questionnaire-item name="a"><ui-questionnaire-title>A?</ui-questionnaire-title></ui-questionnaire-item></ui-questionnaire>`, 'q-authored'],
  ];

  for (const [host, part, base, tpl, authored] of CASES) {
    test(`<${host}>: the authored class, plus the base classes, on the rendered element after hydration`, async () => {
      const root = await hydrate(tpl);
      try {
        const el = root.querySelector(host).querySelector(part);
        assert.ok(el, `${host} rendered ${part}`);
        const list = classes(el);
        assert.ok(list.includes(authored), `${part} carries ${authored}: ${list.join(' ')}`);
        assert.ok(list.includes(base), `${part} keeps ${base}`);
        assert.ok(!list.includes('contents'), `${part} is not display: contents: ${list.join(' ')}`);
      } finally {
        root.remove();
      }
    });
  }

  test('a part with no authored class does not take the host class the server sent', async () => {
    const root = await hydrate(html`<ui-tabs value="a"><ui-tabs-list><ui-tabs-trigger value="a">A</ui-tabs-trigger></ui-tabs-list></ui-tabs>`);
    try {
      for (const part of ['[role="tablist"]', '[role="tab"]']) {
        const list = classes(root.querySelector(part));
        assert.ok(!list.includes('contents'), `${part}: ${list.join(' ')}`);
      }
    } finally {
      root.remove();
    }
  });
});

suite('host class: the served first paint has one box', () => {
  let renderToString;
  suiteSetup(async () => {
    ({ renderToString } = await import('../../../../core/src/render-server.js'));
    for (const name of ['tabs', 'command', 'resizable', 'context-menu', 'hover-card', 'dialog', 'questionnaire']) {
      await import(`${COMPONENTS_DIR}/${name}.ts`);
    }
  });

  // The server used to send the class a host was written with even after the
  // element moved it to the box it renders, so until the page hydrated both
  // drew it (two borders, a narrow host). It now serves the host as the
  // element left it.
  const CASES = [
    ['ui-tabs-list', html`<ui-tabs value="a"><ui-tabs-list class="fp-a"><ui-tabs-trigger value="a">A</ui-tabs-trigger></ui-tabs-list></ui-tabs>`],
    ['ui-command', html`<ui-command label="Menu" class="fp-a"><ui-command-list></ui-command-list></ui-command>`],
    ['ui-resizable-panel-group', html`<ui-resizable-panel-group class="fp-a"><ui-resizable-panel default-size="100">A</ui-resizable-panel></ui-resizable-panel-group>`],
    ['ui-context-menu-trigger', html`<ui-context-menu><ui-context-menu-trigger class="fp-a">Area</ui-context-menu-trigger></ui-context-menu>`],
    ['ui-hover-card-content', html`<ui-hover-card><ui-hover-card-content class="fp-a">Card</ui-hover-card-content></ui-hover-card>`],
    ['ui-dialog-content', html`<ui-dialog><ui-dialog-content class="fp-a"><h2 data-slot="dialog-title">T</h2></ui-dialog-content></ui-dialog>`],
    ['ui-questionnaire', html`<ui-questionnaire class="fp-a"><ui-questionnaire-item name="a"><ui-questionnaire-title>A?</ui-questionnaire-title></ui-questionnaire-item></ui-questionnaire>`],
  ];

  for (const [host, tpl] of CASES) {
    test(`<${host} class> is served with the class on the rendered element only`, async () => {
      const out = await renderToString(tpl);
      const open = out.match(new RegExp(`<${host}[\\s>][^>]*>`))[0];
      assert.ok(!/\bfp-a\b/.test(open.replace(/data-authored-class="[^"]*"/, '')), `the host's class is not served: ${open}`);
      assert.match(open, /data-authored-class="fp-a"/, 'the record the hydrating element reads');
      assert.equal(out.match(/\bfp-a\b/g).length, 2, 'the class appears once in the record and once on the box');
      // Parsed as a page would be, the class is on exactly one box.
      const root = document.createElement('div');
      root.innerHTML = out;
      document.body.appendChild(root);
      try {
        await tick();
        assert.equal(root.querySelectorAll('.fp-a').length, 1, 'one element carries the class');
        assert.notEqual(root.querySelector('.fp-a').localName, host, 'and it is not the host');
      } finally {
        root.remove();
      }
    });
  }
});

suite('ui-sonner: a toast from markup, and a toast with its own position', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/sonner.ts`);
  });

  test('a click on a data-toast button fires the toast it describes, with no script of the page\'s own', async () => {
    const root = await mount(html`<ui-sonner position="bottom-right"></ui-sonner>
      <button type="button" data-toast="Event has been created" data-toast-type="success" data-toast-description="Sunday at 9am" data-toast-action="Undo">Show</button>`);
    try {
      await tick();
      root.querySelector('button[data-toast]').click();
      await tick();
      const t = root.querySelector('[data-slot="sonner-toast"]');
      assert.ok(t, 'a toast was added');
      assert.equal(t.getAttribute('data-type'), 'success');
      assert.match(t.textContent, /Event has been created/);
      assert.match(t.textContent, /Sunday at 9am/);
      assert.ok(t.querySelector('[data-slot="sonner-action"]'), 'with its action button');
    } finally {
      root.remove();
    }
  });

  test('a toast with its own position shows at that corner, in its own region', async () => {
    const root = await mount(html`<ui-sonner position="bottom-right"></ui-sonner>
      <button type="button" data-toast="Top" data-toast-position="top-center">Show</button>`);
    try {
      await tick();
      root.querySelector('button[data-toast]').click();
      await tick();
      const region = root.querySelector('[data-slot="sonner"][data-position="top-center"]');
      assert.ok(region, 'a region at the toast\'s position');
      assert.match(region.textContent, /Top/);
      const own = root.querySelector('[data-slot="sonner"][data-position="bottom-right"]');
      assert.ok(own, 'the viewport\'s own region stays');
      assert.equal(own.querySelectorAll('[data-slot="sonner-toast"]').length, 0);
    } finally {
      root.remove();
    }
  });

  test('the delegated listener goes when the last viewport does', async () => {
    const root = await mount(html`<ui-sonner></ui-sonner>`);
    await tick();
    root.remove();
    const btn = document.createElement('button');
    btn.setAttribute('data-toast', 'nobody');
    document.body.appendChild(btn);
    try {
      btn.click();
      assert.equal(globalThis.__webjsSonnerClicks ?? 0, 0, 'no viewport holds the listener');
    } finally {
      btn.remove();
    }
  });
});

// --------------------------------------------------------------------------
// A dialog footer's buttons are its flex items, so a phone's column footer
// stretches them full width, as shadcn's asChild close and its alert-dialog
// buttons are.
// --------------------------------------------------------------------------

suite('dialog-family footers: the button is the footer\'s item', () => {
  suiteSetup(async () => {
    for (const name of ['dialog', 'alert-dialog', 'sheet', 'drawer']) await import(`${COMPONENTS_DIR}/${name}.ts`);
  });

  test('a close, cancel or action button stretches across a column footer', async () => {
    // The kit suite loads no Tailwind: the footer's phone layout and the
    // wrapper's `contents` class are written out here.
    const root = await mount(html`<style>
        .ft { display: flex; flex-direction: column-reverse; gap: 8px; width: 300px; }
        .contents { display: contents; }
      </style>
      <div class="ft" id="ft-dialog"><ui-dialog-close><button type="button">Cancel</button></ui-dialog-close></div>
      <div class="ft" id="ft-sheet"><ui-sheet-close><button type="button">Close</button></ui-sheet-close></div>
      <div class="ft" id="ft-drawer"><ui-drawer-close><button type="button">Done</button></ui-drawer-close></div>
      <ui-alert-dialog><div class="ft" id="ft-alert"><ui-alert-dialog-cancel class="ad-own">Cancel</ui-alert-dialog-cancel><ui-alert-dialog-action>Continue</ui-alert-dialog-action></div></ui-alert-dialog>`);
    try {
      await tick();
      for (const id of ['ft-dialog', 'ft-sheet', 'ft-drawer', 'ft-alert']) {
        for (const button of root.querySelectorAll(`#${id} button`)) {
          assert.equal(Math.round(button.getBoundingClientRect().width), 300, `${id}: "${button.textContent.trim()}" spans the footer`);
        }
      }
      assert.ok(root.querySelector('#ft-alert [data-slot="alert-dialog-cancel"]').classList.contains('ad-own'), 'a class on the cancel lands on its button');
    } finally {
      root.remove();
    }
  });
});

// --------------------------------------------------------------------------
// The questionnaire: the active question set from outside, navigation
// buttons the author disables, and a form the page binds an action to.
// --------------------------------------------------------------------------

suite('ui-questionnaire: item, disabled buttons and as-child', () => {
  let renderToString;
  suiteSetup(async () => {
    ({ renderToString } = await import('../../../../core/src/render-server.js'));
    await import(`${COMPONENTS_DIR}/questionnaire.ts`);
  });
  const until = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    return fn();
  };
  const questions = (extra = '') => html`
    <ui-questionnaire-item name="a" required><ui-questionnaire-title>A?</ui-questionnaire-title><ui-questionnaire-choices><ui-questionnaire-choice value="a1">A1</ui-questionnaire-choice></ui-questionnaire-choices></ui-questionnaire-item>
    <ui-questionnaire-item name="b"><ui-questionnaire-title>B?</ui-questionnaire-title><ui-questionnaire-choices><ui-questionnaire-choice value="b1">B1</ui-questionnaire-choice></ui-questionnaire-choices></ui-questionnaire-item>
    <ui-questionnaire-item name="c"><ui-questionnaire-title>C?</ui-questionnaire-title><ui-questionnaire-choices><ui-questionnaire-choice value="c1">C1</ui-questionnaire-choice></ui-questionnaire-choices></ui-questionnaire-item>
    <ui-questionnaire-actions><ui-questionnaire-previous></ui-questionnaire-previous><ui-questionnaire-next ?disabled=${extra === 'next-disabled'}></ui-questionnaire-next><ui-questionnaire-submit></ui-questionnaire-submit></ui-questionnaire-actions>`;
  const shown = (root) => [...root.querySelectorAll('[data-slot="questionnaire-item"]')].filter((f) => !f.hidden).map((f) => f.closest('ui-questionnaire-item').getAttribute('name'));

  test('default-item opens on a question, and setting item from outside goes there', async () => {
    const root = await mount(html`<ui-questionnaire default-item="b">${questions()}</ui-questionnaire>`);
    try {
      const q = root.querySelector('ui-questionnaire');
      await until(() => shown(root).length === 1);
      assert.deepEqual(shown(root), ['b'], 'opens on b');
      assert.equal(q.item, 'b', 'item reads the active question');
      const changes = [];
      q.addEventListener('ui-active-change', (e) => changes.push(e.detail.name));
      q.item = 'c';
      await until(() => shown(root)[0] === 'c');
      assert.deepEqual(shown(root), ['c'], 'item set from outside shows that question');
      q.setAttribute('item', 'a');
      await until(() => shown(root)[0] === 'a');
      assert.deepEqual(shown(root), ['a'], 'and so does the attribute');
      root.querySelector('[data-slot="questionnaire-choice"] input, [data-slot="questionnaire-choice-input"], ui-questionnaire-item[name="a"] input').click();
      root.querySelector('[data-slot="questionnaire-next"]').click();
      await until(() => shown(root)[0] === 'b');
      assert.equal(q.item, 'b', 'the reader\'s own step updates item');
      assert.ok(changes.includes('b'), 'and reports it');
    } finally {
      root.remove();
    }
  });

  test('a disabled Next cannot be pressed and Enter does not step on', async () => {
    const root = await mount(html`<ui-questionnaire default-item="b">${questions('next-disabled')}</ui-questionnaire>`);
    try {
      await until(() => shown(root).length === 1);
      const next = root.querySelector('[data-slot="questionnaire-next"]');
      assert.equal(next.disabled, true, 'the button is disabled');
      assert.equal(next.hasAttribute('aria-keyshortcuts'), false, 'and offers no Enter shortcut');
      // Stop the submit below the client router, which would navigate.
      root.addEventListener('submit', (e) => e.preventDefault());
      const form = root.querySelector('form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 100));
      assert.deepEqual(shown(root), ['b'], 'Enter (a submit) leaves the reader on b');
    } finally {
      root.remove();
    }
  });

  test('as-child drives the page\'s own form, keeping the action the page bound', async () => {
    const save = async () => ({ success: true });
    save.$$webjsAction = 'abc123/saveAnswers';
    const out = await renderToString(html`<ui-questionnaire as-child><form action=${save} data-slot="questionnaire" class="cn-questionnaire">${questions()}</form></ui-questionnaire>`);
    assert.equal((out.match(/<form/g) || []).length, 1, 'one form, the page\'s');
    assert.match(out, /name="__webjs_action" value="abc123\/saveAnswers"/, 'served with the action identity');
    assert.match(out, /<form[^>]*method="post"/);
    const root = document.createElement('div');
    root.innerHTML = out;
    document.body.appendChild(root);
    try {
      await until(() => shown(root).length === 1);
      const form = root.querySelector('form');
      assert.deepEqual(shown(root), ['a'], 'one question at a time on the page\'s form');
      assert.equal(form.noValidate, true, 'validated per question');
      assert.ok(form.querySelector('input[name="__webjs_action"]'), 'the identity is still in the form');
      let stepHeld = null;
      root.addEventListener('submit', (e) => { stepHeld = e.defaultPrevented; e.preventDefault(); }, { once: true });
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await tick();
      assert.equal(stepHeld, true, 'Enter on an unanswered required question is held');
      root.querySelector('ui-questionnaire-item[name="a"] input').click();
      root.querySelector('[data-slot="questionnaire-next"]').click();
      await until(() => shown(root)[0] === 'b');
      root.querySelector('[data-slot="questionnaire-next"]').click();
      await until(() => shown(root)[0] === 'c');
      // Read what the questionnaire decided, below it and above the client
      // router, then stop the submit there so the test page stays put.
      let held = null;
      root.addEventListener('submit', (e) => { held = e.defaultPrevented; e.preventDefault(); }, { once: true });
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      assert.equal(held, false, 'on the last question the page\'s form submits to its action');
    } finally {
      root.remove();
    }
  });
});

// --------------------------------------------------------------------------
// The message scroller's served transcript reads with JavaScript off, and its
// peek distance is the author's.
// --------------------------------------------------------------------------

suite('ui-message-scroller: served visible, and the peek is configurable', () => {
  let renderToString;
  suiteSetup(async () => {
    ({ renderToString } = await import('../../../../core/src/render-server.js'));
    await import(`${COMPONENTS_DIR}/message-scroller.ts`);
  });

  const until = async (fn, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 30));
    }
    return fn();
  };
  const style = (h) => `<style>.sv-box { height: ${h}px; } .sv-box .contents { display: contents; } .sv-box [data-slot="message-scroller"] { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; } .sv-box [data-slot="message-scroller-viewport"] { height: 100%; min-height: 0; overflow-y: auto; } .sv-box [data-slot="message-scroller-viewport"][data-pending-scroll] { visibility: hidden; } .sv-box [data-slot="message-scroller-content"] { display: flex; flex-direction: column; } .sv-row { height: 100px; }</style>`;

  test('a server-rendered transcript is never hidden while it hydrates, and still moves to the end', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => html`<ui-message-scroller-item message-id=${`s${i}`}><div class="sv-row">Row ${i}</div></ui-message-scroller-item>`);
    const out = await renderToString(html`<div class="sv-box"><ui-message-scroller><ui-message-scroller-viewport><ui-message-scroller-content aria-label="Log">${rows}</ui-message-scroller-content></ui-message-scroller-viewport></ui-message-scroller></div>`);
    assert.equal(out.includes('data-pending-scroll'), false, 'served visible');
    const root = document.createElement('div');
    const hidden = [];
    const watch = new MutationObserver((records) => {
      for (const r of records) if (r.target.hasAttribute('data-pending-scroll')) hidden.push(r.target.getAttribute('data-slot'));
    });
    watch.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-pending-scroll'] });
    root.innerHTML = style(200) + out;
    document.body.appendChild(root);
    try {
      const el = root.querySelector('ui-message-scroller');
      const viewport = root.querySelector('[data-slot="message-scroller-viewport"]');
      assert.ok(await until(() => el._opened && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 2), 'placed at the end once its script runs');
      assert.deepEqual(hidden, [], 'and never hidden on the way');
    } finally {
      watch.disconnect();
      root.remove();
    }
  });

  test('scroll-previous-item-peek sets how much of the previous turn stays above a new anchored one', async () => {
    const root = document.createElement('div');
    root.innerHTML = style(300) + '<div class="sv-box"><ui-message-scroller scroll-previous-item-peek="32"><ui-message-scroller-viewport><ui-message-scroller-content aria-label="C">'
      + '<ui-message-scroller-item message-id="q1" scroll-anchor><div class="sv-row">Q</div></ui-message-scroller-item>'
      + '<ui-message-scroller-item message-id="a1"><div class="sv-row">A</div></ui-message-scroller-item>'
      + '</ui-message-scroller-content></ui-message-scroller-viewport></ui-message-scroller></div>';
    document.body.appendChild(root);
    try {
      const el = root.querySelector('ui-message-scroller');
      await until(() => el._opened);
      const viewport = el.querySelector('[data-slot="message-scroller-viewport"]');
      const item = document.createElement('ui-message-scroller-item');
      item.setAttribute('message-id', 'q2');
      item.setAttribute('scroll-anchor', '');
      item.innerHTML = '<div class="sv-row">Q2</div>';
      root.querySelector('ui-message-scroller-content').append(item);
      const top = () => Math.round(item.getBoundingClientRect().top - viewport.getBoundingClientRect().top);
      assert.ok(await until(() => top() === 32), `the new turn sits 32px below the top (at ${top()})`);
    } finally {
      root.remove();
    }
  });
});
