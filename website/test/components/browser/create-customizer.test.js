/**
 * Browser tests for <create-customizer>, the /ui/create configurator's
 * behaviour (#1666). The markup is the server's fragments from
 * modules/ui/create/, rendered here on the client inside the element, the way
 * the page renders them.
 *
 * The preview frame here holds the `data-slot="design-system"` wrapper with
 * an open menu surface and the page's own menu script (srcdoc), standing in
 * for /ui/preview/<name>, which this runner does not serve. The element
 * writes the page URL with history.replaceState, so every test puts the
 * runner's own URL back when it is done.
 */
import { html, render } from '@webjsdev/core';
import { customizer } from '#modules/ui/create/customizer.ts';
import { previewFrame } from '#modules/ui/create/preview-frame.ts';
import { projectForm } from '#modules/ui/create/project-form.ts';
import { welcomeDialog, WELCOME_STORAGE_KEY } from '#modules/ui/create/welcome-dialog.ts';
import { DEFAULT_ITEM, normalizeConfig, presetCode } from '#modules/ui/create/params.ts';
import { buildThemeVars } from '#modules/ui/design-system/themes.js';
import { decodePreset } from '#modules/ui/design-system/preset.js';
import '#components/create-customizer.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const GROUPS = [
  { title: 'Blocks', items: [{ name: 'preview', title: 'Preview' }] },
  { title: 'Components', items: [{ name: 'button-demo', title: 'Button' }, { name: 'badge-demo', title: 'Badge' }] },
];

// What the frame holds: the design-system wrapper with an open menu surface,
// and the preview page's own menu script.
const FRAME = '<div data-slot="design-system" class="style-nova"><div data-slot="dropdown-menu-content">menu</div></div><script src="/public/ui-menu-color.js"></script>';

const mount = async (config = normalizeConfig({}), { welcome = false } = {}) => {
  try {
    if (welcome) localStorage.removeItem(WELCOME_STORAGE_KEY);
    else localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
  } catch {}
  const box = document.createElement('div');
  document.body.append(box);
  const params = { config, item: DEFAULT_ITEM };
  render(html`<create-customizer data-slot="designer">${previewFrame(params, GROUPS)}${customizer(params)}${projectForm(params)}${welcomeDialog()}</create-customizer>`, box);
  // The markup is projected into the element's slot a microtask after it connects.
  await wait(50);
  const frame = box.querySelector('iframe');
  const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
  frame.srcdoc = FRAME;
  await loaded;
  await wait(50);
  await tick();
  return box;
};

