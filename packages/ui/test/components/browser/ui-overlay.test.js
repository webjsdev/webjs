/**
 * Browser tests for overlay Tier-2 @webjsdev/ui custom elements: dialog,
 * popover, tooltip, dropdown-menu. Runs in real Chromium via WTR + Playwright.
 *
 * API conventions across all four (mirror what they actually implement, not
 * what shadcn's React API looks like):
 *   - `el.isOpen`: boolean getter (popover, dialog, tooltip). For dropdown-
 *     menu and collapsible the state lives on the `open` HTML attribute, so
 *     `el.hasAttribute('open')` is the canonical read.
 *   - `el.show()` / `el.hide()` / `el.toggle()`: programmatic control.
 *   - Event `ui-open-change` with `detail: { open }`: fires from dialog,
 *     popover, and collapsible. Tooltip and dropdown-menu do NOT emit this
 *     today, so tests for those use post-action state assertions instead.
 *   - Content is rendered INLINE as `:scope > ui-X-content` (not portaled to
 *     document.body). Visibility is controlled by CSS:
 *     `ui-X:not([open]) ui-X-content { display: none !important; }`. So
 *     queries always go through the host element / root, not document.body.
 */
import { html } from '../../../../core/src/html.js';
import { render } from '../../../../core/src/render-client.js';

import { assert } from '../../../../../test/browser-assert.js';

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

suite('ui-dialog', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dialog.ts`);
  });

  test('trigger click opens dialog', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content>
          <ui-dialog-title>T</ui-dialog-title>
          <ui-dialog-description>D</ui-dialog-description>
        </ui-dialog-content>
      </ui-dialog>
    `);
    // Click the inner wrapper that <ui-dialog-trigger> renders (where
    // @click is bound). The user-authored <button> is projected through
    // the slot inside it; clicking either bubbles into the @click
    // handler on the wrapper.
    root.querySelector('ui-dialog-trigger [data-slot="dialog-trigger"]').click();
    await tick();
    const dialog = root.querySelector('ui-dialog');
    assert.equal(dialog.isOpen, true, 'dialog.isOpen=true after trigger click');
    const inner = dialog.querySelector('[data-slot="dialog"]');
    assert.equal(inner.getAttribute('data-state'), 'open');
    dialog.hide();
    root.remove();
  });

  test('native close event on the inner <dialog> closes the host (escape path)', async () => {
    // The WebComponent dialog wires the host's open state to the native
    // <dialog> element's `close` event. In a real browser, pressing Escape
    // while the modal is open fires `cancel` then `close` on the native
    // dialog. We simulate that final close (the UA-internal step) by
    // dispatching a synthetic close event on the native dialog element.
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    const dialog = root.querySelector('ui-dialog');
    dialog.show();
    await tick();
    const nativeDialog = dialog.querySelector('dialog[data-slot="dialog-native"]');
    nativeDialog.dispatchEvent(new Event('close'));
    await tick();
    assert.equal(dialog.isOpen, false, 'host closes when native dialog fires close');
    root.remove();
  });

  test('fires ui-open-change event when toggling', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>Open</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    const dialog = root.querySelector('ui-dialog');
    let detail = null;
    dialog.addEventListener('ui-open-change', (e) => { detail = e.detail; });
    dialog.show();
    await tick();
    assert.equal(detail?.open, true);
    dialog.hide();
    await tick();
    assert.equal(detail?.open, false);
    root.remove();
  });

  // The content renders its data-state from the root's `open`. Every shadcn
  // style animates on data-open / data-closed, so content left "closed" while
  // the native dialog opens plays its EXIT animation as it appears (#1666).
  for (const [tag, file, slot] of [['ui-dialog', 'dialog.ts', 'dialog-content'], ['ui-alert-dialog', 'alert-dialog.ts', 'alert-dialog-content']]) {
    test(`${tag}: the content reads open as the dialog opens, and closed again after`, async () => {
      await import(`${COMPONENTS_DIR}/${file}`);
      const root = document.createElement('div');
      document.body.appendChild(root);
      root.innerHTML = `<${tag}><${tag}-content><h2>T</h2></${tag}-content></${tag}>`;
      await tick();
      const host = root.querySelector(tag);
      const content = root.querySelector(`[data-slot="${slot}"]`);
      try {
        assert.equal(content.getAttribute('data-state'), 'closed');
        host.show();
        await tick();
        assert.ok(root.querySelector('dialog').open, 'the native dialog is open');
        assert.equal(content.getAttribute('data-state'), 'open', 'and the content says so');
        host.hide();
        await tick();
        assert.equal(content.getAttribute('data-state'), 'closed');
      } finally {
        // A modal left open covers every later test in the file.
        host.hide();
        await tick();
        root.remove();
      }
    });
  }

  test('dialog-content has data-state="closed" when host is not open', async () => {
    const root = await mount(html`
      <ui-dialog>
        <ui-dialog-trigger><button>O</button></ui-dialog-trigger>
        <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
      </ui-dialog>
    `);
    await tick();
    const dialog = root.querySelector('ui-dialog');
    // data-state lives on the inner content div rendered inside the
    // <ui-dialog-content> host. Located by its data-slot, NOT by [role="dialog"]:
    // the role moved onto the native <dialog> in #1245, and the two were only
    // ever on the same element by coincidence. data-state is a styling hook and
    // the role is an accessibility contract, so a locator that conflates them
    // breaks whenever either one moves.
    const contentInner = dialog.querySelector('ui-dialog-content [data-slot="dialog-content"]');
    assert.ok(contentInner, 'inner content element exists in DOM');
    assert.equal(contentInner.getAttribute('data-state'), 'closed');
    // Re-pointing the locator above removed this file's only implicit proof
    // that the role exists at all, so assert it directly on the element that
    // owns it. Otherwise the dialog could lose its role entirely and every
    // browser-layer test here would still pass.
    const nativeDialog = dialog.querySelector('dialog[data-slot="dialog-native"]');
    assert.equal(nativeDialog.getAttribute('role'), 'dialog', 'native <dialog> carries role=dialog');
    assert.equal(contentInner.hasAttribute('role'), false, 'and the content panel carries no second dialog role');
    assert.equal(getComputedStyle(dialog.querySelector('ui-dialog-content')).display, 'none', 'host hidden when closed');
    root.remove();
  });
});

// --------------------------------------------------------------------------
// Scroll lock layout (#1144)
//
// Locking body scroll hides the page scrollbar, which widens the viewport by
// the scrollbar's width. Padding the body holds in-flow content still, but a
// `position: fixed` header lays out against the initial containing block, so
// it used to slide right by half the scrollbar width.
//
// These assertions are only meaningful where the scrollbar takes LAYOUT WIDTH.
// Headless browsers default to overlay scrollbars (zero width), which makes the
// whole scenario inert, so `buildFixedHeaderPage()` styles the root scrollbar to
// force a classic one and `requireClassicScrollbar()` decides what a zero width
// means: a genuine overlay-only engine skips, Chromium fails (its scrollbar is
// guaranteed by the WTR config), and a lock leaked by an earlier test fails
// everywhere. A silent pass here would prove nothing, so none is reachable.
// --------------------------------------------------------------------------

const scrollbarWidth = () => window.innerWidth - document.documentElement.clientWidth;

/**
 * Gate a scroll-lock assertion on a scrollbar that actually takes layout width.
 *
 * Skipping is correct on an engine whose scrollbars are always overlay (Firefox
 * on Linux cannot be forced off them). It is NOT correct on Chromium, where the
 * root WTR config drops Playwright's `--hide-scrollbars` precisely so this suite
 * has a real scrollbar: a zero width there means that flag stopped working and
 * the whole suite would otherwise go silently green while asserting nothing.
 */
function requireClassicScrollbar(ctx) {
  // A lock leaked by an earlier test hides the scrollbar, which is
  // indistinguishable from an overlay-scrollbar engine and would silently skip.
  // Fail instead, on every engine: a leak is the failure, not a reason to stop
  // looking for one.
  assert.equal(document.body.style.overflow, '', 'the page arrived with no lock left over');
  if (scrollbarWidth() > 0) return true;
  const ua = navigator.userAgent;
  const isChromium = ua.includes('Chrome/') && !ua.includes('Edg/');
  assert.equal(
    isChromium,
    false,
    'Chromium reported a zero-width scrollbar: the --hide-scrollbars opt-out in ' +
      'web-test-runner.config.js is no longer taking effect, so these assertions ' +
      'would pass without testing anything',
  );
  ctx.skip();
  return false;
}

/**
 * Build the reproduction: a page that overflows, a fixed full-width header with
 * a centred inner box (the thing that visibly jumped), and a centred in-flow
 * box (which must not move either). The header opts into the published
 * compensation, which is a no-op on engines that hold the viewport width via
 * the reserved gutter.
 *
 * Centres are what matter here. The body's own border box legitimately widens
 * when the compensation path runs (padding holds the CONTENT still, not the
 * border box), so measuring the body would report a false shift.
 */
async function buildFixedHeaderPage(rootStyles = {}) {
  const style = document.createElement('style');
  style.textContent =
    'html::-webkit-scrollbar { width: 15px; background: #eee; }' +
    'html::-webkit-scrollbar-thumb { background: #888; }';
  document.head.appendChild(style);

  const spacer = document.createElement('div');
  spacer.style.height = '300vh';
  document.body.appendChild(spacer);

  const flow = document.createElement('div');
  flow.style.cssText = 'max-width:400px;margin:0 auto;height:20px;';
  document.body.appendChild(flow);

  // The opt-in is the shape every doc surface prescribes: a transparent right
  // border on the element that is both viewport-width and painting. Padding was
  // the earlier form and is deliberately NOT what is asserted here.
  const header = document.createElement('div');
  header.style.cssText =
    'position:fixed;top:0;left:0;right:0;height:40px;background:#345;' +
    'border-right:var(--wj-scrollbar-compensation, 0px) solid transparent;';
  // Mirrors the real site's shape, because the shape is what the placement bug
  // turned on: a viewport-width painting header, wrapping a `max-width` centring
  // bar, holding a leading child and a `flex: 1` centred region.
  //
  // That flex-1 region is why BOTH probes are needed, and it is the detail an
  // earlier version of this fixture got wrong. Insetting the bar shrinks the
  // flex-1 region, which pulls its centred content back to where it started, so
  // the centred probe reports no movement. The leading child is `flex: none` and
  // rides the bar's own shift, so it keeps moving. That is exactly the wrong
  // placement that reached review, and the leading probe is the ONLY thing here
  // that catches it. Measured at a 1000px viewport with a 15px scrollbar:
  //
  //   opt-in       leading   centred
  //   none           +7.5      +7.5
  //   on the bar     +7.5       0.0   <- the wrong placement, centred probe blind
  //   on the header   0.0       0.0   <- what ships
  //
  // `box-sizing: border-box` on the bar is load-bearing too and must be explicit:
  // the WTR page ships no reset, and under content-box `max-width` caps the
  // CONTENT box, so a right border grows the border box instead of insetting the
  // content and the leading probe goes inert. The live sites get border-box from
  // Tailwind's preflight, so this matches them.
  const bar = document.createElement('div');
  bar.style.cssText =
    'box-sizing:border-box;max-width:400px;margin:0 auto;height:40px;display:flex;';
  const leading = document.createElement('div');
  leading.style.cssText = 'width:20px;height:40px;flex:none;';
  const nav = document.createElement('div');
  nav.style.cssText = 'flex:1;display:flex;justify-content:center;';
  const inner = document.createElement('div');
  inner.style.cssText = 'width:40px;height:40px;';
  const trailing = document.createElement('div');
  trailing.style.cssText = 'width:20px;height:40px;flex:none;';
  nav.appendChild(inner);
  bar.appendChild(leading);
  bar.appendChild(nav);
  bar.appendChild(trailing);
  header.appendChild(bar);
  document.body.appendChild(header);

  // WebKit only materialises a custom root scrollbar after a layout pass, so
  // the precondition check has to wait or it under-reports the width.
  await tick();

  // Applied here, and restored in teardown AFTER the unlock has run, because
  // `hide()` defers unlockScroll() to a microtask: resetting these in a test's
  // own `finally` would run first and the unlock would then write the app's
  // values straight back onto <html> with nothing left to clear them.
  const savedRoot = {};
  for (const [prop, value] of Object.entries(rootStyles)) {
    savedRoot[prop] = document.documentElement.style[prop];
    document.documentElement.style[prop] = value;
  }

  const mounted = [];

  return {
    header,
    inner,
    leading,
    flow,
    /** Track a mounted root so teardown can unmount it even after a failure. */
    track(root) {
      mounted.push(root);
      return root;
    },
    async teardown() {
      // Close every dialog FIRST, and WAIT for the unlock. An assertion that
      // throws mid-test would otherwise leave the lock engaged, and the next
      // test would see a page with no scrollbar and skip itself instead of
      // running. hide() only queues the unlock, so the await is load-bearing.
      for (const root of mounted) {
        for (const el of root.querySelectorAll('ui-dialog, ui-alert-dialog')) el.hide?.();
      }
      await tick();
      for (const root of mounted) root.remove();
      style.remove();
      spacer.remove();
      flow.remove();
      header.remove();
      for (const [prop, value] of Object.entries(savedRoot)) {
        document.documentElement.style[prop] = value;
      }
    },
  };
}

