/**
 * Browser tests for the /ui block viewer (#1666): the server markup from
 * lib/ui/block-viewer.ts plus the <block-viewer> element's behaviour.
 *
 * The Preview / Code toggle, the viewport size and the file selection are
 * radio groups the stylesheet reads with :has(), so the toggle is checked by
 * what is VISIBLE with public/ui.css loaded, not by an attribute the element
 * sets. The element's own work is checked directly: a viewport choice clears
 * a dragged width and returns to the preview, the tree highlight follows the
 * chosen file, Refresh reloads the frame, and the copy buttons write the
 * install command and the file source.
 *
 * The markup below is the fragment's, reduced to the parts under test, with
 * the class strings that drive the CSS copied verbatim, except that the
 * preview is `flex` rather than `hidden lg:flex`, since the runner's viewport
 * is narrower than lg. The frame points at about:blank so the runner fetches
 * nothing.
 */
import '#components/block-viewer.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const MARKUP = `
<block-viewer id="login-01" class="group/block-view-wrapper flex min-w-0 scroll-mt-24 flex-col-reverse items-stretch gap-4 overflow-hidden md:flex-col" style="--height: 400px">
  <div data-slot="block-viewer-toolbar" class="hidden w-full items-center gap-2 pl-2 md:pr-6 lg:flex">
    <div role="radiogroup" aria-label="View">
      <label><input type="radio" class="sr-only" name="login-01-view" value="preview" data-block-view="preview" checked>Preview</label>
      <label id="code-tab"><input type="radio" class="sr-only" name="login-01-view" value="code" data-block-view="code">Code</label>
    </div>
    <div role="radiogroup" aria-label="Preview size">
      <label title="Desktop"><input type="radio" class="sr-only" name="login-01-viewport" value="desktop" data-block-viewport="desktop" checked></label>
      <label title="Tablet" id="tablet"><input type="radio" class="sr-only" name="login-01-viewport" value="tablet" data-block-viewport="tablet"></label>
      <label title="Mobile"><input type="radio" class="sr-only" name="login-01-viewport" value="mobile" data-block-viewport="mobile"></label>
    </div>
    <button type="button" data-block-refresh>Refresh</button>
    <button type="button" data-block-copy="npx @webjsdev/ui add login-01"><span>npx @webjsdev/ui add login-01</span></button>
  </div>
  <div data-slot="block-viewer-view" class="flex md:h-(--height) group-has-[[data-block-view=code]:checked]/block-view-wrapper:hidden">
    <div class="relative grid w-full gap-4">
      <div data-block-panels class="relative z-10 flex">
        <div data-block-panel class="relative z-10 w-[calc(100%-0.75rem)] min-w-[30%] shrink-0 overflow-hidden rounded-xl border bg-background group-has-[[data-block-viewport=tablet]:checked]/block-view-wrapper:w-[60%] group-has-[[data-block-viewport=mobile]:checked]/block-view-wrapper:w-[30%]">
          <iframe src="about:blank" title="Login 01 preview"></iframe>
        </div>
        <div data-block-handle role="separator" class="relative z-10 hidden w-3 shrink-0 md:block"></div>
      </div>
    </div>
  </div>
  <div data-slot="block-viewer-code" class="mr-[14px] hidden overflow-hidden rounded-xl border bg-code text-code-foreground md:h-(--height) group-has-[[data-block-view=code]:checked]/block-view-wrapper:flex">
    <ul>
      <li><label for="login-01-file-0" data-file="0" data-active="true">page.ts</label></li>
      <li><label for="login-01-file-1" data-file="1" data-active="false" id="second-file">login-form.ts</label></li>
    </ul>
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="contents">
        <input type="radio" class="peer sr-only" id="login-01-file-0" name="login-01-file" value="app/login/page.ts" data-block-file="0" checked>
        <div data-block-source class="hidden min-h-0 flex-1 flex-col peer-checked:flex"><button type="button" data-block-copy-file="0">Copy</button><pre><code>export default function LoginPage() {}</code></pre></div>
      </div>
      <div class="contents">
        <input type="radio" class="peer sr-only" id="login-01-file-1" name="login-01-file" value="components/login-form.ts" data-block-file="1">
        <div data-block-source class="hidden min-h-0 flex-1 flex-col peer-checked:flex"><button type="button" data-block-copy-file="1">Copy</button><pre><code>export function loginForm() {}</code></pre></div>
      </div>
    </div>
  </div>