const pick = (box, name, value) => {
  const radio = box.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

const key = (k, opts = {}) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

const wrapper = (box) => box.querySelector('iframe').contentDocument.querySelector('[data-slot="design-system"]');
const urlCode = () => new URLSearchParams(location.search).get('preset');
const current = () => decodePreset(urlCode());

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
      assert.equal(current().baseColor, 'stone');
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
      assert.equal(current().style, 'lyra');
      assert.equal(current().radius, 'large');
      assert.equal(current().font, 'lora');
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

  test('1. hovering an item previews it in the frame, uncommitted, and leaving reverts', async () => {
    const box = await mount();
    try {
      const before = urlCode();
      const popup = box.querySelector('#create-picker-theme');
      popup.showPopover();
      const label = box.querySelector('input[name="theme"][value="violet"]').closest('label');
      label.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      await wait(120);
      const violet = buildThemeVars({ baseColor: 'neutral', theme: 'violet', chartColor: 'neutral' });
      assert.ok(wrapper(box).style.getPropertyValue('--primary').includes(violet.light.primary), 'the frame shows the hovered theme');
      assert.equal(urlCode(), before, 'nothing is committed');
      assert.ok(box.querySelector('input[name="theme"][value="neutral"]').checked);
      popup.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      await tick();
      assert.ok(!wrapper(box).style.getPropertyValue('--primary').includes(violet.light.primary), 'leaving the list reverts');
      popup.hidePopover();
    } finally {
      box.remove();
    }
  });

  test('2. history: Ctrl+Z undoes and Ctrl+Shift+Z (and Ctrl+Y) redoes, shadcn\'s keys', async () => {
    const box = await mount();
    try {
      const undo = box.querySelector('button[data-action="undo"]');
      assert.ok(undo.disabled, 'nothing to undo yet');
      pick(box, 'theme', 'blue');
      pick(box, 'style', 'lyra');
      await tick();
      assert.ok(!undo.disabled);
      key('z', { ctrlKey: true });
      await tick();
      assert.equal(current().style, 'nova', 'undo the style');
      assert.equal(current().theme, 'blue');
      key('z', { metaKey: true });
      await tick();
      assert.equal(current().theme, 'neutral', 'undo the theme');
      assert.ok(undo.disabled);
      key('z', { ctrlKey: true, shiftKey: true });
      await tick();
      assert.equal(current().theme, 'blue', 'redo');
      key('y', { ctrlKey: true });
      await tick();
      assert.equal(current().style, 'lyra', 'Ctrl+Y redoes too');
      assert.ok(box.querySelector('input[name="style"][value="lyra"]').checked, 'the pickers follow');
      // A new choice after an undo drops the redo branch.
      key('z', { ctrlKey: true });
      pick(box, 'radius', 'none');
      await tick();
      assert.ok(box.querySelector('button[data-action="redo"]').disabled);
    } finally {
      box.remove();
    }
  });

  test('3. R shuffles from the curated presets and keeps every locked field; Shift+R resets', async () => {
    const box = await mount();
    try {
      pick(box, 'style', 'lyra');
      pick(box, 'font', 'lora');
      const lock = box.querySelector('button[data-lock="style"]');
      lock.click();
      box.querySelector('button[data-lock="font"]').click();
      assert.equal(lock.getAttribute('aria-pressed'), 'true');
      const seen = new Set();
      for (let i = 0; i < 6; i++) {
        key('r');
        await tick();
        assert.equal(current().style, 'lyra', 'the locked style holds');
        assert.equal(current().font, 'lora', 'the locked font holds');
        seen.add(urlCode());
      }
      assert.ok(seen.size > 1, 'shuffles land on different designs');
      lock.click();
      assert.equal(lock.getAttribute('aria-pressed'), 'false', 'a lock toggles off');
      key('R', { shiftKey: true });
      await tick();
      assert.equal(urlCode(), presetCode(normalizeConfig({})), 'Shift+R resets');
    } finally {
      box.remove();
    }
  });

  test('4. the menu color reaches the frame: translucent puts the class on menus and takes the subtle accent', async () => {
    const box = await mount(normalizeConfig({ menuAccent: 'bold' }));
    try {
      pick(box, 'menuColor', 'inverted-translucent');
      await wait(50);
      const root = wrapper(box);
      const menu = root.querySelector('[data-slot="dropdown-menu-content"]');
      assert.equal(root.dataset.menuColor, 'inverted-translucent');
      assert.ok(menu.classList.contains('cn-menu-translucent'), 'the menu script applied the class');
      assert.equal(current().menuAccent, 'subtle', 'a translucent menu takes the subtle accent');
      assert.ok(box.querySelector('input[name="menuAccent"][value="bold"]').disabled, 'bold is off for a translucent menu');
      pick(box, 'menuColor', 'inverted');
      await wait(50);
      assert.ok(!menu.classList.contains('cn-menu-translucent'), 'solid takes it off');
      assert.equal(root.dataset.menuColor, 'inverted');
    } finally {
      box.remove();
    }
  });

  test('5. the welcome dialog opens on the first visit only', async () => {
    let box = await mount(undefined, { welcome: true });
    try {
      const dialog = box.querySelector('#create-welcome');
      await wait(20);
      assert.ok(dialog.matches(':modal'), 'shown on the first visit, as a modal');
      dialog.querySelector('button[type="submit"]').click();
      await tick();
      assert.ok(!dialog.open, 'Get Started closes it');
      assert.equal(localStorage.getItem(WELCOME_STORAGE_KEY), 'true', 'the dismissal is kept');
    } finally {
      box.remove();
    }
    try { localStorage.getItem(WELCOME_STORAGE_KEY); } catch {}
    const box2 = document.createElement('div');
    document.body.append(box2);
    try {
      const params = { config: normalizeConfig({}), item: DEFAULT_ITEM };
      render(html`<create-customizer>${welcomeDialog()}${previewFrame(params)}</create-customizer>`, box2);
      await wait(50);
      assert.ok(!box2.querySelector('#create-welcome').open, 'not shown again');
    } finally {
      box2.remove();
    }
  });

  test('6. Get Code opens the project form, whose commands follow the choices', async () => {
    const box = await mount();
    try {
      box.querySelector('button[data-action="get-code"]').click();
      const dialog = box.querySelector('#create-project');
      assert.ok(dialog.matches(':modal'), 'Get Code opens it as a modal');
      pick(box, 'project-runtime', 'bun');
      pick(box, 'project-db', 'postgres');
      const name = box.querySelector('[data-project-field="name"]');
      name.value = 'shop';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.close();
      pick(box, 'theme', 'blue');
      const code = urlCode();
      assert.equal(box.querySelector('[data-pm="npm"] [data-command="new"]').textContent,
        `npm create webjs@latest shop -- --runtime bun --db postgres && cd shop && npx @webjsdev/ui init --preset ${code}`);
      assert.equal(box.querySelector('[data-pm="bun"] [data-command="new"]').textContent,
        `bun create webjs shop --db postgres && cd shop && bunx @webjsdev/ui init --preset ${code}`);
      assert.equal(box.querySelector('[data-pm="yarn"] [data-command="existing"]').textContent, `yarn dlx @webjsdev/ui init --preset ${code}`);
      const blue = buildThemeVars({ baseColor: 'neutral', theme: 'blue', chartColor: 'neutral' });
      assert.ok(box.querySelector('[data-theme-css]').textContent.includes(`--primary: ${blue.light.primary};`), 'the theme tab follows');
    } finally {
      box.remove();
    }
  });

  test('7. the item explorer: Ctrl+P opens it, typing filters it, a pick swaps the frame', async () => {
    const box = await mount();
    try {
      key('p', { ctrlKey: true });
      const explorer = box.querySelector('[data-explorer]');
      assert.ok(explorer.matches(':popover-open'), 'Ctrl+P opens the explorer');
      const filter = explorer.querySelector('[data-explorer-filter]');
      filter.value = 'butt';
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      assert.ok(!explorer.querySelector('[data-item="button-demo"]').hidden);
      assert.ok(explorer.querySelector('[data-item="badge-demo"]').hidden, 'filtered out');
      assert.ok(explorer.querySelector('[data-explorer-group]').hidden, 'an empty group hides');
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      explorer.querySelector('[data-item="button-demo"]').dispatchEvent(ev);
      assert.ok(ev.defaultPrevented);
      assert.ok(box.querySelector('iframe').getAttribute('src').startsWith('/ui/preview/button-demo?preset='));
      assert.equal(new URLSearchParams(location.search).get('item'), 'button-demo');
      assert.ok(!explorer.matches(':popover-open'), 'the explorer closes');
    } finally {
      box.remove();
    }
  });
});
