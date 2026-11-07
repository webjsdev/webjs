/**
 * Browser tests for <create-customizer>, the /ui/create configurator's
 * behaviour (#1666). The markup is the server's fragments from
 * modules/ui/create/, rendered here on the client inside the element, the way
 * the page renders them.
 *
 * The preview frame here holds a bare `data-slot="design-system"` wrapper
 * (srcdoc), standing in for /ui/preview/<name>, which this runner does not
 * serve. The element writes the page URL with history.replaceState, so every
 * test puts the runner's own URL back when it is done.
 */
import { html, render } from '@webjsdev/core';
import { customizer } from '#modules/ui/create/customizer.ts';
import { previewFrame } from '#modules/ui/create/preview-frame.ts';
import { DEFAULT_ITEM, normalizeConfig, presetCode } from '#modules/ui/create/params.ts';
import { buildThemeVars } from '#modules/ui/design-system/themes.js';
import { decodePreset } from '#modules/ui/design-system/preset.js';
import '#components/create-customizer.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const mount = async (config = normalizeConfig({})) => {
  const box = document.createElement('div');
  document.body.append(box);
  const params = { config, item: DEFAULT_ITEM };
  render(html`<create-customizer data-slot="designer">${previewFrame(params)}${customizer(params)}</create-customizer>`, box);
  // The markup is projected into the element's slot a microtask after it connects.
  await new Promise((r) => setTimeout(r, 50));
  const frame = box.querySelector('iframe');
  const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
  frame.srcdoc = '<div data-slot="design-system" class="style-nova"></div>';
  await loaded;
  await tick();
  return box;
};

const pick = (box, name, value) => {
  const radio = box.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

const wrapper = (box) => box.querySelector('iframe').contentDocument.querySelector('[data-slot="design-system"]');
const urlCode = () => new URLSearchParams(location.search).get('preset');

let home;
setup(() => { home = location.pathname + location.search; });
teardown(() => { history.replaceState(history.state, '', home); });

suite('create-customizer', () => {
  test('a picked theme reaches the preset code, the command, the URL and the preview vars', async () => {
    const box = await mount();
    try {
      pick(box, 'theme', 'blue');
      await tick();
      const code = box.querySelector('[data-preset-code]').textContent;
      assert.equal(decodePreset(code).theme, 'blue', 'the code carries the theme');
      assert.equal(code, presetCode(normalizeConfig({ theme: 'blue', chartColor: 'neutral' })));
      assert.equal(box.querySelector('[data-init-command]').textContent, `npx @webjsdev/ui init --preset ${code}`);
      assert.equal(location.pathname, '/ui/create');
      assert.equal(urlCode(), code, 'the URL carries the code');
      const { light, dark } = buildThemeVars({ baseColor: 'neutral', theme: 'blue', chartColor: 'neutral' });
      assert.equal(wrapper(box).style.getPropertyValue('--primary').trim(), `light-dark(${light.primary}, ${dark.primary})`, 'the frame repaints in place');
      assert.equal(box.querySelector('[data-picker="theme"] [data-current]').textContent, 'Blue');
      assert.ok(box.querySelector('a[data-init-md]').getAttribute('href').endsWith(code));
    } finally {
      box.remove();
    }
  });

  test('a new base color hides the themes it cannot wear and takes its own palette', async () => {
    const box = await mount();
    try {
      pick(box, 'baseColor', 'stone');
      await tick();
      const neutral = box.querySelector('input[name="theme"][value="neutral"]');
      const stone = box.querySelector('input[name="theme"][value="stone"]');
      assert.ok(neutral.disabled && neutral.closest('label').hidden, 'neutral is not a theme stone can wear');
      assert.ok(!stone.disabled && !stone.closest('label').hidden);
      assert.ok(stone.checked, 'the theme follows the base color');
      assert.equal(decodePreset(urlCode()).baseColor, 'stone');
      const { light } = buildThemeVars({ baseColor: 'stone' });
      assert.ok(wrapper(box).style.getPropertyValue('--background').includes(light.background));
    } finally {
      box.remove();
    }
  });

  test('style, radius and font repaint the frame', async () => {
    const box = await mount();
    try {
      pick(box, 'style', 'lyra');
      pick(box, 'radius', 'large');
      pick(box, 'font', 'lora');
      await tick();
      const root = wrapper(box);
      assert.ok(root.classList.contains('style-lyra'), 'the style class');
      assert.ok(!root.classList.contains('style-nova'));
      assert.ok(root.ownerDocument.querySelector('link[data-style-sheet="lyra"]'), 'the style\'s stylesheet is linked in the frame');
      assert.equal(root.style.getPropertyValue('--radius').trim(), '0.875rem');
      assert.ok(root.style.getPropertyValue('--font-sans').includes('Lora'));
      assert.equal(box.querySelector('[data-picker="font"] [data-current]').textContent, 'Lora');
      const config = decodePreset(urlCode());
      assert.equal(config.style, 'lyra');
      assert.equal(config.radius, 'large');
      assert.equal(config.font, 'lora');
    } finally {
      box.remove();
    }
  });

  test('a preview switch swaps the frame and stays on the page', async () => {
    const box = await mount();
    try {
      const link = box.querySelector('a[data-item="preview-02"]');
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(ev);
      await tick();
      assert.ok(ev.defaultPrevented, 'the link does not navigate');
      assert.ok(box.querySelector('iframe').getAttribute('src').startsWith('/ui/preview/preview-02?preset='));
      assert.equal(new URLSearchParams(location.search).get('item'), 'preview-02');
      assert.equal(link.dataset.active, 'true');
    } finally {
      box.remove();
    }
  });
});