</block-viewer>`;

suite('block viewer', () => {
  let host;
  let viewer;
  let written;
  let restoreClipboard;

  suiteSetup(async () => {
    // The real /ui stylesheet, so the :has() rules the toggles rely on apply.
    if (!document.querySelector('link[data-test-ui-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/public/ui.css';
      link.dataset.testUiCss = '';
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.appendChild(link);
      await loaded;
    }
  });

  setup(async () => {
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
    host = document.createElement('div');
    host.style.width = '1200px';
    host.innerHTML = MARKUP;
    document.body.appendChild(host);
    viewer = host.querySelector('block-viewer');
    await viewer.updateComplete;
  });

  teardown(() => {
    restoreClipboard();
    host.remove();
  });

  const shown = (sel) => getComputedStyle(viewer.querySelector(sel)).display !== 'none';

  test('Preview is shown first, and the Code tab swaps it for the source', async () => {
    assert.ok(shown('[data-slot="block-viewer-view"]'), 'the preview shows by default');
    assert.ok(!shown('[data-slot="block-viewer-code"]'), 'the code view is hidden by default');
    host.querySelector('#code-tab').click();
    await tick();
    assert.ok(viewer.querySelector('input[data-block-view="code"]').checked, 'the Code radio is checked');
    assert.ok(!shown('[data-slot="block-viewer-view"]'), 'the preview hides');
    assert.ok(shown('[data-slot="block-viewer-code"]'), 'the code view shows');
  });

  test('a file in the tree shows its source and moves the highlight', async () => {
    host.querySelector('#code-tab').click();
    host.querySelector('#second-file').click();
    await tick();
    const sources = viewer.querySelectorAll('[data-block-source]');
    assert.equal(getComputedStyle(sources[0]).display, 'none', 'the first file hides');
    assert.ok(getComputedStyle(sources[1]).display !== 'none', 'the second file shows');
    assert.equal(viewer.querySelector('label[data-file="1"]').dataset.active, 'true', 'the chosen file is highlighted');
    assert.equal(viewer.querySelector('label[data-file="0"]').dataset.active, 'false', 'the other is not');
  });

  test('the viewport toggle resizes the preview and returns to it from Code', async () => {
    const panel = viewer.querySelector('[data-block-panel]');
    const group = panel.parentElement;
    const full = panel.getBoundingClientRect().width;
    assert.ok(full > group.getBoundingClientRect().width * 0.9, 'desktop fills the row');
    // A dragged width, then the Code view: a size choice must clear both.
    panel.style.width = '500px';
    host.querySelector('#code-tab').click();
    host.querySelector('#tablet').click();
    await tick();
    assert.equal(panel.style.width, '', 'the dragged width is cleared');
    assert.ok(viewer.querySelector('input[data-block-view="preview"]').checked, 'the preview is shown again');
    const ratio = panel.getBoundingClientRect().width / group.getBoundingClientRect().width;
    assert.ok(Math.abs(ratio - 0.6) < 0.02, `tablet is 60% of the row, got ${ratio}`);
  });

  test('the install button copies the add command and shows a check', async () => {
    const button = viewer.querySelector('[data-block-copy]');
    button.click();
    await tick();
    assert.equal(written, 'npx @webjsdev/ui add login-01');
    assert.ok(button.hasAttribute('data-copied'), 'the button flips to its copied face');
  });

  test('the file copy button copies that file\'s source', async () => {
    host.querySelector('#code-tab').click();
    host.querySelector('#second-file').click();
    await tick();
    viewer.querySelector('[data-block-copy-file="1"]').click();
    await tick();
    assert.equal(written, 'export function loginForm() {}');
  });

  test('Refresh reloads the frame', async () => {
    const frame = viewer.querySelector('iframe');
    let loads = 0;
    frame.addEventListener('load', () => { loads++; });
    viewer.querySelector('[data-block-refresh]').click();
    await tick(200);
    assert.ok(loads >= 1, 'the frame loaded again');
  });
});
