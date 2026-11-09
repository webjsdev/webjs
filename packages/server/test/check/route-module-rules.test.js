/**
 * The rules for the line between server-only route modules and browser code
 * (#1686): a page, layout or boundary never loads in a browser, so a component
 * defined in one never upgrades, an event binding in one never fires, a
 * browser module importing one 404s, and a Node builtin reached from browser
 * code never resolves. Each rule has a negative case beside it, since every
 * one of these shapes has a legal neighbour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-route-rules-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);
  }
  return dir;
}

async function hits(files, rule) {
  const dir = await makeApp(files);
  try {
    return (await checkConventions(dir)).filter((v) => v.rule === rule);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const COMPONENT = (cls, tag, extra = '') => `import { WebComponent, html } from '@webjsdev/core';
${extra}
export class ${cls} extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>x</button>\`; }
}
${cls}.register('${tag}');
`;
const PAGE = (extra = '', body = '<p>hi</p>') => `import { html } from '@webjsdev/core';
${extra}
export default function Page() { return html\`${body}\`; }
`;

test('the four rules are listed', () => {
  for (const name of ['no-component-in-route-module', 'no-event-binding-in-route-module',
    'no-route-module-import-in-browser-module', 'no-node-builtin-in-browser-module']) {
    assert.ok(RULES.some((r) => r.name === name), `${name} is in RULES`);
  }
});

test("no-use-client-in-route-module: 'use client' in a page or layout is refused with the component translation", async () => {
  const v = await hits({
    'app/page.ts': `'use client';\n${PAGE()}`,
    'app/layout.ts': `// a layout\n"use client"\nimport { html } from '@webjsdev/core';\nexport default ({ children }) => html\`<main>\${children}</main>\`;\n`,
  }, 'no-use-client-in-route-module');
  assert.deepEqual(v.map((x) => x.file).sort(), [join('app', 'layout.ts'), join('app', 'page.ts')]);
  assert.match(v[0].fix, /component/);
});

test("no-use-client-in-route-module: 'use client' in a component, or in prose, is fine", async () => {
  const v = await hits({
    'components/counter.ts': `'use client';\n${COMPONENT('Counter', 'x-counter')}`,
    'app/page.ts': PAGE("import '../components/counter.ts';\nconst note = \"never write 'use client' here\";\nvoid note;", '<x-counter></x-counter>'),
  }, 'no-use-client-in-route-module');
  assert.deepEqual(v, []);
});

test('no-component-in-route-module: a component class in a page is flagged', async () => {
  const v = await hits({
    'app/page.ts': `import { WebComponent, html } from '@webjsdev/core';
class Inline extends WebComponent { render() { return html\`<b>x</b>\`; } }
Inline.register('in-line');
export default function Page() { return html\`<in-line></in-line>\`; }
`,
  }, 'no-component-in-route-module');
  assert.equal(v.length, 1);
  assert.equal(v[0].file, join('app', 'page.ts'));
  assert.match(v[0].fix, /own file/);
});

test('no-component-in-route-module: a component in its own file, imported by the page, is fine', async () => {
  const v = await hits({
    'components/counter.ts': COMPONENT('Counter', 'x-counter'),
    'app/page.ts': PAGE("import '../components/counter.ts';", '<x-counter></x-counter>'),
  }, 'no-component-in-route-module');
  assert.deepEqual(v, []);
});

test('no-component-in-route-module: route-ness comes from the table, not the file name', async () => {
  // A helper called page.ts outside app/ is not a route module.
  const v = await hits({
    'lib/docs/page.ts': COMPONENT('DocsPage', 'docs-page'),
    'app/page.ts': PAGE("import '../lib/docs/page.ts';", '<docs-page></docs-page>'),
  }, 'no-component-in-route-module');
  assert.deepEqual(v, []);
});

test('no-event-binding-in-route-module: an @click on a tag in a page is flagged', async () => {
  const v = await hits({
    'app/page.ts': PAGE('', '<button @click=${() => alert(1)}>Go</button>'),
  }, 'no-event-binding-in-route-module');
  assert.equal(v.length, 1);
  assert.match(v[0].message, /@click/);
  assert.match(v[0].message, /server component/);
});

test('no-event-binding-in-route-module: escaped text, a property binding and a component are fine', async () => {
  assert.deepEqual(await hits({
    'app/page.ts': PAGE('', '<pre>&lt;button @click=${"x"}&gt;</pre>'),
  }, 'no-event-binding-in-route-module'), [], 'a binding written as escaped text in a sample');
  assert.deepEqual(await hits({
    'components/counter.ts': COMPONENT('Counter', 'x-counter'),
    'app/page.ts': PAGE("import '../components/counter.ts';", '<x-counter .start=${3}></x-counter>'),
  }, 'no-event-binding-in-route-module'), [], 'a property binding round-trips to the component');
});

test('no-route-module-import-in-browser-module: a component importing a page is flagged', async () => {
  const v = await hits({
    'app/settings/page.ts': `${PAGE()}export const LABELS = ['a', 'b'];\n`,
    'components/tabs.ts': COMPONENT('Tabs', 'x-tabs', "import { LABELS } from '../app/settings/page.ts';\nvoid LABELS;"),
    'app/page.ts': PAGE("import '../components/tabs.ts';", '<x-tabs></x-tabs>'),
  }, 'no-route-module-import-in-browser-module');
  assert.equal(v.length, 1);
  assert.equal(v[0].file, join('components', 'tabs.ts'));
  assert.match(v[0].message, /app\/settings\/page\.ts/);
});

test('no-route-module-import-in-browser-module: a component importing a shared helper is fine', async () => {
  const v = await hits({
    'lib/labels.ts': "export const LABELS = ['a', 'b'];\n",
    'components/tabs.ts': COMPONENT('Tabs', 'x-tabs', "import { LABELS } from '../lib/labels.ts';\nvoid LABELS;"),
    'app/page.ts': PAGE("import '../components/tabs.ts';\nimport { LABELS } from '../lib/labels.ts';\nvoid LABELS;", '<x-tabs></x-tabs>'),
  }, 'no-route-module-import-in-browser-module');
  assert.deepEqual(v, []);
});

test('no-node-builtin-in-browser-module: a component importing node:fs is flagged, also through a helper', async () => {
  const direct = await hits({
    'components/files.ts': COMPONENT('Files', 'x-files', "import { readFileSync } from 'node:fs';\nvoid readFileSync;"),
    'app/page.ts': PAGE("import '../components/files.ts';", '<x-files></x-files>'),
  }, 'no-node-builtin-in-browser-module');
  assert.equal(direct.length, 1);
  assert.match(direct[0].message, /node:fs/);

  const viaHelper = await hits({
    'lib/paths.ts': "import { join } from 'path';\nexport const p = (a: string) => join('/', a);\n",
    'components/files.ts': COMPONENT('Files', 'x-files', "import { p } from '../lib/paths.ts';\nvoid p;"),
    'app/page.ts': PAGE("import '../components/files.ts';", '<x-files></x-files>'),
  }, 'no-node-builtin-in-browser-module');
  assert.equal(viaHelper.length, 1, 'a bare builtin in a helper the component imports');
  assert.equal(viaHelper[0].file, join('lib', 'paths.ts'));
});

test('no-node-builtin-in-browser-module: a page, a .server file and an import type are fine', async () => {
  const v = await hits({
    'lib/db.server.ts': "import { readFileSync } from 'node:fs';\nexport const read = () => readFileSync('x');\n",
    'components/files.ts': COMPONENT('Files', 'x-files', "import type { Stats } from 'node:fs';\nlet s: Stats | null = null;\nvoid s;"),
    'app/page.ts': PAGE("import { readFileSync } from 'node:fs';\nimport '../components/files.ts';\nvoid readFileSync;", '<x-files></x-files>'),
  }, 'no-node-builtin-in-browser-module');
  assert.deepEqual(v, []);
});

// ---------------------------------------------------------------------------
// Server-only components (#1686): a component in a `.server` file renders on
// the server and is never defined in the browser.
// ---------------------------------------------------------------------------
const SERVER_CARD = (extra = '', body = '<div class="card">${this.name}</div>') => `import { WebComponent, html } from '@webjsdev/core';
${extra}
export class UserCard extends WebComponent({ name: String }) {
  render() { return html\`${body}\`; }
}
UserCard.register('user-card');
`;
const TABS = (body) => `import { WebComponent, html } from '@webjsdev/core';
export class Tabs extends WebComponent { render() { return html\`${body}\`; } }
Tabs.register('x-tabs');
`;

test('no-interactivity-in-server-component: an event, a signal or a client hook in a .server component is flagged', async () => {
  for (const [label, src] of [
    ['@click', SERVER_CARD('', '<button @click=${() => {}}>x</button>')],
    ['signal', SERVER_CARD("import { signal } from '@webjsdev/core';")],
    ['connectedCallback', SERVER_CARD().replace('  render()', '  connectedCallback() { super.connectedCallback(); }\n  render()')],
  ]) {
    const v = await hits({
      'components/user-card.server.ts': src,
      'app/page.ts': PAGE("import '../components/user-card.server.ts';", '<user-card name="Ada"></user-card>'),
    }, 'no-interactivity-in-server-component');
    assert.equal(v.length, 1, `${label} is flagged`);
    assert.match(v[0].message, /server only/);
  }
});

test('no-interactivity-in-server-component: a display-only .server component, or one with willUpdate, is fine', async () => {
  const v = await hits({
    'components/user-card.server.ts': SERVER_CARD().replace('  render()', '  willUpdate() {}\n  render()'),
    'app/page.ts': PAGE("import '../components/user-card.server.ts';", '<user-card name="Ada"></user-card>'),
  }, 'no-interactivity-in-server-component');
  assert.deepEqual(v, []);
});

test('no-server-component-in-client-template: a client component rendering a server-only tag is flagged', async () => {
  const v = await hits({
    'components/user-card.server.ts': SERVER_CARD(),
    'components/tabs.ts': TABS('<button @click=${() => {}}>t</button><user-card name="x"></user-card>'),
    'app/page.ts': PAGE("import '../components/tabs.ts';\nimport '../components/user-card.server.ts';", '<x-tabs></x-tabs>'),
  }, 'no-server-component-in-client-template');
  assert.equal(v.length, 1);
  assert.equal(v[0].file, join('components', 'tabs.ts'));
  assert.match(v[0].fix, /slot/);
});

test('no-server-component-in-client-template: the page passing it in as a child (the slot composition) is fine', async () => {
  const v = await hits({
    'components/user-card.server.ts': SERVER_CARD(),
    'components/tabs.ts': TABS('<button @click=${() => {}}>t</button><slot></slot>'),
    'app/page.ts': PAGE("import '../components/tabs.ts';\nimport '../components/user-card.server.ts';", '<x-tabs><user-card name="Ada"></user-card></x-tabs>'),
  }, 'no-server-component-in-client-template');
  assert.deepEqual(v, []);
});

test("no-component-in-use-server-file: a component in a 'use server' file is refused", async () => {
  const v = await hits({
    'components/user-card.server.ts': `'use server';\n${SERVER_CARD()}`,
    'app/page.ts': PAGE("import '../components/user-card.server.ts';", '<user-card name="Ada"></user-card>'),
  }, 'no-component-in-use-server-file');
  assert.equal(v.length, 1);
  assert.match(v[0].fix, /Drop `'use server'`/);
});

test("no-component-in-use-server-file: a server component without the directive, and actions without a component, are fine", async () => {
  const v = await hits({
    'components/user-card.server.ts': SERVER_CARD(),
    'modules/users/actions.server.ts': "'use server';\nexport async function rename(name: string) { return name; }\n",
    'app/page.ts': PAGE("import '../components/user-card.server.ts';", '<user-card name="Ada"></user-card>'),
  }, 'no-component-in-use-server-file');
  assert.deepEqual(v, []);
});
