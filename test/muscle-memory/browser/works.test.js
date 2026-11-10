/**
 * The muscle-memory corpus after hydration: the Lit-idiom components from
 * `../works/components/` mounted in a real browser. The server render of the
 * same markup is covered in `../works.test.mjs`; this is where the idioms that
 * only act client-side prove themselves.
 */
import '../works/components/lit-counter.ts';
import '../works/components/shadow-card.ts';
import '../works/components/light-root.ts';
import '../works/components/user-card.ts';
import '../works/components/theme-provider.ts';
import '../works/components/theme-label.ts';
import '../works/components/fruit-list.ts';
import '../works/components/shout-text.ts';
import '../works/components/click-tally.ts';
import { assert } from '../../browser-assert.js';

/** Poll until `check()` is truthy, failing with `what` after a second. */
async function until(check, what) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(false, `timed out waiting for ${what}`);
}

function mount(markup) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  return host;
}

suite('muscle-memory corpus in the browser', () => {
  test('static properties with declare: attribute in, click updates, updated() runs', async () => {
    const host = mount('<lit-counter count="3" step="2"></lit-counter>');
    const el = host.querySelector('lit-counter');
    await el.updateComplete;
    assert.equal(el.querySelector('button').textContent, 'Count: 3');
    assert.equal(el.dataset.parity, 'odd');
    el.querySelector('button').click();
    await el.updateComplete;
    assert.equal(el.querySelector('button').textContent, 'Count: 5');
    assert.equal(el.count, 5);
    host.remove();
  });

  test('shadowRootOptions and composed styles apply in a shadow root', async () => {
    const host = mount('<shadow-card heading="Card"><p>Slotted</p></shadow-card>');
    const el = host.querySelector('shadow-card');
    await el.updateComplete;
    assert.ok(el.shadowRoot, 'a shadow root is attached');
    assert.equal(el.shadowRoot.delegatesFocus, true);
    assert.equal(el.renderRoot, el.shadowRoot);
    assert.equal(getComputedStyle(el.shadowRoot.querySelector('h2')).color, 'rgb(255, 0, 0)');
    host.remove();
  });

  test('createRenderRoot() { return this; } makes renderRoot the element', async () => {
    const host = mount('<light-root></light-root>');
    const el = host.querySelector('light-root');
    await el.updateComplete;
    assert.equal(el.shadowRoot, null);
    assert.equal(el.renderRoot, el);
    assert.equal(el.querySelector('p').dataset.found, 'yes');
    host.remove();
  });

  test('a Lit-shaped Task receives its args array and completes', async () => {
    const host = mount('<user-card user-id="7"></user-card>');
    const el = host.querySelector('user-card');
    await until(() => el.textContent.includes('user-7'), 'the task to complete');
    el.userId = 9;
    await until(() => el.textContent.includes('user-9'), 'the task to re-run on new args');
    host.remove();
  });

  test('a consumer with its own createContext key reads the provider and follows it', async () => {
    const host = mount('<theme-provider theme="dark"><theme-label></theme-label></theme-provider>');
    const provider = host.querySelector('theme-provider');
    // A light-DOM slot projects its children a microtask after a client-only
    // first mount, so the label is read through the host each time.
    const label = () => host.querySelector('theme-label')?.textContent || '';
    await until(() => label().includes('Theme: dark'), 'the consumer to read the provider');
    provider.theme = 'light';
    await until(() => label().includes('Theme: light'), 'the subscribed consumer to update');
    host.remove();
  });

  test('the directive set renders and re-renders', async () => {
    const host = mount('<fruit-list items=\'["apple","pear"]\' mode="short"></fruit-list>');
    const el = host.querySelector('fruit-list');
    await el.updateComplete;
    assert.equal(el.querySelectorAll('li').length, 2);
    assert.equal(el.querySelector('.joined').textContent, 'APPLE, PEAR');
    el.items = [];
    el.mode = 'long';
    await el.updateComplete;
    assert.equal(el.querySelectorAll('li').length, 0);
    assert.ok(el.textContent.includes('No fruit'));
    assert.ok(el.textContent.includes('Long mode'));
    host.remove();
  });

  test('a custom directive renders its result', async () => {
    const host = mount('<shout-text text="hello"></shout-text>');
    const el = host.querySelector('shout-text');
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, 'HELLO!');
    host.remove();
  });

  test('a bare signal in a hole re-renders when written', async () => {
    const host = mount('<click-tally></click-tally>');
    const el = host.querySelector('click-tally');
    await el.updateComplete;
    const before = Number(el.querySelector('button').textContent.replace('Clicks: ', ''));
    el.querySelector('button').click();
    await until(() => el.querySelector('button').textContent === `Clicks: ${before + 1}`, 'the signal write to render');
    host.remove();
  });
});