const centreOf = (el) => {
  const b = el.getBoundingClientRect();
  return Math.round((b.left + b.width / 2) * 100) / 100;
};
const rightEdgeOf = (el) => Math.round(el.getBoundingClientRect().right * 100) / 100;

suite('ui-dialog scroll lock layout', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dialog.ts`);
  });

  // A dialog whose own content scrolls is the case where the two scrollbars could
  // interact: the page's is being removed at the same moment the dialog's appears.
  // The residual is measured off the ROOT element's box, which a scrollbar inside
  // the top layer does not touch, so the two should be independent. Asserting it
  // rather than assuming it, and asserting the dialog stays scrollable, since a
  // scroll lock that also froze the dialog would be a worse bug than the shift.
  test('a dialog whose own content scrolls does not disturb the compensation', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(
        await mount(html`
          <ui-dialog>
            <ui-dialog-content>
              <ui-dialog-title>Tall</ui-dialog-title>
              <div style="height:3000px"></div>
            </ui-dialog-content>
          </ui-dialog>
        `),
      );
      const dialog = root.querySelector('ui-dialog');
      const fixedBefore = centreOf(page.inner);
      const leadingBefore = centreOf(page.leading);
      const flowBefore = centreOf(page.flow);

      dialog.show();
      await tick();

      assert.equal(document.body.style.overflow, 'hidden', 'the lock engaged');
      assert.equal(centreOf(page.inner), fixedBefore, 'centred header content does not move');
      assert.equal(centreOf(page.leading), leadingBefore, 'left-aligned header content does not move');
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move');

      // The dialog's content really does overflow, so this is not a vacuous pass.
      const native = dialog.querySelector('dialog[data-slot="dialog-native"]');
      const panel = dialog.querySelector('[data-slot="dialog"]');
      const scroller = [native, panel].find((el) => el && el.scrollHeight > el.clientHeight);
      assert.ok(scroller, 'the tall dialog actually overflows somewhere');

      // And it is still scrollable while the page underneath is locked.
      scroller.scrollTop = 200;
      assert.ok(scroller.scrollTop > 0, 'the dialog still scrolls while the page is locked');

      dialog.hide();
      await tick();
      assert.equal(centreOf(page.inner), fixedBefore, 'centred content back where it started');
      assert.equal(centreOf(page.leading), leadingBefore, 'left-aligned content back where it started');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        '',
        'compensation released',
      );
      assert.equal(document.documentElement.style.paddingRight, '', 'no padding left behind');
    } finally {
      await page.teardown();
    }
  });

  test('opening a dialog leaves a position:fixed header exactly where it was', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(await mount(html`
        <ui-dialog>
          <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
        </ui-dialog>
      `));
      const dialog = root.querySelector('ui-dialog');

      const fixedBefore = centreOf(page.inner);
      const leadingBefore = centreOf(page.leading);
      const flowBefore = centreOf(page.flow);
      const chromeBefore = rightEdgeOf(page.header);
      assert.equal(chromeBefore, rightEdgeOf(document.documentElement), 'chrome starts full width');

      dialog.show();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'the lock engaged');

      assert.equal(centreOf(page.inner), fixedBefore, 'centred header content does not move on open');
      assert.equal(
        centreOf(page.leading),
        leadingBefore,
        'left-aligned header content does not move on open either',
      );
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move on open');
      // The chrome must still reach the edge of the initial containing block. An
      // opt-in that holds the content by shrinking the PAINTED box would satisfy
      // the assertions above and leave an unpainted strip. Compared against the
      // root's own box, which tracks the ICB, so this holds on both paths: where
      // the gutter is reserved nothing moved at all, and where it is not, both
      // edges grew together.
      assert.equal(
        rightEdgeOf(page.header),
        rightEdgeOf(document.documentElement),
        'the painted chrome still spans the full viewport',
      );

      dialog.hide();
      await tick();
      assert.equal(centreOf(page.inner), fixedBefore, 'centred header content does not move on close');
      assert.equal(centreOf(page.leading), leadingBefore, 'left-aligned content does not move on close');
    } finally {
      await page.teardown();
    }
  });

  test('the lock is released cleanly, leaving no compensation behind', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(await mount(html`
        <ui-dialog>
          <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
        </ui-dialog>
      `));
      const dialog = root.querySelector('ui-dialog');

      dialog.show();
      await tick();
      dialog.hide();
      await tick();

      assert.equal(document.body.style.overflow, '', 'body overflow restored');
      assert.equal(document.documentElement.style.paddingRight, '', 'root padding restored');
      assert.equal(document.documentElement.style.scrollbarGutter, '', 'scrollbar gutter restored');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        '',
        'compensation custom property cleared',
      );
    } finally {
      await page.teardown();
    }
  });

  // dialog.ts and alert-dialog.ts ship as separate copies (so
  // `webjs ui add alert-dialog` stays self contained) but share ONE refcount
  // through globalThis, so a confirm opened from inside a dialog is a plain
  // increment and its close a plain decrement. This is the interleaving that
  // duplication creates, and the assertion is that the shared count holds
  // through it.
  test('an alert-dialog inside an open dialog does not release the dialog compensation', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;
      await import(`${COMPONENTS_DIR}/alert-dialog.ts`);

      const root = page.track(
        await mount(html`
          <ui-dialog>
            <ui-dialog-content><ui-dialog-title>Outer</ui-dialog-title></ui-dialog-content>
          </ui-dialog>
          <ui-alert-dialog>
            <ui-alert-dialog-content><ui-alert-dialog-title>Confirm</ui-alert-dialog-title></ui-alert-dialog-content>
          </ui-alert-dialog>
        `),
      );
      const dialog = root.querySelector('ui-dialog');
      const confirm = root.querySelector('ui-alert-dialog');

      const fixedBefore = centreOf(page.inner);
      const flowBefore = centreOf(page.flow);

      dialog.show();
      await tick();
      const compensationWithDialog = document.documentElement.style.getPropertyValue(
        '--wj-scrollbar-compensation',
      );

      confirm.show();
      await tick();
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header held with the confirm open');

      confirm.hide();
      await tick();
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        compensationWithDialog,
        'closing the confirm leaves the dialog compensation as it was',
      );
      assert.equal(document.body.style.overflow, 'hidden', 'still locked, the dialog is open');
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header held after the confirm closes');
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content held after the confirm closes');

      dialog.hide();
      await tick();
      assert.equal(document.body.style.overflow, '', 'released on the outermost close');
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header back where it started');
    } finally {
      await page.teardown();
    }
  });

  // Release order is NOT guaranteed to be LIFO: disconnectedCallback fires in
  // tree order and the before-cache close runs in registration order, so an
  // outer dialog can release before an inner confirm that is still open. With a
  // refcount per module the inner unlock then re-applies what it captured, with
  // nothing left to clear it, and <html> stays padded for the rest of the
  // session. One shared refcount is what makes the order irrelevant.
  test('releasing the outer dialog first still leaves the page clean', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;
      await import(`${COMPONENTS_DIR}/alert-dialog.ts`);

      const root = page.track(
        await mount(html`
          <ui-dialog>
            <ui-dialog-content><ui-dialog-title>Outer</ui-dialog-title></ui-dialog-content>
          </ui-dialog>
          <ui-alert-dialog>
            <ui-alert-dialog-content><ui-alert-dialog-title>Confirm</ui-alert-dialog-title></ui-alert-dialog-content>
          </ui-alert-dialog>
        `),
      );
      const dialog = root.querySelector('ui-dialog');
      const confirm = root.querySelector('ui-alert-dialog');
      const fixedBefore = centreOf(page.inner);

      dialog.show();
      await tick();
      confirm.show();
      await tick();

      // Outer first, the order the DOM actually gives us on a subtree removal.
      dialog.hide();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'still locked, the confirm is open');
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header still held');

      confirm.hide();
      await tick();
      assert.equal(document.body.style.overflow, '', 'overflow released');
      assert.equal(document.documentElement.style.paddingRight, '', 'no padding left on the page');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        '',
        'no compensation left on the page',
      );
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header back where it started');
    } finally {
      await page.teardown();
    }
  });

  // A dialog with no content child returns from _setup() BEFORE locking, so it
  // must not release anything on the way out. It used to: _teardown() unlocked
  // unconditionally, which consumed the OPEN dialog's refcount and restored the
  // page mid-flight, dropping its compensation.
  //
  // What this pins is the `_scrollLocked` guard in _teardown(). The count-zero
  // early return in unlockScroll() is now belt-and-braces rather than the thing
  // under test, because no path through the components can reach unlockScroll
  // with a zero count any more. Deleting that early return would leave this
  // green, and that is expected.
  test('a contentless dialog does not release an open dialog\'s lock', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(
        await mount(html`
          <ui-dialog id="real">
            <ui-dialog-content><ui-dialog-title>Real</ui-dialog-title></ui-dialog-content>
          </ui-dialog>
          <ui-dialog id="contentless"></ui-dialog>
        `),
      );
      const real = root.querySelector('#real');
      const contentless = root.querySelector('#contentless');
      const fixedBefore = centreOf(page.inner);
      const flowBefore = centreOf(page.flow);

      real.show();
      await tick();
      const compensation = document.documentElement.style.getPropertyValue(
        '--wj-scrollbar-compensation',
      );
      const padding = document.documentElement.style.paddingRight;

      // Shown and hidden with no content child, so it never locked.
      contentless.show();
      await tick();
      contentless.hide();
      await tick();

      assert.equal(document.body.style.overflow, 'hidden', 'the open dialog is still locked');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        compensation,
        'the open dialog keeps its compensation',
      );
      assert.equal(document.documentElement.style.paddingRight, padding, 'the padding is untouched');
      assert.equal(centreOf(page.inner), fixedBefore, 'the fixed header does not move');
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move');

      real.hide();
      await tick();
      assert.equal(document.body.style.overflow, '', 'released cleanly afterwards');
      assert.equal(document.documentElement.style.paddingRight, '', 'no padding left behind');
    } finally {
      await page.teardown();
    }
  });

  // An app that already reserves both gutters (the standard no-layout-shift
  // technique) keeps them through the lock, so overwriting its choice with the
  // single-edge value would drop one and introduce a shift the page never had.
  test("an app's own scrollbar-gutter is left alone", async function () {
    const page = await buildFixedHeaderPage({ scrollbarGutter: 'stable both-edges' });
    const root = document.documentElement;
    try {
      await tick();
      if (!requireClassicScrollbar(this)) return;

      const mountedRoot = page.track(
        await mount(html`
          <ui-dialog>
            <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
          </ui-dialog>
        `),
      );
      const dialog = mountedRoot.querySelector('ui-dialog');
      const fixedBefore = centreOf(page.inner);
      const flowBefore = centreOf(page.flow);

      dialog.show();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'the lock engaged');
      assert.equal(
        root.style.scrollbarGutter,
        'stable both-edges',
        "the page's own gutter choice is not overwritten",
      );
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header does not move');
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move');

      dialog.hide();
      await tick();
      assert.equal(root.style.scrollbarGutter, 'stable both-edges', 'gutter choice restored');
    } finally {
      await page.teardown();
    }
  });

  // The compensation is ADDED to whatever padding the page already had on the
  // root, not written over it.
  test("an app's own root padding is added to, not replaced", async function () {
    const page = await buildFixedHeaderPage({ paddingRight: '20px' });
    const root = document.documentElement;
    try {
      await tick();
      if (!requireClassicScrollbar(this)) return;

      const mountedRoot = page.track(
        await mount(html`
          <ui-dialog>
            <ui-dialog-content><ui-dialog-title>T</ui-dialog-title></ui-dialog-content>
          </ui-dialog>
        `),
      );
      const dialog = mountedRoot.querySelector('ui-dialog');
      const flowBefore = centreOf(page.flow);

      dialog.show();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'the lock engaged');
      assert.ok(
        parseFloat(getComputedStyle(root).paddingRight) >= 20,
        "the page's own padding is never reduced",
      );
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move');

      dialog.hide();
      await tick();
      assert.equal(root.style.paddingRight, '20px', "the page's own padding is restored exactly");
    } finally {
      await page.teardown();
    }
  });

  test('nested dialogs release the compensation only on the outermost close', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(await mount(html`
        <ui-dialog id="outer">
          <ui-dialog-content><ui-dialog-title>Outer</ui-dialog-title></ui-dialog-content>
        </ui-dialog>
        <ui-dialog id="inner">
          <ui-dialog-content><ui-dialog-title>Inner</ui-dialog-title></ui-dialog-content>
        </ui-dialog>
      `));
      const outer = root.querySelector('#outer');
      const nested = root.querySelector('#inner');

      const fixedBefore = centreOf(page.inner);

      outer.show();
      await tick();
      nested.show();
      await tick();
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header held with both dialogs open');

      nested.hide();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'still locked while the outer dialog is open');
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header still held after the nested close');

      outer.hide();
      await tick();
      assert.equal(document.body.style.overflow, '', 'released on the outermost close');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        '',
        'compensation released on the outermost close',
      );
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header back where it started');
    } finally {
      await page.teardown();
    }
  });
});

suite('ui-tooltip', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/tooltip.ts`);
  });

  // The Lit-idiomatic refactor renders each compound subcomponent's
  // ARIA role + popover element inside its slot output. The host stays
  // a thin wrapper; data-state, role, popover, class all live on the
  // inner rendered element. Tests target the inner element accordingly.

  test('tooltip is closed initially', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    await tick();
    const tip = root.querySelector('ui-tooltip');
    assert.equal(tip.isOpen, false);
    const inner = tip.querySelector('[data-slot="tooltip"]');
    assert.equal(inner.getAttribute('data-state'), 'closed');
    root.remove();
  });

  test('show() opens the tooltip and reflects via data-state', async () => {
    // `delay-duration="0"` skips the default 700ms open delay so the
    // setTimeout fires effectively immediately.
    const root = await mount(html`
      <ui-tooltip delay-duration="0">
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(tip.isOpen, true);
    const inner = tip.querySelector('[data-slot="tooltip"]');
    assert.equal(inner.getAttribute('data-state'), 'open');
    const contentPanel = tip.querySelector('ui-tooltip-content [role="tooltip"]');
    assert.ok(contentPanel, 'tooltip content element rendered');
    root.remove();
  });

  test('mouseleave on trigger closes after open', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>Tip</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    await tick();
    // Dispatch on the inner wrapper since that is where @mouseleave is bound.
    const triggerWrapper = root.querySelector('ui-tooltip-trigger [data-slot="tooltip-trigger"]');
    triggerWrapper.dispatchEvent(new Event('mouseleave', { bubbles: true }));
    await tick();
    assert.equal(tip.isOpen, false);
    root.remove();
  });

  test('content has tooltip-content styling classes', async () => {
    const root = await mount(html`
      <ui-tooltip>
        <ui-tooltip-trigger><button>Hover</button></ui-tooltip-trigger>
        <ui-tooltip-content>TipText</ui-tooltip-content>
      </ui-tooltip>
    `);
    const tip = root.querySelector('ui-tooltip');
    tip.show();
    await tick();
    const panel = tip.querySelector('ui-tooltip-content [popover]');
    assert.ok(panel);
    assert.match(panel.className, /bg-foreground/);
    tip.hide();
    root.remove();
  });
});

suite('ui-dropdown-menu', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
  });

  test('show() opens content and content has role="menu"', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    assert.ok(dm.hasAttribute('open'));
    const contentInner = dm.querySelector('ui-dropdown-menu-content [role="menu"]');
    assert.ok(contentInner, 'inner role="menu" rendered');
    dm.hide();
    root.remove();
  });

  test('ArrowDown cycles focus across items', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Three</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    // The focusable target is now the inner [role=menuitem] rendered
    // inside each <ui-dropdown-menu-item> host.
    const items = root.querySelectorAll('ui-dropdown-menu-item [role="menuitem"]');
    assert.ok(items.length >= 2);
    items[0].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await tick();
    assert.equal(document.activeElement, items[1]);
    dm.hide();
    root.remove();
  });

  test('focus highlights the item (signal-backed data-highlighted), blur clears it', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    const items = root.querySelectorAll('ui-dropdown-menu-item [role="menuitem"]');
    assert.ok(items.length >= 2);
    // Highlight rides a local signal -> ?data-highlighted re-render, so it
    // applies after the microtask tick, not synchronously on focus.
    items[0].focus();
    await tick();
    assert.equal(items[0].hasAttribute('data-highlighted'), true, 'focused item is highlighted');
    assert.equal(items[1].hasAttribute('data-highlighted'), false, 'unfocused item is not highlighted');
    // Moving focus to the next item blurs the first and highlights the second.
    items[1].focus();
    await tick();
    assert.equal(items[0].hasAttribute('data-highlighted'), false, 'blurred item clears highlight');
    assert.equal(items[1].hasAttribute('data-highlighted'), true, 'newly focused item is highlighted');
    dm.hide();
    root.remove();
  });

  test('escape closes the dropdown', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });

  test('clicking an item closes the menu', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    dm.show();
    await tick();
    root.querySelector('ui-dropdown-menu-item [role="menuitem"]').click();
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });

  test('trigger click toggles open', async () => {
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    const trigger = root.querySelector('ui-dropdown-menu-trigger [data-slot="dropdown-menu-trigger"]');
    trigger.click();
    await tick();
    assert.equal(dm.hasAttribute('open'), true);
    trigger.click();
    await tick();
    assert.equal(dm.hasAttribute('open'), false);
    root.remove();
  });
});

suite('ui-alert-dialog', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/alert-dialog.ts`);
  });

  // alert-dialog carries its own copy of the scroll lock (deliberately not
  // imported from dialog.ts, so `webjs ui add alert-dialog` stays self
  // contained), so the #1144 guarantee is asserted against it separately. This
  // is the exact case reported on webjs.dev/ui: the Delete-account demo moved
  // the site's fixed navbar.
  test('opening an alert-dialog leaves a position:fixed header where it was', async function () {
    const page = await buildFixedHeaderPage();
    try {
      if (!requireClassicScrollbar(this)) return;

      const root = page.track(await mount(html`
        <ui-alert-dialog>
          <ui-alert-dialog-content><ui-alert-dialog-title>T</ui-alert-dialog-title></ui-alert-dialog-content>
        </ui-alert-dialog>
      `));
      const dialog = root.querySelector('ui-alert-dialog');

      const fixedBefore = centreOf(page.inner);
      const flowBefore = centreOf(page.flow);

      dialog.show();
      await tick();
      assert.equal(document.body.style.overflow, 'hidden', 'the lock engaged');
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header content does not move on open');
      assert.equal(centreOf(page.flow), flowBefore, 'in-flow content does not move on open');

      dialog.hide();
      await tick();
      assert.equal(centreOf(page.inner), fixedBefore, 'fixed header content does not move on close');
      assert.equal(
        document.documentElement.style.getPropertyValue('--wj-scrollbar-compensation'),
        '',
        'compensation released on close',
      );
    } finally {
      await page.teardown();
    }
  });

  test('trigger click opens via show(); native <dialog> has role="alertdialog"', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>Delete</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>Are you sure?</ui-alert-dialog-title>
          <ui-alert-dialog-cancel><button>Cancel</button></ui-alert-dialog-cancel>
          <ui-alert-dialog-action><button>Delete</button></ui-alert-dialog-action>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    root.querySelector('ui-alert-dialog-trigger [data-slot="alert-dialog-trigger"]').click();
    await tick();
    assert.ok(ad.hasAttribute('open'), 'host gets [open] attribute');
    // Located by data-slot, NOT by [role="alertdialog"]. The role moved onto
    // the native <dialog>, so a role-based locator here would resolve to the
    // same node as `native` below and this would be a weaker duplicate of that
    // assertion rather than a check that the content panel rendered.
    const inner = ad.querySelector('ui-alert-dialog-content [data-slot="alert-dialog-content"]');
    assert.ok(inner, 'inner content panel rendered');
    // showModal() reaches the own-rendered native <dialog> through the
    // ref()/createRef() handle, so the native element is actually open.
    const native = ad.querySelector('dialog[data-slot="alert-dialog-native"]');
    assert.ok(native && native.open, 'ref()-driven showModal opened the native <dialog>');
    // The role lives on the native <dialog>, which is what this test's name is
    // about. Asserted here rather than through a role-based locator, so the
    // check is on the element and cannot quietly become a lookup that passes
    // because it found some other node. This is the browser layer's only
    // assertion of the alertdialog role.
    assert.equal(native.getAttribute('role'), 'alertdialog', 'native <dialog> carries role=alertdialog');
    assert.equal(inner.hasAttribute('role'), false, 'and the content panel carries no second dialog role');
    ad.hide();
    root.remove();
  });

  test('cancel trigger closes the dialog (no escape close, unlike ui-dialog)', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>Delete</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>T</ui-alert-dialog-title>
          <ui-alert-dialog-cancel><button>Cancel</button></ui-alert-dialog-cancel>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    ad.show();
    await tick();
    root.querySelector('ui-alert-dialog-cancel [data-slot="alert-dialog-cancel"]').click();
    await tick();
    assert.equal(ad.hasAttribute('open'), false, 'cancel closes');
    root.remove();
  });

  test('action trigger closes the dialog', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>X</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-action><button>Confirm</button></ui-alert-dialog-action>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    ad.show();
    await tick();
    root.querySelector('ui-alert-dialog-action [data-slot="alert-dialog-action"]').click();
    await tick();
    assert.equal(ad.hasAttribute('open'), false);
    root.remove();
  });

  test('content hidden when host has no [open] attribute', async () => {
    const root = await mount(html`
      <ui-alert-dialog>
        <ui-alert-dialog-trigger><button>X</button></ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-title>T</ui-alert-dialog-title>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `);
    const ad = root.querySelector('ui-alert-dialog');
    const content = ad.querySelector('ui-alert-dialog-content');
    assert.ok(content, 'content stays in DOM when closed');
    assert.equal(getComputedStyle(content).display, 'none', 'CSS hides content when not [open]');
    root.remove();
  });
});

