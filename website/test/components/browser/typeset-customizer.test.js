/**
 * Browser tests for <typeset-customizer>, the /ui/typeset builder's behaviour
 * (#1666). The markup is the server's fragments from modules/ui/typeset/,
 * rendered here on the client inside the element, the way the page renders
 * them.
 *
 * The element writes the page URL with history.replaceState, so every test
 * puts the runner's own URL back when it is done.
 */
import { html, render } from '@webjsdev/core';
import { customizer } from '#modules/ui/typeset/customizer.ts';
import { previewFrame } from '#modules/ui/typeset/preview-frame.ts';
import { docsPanel } from '#modules/ui/typeset/docs-panel.ts';
import { DEFAULTS, parseParams } from '#modules/ui/typeset/params.ts';
import '#components/typeset-customizer.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const mount = async (params = DEFAULTS) => {
  const box = document.createElement('div');
  document.body.append(box);
  render(html`<typeset-customizer data-slot="designer">${docsPanel(params, location.origin)}${previewFrame(params)}${customizer(params, location.origin)}</typeset-customizer>`, box);
  await new Promise((r) => setTimeout(r, 50));
  await tick();
  return box;
};

const current = () => parseParams(new URLSearchParams(location.search));
const key = (k, opts = {}, target = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
const pick = (box, name, value) => {
  const radio = box.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

let home;
setup(() => { home = location.pathname + location.search; });
teardown(() => { history.replaceState(history.state, '', home); });

suite('typeset-customizer', () => {
  test('a choice applies at once: URL, trigger, links and docs follow, with no reload', async () => {
    const box = await mount();
    try {
      const frame = box.querySelector('iframe');
      const src = frame.getAttribute('src');
      pick(box, 'body', 'lora');
      await tick();
      assert.equal(location.pathname, '/ui/typeset');
      assert.equal(current().body, 'lora', 'the URL carries it');
      assert.equal(frame.getAttribute('src'), src, 'the frame is not reloaded for a design param');
      assert.equal(box.querySelector('[data-picker="body"] [data-current]').textContent, 'Lora');
      assert.ok(box.querySelector('[data-picker="body"] [data-sample]').style.fontFamily.includes('Lora'));
      assert.equal(box.querySelector('[data-picker="heading"] [data-current]').textContent, 'Lora', 'the heading inherits the body');
      assert.ok(box.querySelector('[data-typeset-code="preset"]').textContent.includes('--typeset-font-body: var(--font-lora);'));
      assert.ok(box.querySelector('[data-typeset-code="prompt"]').textContent.includes('--font-lora'));
      assert.ok(box.querySelector('a[data-item="chat"]').getAttribute('href').includes('body=lora'), 'the specimen links carry it');
      assert.ok(box.querySelector('a[data-open-preview]').getAttribute('href').includes('body=lora'));
    } finally {
      box.remove();
    }
  });

  test('a specimen click swaps the frame and stays on the page', async () => {
    const box = await mount();
    try {
      const link = box.querySelector('a[data-item="notes"]');
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(ev);
      await tick();
      assert.ok(ev.defaultPrevented, 'the link does not navigate');
      assert.equal(current().item, 'notes');
      assert.ok(box.querySelector('iframe').getAttribute('src').startsWith('/ui/preview/typeset/notes'));
      assert.equal(link.dataset.active, 'true');
      assert.equal(box.querySelector('a[data-item="docs"]').dataset.active, 'false');
    } finally {
      box.remove();
    }
  });

  test('R shuffles, Ctrl+Z undoes, Ctrl+Shift+Z redoes, Shift+R resets', async () => {
    const box = await mount();
    try {
      box.querySelector('a[data-item="chat"]').click();
      await tick();
      const before = current();
      let shuffled = before;
      for (let i = 0; i < 10 && JSON.stringify(shuffled) === JSON.stringify(before); i++) {
        key('r');
        await tick();
        shuffled = current();
      }
      assert.ok(JSON.stringify(shuffled) !== JSON.stringify(before), 'R changed the design');
      assert.equal(shuffled.item, 'chat', 'the specimen stays');
      key('z', { ctrlKey: true });
      await tick();
      assert.equal(JSON.stringify(current()), JSON.stringify(before), 'undo restores it');
      key('z', { ctrlKey: true, shiftKey: true });
      await tick();
      assert.equal(JSON.stringify(current()), JSON.stringify(shuffled), 'redo brings it back');
      key('R', { shiftKey: true });
      await tick();
      assert.equal(JSON.stringify(current()), JSON.stringify(DEFAULTS), 'Shift+R resets everything, the specimen too');
    } finally {
      box.remove();
    }
  });

  test('a shortcut typed into a field is left to the field', async () => {
    const box = await mount();
    const field = document.createElement('input');
    document.body.append(field);
    try {
      const before = location.search;
      key('r', {}, field);
      await tick();
      assert.equal(location.search, before);
    } finally {
      field.remove();
      box.remove();
    }
  });

  test('a locked param survives Shuffle', async () => {
    const box = await mount();
    try {
      pick(box, 'body', 'merriweather');
      box.querySelector('button[data-lock="body"]').click();
      assert.equal(box.querySelector('button[data-lock="body"]').getAttribute('aria-pressed'), 'true');
      for (let i = 0; i < 15; i++) {
        key('r');
        assert.equal(current().body, 'merriweather');
      }
      const href = new URL(box.querySelector('a[data-action="shuffle"]').href);
      assert.equal(href.searchParams.get('body'), 'merriweather', 'the Shuffle link respects the lock too');
    } finally {
      box.remove();
    }
  });

  test('the menu: script-only items enable, Undo follows the history, the font source switches', async () => {
    const box = await mount();
    try {
      assert.equal(box.querySelector('button[data-action="theme"]').disabled, false, 'Light/Dark is enabled');
      assert.equal(box.querySelector('button[data-action="copy-link"]').disabled, false);
      assert.equal(box.querySelector('button[data-action="undo"]').disabled, true, 'nothing to undo yet');
      pick(box, 'scale', '18');
      assert.equal(box.querySelector('button[data-action="undo"]').disabled, false);
      const panel = box.querySelector('[data-slot="typeset-docs"]');
      const select = panel.querySelector('[data-font-source-select]');
      select.value = 'self-hosted';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      assert.equal(panel.querySelector('[data-font-source="google"]').hidden, true);
      assert.equal(panel.querySelector('[data-font-source="self-hosted"]').hidden, false);
      assert.ok(panel.querySelector('[data-typeset-code="prompt"]').textContent.includes('public/fonts/'), 'the prompt follows the source');
    } finally {
      box.remove();
    }
  });
});
