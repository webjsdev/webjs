// Co-located browser test for the <counter-card> component. This is the webjs
// component-test SHAPE, so copy it for your own components:
//   - It runs in REAL Chromium (webjs test --browser, or npx wtr), not jsdom. If
//     the browser binary is missing, install it once: npx playwright install chromium.
//   - The runner's mocha UI is `tdd`, so use suite() / test(), NOT describe / it().
//   - There is NO assertion library in the importmap (no chai, no expect). Throw
//     to fail. A tiny inline `assert` is plenty.
//   - `ssrFixture` server-renders AND hydrates the component, so you exercise the
//     REAL SSR output and the client interactivity, not a jsdom approximation.
// It lives NEXT TO the component (a `browser/` dir inside the module), the
// co-located default; the runner discovers browser tests under any browser dir.
import { html } from '@webjsdev/core';
import { ssrFixture } from '@webjsdev/core/testing';
import '../counter-card.ts';

const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

suite('<counter-card>', () => {
  test('SSRs its initial state and the default label', async () => {
    const el = await ssrFixture(html`<counter-card></counter-card>`);
    assert(el.textContent.includes('0'), 'the count starts at 0');
    assert(el.textContent.includes('Clicks'), 'the default label renders');
  });

  test('reads the label reactive prop', async () => {
    const el = await ssrFixture(html`<counter-card label="Taps"></counter-card>`);
    assert(el.textContent.includes('Taps'), 'the provided label renders');
  });

  test('increments on click (hydrated interactivity)', async () => {
    const el = await ssrFixture(html`<counter-card></counter-card>`);
    el.querySelector('button').click();
    await el.updateComplete;
    assert(el.textContent.includes('1'), 'the count becomes 1 after one click');
  });
});