suite('ui-hover-card', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/hover-card.ts`);
  });

  // After the Lit-idiomatic refactor, role + data-state + popover all
  // live on the inner rendered element, not the <ui-*> host.

  test('hover-card is closed initially; data-state="closed"', async () => {
    const root = await mount(html`
      <ui-hover-card>
        <ui-hover-card-trigger><span>Hover me</span></ui-hover-card-trigger>
        <ui-hover-card-content>Profile preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    await tick();
    const hc = root.querySelector('ui-hover-card');
    assert.equal(hc.hasAttribute('open'), false);
    const inner = hc.querySelector('[data-slot="hover-card"]');
    assert.equal(inner.getAttribute('data-state'), 'closed');
    root.remove();
  });

  test('show() with open-delay=0 opens immediately on next macrotask', async () => {
    // Default open-delay is 700ms: too long for a tick(). Set to 0 to
    // make the setTimeout fire on the next macrotask.
    const root = await mount(html`
      <ui-hover-card open-delay="0" close-delay="0">
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const hc = root.querySelector('ui-hover-card');
    hc.show();
    await new Promise((r) => setTimeout(r, 5));
    assert.ok(hc.hasAttribute('open'));
    const inner = hc.querySelector('[data-slot="hover-card"]');
    assert.equal(inner.getAttribute('data-state'), 'open');
    hc.hide();
    root.remove();
  });

  test('hide() closes after close-delay', async () => {
    const root = await mount(html`
      <ui-hover-card open-delay="0" close-delay="0">
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    const hc = root.querySelector('ui-hover-card');
    hc.show();
    await new Promise((r) => setTimeout(r, 5));
    hc.hide();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(hc.hasAttribute('open'), false);
    root.remove();
  });

  test('content has role="dialog" for screen-reader semantics', async () => {
    const root = await mount(html`
      <ui-hover-card>
        <ui-hover-card-trigger><span>x</span></ui-hover-card-trigger>
        <ui-hover-card-content>preview</ui-hover-card-content>
      </ui-hover-card>
    `);
    await tick();
    const panel = root.querySelector('ui-hover-card-content [role="dialog"]');
    assert.ok(panel, 'role="dialog" present on rendered inner element');
    root.remove();
  });
});

