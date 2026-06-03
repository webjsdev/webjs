/**
 * Browser tests for the <copy-cmd> element covering click-to-copy and
 * the icon flip.
 *
 * The component is light DOM and progressively enhanced: the slotted
 * command text is the click target, clicking writes the trimmed text to
 * the clipboard, and the copy icon flips to a checkmark for ~1.5s.
 *
 * navigator.clipboard.writeText is stubbed so the test is deterministic
 * regardless of the headless browser's clipboard permission (the real
 * component swallows a rejected write, so without the stub the flip would
 * never happen and there would be nothing to assert).
 */
import '../../../components/copy-cmd.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

suite('copy-cmd', () => {
  let written;
  let restoreClipboard;

  const stubClipboard = () => {
    written = null;
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')
      || Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t) => { written = t; } },
    });
    restoreClipboard = () => {
      delete navigator.clipboard;
      if (desc) Object.defineProperty(navigator, 'clipboard', desc);
    };
  };

  const mount = async (text) => {
    const el = document.createElement('copy-cmd');
    el.textContent = text;
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  };

  setup(() => stubClipboard());
  teardown(() => restoreClipboard && restoreClipboard());

  test('renders the slotted command and a copy affordance', async () => {
    const el = await mount('npm create webjs-app@latest my-app');
    const textEl = el.querySelector('[data-copy-text]');
    assert.ok(textEl, 'a [data-copy-text] click target is rendered');
    assert.ok(
      textEl.textContent.includes('npm create webjs-app@latest my-app'),
      'the slotted command text is projected into the click target',
    );
    assert.ok(el.querySelector('button'), 'a copy button is rendered');
    // Pre-copy the button shows the copy (clipboard) icon, not the check.
    assert.ok(el.querySelector('button rect'), 'copy icon is shown initially');
    assert.equal(el.querySelector('button polyline'), null, 'no checkmark initially');
    document.body.removeChild(el);
  });

  test('clicking the command copies the trimmed text and flips to a checkmark', async () => {
    const el = await mount('   npm create webjs-app@latest my-app   ');
    el.querySelector('[data-copy-text]').click();
    await tick(10);          // let the async _copy + clipboard stub resolve
    await el.updateComplete;  // and the copied-signal re-render commit

    assert.equal(written, 'npm create webjs-app@latest my-app', 'trimmed text was written to the clipboard');
    assert.ok(el.querySelector('button polyline'), 'icon flipped to the checkmark');
    assert.equal(el.querySelector('button rect'), null, 'copy icon is gone after copy');
    assert.ok(
      el.querySelector('button').className.includes('opacity-100'),
      'the button is made visible (opacity-100) in the copied state',
    );
    document.body.removeChild(el);
  });

  test('keyboard activation (Enter) copies too', async () => {
    const el = await mount('npm create webjs-app@latest my-app');
    const target = el.querySelector('[data-copy-text]');
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick(10);
    await el.updateComplete;
    assert.equal(written, 'npm create webjs-app@latest my-app', 'Enter triggers a copy');
    assert.ok(el.querySelector('button polyline'), 'icon flipped to the checkmark on Enter');
    document.body.removeChild(el);
  });

  test('the checkmark resets back to the copy icon', async () => {
    const el = await mount('npm create webjs-app@latest my-app');
    el.querySelector('[data-copy-text]').click();
    await tick(10);
    await el.updateComplete;
    assert.ok(el.querySelector('button polyline'), 'checkmark shown right after copy');

    await tick(1700);         // the component resets after ~1.5s
    await el.updateComplete;
    assert.ok(el.querySelector('button rect'), 'copy icon is restored after the reset window');
    assert.equal(el.querySelector('button polyline'), null, 'checkmark is gone after the reset window');
    document.body.removeChild(el);
  });
});
