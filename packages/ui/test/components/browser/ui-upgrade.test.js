/** Compound parts must recover state sent before custom-element upgrade. */
import { html, render } from '@webjsdev/core';
import { assert } from '../../../../../test/browser-assert.js';

const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

// Hold the real registrations so roots can settle while their parts are still
// plain HTMLElements. Defining each tag later exercises native upgrade.
async function delayDefinitions(module, tags) {
  const define = customElements.define;
  const pending = new Map();
  customElements.define = function (tag, ctor, options) {
    if (tags.includes(tag)) pending.set(tag, [ctor, options]);
    else define.call(this, tag, ctor, options);
  };
  try {
    await import(`/packages/ui/packages/registry/components/${module}.ts`);
  } finally {
    customElements.define = define;
  }
  return (tag) => {
    assert.ok(pending.has(tag), `${tag} registration was held`);
    const [ctor, options] = pending.get(tag);
    pending.delete(tag);
    define.call(customElements, tag, ctor, options);
  };
}

async function mount(template) {
  const root = document.createElement('div');
  document.body.append(root);
  render(template, root);
  await tick();
  return root;
}

suite('compound UI elements upgrading after their first sync', () => {
  test('navigation trigger and content recover open state and ARIA without another value change', async () => {
    const upgrade = await delayDefinitions('navigation-menu', ['ui-navigation-menu-trigger', 'ui-navigation-menu-content']);
    const root = await mount(html`<ui-navigation-menu value="docs"><ui-navigation-menu-list><ui-navigation-menu-item value="docs">
      <ui-navigation-menu-trigger>Docs</ui-navigation-menu-trigger>
      <ui-navigation-menu-content><a href="/docs">Read the docs</a></ui-navigation-menu-content>
    </ui-navigation-menu-item></ui-navigation-menu-list></ui-navigation-menu>`);
    try {
      upgrade('ui-navigation-menu-trigger');
      await tick();
      const button = root.querySelector('button[data-slot="navigation-menu-trigger"]');
      assert.equal(button.getAttribute('aria-expanded'), 'true');
      upgrade('ui-navigation-menu-content');
      await tick();
      const panel = root.querySelector('[data-slot="navigation-menu-content"]');
      assert.equal(panel.hidden, false);
      assert.equal(panel.getAttribute('data-state'), 'open');
      assert.equal(button.getAttribute('aria-controls'), panel.id);
      assert.equal(panel.getAttribute('aria-labelledby'), button.id);
      const frame = root.querySelector('[data-slot="navigation-menu-viewport"]');
      assert.ok(panel.offsetWidth > 0 && panel.offsetHeight > 0);
      assert.equal(frame.style.getPropertyValue('--radix-navigation-menu-viewport-width'), `${panel.offsetWidth}px`);
      assert.equal(frame.style.getPropertyValue('--radix-navigation-menu-viewport-height'), `${panel.offsetHeight}px`);
    } finally {
      root.remove();
    }
  });

  test('message viewport renders before its root has a pending signal', async () => {
    const upgrade = await delayDefinitions('message-scroller', ['ui-message-scroller']);
    const root = await mount(html`<ui-message-scroller><ui-message-scroller-viewport>Messages</ui-message-scroller-viewport></ui-message-scroller>`);
    try {
      const viewport = root.querySelector('[data-slot="message-scroller-viewport"]');
      assert.ok(viewport, 'the viewport renders even before the root upgrades');
      assert.equal(viewport.hasAttribute('data-pending-scroll'), false);
      upgrade('ui-message-scroller');
      await tick();
      assert.ok(root.querySelector('[data-slot="message-scroller"]'));
    } finally {
      root.remove();
    }
  });

  test('OTP slots, groups and separators recover the existing input value on upgrade', async () => {
    const tags = ['ui-input-otp-group', 'ui-input-otp-slot', 'ui-input-otp-separator'];
    const upgrade = await delayDefinitions('input-otp', tags);
    const root = await mount(html`<ui-input-otp><input maxlength="2" value="42">
      <ui-input-otp-group><ui-input-otp-slot index="0"></ui-input-otp-slot><ui-input-otp-slot index="1"></ui-input-otp-slot></ui-input-otp-group>
      <ui-input-otp-separator></ui-input-otp-separator>
    </ui-input-otp>`);
    try {
      for (const tag of tags) { upgrade(tag); await tick(); }
      const slots = [...root.querySelectorAll('ui-input-otp-slot')];
      assert.deepEqual(slots.map((slot) => slot.textContent.trim()), ['4', '2']);
      assert.ok(slots.every((slot) => !slot.hidden));
      assert.equal(root.querySelector('[data-slot="input-otp-group"]').hidden, false);
      assert.equal(root.querySelector('[data-slot="input-otp-separator"]').hidden, false);
    } finally {
      root.remove();
    }
  });

  test('questionnaire progress and buttons recover the active question on upgrade', async () => {
    const tags = ['ui-questionnaire-progress', 'ui-questionnaire-previous', 'ui-questionnaire-next', 'ui-questionnaire-submit'];
    const upgrade = await delayDefinitions('questionnaire', tags);
    const root = await mount(html`<ui-questionnaire default-item="two">
      <ui-questionnaire-progress></ui-questionnaire-progress>
      <ui-questionnaire-item name="one">One?</ui-questionnaire-item><ui-questionnaire-item name="two">Two?</ui-questionnaire-item>
      <ui-questionnaire-previous></ui-questionnaire-previous><ui-questionnaire-next></ui-questionnaire-next><ui-questionnaire-submit></ui-questionnaire-submit>
    </ui-questionnaire>`);
    try {
      for (const tag of tags) { upgrade(tag); await tick(); }
      assert.equal(root.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '2');
      assert.equal(root.querySelector('[data-slot="questionnaire-previous"]').hidden, false);
      assert.equal(root.querySelector('[data-slot="questionnaire-next"]').hidden, true);
      assert.equal(root.querySelector('[data-slot="questionnaire-submit"]').hidden, false);
    } finally {
      root.remove();
    }
  });

  test('combobox parts recover the selection and open state on upgrade', async () => {
    const tags = ['ui-combobox-content', 'ui-combobox-list', 'ui-combobox-chips'];
    const upgrade = await delayDefinitions('combobox', tags);
    const root = await mount(html`<ui-combobox value="docs" open>
      <ui-combobox-chips></ui-combobox-chips>
      <ui-combobox-content><ui-combobox-list><ui-combobox-item value="docs">Docs</ui-combobox-item></ui-combobox-list></ui-combobox-content>
    </ui-combobox>`);
    try {
      for (const tag of tags) { upgrade(tag); await tick(); }
      assert.equal(root.querySelector('[data-slot="combobox-content"]').getAttribute('data-state'), 'open');
      assert.equal(root.querySelector('[data-slot="combobox-list"]').hasAttribute('data-empty'), false);
      assert.match(root.querySelector('[data-slot="combobox-chips"]').textContent, /Docs/);
    } finally {
      root.remove();
    }
  });

  test('command parts recover the ranked selection on upgrade', async () => {
    const tags = ['ui-command-input', 'ui-command-item', 'ui-command-group', 'ui-command-empty'];
    const upgrade = await delayDefinitions('command', tags);
    const root = await mount(html`<ui-command value="docs"><ui-command-input></ui-command-input>
      <ui-command-group><ui-command-item value="docs">Docs</ui-command-item></ui-command-group>
      <ui-command-empty>No matches</ui-command-empty>
    </ui-command>`);
    try {
      for (const tag of tags) { upgrade(tag); await tick(); }
      const option = root.querySelector('[role="option"]');
      assert.equal(option.getAttribute('aria-selected'), 'true');
      assert.equal(root.querySelector('ui-command-group').hidden, false);
      assert.equal(root.querySelector('[data-slot="command-empty"]').hidden, true);
      assert.equal(root.querySelector('input').getAttribute('aria-activedescendant'), option.id);
    } finally {
      root.remove();
    }
  });
});