// <ui-sheet> is the dialog machinery under its own tags (#1666), so these
// cover what the sheet adds: its tags, its data-side and its title wiring.
suite('ui-sheet', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/sheet.ts`);
  });

  test('the trigger opens the sheet as a modal native dialog', async () => {
    const root = await mount(html`
      <ui-sheet>
        <ui-sheet-trigger><button>Open</button></ui-sheet-trigger>
        <ui-sheet-content side="left"><h2 data-slot="sheet-title">Filters</h2></ui-sheet-content>
      </ui-sheet>
    `);
    root.querySelector('ui-sheet-trigger [data-slot="sheet-trigger"]').click();
    await tick();
    const sheet = root.querySelector('ui-sheet');
    assert.equal(sheet.isOpen, true, 'open after the trigger click');
    const native = sheet.querySelector('dialog[data-slot="sheet-native"]');
    assert.ok(native, 'the sheet renders its own native dialog');
    assert.equal(native.open, true, 'opened with showModal');
    assert.equal(native.getAttribute('role'), 'dialog');
    sheet.hide();
    root.remove();
  });

  test('the panel carries data-side from the side attribute, right by default', async () => {
    const root = await mount(html`
      <ui-sheet><ui-sheet-content side="bottom"><h2 data-slot="sheet-title">A</h2></ui-sheet-content></ui-sheet>
      <ui-sheet><ui-sheet-content><h2 data-slot="sheet-title">B</h2></ui-sheet-content></ui-sheet>
    `);
    const panels = root.querySelectorAll('[data-slot="sheet-content"]');
    assert.equal(panels[0].getAttribute('data-side'), 'bottom');
    assert.equal(panels[1].getAttribute('data-side'), 'right');
    root.remove();
  });

  test('on open the native dialog is named by the sheet-title node', async () => {
    const root = await mount(html`
      <ui-sheet>
        <ui-sheet-content>
          <p>intro</p>
          <h2 data-slot="sheet-title">Settings</h2>
          <p data-slot="sheet-description">Change how it works.</p>
        </ui-sheet-content>
      </ui-sheet>
    `);
    const sheet = root.querySelector('ui-sheet');
    sheet.show();
    await tick();
    const native = sheet.querySelector('dialog[data-slot="sheet-native"]');
    const title = sheet.querySelector('[data-slot="sheet-title"]');
    const desc = sheet.querySelector('[data-slot="sheet-description"]');
    assert.equal(native.getAttribute('aria-labelledby'), title.id, 'named by the sheet-title node');
    // The description is found by its sheet-description slot, not by falling
    // back to the first paragraph ("intro").
    assert.equal(native.getAttribute('aria-describedby'), desc.id, 'described by the sheet-description node');
    sheet.hide();
    root.remove();
  });

  test('a native close (Escape) closes the host', async () => {
    const root = await mount(html`
      <ui-sheet><ui-sheet-content><h2 data-slot="sheet-title">T</h2></ui-sheet-content></ui-sheet>
    `);
    const sheet = root.querySelector('ui-sheet');
    sheet.show();
    await tick();
    sheet.querySelector('dialog[data-slot="sheet-native"]').dispatchEvent(new Event('close'));
    await tick();
    assert.equal(sheet.isOpen, false);
    root.remove();
  });
});

// <ui-drawer> is the dialog machinery plus a handle and drag-to-dismiss (#1666).
suite('ui-drawer', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/drawer.ts`);
  });

  /** Drag the panel from its centre by `dy` pixels, as one pointer gesture. */
  async function drag(target, dy, { slow = true } = {}) {
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = (cy, extra = {}) => ({ pointerId: 7, clientX: x, clientY: cy, button: 0, bubbles: true, ...extra });
    target.dispatchEvent(new PointerEvent('pointerdown', opts(y)));
    if (slow) await new Promise((r) => setTimeout(r, 120));
    target.dispatchEvent(new PointerEvent('pointermove', opts(y + dy)));
    target.dispatchEvent(new PointerEvent('pointerup', opts(y + dy)));
    await tick();
  }

  async function openDrawer(inner = '') {
    const root = await mount(html`
      <ui-drawer>
        <ui-drawer-content>
          <h2 data-slot="drawer-title">Share</h2>
          <div style="height: 300px">body</div>
          <button type="button" id="inside">Inside</button>
        </ui-drawer-content>
      </ui-drawer>
    `);
    const drawer = root.querySelector('ui-drawer');
    drawer.show();
    await tick();
    const panel = drawer.querySelector('[data-slot="drawer-content"]');
    return { root, drawer, panel };
  }

  test('the panel carries the vaul direction attribute, a hidden handle and no corner X', async () => {
    const { root, drawer, panel } = await openDrawer();
    assert.equal(panel.getAttribute('data-vaul-drawer-direction'), 'bottom');
    const handle = panel.querySelector('[data-slot="drawer-handle"]');
    assert.ok(handle, 'the handle is rendered');
    assert.equal(handle.getAttribute('aria-hidden'), 'true');
    assert.equal(drawer.querySelector('button[data-slot="drawer-close"]'), null, 'no auto-injected X');
    drawer.hide();
    root.remove();
  });

  test('dragging the panel down past a quarter of its height closes it', async () => {
    const { root, drawer, panel } = await openDrawer();
    await drag(panel, panel.offsetHeight * 0.5);
    assert.equal(drawer.isOpen, false, 'a long drag dismisses');
    root.remove();
  });

  test('a short slow drag snaps back and leaves it open', async () => {
    const { root, drawer, panel } = await openDrawer();
    await drag(panel, 10);
    assert.equal(drawer.isOpen, true, 'a short drag does not dismiss');
    assert.equal(panel.style.transform, '', 'the panel snaps back');
    drawer.hide();
    root.remove();
  });

  test('a drag that starts on a control inside the panel does not move it', async () => {
    const { root, drawer } = await openDrawer();
    await drag(drawer.querySelector('#inside'), 400);
    assert.equal(drawer.isOpen, true, 'a button keeps its own pointer events');
    drawer.hide();
    root.remove();
  });
});

