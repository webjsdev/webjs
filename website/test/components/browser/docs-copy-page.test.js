/**
 * Browser tests for <docs-copy-page>, the /ui docs pages' Copy Page button
 * (#1666).
 *
 * A click fetches the element's `href` (the page's /ui/llm markdown) and puts
 * the text on the clipboard, then flips the icon and announces "Copied". The
 * fetch and the clipboard are stubbed, so the test is deterministic whatever
 * the headless browser's clipboard permission, and so it can see exactly what
 * was requested and what was written.
 */
import '#components/docs-copy-page.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Wait until `check()` holds, or fail after `ms`. */
async function until(check, msg, ms = 1000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(msg);
    await tick(10);
  }
}

suite('docs-copy-page', () => {
  let written;
  let fetched;
  let fetchStatus;
  let restore;

  setup(() => {
    written = null;
    fetched = [];
    fetchStatus = 200;
    const realFetch = window.fetch;
    window.fetch = async (url) => {
      fetched.push(String(url));
      return new Response('# Button\n\nDisplays a button.\n', { status: fetchStatus, headers: { 'content-type': 'text/markdown' } });
    };
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
      || Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        // The element prefers write([ClipboardItem]) so the click's user
        // activation survives the fetch, and falls back to writeText.
        write: async (items) => { written = await (await items[0].getType('text/plain')).text(); },
        writeText: async (t) => { written = t; },
      },
    });
    restore = () => {
      window.fetch = realFetch;
      delete navigator.clipboard;
      if (desc) Object.defineProperty(navigator, 'clipboard', desc);
    };
  });

  teardown(() => {
    restore();
    document.querySelectorAll('docs-copy-page').forEach((el) => el.remove());
  });

  const mount = async (href = '/ui/llm/docs/components/button') => {
    const el = document.createElement('docs-copy-page');
    el.setAttribute('href', href);
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  };

  test('renders a Copy Page button and nothing copied yet', async () => {
    const el = await mount();
    const button = el.querySelector('button');
    assert.ok(button, 'a button');
    assert.equal(button.getAttribute('type'), 'button');
    assert.ok(button.textContent.includes('Copy Page'));
    assert.equal(el.querySelector('[role="status"]').textContent.trim(), '');
    assert.equal(fetched.length, 0, 'the markdown is not fetched before a click');
  });

  test('a click copies the page markdown from href and announces it', async () => {
    const el = await mount();
    el.querySelector('button').click();
    await until(() => written !== null, 'the clipboard was written');
    assert.equal(fetched[0], '/ui/llm/docs/components/button', 'fetches the element href');
    assert.equal(written, '# Button\n\nDisplays a button.\n', 'copies the markdown as served');
    await el.updateComplete;
    assert.equal(el.querySelector('[role="status"]').textContent.trim(), 'Copied');
    assert.ok(el.querySelector('button path[d="M20 6 9 17l-5-5"]'), 'the icon flips to a check');
  });

  test('the menu opens the page as markdown and in ChatGPT or Claude', async () => {
    const el = await mount();
    el.setAttribute('url', 'https://webjs.dev/ui/docs/components/button');
    await el.updateComplete;
    const trigger = el.querySelector('#docs-copy-page-menu');
    assert.ok(trigger, 'the chevron trigger');
    assert.ok(trigger.querySelector('.sr-only').textContent.trim(), 'the trigger is named');
    const links = [...el.querySelectorAll('ui-dropdown-menu-item a')];
    assert.equal(links.length, 3);
    assert.equal(links[0].getAttribute('href'), '/ui/llm/docs/components/button', 'View as Markdown is the page markdown');
    assert.ok(links[0].textContent.includes('View as Markdown'));
    assert.ok(links[1].href.startsWith('https://chatgpt.com/?q='), 'Open in ChatGPT');
    assert.ok(decodeURIComponent(links[1].href).includes('https://webjs.dev/ui/docs/components/button'), 'the prompt names the page');
    assert.ok(links[2].href.startsWith('https://claude.ai/new?q='), 'Open in Claude');
    assert.equal(fetched.length, 0, 'opening nothing fetches nothing');
  });

  test('Enter on a menu item follows its link', async () => {
    const el = await mount();
    // The menu's items are slotted a microtask after the element renders.
    await until(() => el.querySelector('ui-dropdown-menu-item [role="menuitem"] a'), 'the menu items rendered');
    const link = el.querySelector('ui-dropdown-menu-item a');
    let followed = 0;
    link.addEventListener('click', (e) => { e.preventDefault(); followed++; });
    const item = link.closest('ui-dropdown-menu-item').querySelector('[role="menuitem"]');
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(followed, 1, 'the keyboard reaches the link the item holds');
  });

  test('a failed fetch copies nothing and announces nothing', async () => {
    fetchStatus = 404;
    const el = await mount('/ui/llm/docs/components/nope');
    el.querySelector('button').click();
    await tick(100);
    await el.updateComplete;
    assert.equal(written, null, 'nothing reaches the clipboard');
    assert.equal(el.querySelector('[role="status"]').textContent.trim(), '');
  });
});
