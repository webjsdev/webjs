/**
 * Browser tests for the /ui header's mobile chrome (#1666): <ui-mobile-nav>,
 * shadcn's MobileNav, and <ui-mode-switcher>, shadcn's ModeSwitcher.
 *
 * <ui-mobile-nav> inherits every dismissal from <site-nav-menu>, whose own
 * suite covers them in depth. These cases prove the subclass kept them (its
 * render() is new, and the dismissals reach the details and summary through
 * refs it must wire), and that the slotted panel shows all three kinds of link.
 */

import '#components/ui-mobile-nav.ts';
import '#components/ui-mode-switcher.ts';
import { THEME_STORAGE_KEY } from '#lib/theme.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

suite('ui mobile nav', () => {
  let host;
  let nav;
  let blockNav;

  setup(async () => {
    // Cancel anchor navigation in the CAPTURE phase so the router bows out,
    // as site-nav-menu.test.js does and for the same reason.
    blockNav = (e) => { if (e.target.closest?.('a')) e.preventDefault(); };
    document.addEventListener('click', blockNav, true);
    host = document.createElement('div');
    host.innerHTML = `
      <ui-mobile-nav label="Toggle Menu">
        <div><div>Menu</div><a href="/ui/blocks">Blocks</a></div>
        <div><div>Sections</div><a href="/ui/docs/installation">Installation</a></div>
        <div><div>Components</div><a href="/ui/docs/components/button">Button</a></div>
      </ui-mobile-nav>
      <button id="outside">elsewhere</button>
    `;
    document.body.appendChild(host);
    nav = host.querySelector('ui-mobile-nav');
    await nav.updateComplete;
  });

  teardown(() => {
    document.removeEventListener('click', blockNav, true);
    host.remove();
  });

  const details = () => nav.querySelector('details');
  const summary = () => nav.querySelector('summary');
  const panel = () => nav.querySelector('nav');
  const clickSummary = async () => {
    const landed = new Promise((r) => details().addEventListener('toggle', r, { once: true }));
    summary().click();
    await landed;
    await nav.updateComplete;
  };

  test('renders shadcn\'s trigger, closed, with the panel hidden', () => {
    assert.ok(!details().open, 'starts closed');
    assert.equal(summary().getAttribute('aria-label'), 'Toggle Menu');
    assert.ok(summary().textContent.includes('Menu'), 'the trigger reads Menu');
    assert.ok(!panel().checkVisibility(), 'the panel is hidden while closed');
  });

  test('the summary opens the panel natively over the page, with every section', async () => {
    await clickSummary();
    assert.ok(details().open, 'the details opened');
    assert.equal(nav.open, true, 'and the component knows');
    // The runner loads no stylesheet, so the panel's placement is pinned by
    // its classes (fixed, full width, from the header down) rather than measured.
    for (const cls of ['fixed', 'inset-x-0', 'top-(--header-h)', 'bottom-0', 'overflow-y-auto']) {
      assert.ok(panel().classList.contains(cls), `the panel carries ${cls}`);
    }
    for (const text of ['Blocks', 'Installation', 'Button']) {
      const link = [...nav.querySelectorAll('a')].find((a) => a.textContent === text);
      assert.ok(link && link.checkVisibility(), `${text} shows in the panel`);
    }
  });

  test('a link click closes it', async () => {
    await clickSummary();
    nav.querySelector('a').click();
    await nav.updateComplete;
    assert.ok(!nav.open, 'closed');
    assert.ok(!details().open, 'and the details agrees');
  });

  test('a click outside closes it', async () => {
    await clickSummary();
    host.querySelector('#outside').click();
    await nav.updateComplete;
    assert.ok(!details().open, 'closed');
  });

  test('Escape closes it and returns focus to the trigger', async () => {
    await clickSummary();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await nav.updateComplete;
    assert.ok(!nav.open, 'closed');
    assert.equal(document.activeElement, summary(), 'focus back on the trigger');
  });

  test('the snapshot hook closes the details synchronously', async () => {
    await clickSummary();
    document.dispatchEvent(new CustomEvent('webjs:before-cache'));
    assert.ok(!details().open, 'closed in the same task, before the router serializes the page');
  });
});

suite('ui mode switcher', () => {
  let el;
  let saved;

  setup(async () => {
    saved = { theme: document.documentElement.dataset.theme, stored: localStorage.getItem(THEME_STORAGE_KEY) };
    el = document.createElement('ui-mode-switcher');
    document.body.appendChild(el);
    await el.updateComplete;
  });

  teardown(() => {
    el.remove();
    if (saved.theme) document.documentElement.dataset.theme = saved.theme;
    else delete document.documentElement.dataset.theme;
    if (saved.stored === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, saved.stored);
  });

  test('flips the resolved theme and stores it where the bootstrap reads it', () => {
    document.documentElement.dataset.theme = 'light';
    el.querySelector('button').click();
    assert.equal(document.documentElement.dataset.theme, 'dark');
    assert.equal(localStorage.getItem(THEME_STORAGE_KEY), 'dark');
    el.querySelector('button').click();
    assert.equal(document.documentElement.dataset.theme, 'light');
  });

  test('from the OS theme it writes the opposite of what shows', () => {
    delete document.documentElement.dataset.theme;
    const osDark = matchMedia('(prefers-color-scheme: dark)').matches;
    el.querySelector('button').click();
    assert.equal(document.documentElement.dataset.theme, osDark ? 'light' : 'dark');
  });

  test('a same-origin frame on the page follows', async () => {
    const frame = document.createElement('iframe');
    frame.srcdoc = '<!doctype html><p>frame</p>';
    const loaded = new Promise((r) => frame.addEventListener('load', r, { once: true }));
    document.body.appendChild(frame);
    await loaded;
    try {
      document.documentElement.dataset.theme = 'light';
      el.querySelector('button').click();
      assert.equal(frame.contentDocument.documentElement.dataset.theme, 'dark');
    } finally {
      frame.remove();
    }
  });

  test('names itself for a screen reader', () => {
    assert.ok(el.querySelector('button').textContent.includes('Toggle theme'));
  });
});