suite('ui-context-menu', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/context-menu.ts`);
  });

  const region = (label = 'File actions') => html`
    <ui-context-menu>
      <ui-context-menu-trigger>
        <div tabindex="0" data-testid="region" style="width: 300px; height: 120px">Right-click here</div>
      </ui-context-menu-trigger>
      <ui-context-menu-content aria-label=${label}>
        <ui-context-menu-item>Rename</ui-context-menu-item>
        <ui-context-menu-item>Duplicate</ui-context-menu-item>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-item variant="destructive">Delete<ui-context-menu-shortcut>⌘⌫</ui-context-menu-shortcut></ui-context-menu-item>
      </ui-context-menu-content>
    </ui-context-menu>
  `;

  // Where the component placed the panel. The kit's style supplies the
  // `fixed m-0` that makes these coordinates the painted ones, and this suite
  // loads no stylesheet, so the UA [popover] rule would centre the rect.
  const placed = (cm) => {
    const panel = cm.querySelector('ui-context-menu-content [role="menu"]');
    return { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
  };

  const rightClick = (el, x, y) => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
    el.dispatchEvent(ev);
    return ev;
  };

  test('a right-click opens the menu at the pointer, cancels the native menu and focuses the first item', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    const r = area.getBoundingClientRect();
    const x = Math.round(r.left + 60);
    const y = Math.round(r.top + 30);
    const ev = rightClick(area, x, y);
    await tick();
    assert.ok(ev.defaultPrevented, 'the native context menu is suppressed');
    assert.ok(cm.hasAttribute('open'), 'the menu opened');
    const p = placed(cm);
    assert.ok(Math.abs(p.left - x) <= 1, `the panel starts at the pointer x (${p.left} vs ${x})`);
    assert.ok(Math.abs(p.top - y) <= 1, `the panel starts at the pointer y (${p.top} vs ${y})`);
    const first = cm.querySelector('ui-context-menu-item [role="menuitem"]');
    assert.equal(document.activeElement, first, 'the first item has focus');
    cm.hide();
    root.remove();
  });

  test('a second right-click while open moves the menu to the new point', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    const r = area.getBoundingClientRect();
    rightClick(area, Math.round(r.left + 10), Math.round(r.top + 10));
    await tick();
    const x = Math.round(r.left + 120);
    const y = Math.round(r.top + 50);
    rightClick(area, x, y);
    await tick();
    assert.ok(cm.hasAttribute('open'), 'still open');
    const p = placed(cm);
    assert.ok(Math.abs(p.left - x) <= 1 && Math.abs(p.top - y) <= 1, `repositioned at the second point (${p.left},${p.top} vs ${x},${y})`);
    cm.hide();
    root.remove();
  });

  test('a left click on the region never opens the menu', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    root.querySelector('[data-testid="region"]').click();
    await tick();
    assert.equal(cm.hasAttribute('open'), false);
    root.remove();
  });

  test('Shift+F10 on the focused region opens it, and Escape returns focus to the region', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    area.focus();
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    await tick();
    assert.ok(cm.hasAttribute('open'), 'Shift+F10 opened the menu');
    const r = area.getBoundingClientRect();
    const p = placed(cm);
    assert.ok(Math.abs(p.left - r.left) <= 1 && Math.abs(p.top - r.bottom) <= 1, `placed below the region start corner (${p.left},${p.top} vs ${r.left},${r.bottom})`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();
    assert.equal(cm.hasAttribute('open'), false, 'Escape closed it');
    assert.equal(document.activeElement, area, 'focus went back to the region');
    root.remove();
  });

  test('the ContextMenu key opens it too', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    area.focus();
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
    await tick();
    assert.ok(cm.hasAttribute('open'));
    cm.hide();
    root.remove();
  });

  test('the region gets no popup ARIA, and the menu is named by its aria-label or a fallback', async () => {
    const root = await mount(html`${region()}${region('')}`);
    const [named, unnamed] = root.querySelectorAll('ui-context-menu');
    for (const cm of [named, unnamed]) {
      const area = cm.querySelector('[data-testid="region"]');
      const r = area.getBoundingClientRect();
      rightClick(area, Math.round(r.left + 5), Math.round(r.top + 5));
      await tick();
      assert.equal(area.hasAttribute('aria-haspopup'), false, 'no aria-haspopup on the region');
      assert.equal(area.hasAttribute('aria-expanded'), false, 'no aria-expanded on the region');
      cm.hide();
      await tick();
    }
    assert.equal(named.querySelector('[role="menu"]').getAttribute('aria-label'), 'File actions', 'the authored name');
    assert.equal(unnamed.querySelector('[role="menu"]').getAttribute('aria-label'), 'Context menu', 'the fallback name');
    root.remove();
  });

  test('activating an item closes the menu and returns focus to the region', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    area.focus();
    const r = area.getBoundingClientRect();
    rightClick(area, Math.round(r.left + 20), Math.round(r.top + 20));
    await tick();
    cm.querySelector('ui-context-menu-item [role="menuitem"]').click();
    await tick();
    assert.equal(cm.hasAttribute('open'), false, 'closed on activation');
    assert.equal(document.activeElement, area, 'focus is back on the region');
    root.remove();
  });

  test('a right-click outside closes the menu', async () => {
    const root = await mount(html`${region()}<div data-testid="elsewhere" style="height: 40px">elsewhere</div>`);
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    const r = area.getBoundingClientRect();
    rightClick(area, Math.round(r.left + 20), Math.round(r.top + 20));
    await tick();
    assert.ok(cm.hasAttribute('open'));
    root.querySelector('[data-testid="elsewhere"]').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 2 }),
    );
    await tick();
    assert.equal(cm.hasAttribute('open'), false, 'an outside right-click dismissed it');
    root.remove();
  });

  test('a left click on the region closes an open menu', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    const area = root.querySelector('[data-testid="region"]');
    const r = area.getBoundingClientRect();
    rightClick(area, Math.round(r.left + 20), Math.round(r.top + 20));
    await tick();
    assert.ok(cm.hasAttribute('open'));
    area.click();
    await tick();
    assert.equal(cm.hasAttribute('open'), false);
    root.remove();
  });

  test('every part carries a context-menu slot and class name, never a dropdown one', async () => {
    const root = await mount(region());
    const cm = root.querySelector('ui-context-menu');
    cm.show();
    await tick();
    const item = cm.querySelector('ui-context-menu-item [role="menuitem"]');
    assert.equal(item.getAttribute('data-slot'), 'context-menu-item');
    assert.ok(item.classList.contains('cn-context-menu-item'), 'the item takes its style name from its family');
    assert.ok(item.classList.contains('group/context-menu-item'), 'the item is the shortcut group-focus target');
    assert.equal(cm.querySelector('[role="menu"]').getAttribute('data-slot'), 'context-menu-content');
    assert.equal(cm.querySelector('[role="separator"], ui-context-menu-separator > *').getAttribute('data-slot'), 'context-menu-separator');
    assert.equal(cm.querySelectorAll('[data-slot^="dropdown-menu"], [class*="cn-dropdown-menu"]').length, 0, 'no dropdown names leak in');
    cm.hide();
    root.remove();
  });
});

suite('ui-menubar', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/menubar.ts`);
  });

  const bar = () => html`
    <ui-menubar aria-label="Editor">
      <ui-menubar-menu>
        <ui-menubar-trigger>File</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item>New Tab</ui-menubar-item>
          <ui-menubar-item>New Window</ui-menubar-item>
          <ui-menubar-item>Print</ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Edit</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item>Undo</ui-menubar-item>
          <ui-menubar-sub>
            <ui-menubar-sub-trigger>Find</ui-menubar-sub-trigger>
            <ui-menubar-sub-content>
              <ui-menubar-item>Search the web</ui-menubar-item>
            </ui-menubar-sub-content>
          </ui-menubar-sub>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>View</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-item type="checkbox" checked>Status Bar</ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;

  const parts = (root) => {
    const menus = [...root.querySelectorAll('ui-menubar-menu')];
    const buttons = menus.map((m) => m.querySelector('ui-menubar-trigger button'));
    const firstItem = (m) => m.querySelector('ui-menubar-content [role^="menuitem"]');
    return { menus, buttons, firstItem };
  };
  const key = (target, k, opts = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  test('the bar is one tab stop, and ArrowRight / ArrowLeft / Home / End move between triggers', async () => {
    const root = await mount(bar());
    await tick();
    const { buttons } = parts(root);
    assert.deepEqual(buttons.map((b) => b.tabIndex), [0, -1, -1], 'only the first trigger is tabbable');
    buttons[0].focus();
    key(buttons[0], 'ArrowRight');
    assert.equal(document.activeElement, buttons[1]);
    assert.deepEqual(buttons.map((b) => b.tabIndex), [-1, 0, -1], 'the tab stop follows focus');
    key(buttons[1], 'ArrowLeft');
    key(buttons[0], 'ArrowLeft');
    assert.equal(document.activeElement, buttons[2], 'ArrowLeft wraps');
    key(buttons[2], 'Home');
    assert.equal(document.activeElement, buttons[0]);
    key(buttons[0], 'End');
    assert.equal(document.activeElement, buttons[2]);
    root.remove();
  });

  test('ArrowDown opens a menu on its first item, ArrowUp on its last', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons, firstItem } = parts(root);
    buttons[0].focus();
    key(buttons[0], 'ArrowDown');
    await tick();
    assert.ok(menus[0].open, 'ArrowDown opened File');
    assert.equal(document.activeElement, firstItem(menus[0]));
    key(document.activeElement, 'Escape');
    await tick();
    assert.equal(menus[0].open, false);
    assert.equal(document.activeElement, buttons[0], 'Escape returns focus to the trigger button');
    key(buttons[0], 'ArrowUp');
    await tick();
    const items = menus[0].querySelectorAll('ui-menubar-content [role^="menuitem"]');
    assert.equal(document.activeElement, items[items.length - 1], 'ArrowUp lands on the last item');
    menus[0].hide();
    root.remove();
  });

  test('ArrowRight / ArrowLeft in an open menu open the neighbouring menu, and only one is open', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons, firstItem } = parts(root);
    buttons[0].click();
    await tick();
    assert.ok(menus[0].open);
    key(document.activeElement, 'ArrowRight');
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, true, false], 'Edit replaced File');
    assert.equal(document.activeElement, firstItem(menus[1]), 'focus is on Edit\'s first item');
    key(document.activeElement, 'ArrowLeft');
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [true, false, false], 'back to File');
    key(document.activeElement, 'ArrowLeft');
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, false, true], 'ArrowLeft wraps to View');
    menus[2].hide();
    root.remove();
  });

  test('ArrowRight on a sub-trigger opens the sub-menu instead of moving on', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    buttons[1].click();
    await tick();
    const subItem = menus[1].querySelector('ui-menubar-sub-trigger [role="menuitem"]');
    subItem.focus();
    key(subItem, 'ArrowRight');
    await tick();
    assert.ok(menus[1].open, 'Edit stays open');
    assert.equal(menus[2].open, false, 'View did not open');
    assert.ok(menus[1].querySelector('ui-menubar-sub').open, 'the sub-menu opened');
    menus[1].hide();
    root.remove();
  });

  test('with a menu open, pointing at another trigger switches to it; with none open it does nothing', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    buttons[1].dispatchEvent(new PointerEvent('pointerenter'));
    await tick();
    assert.equal(menus[1].open, false, 'a bare hover opens nothing');
    buttons[0].click();
    await tick();
    buttons[2].dispatchEvent(new PointerEvent('pointerenter'));
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, false, true], 'View replaced File');
    menus[2].hide();
    root.remove();
  });

  test('clicking a trigger toggles its menu, and clicking another closes the first', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    buttons[0].click();
    await tick();
    assert.ok(menus[0].open);
    buttons[1].click();
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, true, false]);
    buttons[1].click();
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, false, false], 'a second click closes it');
    root.remove();
  });

  test('the trigger button carries the popup ARIA, open state and the menu is named by it', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    const b = buttons[0];
    assert.equal(b.getAttribute('role'), 'menuitem');
    assert.equal(b.getAttribute('aria-haspopup'), 'menu');
    assert.equal(b.getAttribute('aria-expanded'), 'false');
    b.click();
    await tick();
    assert.equal(b.getAttribute('aria-expanded'), 'true');
    assert.equal(b.getAttribute('data-state'), 'open', 'the open styling hook');
    const menu = menus[0].querySelector('[role="menu"]');
    assert.equal(b.getAttribute('aria-controls'), menu.id);
    assert.equal(menu.getAttribute('aria-labelledby'), b.id, 'the menu is named by its trigger');
    assert.equal(root.querySelector('[role="menubar"]').getAttribute('aria-label'), 'Editor');
    menus[0].hide();
    await tick();
    assert.equal(b.getAttribute('data-state'), 'closed');
    root.remove();
  });

  test('opening a menu programmatically closes the open one', async () => {
    const root = await mount(bar());
    await tick();
    const { menus } = parts(root);
    menus[0].show();
    await tick();
    menus[2].show();
    await tick();
    assert.deepEqual(menus.map((m) => m.open), [false, false, true], 'one open menu per bar');
    menus[2].hide();
    root.remove();
  });

  test('the panel sits 8px below its trigger and 4px back, shadcn\'s menubar offsets', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    buttons[1].click();
    await tick();
    const panel = menus[1].querySelector('ui-menubar-content [role="menu"]');
    // shadcn's MenubarTrigger is the button, so the panel is placed against it.
    const t = buttons[1].getBoundingClientRect();
    assert.ok(Math.abs(parseFloat(panel.style.top) - (t.bottom + 8)) <= 1, `top ${panel.style.top} vs ${t.bottom + 8}`);
    const expectLeft = Math.max(8, t.left - 4);
    assert.ok(Math.abs(parseFloat(panel.style.left) - expectLeft) <= 1, `left ${panel.style.left} vs ${expectLeft}`);
    menus[1].hide();
    root.remove();
  });

  test('every part carries a menubar slot and class name, the item the shortcut group target', async () => {
    const root = await mount(bar());
    await tick();
    const { menus, buttons } = parts(root);
    buttons[2].click();
    await tick();
    const item = menus[2].querySelector('[role="menuitemcheckbox"]');
    assert.equal(item.getAttribute('data-slot'), 'menubar-checkbox-item');
    assert.ok(item.querySelector('.cn-menubar-checkbox-item-indicator'), 'the checkbox indicator class');
    assert.ok(menus[0].querySelector('ui-menubar-item [role="menuitem"]').classList.contains('group/menubar-item'));
    assert.equal(root.querySelectorAll('[data-slot^="dropdown-menu"], [class*="cn-dropdown-menu"]').length, 0);
    menus[2].hide();
    root.remove();
  });
});

suite('ui-navigation-menu', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/navigation-menu.ts`);
  });

  const nav = (attrs = '') => html`
    <ui-navigation-menu ${attrs}>
      <ui-navigation-menu-list>
        <ui-navigation-menu-item>
          <ui-navigation-menu-trigger>Getting started</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <div style="width: 320px">
              <ui-navigation-menu-link href="#intro">Introduction</ui-navigation-menu-link>
              <ui-navigation-menu-link href="#install">Installation</ui-navigation-menu-link>
            </div>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item>
          <ui-navigation-menu-trigger>Components</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <div style="width: 480px; height: 120px">
              <ui-navigation-menu-link href="#dialog">Dialog</ui-navigation-menu-link>
            </div>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item>
          <ui-navigation-menu-link href="#docs">Docs</ui-navigation-menu-link>
        </ui-navigation-menu-item>
      </ui-navigation-menu-list>
      <ui-navigation-menu-indicator></ui-navigation-menu-indicator>
    </ui-navigation-menu>
  `;
  const parts = (root) => {
    const menu = root.querySelector('ui-navigation-menu');
    const items = [...root.querySelectorAll('ui-navigation-menu-item')];
    const buttons = [...root.querySelectorAll('[data-slot="navigation-menu-trigger"]')];
    const panels = [...root.querySelectorAll('[data-slot="navigation-menu-content"]')];
    return { menu, items, buttons, panels };
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (target, k) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const hover = (el, type) => el.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }));

  test('a click toggles a panel and wires trigger and panel to each other', async () => {
    const root = await mount(nav());
    await tick();
    const { buttons, panels } = parts(root);
    assert.equal(panels[0].hidden, true);
    buttons[0].click();
    await tick();
    assert.equal(panels[0].hidden, false, 'the panel shows');
    assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
    assert.equal(buttons[0].getAttribute('data-state'), 'open');
    assert.equal(buttons[0].getAttribute('aria-controls'), panels[0].id);
    assert.equal(panels[0].getAttribute('aria-labelledby'), buttons[0].id);
    buttons[0].click();
    await tick();
    assert.equal(panels[0].hidden, true, 'a second click closes it');
    assert.equal(buttons[0].getAttribute('aria-expanded'), 'false');
    root.remove();
  });

  test('pointing opens after the delay, switches at once while open, and leaving closes after a grace', async () => {
    const root = await mount(nav());
    await tick();
    const { menu, buttons, panels } = parts(root);
    hover(buttons[0], 'pointerenter');
    await wait(80);
    assert.equal(panels[0].hidden, true, 'not before the 200ms delay');
    await wait(200);
    await tick();
    assert.equal(panels[0].hidden, false, 'open after the delay');
    hover(buttons[0], 'pointerleave');
    hover(buttons[1], 'pointerenter');
    await tick();
    assert.equal(panels[1].hidden, false, 'the next trigger opens at once');
    assert.equal(panels[0].hidden, true, 'and the first closes');
    hover(buttons[1], 'pointerleave');
    await wait(60);
    assert.equal(menu.value !== '', true, 'still open inside the grace');
    await wait(150);
    await tick();
    assert.equal(panels[1].hidden, true, 'closed after the grace');
    root.remove();
  });

  test('moving from the trigger into its panel keeps it open', async () => {
    const root = await mount(nav());
    await tick();
    const { buttons, panels } = parts(root);
    buttons[0].click();
    await tick();
    hover(buttons[0], 'pointerleave');
    hover(panels[0], 'pointerenter');
    await wait(220);
    assert.equal(panels[0].hidden, false);
    hover(panels[0], 'pointerleave');
    await wait(220);
    await tick();
    assert.equal(panels[0].hidden, true, 'leaving the panel closes it');
    root.remove();
  });

  test('ArrowRight / ArrowLeft walk the bar, ArrowDown opens on the first link, Escape returns to the trigger', async () => {
    const root = await mount(nav());
    await tick();
    const { buttons, panels } = parts(root);
    const docs = root.querySelector('a[href="#docs"]');
    buttons[0].focus();
    key(buttons[0], 'ArrowRight');
    assert.equal(document.activeElement, buttons[1]);
    key(buttons[1], 'ArrowRight');
    assert.equal(document.activeElement, docs, 'a link in the bar is part of the walk');
    key(docs, 'ArrowRight');
    assert.equal(document.activeElement, buttons[0], 'wraps');
    key(buttons[0], 'ArrowDown');
    await tick();
    assert.equal(panels[0].hidden, false);
    const intro = panels[0].querySelector('a[href="#intro"]');
    assert.equal(document.activeElement, intro, 'focus is on the first link');
    key(intro, 'ArrowDown');
    assert.equal(document.activeElement, panels[0].querySelector('a[href="#install"]'), 'ArrowDown moves within the panel');
    key(document.activeElement, 'Escape');
    await tick();
    assert.equal(panels[0].hidden, true);
    assert.equal(document.activeElement, buttons[0], 'Escape returns to the trigger');
    root.remove();
  });

  test('a click outside, focus leaving the nav, or following a link closes the panel', async () => {
    const root = await mount(html`${nav()}<button data-testid="after">after</button>`);
    await tick();
    const { buttons, panels } = parts(root);
    buttons[0].click();
    await tick();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await tick();
    assert.equal(panels[0].hidden, true, 'an outside pointerdown');
    buttons[0].focus();
    buttons[0].click();
    await tick();
    root.querySelector('[data-testid="after"]').focus();
    await tick();
    assert.equal(panels[0].hidden, true, 'focus leaving the nav');
    buttons[0].click();
    await tick();
    const link = panels[0].querySelector('a[href="#intro"]');
    link.addEventListener('click', (e) => e.preventDefault(), { once: true });
    link.click();
    await tick();
    assert.equal(panels[0].hidden, true, 'following a link');
    root.remove();
  });

  test('the viewport frame takes the open panel\'s size, and a panel sits over it', async () => {
    const root = await mount(nav());
    await tick();
    const { buttons, panels } = parts(root);
    const frame = root.querySelector('[data-slot="navigation-menu-viewport"]');
    assert.equal(frame.hidden, true, 'no frame while closed');
    buttons[1].click();
    await tick();
    assert.equal(frame.hidden, false);
    assert.equal(frame.getAttribute('data-state'), 'open');
    assert.equal(frame.style.getPropertyValue('--radix-navigation-menu-viewport-width'), `${panels[1].offsetWidth}px`);
    assert.equal(frame.style.getPropertyValue('--radix-navigation-menu-viewport-height'), `${panels[1].offsetHeight}px`);
    // This suite loads no stylesheet, so the class is the observable: an item
    // positions its panel only when there is no viewport frame to sit over.
    const li = root.querySelector('[data-slot="navigation-menu-item"]').classList;
    assert.ok(li.contains('group-data-[viewport=false]/navigation-menu:relative'), 'positioned without a viewport');
    assert.equal(li.contains('relative'), false, 'never positioned unconditionally');
    buttons[1].click();
    root.remove();
  });

  test('switching panels sets the slide direction', async () => {
    const root = await mount(nav());
    await tick();
    const { buttons, panels } = parts(root);
    buttons[0].click();
    await tick();
    assert.equal(panels[0].hasAttribute('data-motion'), false, 'a first open has no direction');
    buttons[1].click();
    await tick();
    assert.equal(panels[1].getAttribute('data-motion'), 'from-end');
    buttons[0].click();
    await tick();
    assert.equal(panels[0].getAttribute('data-motion'), 'from-start');
    buttons[0].click();
    root.remove();
  });

  test('the indicator sits under the open trigger', async () => {
    const root = await mount(nav());
    await tick();
    const { menu, buttons } = parts(root);
    const ind = root.querySelector('[data-slot="navigation-menu-indicator"]');
    assert.equal(ind.getAttribute('data-state'), 'hidden');
    buttons[1].click();
    await tick();
    assert.equal(ind.getAttribute('data-state'), 'visible');
    const b = buttons[1].getBoundingClientRect();
    const n = menu.querySelector('[data-slot="navigation-menu"]').getBoundingClientRect();
    assert.ok(Math.abs(parseFloat(ind.style.left) - (b.left - n.left)) < 0.01, `left ${ind.style.left}`);
    assert.ok(Math.abs(parseFloat(ind.style.width) - b.width) < 0.01, `width ${ind.style.width}`);
    buttons[1].click();
    root.remove();
  });
});

