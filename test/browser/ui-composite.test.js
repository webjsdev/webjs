/**
 * Browser tests for composed @webjskit/ui components — components made of
 * multiple subcomponents that compose by DOM nesting. Runs in real Chromium
 * via WTR + Playwright.
 *
 * Covers: card + subcomponents, alert + subcomponents, avatar + subcomponents,
 * table + subcomponents.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
  match: (s, re, msg) => { if (!re.test(s)) throw new Error(msg || `Expected ${s} to match ${re}`); },
};

const COMPONENTS_DIR = '/packages/ui/packages/registry/components';

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

async function mount(tpl) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(tpl, root);
  await tick();
  return root;
}

suite('ui-card composition', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/card.ts`);
  });

  test('renders card with data-slot="card"', async () => {
    const root = await mount(html`<ui-card>body</ui-card>`);
    const inner = root.querySelector('ui-card > div');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-slot'), 'card');
    root.remove();
  });

  test('ui-card-header renders with data-slot="card-header"', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-header>head</ui-card-header>
      </ui-card>
    `);
    const header = root.querySelector('ui-card-header > div');
    assert.ok(header);
    assert.equal(header.getAttribute('data-slot'), 'card-header');
    root.remove();
  });

  test('ui-card-title and description have correct data-slot', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-header>
          <ui-card-title>T</ui-card-title>
          <ui-card-description>D</ui-card-description>
        </ui-card-header>
      </ui-card>
    `);
    const title = root.querySelector('ui-card-title > div');
    const desc = root.querySelector('ui-card-description > div');
    assert.equal(title.getAttribute('data-slot'), 'card-title');
    assert.equal(desc.getAttribute('data-slot'), 'card-description');
    assert.match(title.className, /font-semibold/);
    root.remove();
  });

  test('ui-card-content has data-slot="card-content"', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-content>main body</ui-card-content>
      </ui-card>
    `);
    const content = root.querySelector('ui-card-content > div');
    assert.equal(content.getAttribute('data-slot'), 'card-content');
    assert.match(content.textContent, /main body/);
    root.remove();
  });

  test('ui-card-footer has data-slot="card-footer"', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-footer>footer</ui-card-footer>
      </ui-card>
    `);
    const footer = root.querySelector('ui-card-footer > div');
    assert.equal(footer.getAttribute('data-slot'), 'card-footer');
    root.remove();
  });

  test('full composition: header/title/description/content/footer all render', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-header>
          <ui-card-title>Title</ui-card-title>
          <ui-card-description>Description</ui-card-description>
        </ui-card-header>
        <ui-card-content>Body</ui-card-content>
        <ui-card-footer>Footer</ui-card-footer>
      </ui-card>
    `);
    assert.ok(root.querySelector('[data-slot="card"]'));
    assert.ok(root.querySelector('[data-slot="card-header"]'));
    assert.ok(root.querySelector('[data-slot="card-title"]'));
    assert.ok(root.querySelector('[data-slot="card-description"]'));
    assert.ok(root.querySelector('[data-slot="card-content"]'));
    assert.ok(root.querySelector('[data-slot="card-footer"]'));
    root.remove();
  });

  test('ui-card-action has data-slot="card-action"', async () => {
    const root = await mount(html`
      <ui-card>
        <ui-card-header>
          <ui-card-action>x</ui-card-action>
        </ui-card-header>
      </ui-card>
    `);
    const action = root.querySelector('ui-card-action > div');
    assert.equal(action.getAttribute('data-slot'), 'card-action');
    root.remove();
  });
});

suite('ui-alert composition', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/alert.ts`);
  });

  test('renders an alert with role="alert"', async () => {
    const root = await mount(html`<ui-alert>oops</ui-alert>`);
    const inner = root.querySelector('ui-alert > div');
    assert.ok(inner);
    assert.equal(inner.getAttribute('role'), 'alert');
    assert.equal(inner.getAttribute('data-slot'), 'alert');
    root.remove();
  });

  test('default variant reflects via data-variant + classes', async () => {
    const root = await mount(html`<ui-alert>x</ui-alert>`);
    const inner = root.querySelector('ui-alert > div');
    assert.equal(inner.getAttribute('data-variant'), 'default');
    assert.match(inner.className, /bg-card/);
    root.remove();
  });

  test('destructive variant reflects via data-variant + classes', async () => {
    const root = await mount(html`<ui-alert variant="destructive">x</ui-alert>`);
    const inner = root.querySelector('ui-alert > div');
    assert.equal(inner.getAttribute('data-variant'), 'destructive');
    assert.match(inner.className, /text-destructive/);
    root.remove();
  });

  test('ui-alert-title has data-slot="alert-title"', async () => {
    const root = await mount(html`
      <ui-alert>
        <ui-alert-title>Heads up</ui-alert-title>
      </ui-alert>
    `);
    const title = root.querySelector('ui-alert-title > div');
    assert.equal(title.getAttribute('data-slot'), 'alert-title');
    assert.match(title.textContent, /Heads up/);
    root.remove();
  });

  test('ui-alert-description has data-slot="alert-description"', async () => {
    const root = await mount(html`
      <ui-alert>
        <ui-alert-description>Something broke</ui-alert-description>
      </ui-alert>
    `);
    const desc = root.querySelector('ui-alert-description > div');
    assert.equal(desc.getAttribute('data-slot'), 'alert-description');
    assert.match(desc.textContent, /Something broke/);
    root.remove();
  });

  test('full composition renders all three slots', async () => {
    const root = await mount(html`
      <ui-alert variant="destructive">
        <ui-alert-title>Heads up</ui-alert-title>
        <ui-alert-description>Something broke</ui-alert-description>
      </ui-alert>
    `);
    assert.ok(root.querySelector('[data-slot="alert"]'));
    assert.ok(root.querySelector('[data-slot="alert-title"]'));
    assert.ok(root.querySelector('[data-slot="alert-description"]'));
    root.remove();
  });
});

suite('ui-avatar composition', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/avatar.ts`);
  });

  test('renders avatar root with data-slot="avatar"', async () => {
    const root = await mount(html`<ui-avatar></ui-avatar>`);
    const inner = root.querySelector('ui-avatar > span');
    assert.ok(inner);
    assert.equal(inner.getAttribute('data-slot'), 'avatar');
    root.remove();
  });

  test('size attribute reflects to data-size', async () => {
    const root = await mount(html`<ui-avatar size="lg"></ui-avatar>`);
    const inner = root.querySelector('ui-avatar > span');
    assert.equal(inner.getAttribute('data-size'), 'lg');
    root.remove();
  });

  test('ui-avatar-image renders <img> when src is set', async () => {
    const root = await mount(html`
      <ui-avatar>
        <ui-avatar-image src="/me.png" alt="Me"></ui-avatar-image>
      </ui-avatar>
    `);
    await tick();
    const img = root.querySelector('ui-avatar-image img');
    assert.ok(img, 'img rendered when src is set');
    assert.equal(img.getAttribute('src'), '/me.png');
    assert.equal(img.getAttribute('alt'), 'Me');
    root.remove();
  });

  test('ui-avatar-image renders nothing when src is empty', async () => {
    const root = await mount(html`
      <ui-avatar>
        <ui-avatar-image></ui-avatar-image>
      </ui-avatar>
    `);
    await tick();
    const img = root.querySelector('ui-avatar-image img');
    assert.ok(!img, 'no img when src is empty');
    root.remove();
  });

  test('image error sets failed=true and hides the img', async () => {
    const root = await mount(html`
      <ui-avatar>
        <ui-avatar-image src="/does-not-exist.png"></ui-avatar-image>
      </ui-avatar>
    `);
    await tick();
    const imageHost = root.querySelector('ui-avatar-image');
    let img = imageHost.querySelector('img');
    assert.ok(img, 'img initially rendered');
    // Dispatch a synthetic error event
    img.dispatchEvent(new Event('error', { bubbles: true }));
    await tick();
    img = imageHost.querySelector('img');
    assert.ok(!img, 'img hidden after error');
    root.remove();
  });

  test('ui-avatar-fallback renders with data-slot', async () => {
    const root = await mount(html`
      <ui-avatar>
        <ui-avatar-fallback>VR</ui-avatar-fallback>
      </ui-avatar>
    `);
    const fb = root.querySelector('ui-avatar-fallback span');
    assert.ok(fb);
    assert.equal(fb.getAttribute('data-slot'), 'avatar-fallback');
    assert.match(fb.textContent, /VR/);
    root.remove();
  });

  test('ui-avatar-group renders with data-slot="avatar-group"', async () => {
    const root = await mount(html`
      <ui-avatar-group>
        <ui-avatar></ui-avatar>
        <ui-avatar></ui-avatar>
      </ui-avatar-group>
    `);
    const g = root.querySelector('ui-avatar-group > div');
    assert.equal(g.getAttribute('data-slot'), 'avatar-group');
    root.remove();
  });
});

suite('ui-table composition', () => {
  suiteSetup(async () => {
    await import(`${COMPONENTS_DIR}/table.ts`);
  });

  test('ui-table renders an inner <table> wrapped in a scrolling div', async () => {
    const root = await mount(html`<ui-table></ui-table>`);
    const container = root.querySelector('ui-table > div[data-slot="table-container"]');
    assert.ok(container);
    const table = container.querySelector('table[data-slot="table"]');
    assert.ok(table);
    root.remove();
  });

  test('ui-table-header renders a <thead>', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-header>
          <ui-table-row><ui-table-head>Name</ui-table-head></ui-table-row>
        </ui-table-header>
      </ui-table>
    `);
    const thead = root.querySelector('thead[data-slot="table-header"]');
    assert.ok(thead);
    root.remove();
  });

  test('ui-table-body renders a <tbody>', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-body>
          <ui-table-row><ui-table-cell>Alice</ui-table-cell></ui-table-row>
        </ui-table-body>
      </ui-table>
    `);
    const tbody = root.querySelector('tbody[data-slot="table-body"]');
    assert.ok(tbody);
    root.remove();
  });

  test('ui-table-row renders a <tr> with hover class', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-body>
          <ui-table-row><ui-table-cell>x</ui-table-cell></ui-table-row>
        </ui-table-body>
      </ui-table>
    `);
    const tr = root.querySelector('tr[data-slot="table-row"]');
    assert.ok(tr);
    assert.match(tr.className, /hover:bg-muted/);
    root.remove();
  });

  test('ui-table-head renders a <th> with align-middle class', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-header>
          <ui-table-row><ui-table-head>Col</ui-table-head></ui-table-row>
        </ui-table-header>
      </ui-table>
    `);
    const th = root.querySelector('th[data-slot="table-head"]');
    assert.ok(th);
    assert.match(th.className, /align-middle/);
    assert.match(th.textContent, /Col/);
    root.remove();
  });

  test('ui-table-cell renders a <td>', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-body>
          <ui-table-row><ui-table-cell>Alice</ui-table-cell></ui-table-row>
        </ui-table-body>
      </ui-table>
    `);
    const td = root.querySelector('td[data-slot="table-cell"]');
    assert.ok(td);
    assert.match(td.textContent, /Alice/);
    root.remove();
  });

  test('full composition: header, body, rows render as a real table', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-header>
          <ui-table-row>
            <ui-table-head>Name</ui-table-head>
            <ui-table-head>Email</ui-table-head>
          </ui-table-row>
        </ui-table-header>
        <ui-table-body>
          <ui-table-row>
            <ui-table-cell>Alice</ui-table-cell>
            <ui-table-cell>a@x.com</ui-table-cell>
          </ui-table-row>
          <ui-table-row>
            <ui-table-cell>Bob</ui-table-cell>
            <ui-table-cell>b@x.com</ui-table-cell>
          </ui-table-row>
        </ui-table-body>
      </ui-table>
    `);
    const headerCells = root.querySelectorAll('th[data-slot="table-head"]');
    assert.equal(headerCells.length, 2);
    const bodyCells = root.querySelectorAll('td[data-slot="table-cell"]');
    assert.equal(bodyCells.length, 4);
    root.remove();
  });

  test('ui-table-caption renders a <caption>', async () => {
    const root = await mount(html`
      <ui-table>
        <ui-table-caption>Users</ui-table-caption>
      </ui-table>
    `);
    const caption = root.querySelector('caption[data-slot="table-caption"]');
    assert.ok(caption);
    assert.match(caption.textContent, /Users/);
    root.remove();
  });
});
