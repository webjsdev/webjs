/**
 * Browser tests for <docs-copy-code>, the copy button on a /ui docs code
 * block (#1666, shadcn's CopyButton).
 *
 * It copies the code of the figure it sits in, so the source is in the HTML
 * once: a plain block copies its pre, a package-manager block the command of
 * the selected tab. The clipboard is stubbed so the test sees exactly what
 * was written.
 */
import '#components/docs-copy-code.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function until(check, msg, ms = 1000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(msg);
    await tick(10);
  }
}

suite('docs-copy-code', () => {
  let written;
  let restore;

  setup(() => {
    written = null;
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
      || Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t) => { written = t; } },
    });
    restore = () => {
      delete navigator.clipboard;
      if (desc) Object.defineProperty(navigator, 'clipboard', desc);
    };
  });

  teardown(() => {
    restore();
    document.querySelectorAll('figure[data-test]').forEach((el) => el.remove());
  });

  const mount = async (inner) => {
    const fig = document.createElement('figure');
    fig.setAttribute('data-test', '');
    fig.innerHTML = inner;
    document.body.appendChild(fig);
    const el = fig.querySelector('docs-copy-code');
    await el.updateComplete;
    return el;
  };

  test('copies the figure\'s code as shown, lines and all', async () => {
    const el = await mount(`<docs-copy-code></docs-copy-code><pre><code><span data-line><span class="t-kw">const</span> a = 1;</span>\n<span data-line>a + 1;</span>\n</code></pre>`);
    const button = el.querySelector('button');
    assert.equal(button.getAttribute('type'), 'button');
    assert.ok(button.querySelector('.sr-only').textContent === 'Copy', 'a named button');
    button.click();
    await until(() => written !== null, 'the clipboard was written');
    assert.equal(written, 'const a = 1;\na + 1;', 'the code, without the trailing newline');
    await el.updateComplete;
    assert.equal(el.querySelector('[role="status"]').textContent.trim(), 'Copied');
    assert.equal(button.getAttribute('data-copied'), 'true');
  });

  test('a package-manager block copies the selected tab\'s command', async () => {
    const el = await mount(`
      <div>
        <ui-tabs-content value="pnpm" hidden><pre><code>pnpm dlx @webjsdev/ui add button</code></pre></ui-tabs-content>
        <ui-tabs-content value="npm"><pre><code>npx @webjsdev/ui add button</code></pre></ui-tabs-content>
      </div>
      <docs-copy-code variant="command"></docs-copy-code>`);
    el.querySelector('button').click();
    await until(() => written !== null, 'the clipboard was written');
    assert.equal(written, 'npx @webjsdev/ui add button');
  });

  test('a blocked clipboard leaves the button as it was', async () => {
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    const el = await mount(`<docs-copy-code></docs-copy-code><pre><code>x</code></pre>`);
    el.querySelector('button').click();
    await tick(50);
    await el.updateComplete;
    assert.equal(el.querySelector('[role="status"]').textContent.trim(), '');
    assert.equal(el.querySelector('button').getAttribute('data-copied'), 'false');
  });
});