suite('ui-select', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/select.ts`);
  });

  const field = ({ required = false, extra = '' } = {}) => html`
    <form data-testid="form">
      <label for="fruit">Fruit</label>
      <ui-select placeholder="Select a fruit">
        <select id="fruit" name="fruit" ?required=${required} aria-describedby="fruit-hint">
          <option value="" disabled selected hidden>Select a fruit</option>
          <optgroup label="Fruits">
            <option value="apple">Apple</option>
            <option value="banana">Banana</option>
            <option value="grapes" disabled>Grapes</option>
          </optgroup>
          <hr>
          <option value="pineapple">Pineapple</option>
        </select>
      </ui-select>
      <p id="fruit-hint">Pick one.</p>
      <button type="submit">Save</button>${extra}
    </form>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-select');
    const select = el.querySelector('select');
    const trigger = el.querySelector('[data-slot="select-trigger"]');
    const panel = el.querySelector('[data-slot="select-content"]');
    const options = () => [...el.querySelectorAll('[data-slot="select-item"]')];
    const value = () => el.querySelector('[data-slot="select-value"]').textContent.trim();
    return { el, select, trigger, panel, options, value };
  };
  const key = (target, k, opts = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  test('it hides the native select visually, keeps it in the form, and draws a combobox trigger', async () => {
    const root = await mount(field());
    await tick();
    const { select, trigger, value } = parts(root);
    assert.ok(trigger, 'a trigger is drawn');
    assert.equal(trigger.getAttribute('role'), 'combobox');
    assert.equal(trigger.getAttribute('aria-haspopup'), 'listbox');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.ok(trigger.hasAttribute('data-placeholder'));
    assert.equal(value(), 'Select a fruit');
    assert.equal(select.hidden, false, 'not hidden, so it can still anchor a validation bubble');
    assert.notEqual(getComputedStyle(select).display, 'none');
    assert.equal(getComputedStyle(select).opacity, '0');
    assert.equal(select.getAttribute('aria-hidden'), 'true');
    assert.equal(select.tabIndex, -1);
    root.remove();
  });

  test('the trigger is named by the label, carries the describedby, and a label click focuses it', async () => {
    const root = await mount(field());
    await tick();
    const { trigger } = parts(root);
    const label = root.querySelector('label');
    assert.equal(trigger.getAttribute('aria-labelledby'), label.id);
    assert.equal(trigger.getAttribute('aria-describedby'), 'fruit-hint');
    label.click();
    await tick();
    assert.equal(document.activeElement, trigger, 'the label click lands on the trigger');
    root.remove();
  });

  test('the list mirrors the options: groups are named, the separator is hidden, the placeholder is not listed', async () => {
    const root = await mount(field());
    await tick();
    const { el, trigger, panel, options } = parts(root);
    trigger.click();
    await tick();
    assert.equal(panel.getAttribute('role'), 'listbox');
    assert.equal(trigger.getAttribute('aria-controls'), panel.id);
    assert.deepEqual(options().map((o) => o.textContent.trim()), ['Apple', 'Banana', 'Grapes', 'Pineapple']);
    const group = el.querySelector('[role="group"]');
    assert.equal(document.getElementById(group.getAttribute('aria-labelledby')).textContent, 'Fruits');
    assert.equal(el.querySelector('[data-slot="select-separator"]').getAttribute('aria-hidden'), 'true');
    assert.equal(options()[2].getAttribute('aria-disabled'), 'true', 'a disabled option says so');
    el.hide();
    root.remove();
  });

  test('choosing writes the native value, fires input, change and ui-value-change once, and closes on the trigger', async () => {
    const root = await mount(field());
    await tick();
    const { el, select, trigger, options, value } = parts(root);
    const seen = [];
    select.addEventListener('input', () => seen.push('input'));
    select.addEventListener('change', () => seen.push('change'));
    el.addEventListener('ui-value-change', (e) => seen.push(`ui:${e.detail.value}`));
    trigger.click();
    await tick();
    options()[1].click();
    await tick();
    assert.equal(select.value, 'banana');
    assert.deepEqual(seen, ['input', 'change', 'ui:banana']);
    assert.equal(value(), 'Banana');
    assert.equal(trigger.hasAttribute('data-placeholder'), false);
    assert.equal(el.open, false);
    assert.equal(document.activeElement, trigger);
    assert.equal(new FormData(root.querySelector('form')).get('fruit'), 'banana', 'the form submits it');
    trigger.click();
    await tick();
    options()[1].click();
    await tick();
    assert.equal(seen.length, 3, 'choosing the same option again fires nothing');
    root.remove();
  });

  test('ArrowDown opens on the selected option, arrows skip a disabled option, Enter chooses', async () => {
    const root = await mount(field());
    await tick();
    const { el, select, trigger, options } = parts(root);
    select.value = 'banana';
    select.dispatchEvent(new Event('change'));
    await tick();
    trigger.focus();
    key(trigger, 'ArrowDown');
    await tick();
    assert.ok(el.open);
    assert.equal(document.activeElement, options()[1], 'opens on Banana');
    key(document.activeElement, 'ArrowDown');
    assert.equal(document.activeElement, options()[3], 'Grapes is disabled, so Pineapple');
    key(document.activeElement, 'Enter');
    await tick();
    assert.equal(select.value, 'pineapple');
    assert.equal(document.activeElement, trigger);
    root.remove();
  });

  test('Escape closes without changing the value', async () => {
    const root = await mount(field());
    await tick();
    const { el, select, trigger } = parts(root);
    trigger.click();
    await tick();
    key(document.activeElement, 'ArrowDown');
    key(document.activeElement, 'Escape');
    await tick();
    assert.equal(el.open, false);
    assert.equal(select.value, '');
    assert.equal(document.activeElement, trigger);
    root.remove();
  });

  test('typing on the closed trigger picks the matching option, as a native select does', async () => {
    const root = await mount(field());
    await tick();
    const { el, select, trigger } = parts(root);
    trigger.focus();
    key(trigger, 'p');
    await tick();
    assert.equal(select.value, 'pineapple');
    assert.equal(el.open, false, 'without opening');
    root.remove();
  });

  test('editing the options re-renders the list, and a form reset restores the trigger', async () => {
    const root = await mount(field());
    await tick();
    const { el, select, trigger, options, value } = parts(root);
    select.value = 'apple';
    select.dispatchEvent(new Event('change'));
    await tick();
    select.querySelector('option[value="apple"]').textContent = 'Green apple';
    await tick();
    assert.equal(value(), 'Green apple', 'an edit to the chosen option reaches the trigger with no interaction');
    const o = document.createElement('option');
    o.value = 'mango';
    o.textContent = 'Mango';
    select.appendChild(o);
    await tick();
    trigger.click();
    await tick();
    assert.ok(options().some((x) => x.textContent.trim() === 'Mango'), 'the new option is listed');
    options().find((x) => x.textContent.trim() === 'Mango').click();
    await tick();
    assert.equal(value(), 'Mango');
    root.querySelector('form').reset();
    await tick();
    assert.equal(select.value, '');
    assert.equal(value(), 'Select a fruit', 'the trigger reverts with the form');
    el.hide();
    root.remove();
  });

  test('a required select that fails validation marks and focuses the trigger, without throwing', async () => {
    const root = await mount(field({ required: true }));
    await tick();
    const { trigger, options } = parts(root);
    const form = root.querySelector('form');
    let ok = true;
    assert.doesNotThrow(() => { ok = form.reportValidity(); });
    await tick();
    assert.equal(ok, false);
    assert.equal(trigger.getAttribute('aria-invalid'), 'true');
    assert.equal(document.activeElement, trigger);
    trigger.click();
    await tick();
    options()[0].click();
    await tick();
    assert.equal(trigger.hasAttribute('aria-invalid'), false, 'a valid choice clears it');
    root.remove();
  });

  const placed = (panel) => ({ top: parseFloat(panel.style.top), left: parseFloat(panel.style.left) });

  test('by default the list opens over the trigger, the chosen option lying on the value', async () => {
    const root = await mount(html`<div style="padding: 220px 0 0 240px">${field()}</div>`);
    await tick();
    const { el, select, trigger, panel, options } = parts(root);
    select.value = 'banana';
    select.dispatchEvent(new Event('change'));
    await tick();
    trigger.click();
    await tick();
    assert.equal(panel.getAttribute('data-position'), 'item-aligned');
    // This suite loads no stylesheet, so the UA [popover] rule moves the
    // painted panel; offsets INSIDE the panel are unaffected, so the check
    // composes the written top with the option's offset in the panel.
    const p = panel.getBoundingClientRect();
    const o = options()[1].getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const optionCentre = placed(panel).top + (o.top - p.top) + o.height / 2;
    assert.ok(Math.abs(optionCentre - (t.top + t.height / 2)) <= 1, `option centre ${optionCentre} vs trigger centre ${t.top + t.height / 2}`);
    const textLeft = placed(panel).left + (options()[1].lastElementChild.getBoundingClientRect().left - p.left);
    const valueLeft = el.querySelector('[data-slot="select-value"]').getBoundingClientRect().left;
    assert.ok(Math.abs(textLeft - valueLeft) <= 1, `option text ${textLeft} vs value text ${valueLeft}`);
    el.hide();
    root.remove();
  });

  test('position="popper" opens the list below the trigger, at least as wide', async () => {
    const root = await mount(html`<ui-select position="popper"><select name="s"><option value="a">A</option><option value="b">B</option></select></ui-select>`);
    await tick();
    const el = root.querySelector('ui-select');
    const trigger = el.querySelector('[data-slot="select-trigger"]');
    const panel = el.querySelector('[data-slot="select-content"]');
    trigger.click();
    await tick();
    const t = trigger.getBoundingClientRect();
    assert.equal(panel.getAttribute('data-position'), 'popper');
    assert.ok(Math.abs(placed(panel).top - (t.bottom + 4)) <= 1, 'below the trigger');
    assert.ok(Math.abs(parseFloat(panel.style.minWidth) - t.width) < 0.01, `min-width ${panel.style.minWidth}`);
    el.hide();
    root.remove();
  });

  test('an outside press closes the list', async () => {
    const root = await mount(field());
    await tick();
    const { el, trigger } = parts(root);
    trigger.click();
    await tick();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await tick();
    assert.equal(el.open, false);
    root.remove();
  });
});

suite('ui-command', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/command.ts`);
  });

  const palette = (attrs = {}) => html`
    <ui-command label="Command menu" ?loop=${!!attrs.loop} should-filter=${attrs.filter ?? 'true'}>
      <ui-command-input placeholder="Type a command"></ui-command-input>
      <ui-command-list>
        <ui-command-empty>No results found.</ui-command-empty>
        <ui-command-group heading="Suggestions">
          <ui-command-item>Calendar</ui-command-item>
          <ui-command-item keywords="emoji smiley">Search Emoji</ui-command-item>
          <ui-command-item disabled>Calculator</ui-command-item>
        </ui-command-group>
        <ui-command-separator></ui-command-separator>
        <ui-command-group heading="Settings">
          <ui-command-item>Open Settings</ui-command-item>
          <ui-command-item value="settings">Settings<ui-command-shortcut>⌘S</ui-command-shortcut></ui-command-item>
          <ui-command-item value="docs"><a href="#docs" data-testid="docs">Docs</a></ui-command-item>
        </ui-command-group>
      </ui-command-list>
    </ui-command>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-command');
    const input = el.querySelector('input[data-slot="command-input"]');
    const items = () => [...el.querySelectorAll('ui-command-item')];
    const shown = () => el.visibleItems().map((i) => i.itemValue);
    const selected = () => items().find((i) => i.state.selected)?.itemValue ?? null;
    return { el, input, items, shown, selected };
  };
  const search = async (input, text) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const key = (target, k, opts = {}) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));

  test('the input is a combobox over the listbox, pointing at the selected option', async () => {
    const root = await mount(palette());
    await tick();
    const { el, input, items, selected } = parts(root);
    const list = el.querySelector('[data-slot="command-list"]');
    assert.equal(input.getAttribute('role'), 'combobox');
    assert.equal(list.getAttribute('role'), 'listbox');
    assert.equal(input.getAttribute('aria-controls'), list.id);
    assert.equal(document.getElementById(input.getAttribute('aria-labelledby')).textContent, 'Command menu');
    assert.equal(selected(), 'Calendar', 'the first enabled item starts selected');
    const option = items()[0].querySelector('[role="option"]');
    assert.equal(option.getAttribute('data-selected'), 'true');
    assert.equal(input.getAttribute('aria-activedescendant'), option.id);
    const group = el.querySelector('[role="group"]');
    assert.equal(document.getElementById(group.getAttribute('aria-labelledby')).textContent, 'Suggestions');
    assert.equal(items()[2].querySelector('[role="option"]').getAttribute('aria-disabled'), 'true');
    root.remove();
  });

  test('typing filters by value and keywords, hides empty groups and separators, and reselects', async () => {
    const root = await mount(palette());
    await tick();
    const { el, input, shown, selected } = parts(root);
    const searches = [];
    el.addEventListener('ui-search-change', (e) => searches.push(e.detail.search));
    await search(input, 'smiley');
    assert.deepEqual(shown(), ['Search Emoji'], 'a keyword matches');
    assert.equal(selected(), 'Search Emoji');
    assert.equal(el.querySelectorAll('ui-command-group')[1].hidden, true, 'the empty group hides');
    assert.equal(el.querySelector('ui-command-separator [role="separator"]').hidden, true, 'separators hide while searching');
    assert.equal(el.querySelector('[data-slot="command-empty"]').hidden, true);
    await search(input, 'zzz');
    assert.deepEqual(shown(), []);
    assert.equal(el.querySelector('[data-slot="command-empty"]').hidden, false, 'nothing matches, so the empty state shows');
    await search(input, '');
    assert.equal(shown().length, 6, 'clearing the search shows everything');
    assert.deepEqual(searches, ['smiley', 'zzz', '']);
    root.remove();
  });

  test('a search ranks a prefix above a later word, and orders the list to match', async () => {
    const root = await mount(palette());
    await tick();
    const { input, items, shown, selected } = parts(root);
    await search(input, 'set');
    assert.deepEqual(shown(), ['settings', 'Open Settings']);
    assert.equal(selected(), 'settings', 'the best match is selected');
    const [open, settings] = [items()[3], items()[4]];
    assert.ok(Number(settings.style.order || 0) < Number(open.style.order || 0), 'the list shows it first');
    root.remove();
  });

  test('arrows move the selection past a disabled item and stop at the ends; loop wraps', async () => {
    const root = await mount(palette());
    await tick();
    const { el, input, selected } = parts(root);
    input.focus();
    key(input, 'ArrowDown');
    assert.equal(selected(), 'Search Emoji');
    key(input, 'ArrowDown');
    assert.equal(selected(), 'Open Settings', 'Calculator is disabled');
    key(input, 'End');
    assert.equal(selected(), 'docs');
    key(input, 'ArrowDown');
    assert.equal(selected(), 'docs', 'no wrap without loop');
    key(input, 'Home');
    key(input, 'ArrowUp');
    assert.equal(selected(), 'Calendar');
    key(input, 'n', { ctrlKey: true });
    assert.equal(selected(), 'Search Emoji', 'Ctrl+N moves down too');
    el.loop = true;
    key(input, 'Home');
    key(input, 'ArrowUp');
    assert.equal(selected(), 'docs', 'loop wraps');
    root.remove();
  });

  test('Enter runs the selected item, a click runs any item, and a link inside is followed', async () => {
    const root = await mount(palette());
    await tick();
    const { el, input, items } = parts(root);
    const ran = [];
    el.addEventListener('ui-select', (e) => ran.push(e.detail.value));
    key(input, 'Enter');
    assert.deepEqual(ran, ['Calendar']);
    items()[1].querySelector('[role="option"]').click();
    assert.deepEqual(ran, ['Calendar', 'Search Emoji']);
    items()[2].querySelector('[role="option"]').click();
    assert.equal(ran.length, 2, 'a disabled item does not run');
    let followed = 0;
    const link = root.querySelector('[data-testid="docs"]');
    link.addEventListener('click', (e) => { followed++; e.preventDefault(); });
    key(input, 'End');
    key(input, 'Enter');
    assert.equal(followed, 1, 'Enter on an item holding a link follows it');
    root.remove();
  });

  test('pointing at an item selects it', async () => {
    const root = await mount(palette());
    await tick();
    const { items, selected } = parts(root);
    items()[3].querySelector('[role="option"]').dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    assert.equal(selected(), 'Open Settings');
    items()[2].querySelector('[role="option"]').dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    assert.equal(selected(), 'Open Settings', 'not onto a disabled item');
    root.remove();
  });

  test('should-filter="false" leaves every item shown', async () => {
    const root = await mount(palette({ filter: 'false' }));
    await tick();
    const { input, shown } = parts(root);
    await search(input, 'zzz');
    assert.equal(shown().length, 6);
    root.remove();
  });

  test('ui-command-dialog opens the command in a named native dialog', async () => {
    const root = await mount(html`<ui-command-dialog title="Search the docs"><ui-command><ui-command-input placeholder="Search"></ui-command-input><ui-command-list><ui-command-item>Intro</ui-command-item></ui-command-list></ui-command></ui-command-dialog>`);
    await tick();
    const dlg = root.querySelector('ui-command-dialog');
    dlg.show();
    await tick();
    const native = dlg.querySelector('dialog');
    assert.ok(native.open, 'the native dialog is open');
    assert.equal(document.getElementById(native.getAttribute('aria-labelledby'))?.textContent, 'Search the docs');
    assert.ok(native.querySelector('ui-command [role="combobox"]'), 'the command is inside it');
    assert.equal(native.querySelector('[data-slot="dialog-close"]'), null, 'no close button unless asked');
    dlg.hide();
    await tick();
    root.remove();
  });
});

suite('ui-combobox', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/combobox.ts`);
  });

  const single = (value = '') => html`
    <form>
      <label for="fw">Framework</label>
      <ui-combobox name="framework" value=${value}>
        <ui-combobox-input input-id="fw" placeholder="Select a framework" show-clear></ui-combobox-input>
        <ui-combobox-content>
          <ui-combobox-empty>No items found.</ui-combobox-empty>
          <ui-combobox-list>
            <ui-combobox-group>
              <ui-combobox-label>React</ui-combobox-label>
              <ui-combobox-item value="next">Next.js</ui-combobox-item>
              <ui-combobox-item value="remix" disabled>Remix</ui-combobox-item>
            </ui-combobox-group>
            <ui-combobox-separator></ui-combobox-separator>
            <ui-combobox-item value="sveltekit">SvelteKit</ui-combobox-item>
            <ui-combobox-item value="astro">Astro</ui-combobox-item>
          </ui-combobox-list>
        </ui-combobox-content>
      </ui-combobox>
    </form>
  `;
  const chips = () => html`
    <form>
      <ui-combobox name="tags" multiple value="next,astro">
        <ui-combobox-chips><ui-combobox-chips-input aria-label="Tags" placeholder="Add"></ui-combobox-chips-input></ui-combobox-chips>
        <ui-combobox-content>
          <ui-combobox-list>
            <ui-combobox-item value="next">Next.js</ui-combobox-item>
            <ui-combobox-item value="sveltekit">SvelteKit</ui-combobox-item>
            <ui-combobox-item value="astro">Astro</ui-combobox-item>
          </ui-combobox-list>
        </ui-combobox-content>
      </ui-combobox>
    </form>
  `;
  const parts = (root) => {
    const el = root.querySelector('ui-combobox');
    const input = el._input();
    const form = () => new FormData(root.querySelector('form'));
    const shown = () => el.visibleItems().map((i) => i.itemValue);
    const option = (v) => [...el.querySelectorAll('ui-combobox-item')].find((i) => i.itemValue === v).querySelector('[role="option"]');
    return { el, input, form, shown, option };
  };
  const type = async (input, text) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const key = (target, k) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

  test('the value lives in a hidden form control, and the input shows its label', async () => {
    const root = await mount(single('astro'));
    await tick();
    const { el, input, form } = parts(root);
    assert.equal(form().get('framework'), 'astro');
    assert.equal(input.value, 'Astro');
    assert.equal(input.getAttribute('role'), 'combobox');
    assert.equal(input.labels[0].textContent, 'Framework', 'the label names the rendered input');
    assert.equal(input.getAttribute('aria-controls'), el.querySelector('[role="listbox"]').id);
    root.remove();
  });

  test('typing opens and filters the list, hides an empty group, and marks the content empty when nothing matches', async () => {
    const root = await mount(single());
    await tick();
    const { el, input, shown } = parts(root);
    await type(input, 'st');
    assert.ok(el.open, 'typing opens the list');
    assert.deepEqual(shown(), ['astro']);
    assert.equal(el.querySelector('ui-combobox-group').hidden, true, 'the React group has no match');
    await type(input, 'zz');
    const content = el.querySelector('[data-slot="combobox-content"]');
    assert.ok(content.hasAttribute('data-empty'), 'the empty state is shown through data-empty');
    root.remove();
  });

  test('arrows highlight through aria-activedescendant past a disabled item, and Enter picks', async () => {
    const root = await mount(single());
    await tick();
    const { el, input, form, option } = parts(root);
    input.focus();
    key(input, 'ArrowDown');
    await tick();
    assert.ok(el.open);
    assert.equal(input.getAttribute('aria-activedescendant'), option('next').id);
    assert.ok(option('next').hasAttribute('data-highlighted'));
    key(input, 'ArrowDown');
    await tick();
    assert.equal(input.getAttribute('aria-activedescendant'), option('sveltekit').id, 'Remix is disabled');
    const seen = [];
    el.addEventListener('ui-value-change', (e) => seen.push(e.detail.value));
    key(input, 'Enter');
    await tick();
    assert.deepEqual(seen, ['sveltekit']);
    assert.equal(form().get('framework'), 'sveltekit');
    assert.equal(input.value, 'SvelteKit');
    assert.equal(el.open, false, 'a single pick closes the list');
    assert.equal(option('sveltekit').getAttribute('aria-selected'), 'true');
    root.remove();
  });

  test('Escape closes, and leaving puts the chosen label back in the input', async () => {
    const root = await mount(html`${single('next')}<button data-testid="after">after</button>`);
    await tick();
    const { el, input } = parts(root);
    input.focus();
    await type(input, 'sv');
    key(input, 'Escape');
    await tick();
    assert.equal(el.open, false);
    root.querySelector('[data-testid="after"]').focus();
    await tick();
    assert.equal(input.value, 'Next.js', 'the half-typed text reverts to the choice');
    root.remove();
  });

  test('the clear button empties the value and the form control', async () => {
    const root = await mount(single('astro'));
    await tick();
    const { el, input, form } = parts(root);
    const clear = el.querySelector('[data-slot="combobox-clear"]');
    assert.ok(clear, 'a clear button shows while there is a value');
    clear.click();
    await tick();
    assert.equal(form().get('framework'), null);
    assert.equal(input.value, '');
    assert.equal(el.querySelector('[data-slot="combobox-clear"]'), null, 'and goes once it is empty');
    root.remove();
  });

  test('an outside press closes the list, and a click on an item picks it', async () => {
    const root = await mount(single());
    await tick();
    const { el, input, option, form } = parts(root);
    input.click();
    await tick();
    assert.ok(el.open);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await tick();
    assert.equal(el.open, false);
    input.click();
    await tick();
    option('astro').click();
    await tick();
    assert.equal(form().get('framework'), 'astro');
    root.remove();
  });

  test('chips mode: one hidden control per value, chips drawn and removable, Backspace drops the last', async () => {
    const root = await mount(chips());
    await tick();
    const { el, input, form, option } = parts(root);
    assert.deepEqual(form().getAll('tags'), ['next', 'astro']);
    const chipsEl = () => [...el.querySelectorAll('[data-slot="combobox-chip"]')];
    assert.deepEqual(chipsEl().map((c) => c.firstChild.textContent.trim()), ['Next.js', 'Astro']);
    assert.equal(el.querySelector('[role="listbox"]').getAttribute('aria-multiselectable'), 'true');
    input.click();
    await tick();
    option('sveltekit').click();
    await tick();
    assert.deepEqual(form().getAll('tags'), ['next', 'astro', 'sveltekit']);
    assert.ok(el.open, 'a pick keeps the list open in chips mode');
    option('next').click();
    await tick();
    assert.deepEqual(form().getAll('tags'), ['astro', 'sveltekit'], 'picking again toggles it off');
    const remove = chipsEl()[0].querySelector('[data-slot="combobox-chip-remove"]');
    assert.equal(remove.getAttribute('aria-label'), 'Remove Astro');
    remove.click();
    await tick();
    assert.deepEqual(form().getAll('tags'), ['sveltekit']);
    input.focus();
    key(input, 'Backspace');
    await tick();
    assert.deepEqual(form().getAll('tags'), []);
    root.remove();
  });
});

suite('ui-dropdown-menu: a trigger outside the menu, and the panel shadcn styles', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
  });

  async function group() {
    const root = await mount(html`
      <div role="group" data-slot="button-group">
        <button type="button">Archive</button>
        <button type="button" id="dd-ext" aria-label="More">+</button>
      </div>
      <ui-dropdown-menu trigger="dd-ext" class="absolute">
        <ui-dropdown-menu-content align="end" class="w-40 dd-authored">
          <ui-dropdown-menu-label>Actions</ui-dropdown-menu-label>
          <ui-dropdown-menu-item>One</ui-dropdown-menu-item>
          <ui-dropdown-menu-item>Two</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    await tick();
    return root;
  }

  test('the named button opens and closes the menu, and carries its ARIA', async () => {
    const root = await group();
    const menu = root.querySelector('ui-dropdown-menu');
    const button = root.querySelector('#dd-ext');
    try {
      assert.equal(button.getAttribute('aria-haspopup'), 'menu', 'the button is announced as a menu button');
      button.click();
      await tick();
      assert.equal(menu.open, true, 'a click opens the menu');
      assert.equal(button.getAttribute('aria-expanded'), 'true');
      button.click();
      await tick();
      assert.equal(menu.open, false, 'a second click closes it, rather than the outside-click handler reopening it');
      button.click();
      await tick();
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      document.body.click();
      await tick();
      assert.equal(menu.open, false, 'a click elsewhere closes it');
    } finally {
      menu.hide();
      root.remove();
    }
  });

  test('the class written on the content is on the panel, which keeps start alignment under align="end"', async () => {
    const root = await group();
    try {
      const host = root.querySelector('ui-dropdown-menu-content');
      const panel = root.querySelector('[role="menu"]');
      assert.match(panel.className, /\bw-40\b/, 'shadcn\'s className lands on the panel');
      assert.match(panel.className, /\bdd-authored\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
      // Chromium and WebKit map the legacy align attribute to text-align: end
      // (Firefox does not on a custom element). The browser suite loads no
      // stylesheet, so the reset is asserted as the class that carries it.
      assert.match(panel.className, /\btext-start\b/, 'the panel resets the legacy alignment');
    } finally {
      root.remove();
    }
  });

  test('a pointer open focuses the panel, a keyboard open the first item', async () => {
    const root = await group();
    const menu = root.querySelector('ui-dropdown-menu');
    const button = root.querySelector('#dd-ext');
    try {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      await tick();
      assert.equal(document.activeElement, root.querySelector('[role="menu"]'), 'a pointer open highlights nothing');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await tick();
      assert.equal(document.activeElement.textContent.trim(), 'One', 'and ArrowDown then moves to the first item');
      menu.hide();
      await tick();
      button.click();
      await tick();
      assert.equal(document.activeElement.textContent.trim(), 'One', 'a keyboard open (detail 0) moves straight to the first item');
    } finally {
      menu.hide();
      root.remove();
    }
  });
});

suite('overlay positioning: the Radix variables shadcn\'s classes read', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
    await import(`${COMPONENTS_DIR}/tooltip.ts`);
  });

  test('a dropdown panel sized from the trigger width stays the menu\'s width, not the viewport\'s', async () => {
    // The browser suite loads no stylesheet, so the rule under test is written
    // here: shadcn's dropdown content classes w-(--radix-dropdown-menu-trigger-width)
    // and min-w-32. With the variable unset the width is invalid, falls back
    // to auto, and the fixed panel stretches to the viewport's edge.
    const style = document.createElement('style');
    style.textContent = '[data-slot="dropdown-menu-content"] { box-sizing: border-box; width: var(--radix-dropdown-menu-trigger-width); min-width: 128px; }';
    document.head.append(style);
    const root = await mount(html`
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger><button style="width: 28px">More</button></ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content>
          <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    `);
    const dm = root.querySelector('ui-dropdown-menu');
    try {
      dm.show();
      await tick();
      const panel = root.querySelector('[role="menu"]');
      assert.equal(panel.style.getPropertyValue('--radix-dropdown-menu-trigger-width'), '28px');
      assert.ok(parseFloat(panel.style.getPropertyValue('--radix-dropdown-menu-content-available-height')) > 0, 'the room beside the trigger');
      assert.ok(panel.style.getPropertyValue('--radix-dropdown-menu-content-transform-origin'), 'the corner it grows from');
      const width = Math.round(panel.getBoundingClientRect().width);
      assert.equal(width, 128, `min-w-32 over the trigger width, not the viewport (got ${width})`);
    } finally {
      dm.hide();
      root.remove();
      style.remove();
    }
  });

  test('a tooltip panel carries its own component\'s variables', async () => {
    const root = await mount(html`
      <ui-tooltip delay-duration="0">
        <ui-tooltip-trigger><button>Tip</button></ui-tooltip-trigger>
        <ui-tooltip-content>Reset</ui-tooltip-content>
      </ui-tooltip>
    `);
    try {
      const button = root.querySelector('button');
      button.focus();
      await new Promise((r) => setTimeout(r, 50));
      await tick();
      const panel = root.querySelector('ui-tooltip-content [popover]');
      assert.ok(panel.style.getPropertyValue('--radix-tooltip-trigger-width'), 'the trigger width');
      assert.ok(panel.style.getPropertyValue('--radix-tooltip-content-transform-origin'), 'the corner it grows from');
    } finally {
      root.querySelector('button')?.blur();
      root.remove();
    }
  });
});

suite('dialog family: the class on the content lands on the panel', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/dialog.ts`);
    await import(`${COMPONENTS_DIR}/alert-dialog.ts`);
    await import(`${COMPONENTS_DIR}/command.ts`);
  });

  test('<ui-dialog-content class> styles the panel, as shadcn\'s DialogContent className does', async () => {
    const root = await mount(html`<ui-dialog><ui-dialog-content class="sm:max-w-md dc-authored"><h2 data-slot="dialog-title">Edit</h2></ui-dialog-content></ui-dialog>`);
    try {
      await tick();
      const host = root.querySelector('ui-dialog-content');
      const panel = root.querySelector('[data-slot="dialog-content"]');
      assert.match(panel.className, /\bsm:max-w-md\b/);
      assert.match(panel.className, /\bdc-authored\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
    } finally {
      root.remove();
    }
  });

  test('<ui-alert-dialog-content class> styles the panel', async () => {
    const root = await mount(html`<ui-alert-dialog><ui-alert-dialog-content class="ad-authored"><h2 data-slot="alert-dialog-title">Sure?</h2></ui-alert-dialog-content></ui-alert-dialog>`);
    try {
      await tick();
      assert.match(root.querySelector('[data-slot="alert-dialog-content"]').className, /\bad-authored\b/);
      assert.equal(root.querySelector('ui-alert-dialog-content').getAttribute('class'), null);
    } finally {
      root.remove();
    }
  });

  test('<ui-command-dialog class> styles the panel, as shadcn\'s CommandDialog className does', async () => {
    const root = await mount(html`<ui-command-dialog class="cd-authored"><ui-command label="Search"><ui-command-input></ui-command-input><ui-command-list><ui-command-item>One</ui-command-item></ui-command-list></ui-command></ui-command-dialog>`);
    try {
      await tick();
      await tick();
      const panel = root.querySelector('[data-slot="dialog-content"]');
      assert.match(panel.className, /\bcd-authored\b/);
      assert.match(panel.className, /\bcn-command-dialog\b/, 'beside the command dialog\'s own classes');
      assert.equal(root.querySelector('ui-command-dialog').getAttribute('class'), null);
    } finally {
      root.remove();
    }
  });
});

suite('overlay parts: a class on the host lands on the element it renders', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/hover-card.ts`);
    await import(`${COMPONENTS_DIR}/dropdown-menu.ts`);
    await import(`${COMPONENTS_DIR}/context-menu.ts`);
    await import(`${COMPONENTS_DIR}/menubar.ts`);
  });

  test('<ui-hover-card-content class> styles the card panel', async () => {
    const root = await mount(html`<ui-hover-card><ui-hover-card-trigger><a href="#x">x</a></ui-hover-card-trigger><ui-hover-card-content class="w-80 hc-authored">Card</ui-hover-card-content></ui-hover-card>`);
    try {
      await tick();
      const host = root.querySelector('ui-hover-card-content');
      const panel = host.querySelector('[data-slot="hover-card-content"]');
      assert.match(panel.className, /\bhc-authored\b/);
      assert.match(panel.className, /\bw-80\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
    } finally {
      root.remove();
    }
  });

  test('<ui-dropdown-menu-sub-content class> styles the submenu panel', async () => {
    const root = await mount(html`<ui-dropdown-menu><ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger><ui-dropdown-menu-content><ui-dropdown-menu-sub><ui-dropdown-menu-sub-trigger>More</ui-dropdown-menu-sub-trigger><ui-dropdown-menu-sub-content class="w-44 sub-authored"><ui-dropdown-menu-item>One</ui-dropdown-menu-item></ui-dropdown-menu-sub-content></ui-dropdown-menu-sub></ui-dropdown-menu-content></ui-dropdown-menu>`);
    try {
      await tick();
      const host = root.querySelector('ui-dropdown-menu-sub-content');
      assert.match(host.querySelector('[role="menu"]').className, /\bsub-authored\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
    } finally {
      root.remove();
    }
  });

  test('<ui-context-menu-sub-content class> styles the submenu panel', async () => {
    const root = await mount(html`<ui-context-menu><ui-context-menu-trigger><div tabindex="0">Area</div></ui-context-menu-trigger><ui-context-menu-content><ui-context-menu-sub><ui-context-menu-sub-trigger>More</ui-context-menu-sub-trigger><ui-context-menu-sub-content class="w-44 sub-authored"><ui-context-menu-item>One</ui-context-menu-item></ui-context-menu-sub-content></ui-context-menu-sub></ui-context-menu-content></ui-context-menu>`);
    try {
      await tick();
      const host = root.querySelector('ui-context-menu-sub-content');
      assert.match(host.querySelector('[role="menu"]').className, /\bsub-authored\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
    } finally {
      root.remove();
    }
  });

  test('<ui-menubar-sub-content class> styles the submenu panel', async () => {
    const root = await mount(html`<ui-menubar><ui-menubar-menu><ui-menubar-trigger>File</ui-menubar-trigger><ui-menubar-content><ui-menubar-sub><ui-menubar-sub-trigger>Share</ui-menubar-sub-trigger><ui-menubar-sub-content class="sub-authored"><ui-menubar-item>Email</ui-menubar-item></ui-menubar-sub-content></ui-menubar-sub></ui-menubar-content></ui-menubar-menu></ui-menubar>`);
    try {
      await tick();
      const host = root.querySelector('ui-menubar-sub-content');
      assert.match(host.querySelector('[role="menu"]').className, /\bsub-authored\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
    } finally {
      root.remove();
    }
  });

  test('<ui-context-menu-trigger class> styles the region, as shadcn\'s ContextMenuTrigger className does', async () => {
    const root = await mount(html`<ui-context-menu><ui-context-menu-trigger class="ctx-area"><span>Right click</span></ui-context-menu-trigger><ui-context-menu-content><ui-context-menu-item>One</ui-context-menu-item></ui-context-menu-content></ui-context-menu>`);
    try {
      await tick();
      const host = root.querySelector('ui-context-menu-trigger');
      const region = host.querySelector('[data-slot="context-menu-trigger"]');
      assert.ok(region, 'the trigger renders its region');
      assert.match(region.className, /\bctx-area\b/);
      assert.equal(host.getAttribute('class'), null, 'and leaves the host');
      assert.equal(getComputedStyle(host).display, 'contents', 'which draws no box of its own');
    } finally {
      root.remove();
    }
  });

  test('a menu shortcut is the item\'s flex item, so its auto start margin ends the row', async () => {
    const root = await mount(html`<style>
        .ms-item { display: flex; width: 240px; }
        [data-slot="dropdown-menu-shortcut"] { margin-inline-start: auto; }
      </style>
      <ui-dropdown-menu><ui-dropdown-menu-trigger><button>Open</button></ui-dropdown-menu-trigger><ui-dropdown-menu-content>
        <div class="ms-item">Copy<ui-dropdown-menu-shortcut>C</ui-dropdown-menu-shortcut></div>
      </ui-dropdown-menu-content></ui-dropdown-menu>`);
    try {
      await tick();
      root.querySelector('ui-dropdown-menu').show();
      await tick();
      await tick();
      const host = root.querySelector('ui-dropdown-menu-shortcut');
      const span = host.querySelector('[data-slot="dropdown-menu-shortcut"]');
      const row = root.querySelector('.ms-item');
      assert.equal(getComputedStyle(host).display, 'contents');
      assert.ok(Math.abs(span.getBoundingClientRect().right - row.getBoundingClientRect().right) < 1, 'the shortcut ends the row');
    } finally {
      root.remove();
    }
  });
});
