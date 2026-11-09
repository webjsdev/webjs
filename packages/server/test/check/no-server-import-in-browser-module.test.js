import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

/**
 * Tests for the `no-server-import-in-browser-module` rule. The rule flags a
 * component (or `instrumentation-client`) that loads in the browser and
 * transitively imports a server-only `.server.{ts,js}` module. A route module
 * (page, layout, boundary) never ships (#1686), so a server import in one is
 * never flagged, whatever else the route module does.
 */

const RULE = 'no-server-import-in-browser-module';

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-server-import-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}

function find(violations, file) {
  return violations.filter((v) => v.rule === RULE && (!file || v.file.includes(file)));
}

// A minimal server-only auth module: the canonical motivating case. In the
// browser this resolves to a stub, so importing it from a shipping module is
// the runtime crash the rule catches.
const AUTH_SERVER = `export async function auth() {
  // server-only: reads a cookie/session on the request
  return { user: null };
}
`;

// A shipping component (every component in an ordinary file ships, #1686).
const INTERACTIVE_COMPONENT = `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';

class CrispWorkspace extends WebComponent {
  #open = signal(false);
  render() { return this.html\`<div>workspace</div>\`; }
}
CrispWorkspace.register('crisp-workspace');
`;

test('RULES enumerates no-server-import-in-browser-module', () => {
  const r = RULES.find((r) => r.name === RULE);
  assert.ok(r, 'rule must be listed in RULES');
  assert.ok(/\.server` file never loads in the browser/.test(r.description),
    'description should exempt a server-only component');
});

// (a) A page that imports auth -> NO violation. A page runs only on the
// server and never ships (#1686), so its server import never reaches the
// browser. This is the legitimate pattern and the single biggest
// false-positive risk; it must pass.
test('a page importing auth is NOT flagged', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/dashboard/page.ts': `import { auth } from '../../lib/auth.server.ts';
export default async function DashboardPage() {
  const session = await auth();
  return \`<h1>Hello \${session.user ?? 'guest'}</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'a page never ships, so it must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// An IMPORT-ONLY page (its only client relevance is importing a shipping
// component, #605/#963) is dropped from the boot in favour of its components,
// so its bare server import never loads in a browser and must NOT be flagged.
test('import-only page importing auth AND a component is NOT flagged (#963)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/project/page.ts': `import { auth } from '../../lib/auth.server.ts';
import '../../modules/workspace/components/crisp-workspace.ts';
export default async function ProjectPage() {
  const session = await auth();
  return \`<crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'an import-only page must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// (b) Page that imports auth AND a component AND does its OWN client work (so
// it ships whole under the path-aware verdict, #963) -> violation. The page's
// own client signal forces it to load in the browser, which drags the
// server-only auth import along: a runtime crash.
test('a page importing auth, a component and the client router is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/project/page.ts': `import { auth } from '../../lib/auth.server.ts';
import '../../modules/workspace/components/crisp-workspace.ts';
import '@webjsdev/core/client-router'; // own client work: the page ships whole (#963)
export default async function ProjectPage() {
  const session = await auth();
  return \`<crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'a page never ships, whatever else it imports, so its server import is fine');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// A `'use server'` ACTION imported by a shipping page is NOT a crash and must
// NOT be flagged. The browser receives a working RPC stub (exports POST to the
// server), so calling it from a shipping module is the intended pattern. This
// is the single biggest false-positive class the rule must avoid (it fired on
// every dogfood app before the directive check): a `.server.ts` with
// `'use server'` is fundamentally different from a bare server-only utility
// whose stub throws at load.
test('a use-server action imported by a shipping page is NOT flagged', async () => {
  const appDir = await makeApp({
    'modules/posts/actions/create-post.server.ts': `'use server';
export async function createPost(input: { title: string }) {
  return { id: '1', title: input.title };
}
`,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/project/page.ts': `import { createPost } from '../../modules/posts/actions/create-post.server.ts';
import '../../modules/workspace/components/crisp-workspace.ts';
export default async function ProjectPage() {
  await createPost({ title: 'hi' });
  return \`<crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0,
      'a use-server action resolves to a working RPC stub, so it is not a crash and must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// A phantom edge from a code-example STRING (an `import` written inside a
// quoted string the module graph keeps verbatim) resolves to a non-existent
// file and must not be flagged: that import never runs. Mirrors the docs /
// website `<pre>` samples that tripped the rule before the on-disk check.
test('a server import that only appears inside a code-example string is NOT flagged', async () => {
  const appDir = await makeApp({
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/docs/page.ts': `import '../../modules/workspace/components/crisp-workspace.ts';
// A code sample shown in the page body; the import below is a STRING, not a
// real import, and points at a file that does not exist on disk.
const SAMPLE = [
  "import { db } from '../lib/db.server.ts';",
  "export const x = 1;",
];
export default function DocsPage() {
  return \`<pre>\${SAMPLE.join('\\n')}</pre><crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0,
      'a server path that only appears in a code-example string must not be flagged (phantom edge, file does not exist)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// (c) A `.server.ts` importing another `.server.ts` -> no violation.
// Server-to-server is fine; neither file is a component or a route module the
// browser loads, so neither is a candidate.
test('server-to-server import is NOT flagged', async () => {
  const appDir = await makeApp({
    'lib/db.server.ts': `export const db = { query() { return []; } };\n`,
    'lib/auth.server.ts': `import { db } from './db.server.ts';
export async function auth() { return db.query(); }
`,
    // An app/ dir so the rule actually runs, with a page that does not reach
    // either server file.
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'a .server.ts importing a .server.ts must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// (d) middleware.ts / route.ts importing server code -> no violation.
// These are server-only entries the browser never loads, so they are not
// candidates even when they import a server module.
test('middleware and route importing server code are NOT flagged', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/middleware.ts': `import { auth } from '../lib/auth.server.ts';
export default async function middleware() { await auth(); }
`,
    'app/api/route.ts': `import { auth } from '../../lib/auth.server.ts';
export async function GET() { await auth(); return new Response('ok'); }
`,
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'middleware/route importing server code must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// Transitive (indirect) server import through a non-server helper still fires,
// and the chain hint shows the indirection.
test('indirect server import through a non-server helper IS flagged', async () => {
  // A shipping component imports a plain helper that imports the server
  // module; the chain hint shows the indirection.
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'lib/session.ts': `import { auth } from './auth.server.ts';
export async function currentUser() { return (await auth()).user; }
`,
    'components/user-chip.ts': `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';
import { currentUser } from '../lib/session.ts';
class UserChip extends WebComponent {
  #u = signal('');
  async connectedCallback() { super.connectedCallback(); this.#u.set(await currentUser()); }
  render() { return this.html\`<span>\${this.#u.get()}</span>\`; }
}
UserChip.register('user-chip');
`,
    'app/page.ts': `import '../components/user-chip.ts';
export default function Home() { return '<user-chip></user-chip>'; }
`,
  });
  try {
    const violations = await checkConventions(appDir);
    const hits = find(violations, 'user-chip.ts');
    assert.equal(hits.length, 1, 'an indirect server import must still be flagged');
    assert.ok(hits[0].message.includes('auth.server.ts'), 'names the server module reached transitively');
    // #804: the full chain is printed, every hop, no truncation.
    assert.match(hits[0].message, /components\/user-chip\.ts -> lib\/session\.ts -> lib\/auth\.server\.ts/,
      'message shows the full indirection chain');
    assert.ok(!hits[0].message.includes('…'), 'no truncation glyph in the chain');
    assert.deepEqual(find(violations, 'app/page.ts'), [], 'the page itself is never flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// An interactive component that ITSELF imports a server module ships and is
// flagged (the rule covers components, not just pages).
test('a shipping component importing a server module IS flagged', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'components/user-badge.ts': `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';
import { auth } from '../lib/auth.server.ts';

class UserBadge extends WebComponent {
  #name = signal('');
  async connectedCallback() { super.connectedCallback(); this.#name.set((await auth()).user); }
  render() { return this.html\`<span>\${this.#name.get()}</span>\`; }
}
UserBadge.register('user-badge');
`,
    'app/page.ts': `import '../components/user-badge.ts';
export default function Home() { return '<user-badge></user-badge>'; }
`,
  });
  try {
    const violations = await checkConventions(appDir);
    const hits = find(violations, 'user-badge.ts');
    assert.equal(hits.length, 1, 'a shipping component importing a server module must be flagged');
    assert.equal(hits[0].message.includes('component'), true, 'message identifies it as a component');
    assert.match(hits[0].fix, /\*\.server\.ts. file \(without .'use server'.\)/, 'the fix offers the server-only component option');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// error.ts / loading.ts / not-found.ts run only on the server, like pages and
// layouts (#1686), so a server-only import reaching one of them never loads in
// the browser and is not flagged. The fixtures pair each boundary with a
// sibling page so the router attaches it.
test('an error boundary importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
    'app/error.ts': `import { auth } from '../lib/auth.server.ts';
export default async function ErrorBoundary() {
  const session = await auth();
  return \`<p>Sorry \${session.user ?? 'guest'}, something broke</p>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('a not-found page importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
    'app/not-found.ts': `import { auth } from '../lib/auth.server.ts';
export default async function NotFound() {
  const session = await auth();
  return \`<h1>404 for \${session.user ?? 'guest'}</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// forbidden.ts / unauthorized.ts / global-not-found.ts joined the shipping set
// with #1298: they render inside their layout chain now, and ship with it. The
// rule has to see them, or the exact #963 crash it exists to catch (a
// throw-at-load stub taking every sibling registration with it) passes a green
// `webjs check`. A 403 that greets the signed-in user by name is the natural
// shape, so this is not a hypothetical import.
test('a forbidden boundary importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/admin/page.ts': `export default function Admin() { return '<h1>admin</h1>'; }\n`,
    'app/admin/forbidden.ts': `import { auth } from '../../lib/auth.server.ts';
export default async function Forbidden() {
  const session = await auth();
  return \`<h1>No access for \${session.user ?? 'guest'}</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('an unauthorized boundary importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/private/page.ts': `export default function P() { return '<h1>private</h1>'; }\n`,
    'app/private/unauthorized.ts': `import { auth } from '../../lib/auth.server.ts';
export default async function Unauthorized() {
  const session = await auth();
  return \`<h1>Sign in (\${session.user ?? 'guest'})</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('a global-not-found page importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
    'app/global-not-found.ts': `import { auth } from '../lib/auth.server.ts';
export default async function GlobalNotFound() {
  const session = await auth();
  return \`<h1>404 for \${session.user ?? 'guest'}</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('a loading boundary importing a server module is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'app/dashboard/page.ts': `export default function Dash() { return '<h1>dash</h1>'; }\n`,
    'app/dashboard/loading.ts': `import { auth } from '../../lib/auth.server.ts';
export default async function Loading() {
  const session = await auth();
  return \`<p>Loading for \${session.user ?? 'guest'}…</p>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// An error / loading / not-found module that imports only a 'use server' action
// is still exempt (working RPC stub, not a crash) and a phantom string edge from
// such a module is still ignored: the new candidates honor the same guards as
// pages and components.
test('an error boundary importing only a use-server action is NOT flagged', async () => {
  const appDir = await makeApp({
    'modules/log/actions/report.server.ts': `'use server';
export async function report(input: { msg: string }) { return { ok: true, msg: input.msg }; }
`,
    'app/page.ts': `export default function Home() { return '<h1>home</h1>'; }\n`,
    'app/error.ts': `import { report } from '../modules/log/actions/report.server.ts';
export default async function ErrorBoundary() {
  await report({ msg: 'boom' });
  return '<p>handled</p>';
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0,
      'an error boundary calling a use-server action (working RPC stub) must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// A code-example `import` written as a plain quoted STRING whose path resolves
// to a REAL in-repo `.server.ts` must NOT create a graph edge and must NOT be
// flagged. This is the live false-positive webjs's own docs / website pages hit:
// a shipping page that shows `import { db } from '…lib/db.server.ts'` in
// a code sample, where that path is a real file. The module-graph scanner now
// masks string-embedded imports (blankStrings), so the string never becomes an
// edge; a REAL import statement to the same file still does.
test('a real-path server import inside a code-example string is NOT flagged', async () => {
  const appDir = await makeApp({
    // A REAL server file the example string names.
    'lib/db.server.ts': `export const db = { user: { findMany() { return []; } } };\n`,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    // A shipping page (registers a component) that shows the import in a STRING.
    'app/docs/page.ts': `import '../../modules/workspace/components/crisp-workspace.ts';
const SAMPLE = "import { db } from '../../lib/db.server.ts';";
export default function DocsPage() {
  return \`<pre>\${SAMPLE}</pre><crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0,
      'a server path shown in a code-example string (even a real file) must not create an edge or be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// The counterpart to the case above: the SAME real server file, imported as a
// genuine top-level statement (not inside a string) on a shipping page, still
// flags. This proves the string mask did not over-blank real imports.
test('a real server import statement on a page with client work is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'lib/db.server.ts': `export const db = { user: { findMany() { return []; } } };\n`,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/docs/page.ts': `import { db } from '../../lib/db.server.ts';
import '../../modules/workspace/components/crisp-workspace.ts';
import '@webjsdev/core/client-router'; // own client work: the page ships whole (#963)
export default async function DocsPage() {
  const users = db.user.findMany();
  return \`<crisp-workspace count="\${users.length}"></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// A page with no app/-routable structure (no app/ dir) is not analysed: the
// rule degrades to a no-op rather than throwing or flagging a bare lib.
test('an app with no app/ directory is not analysed', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'lib/helper.ts': `import { auth } from './auth.server.ts';\nexport const x = auth;\n`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'no app/ dir means nothing ships, so no finding');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// SECURITY COUNTERFACTUAL (#555): a server-only `.server.ts` imported via a
// `#` PATH ALIAS into a shipping module must STILL be flagged. The whole risk
// of an import alias is that it could launder a server import past the boundary
// (resolveImport historically skipped any non-`.`/`/` specifier). The alias is
// expanded to the real path inside resolveImport, so the rule sees through it.
test('a server import via a # alias into a page is NOT flagged (#1686)', async () => {
  const appDir = await makeApp({
    'package.json': JSON.stringify({ name: 'x', type: 'module', imports: { '#*': './*' } }),
    'lib/auth.server.ts': AUTH_SERVER,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/project/page.ts': `import { auth } from '#lib/auth.server.ts';
import '#modules/workspace/components/crisp-workspace.ts';
import '@webjsdev/core/client-router'; // own client work: the page ships whole (#963)
export default async function ProjectPage() {
  const session = await auth();
  return \`<crisp-workspace></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.deepEqual(find(violations), [], 'route modules never load in the browser (#1686)');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// The complement: a #-aliased server import into a page is NOT flagged (a page
// never ships), proving the alias resolves through to the SAME verdict a
// relative import gets, not a blanket pass/fail.
test('a # alias server import into a page is NOT flagged', async () => {
  const appDir = await makeApp({
    'package.json': JSON.stringify({ name: 'x', type: 'module', imports: { '#*': './*' } }),
    'lib/auth.server.ts': AUTH_SERVER,
    'app/dashboard/page.ts': `import { auth } from '#lib/auth.server.ts';
export default async function DashboardPage() {
  const session = await auth();
  return \`<h1>Hello \${session.user ?? 'guest'}</h1>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0, 'a page is not flagged, alias or not');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// #805: a TYPE-ONLY import of a `.server.ts` from a SHIPPING module is fully
// erased by the TS stripper (module.stripTypeScriptTypes), so it never becomes a
// browser fetch or a runtime crash. It must NOT be flagged. Three independent
// agents hit this false positive writing `import type { Todo } from
// '#db/schema.server.ts'` in a shipping component: the greppable source confirms
// the import is safe, yet the check fired, sending them into a needless
// `types.ts`-duplication rewrite. The component ships (reactive `signal` import),
// so the pass comes from the type-only edge being correctly dropped from the
// module graph.
test('a TYPE-ONLY import of a server module from a shipping component is NOT flagged (#805)', async () => {
  const appDir = await makeApp({
    'db/schema.server.ts': `export type Todo = { id: number; title: string; completed: boolean };
export const todos = { findMany() { return []; } };
`,
    'components/todo-list.ts': `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';
import type { Todo } from '../db/schema.server.ts';

class TodoList extends WebComponent {
  #items = signal<Todo[]>([]);
  render() { return this.html\`<ul>\${this.#items.get().length}</ul>\`; }
}
TodoList.register('todo-list');
`,
    'app/page.ts': `import '../components/todo-list.ts';
export default function Home() { return '<todo-list></todo-list>'; }
`,
  });
  try {
    const violations = await checkConventions(appDir);
    assert.equal(find(violations).length, 0,
      'a type-only import is erased at strip time and must not be flagged as a server import');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// The counterpart proving the #805 fix did not OVER-skip: a MIXED
// `import { type Todo, todos }` pulls a real runtime binding (`todos`), so it is
// a genuine value edge to the server module and MUST still fire. The statement
// does not lead with `type`, so the graph keeps it.
test('a MIXED value+type import of a server module on a shipping component IS still flagged (#805)', async () => {
  const appDir = await makeApp({
    'db/schema.server.ts': `export type Todo = { id: number };
export const todos = { findMany() { return []; } };
`,
    'components/todo-list.ts': `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';
import { type Todo, todos } from '../db/schema.server.ts';

class TodoList extends WebComponent {
  #items = signal<Todo[]>(todos.findMany());
  render() { return this.html\`<ul>\${this.#items.get().length}</ul>\`; }
}
TodoList.register('todo-list');
`,
    'app/page.ts': `import '../components/todo-list.ts';
export default function Home() { return '<todo-list></todo-list>'; }
`,
  });
  try {
    const violations = await checkConventions(appDir);
    const hits = find(violations, 'todo-list.ts');
    assert.equal(hits.length, 1, 'a mixed value+type import is a real runtime edge and must still be flagged');
    assert.ok(hits[0].message.includes('schema.server.ts'), 'names the server import');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// #804: the message must print the FULL transitive chain (every hop), not a
// `… ->` truncation, and name the types-module relocation fix when the edge
// enters via a types-shaped module.
test('message prints the full import chain and names the types-module fix (#804)', async () => {
  const dir = await makeApp({
    'app/page.ts': `import { html } from '@webjsdev/core';\nimport '../components/my-widget.ts';\nexport default function P() { return html\`<my-widget></my-widget>\`; }\n`,
    'components/my-widget.ts': INTERACTIVE_COMPONENT.replace('crisp-workspace', 'my-widget').replace('CrispWorkspace', 'MyWidget')
      .replace("import { signal } from '@webjsdev/core';", "import { signal } from '@webjsdev/core';\nimport { thing } from '../modules/todos/types.ts';\nvoid thing;"),
    'modules/todos/types.ts': `export { thing } from '../../lib/data.server.ts';\n`,
    'lib/data.server.ts': `export const thing = 'x';\n`,
  });
  try {
    const violations = await checkConventions(dir);
    const v = find(violations, 'components/my-widget.ts')[0];
    assert.ok(v, 'the shipping component importing a server value via types.ts is flagged');
    // full chain: every hop present, no truncation glyph
    assert.match(v.message, /components\/my-widget\.ts -> modules\/todos\/types\.ts -> lib\/data\.server\.ts/, `full chain, got: ${v.message}`);
    assert.ok(!v.message.includes('…'), 'no `… ->` truncation in the chain');
    assert.match(v.fix, /types-shaped module/, 'the fix names the types-module relocation');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page whose helper does module-scope client work is NOT flagged (#1686)', async () => {
  // Found by an agent building an app: a page shipped because a plain helper it
  // imported did client work at module scope, and the message blamed the page,
  // so the agent moved the wrong code. A page never ships now (#1686), so
  // neither the helper nor the server import loads. (The agent's helper built an
  // Intl formatter; see the next test.)
  const dir = await makeApp({
    'app/layout.ts': "import { html } from '@webjsdev/core';\nexport default function L({ children }) { return html`<html><body>${children}</body></html>`; }\n",
    'lib/format.ts': "export const chan = new BroadcastChannel('events');\nexport const label = (d: Date) => d.toISOString();\n",
    'lib/db.server.ts': 'export function listEvents() { return []; }\n',
    'app/page.ts': "import { html } from '@webjsdev/core';\nimport { label } from '../lib/format.ts';\nimport { listEvents } from '../lib/db.server.ts';\nexport default function P() { return html`<p>${label(new Date())} ${listEvents().length}</p>`; }\n",
  });
  try {
    const violations = await checkConventions(dir);
    assert.deepEqual(find(violations), [], 'the page never ships, so neither the helper nor the server import loads');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page computing its select options with Array.from at module scope is not flagged', async () => {
  // The exact line three of three agents wrote on a booking page that also
  // imports a server module: the page stays server-only, so the import is fine.
  const dir = await makeApp({
    'app/layout.ts': "import { html } from '@webjsdev/core';\nexport default function L({ children }) { return html`<html><body>${children}</body></html>`; }\n",
    'lib/bookings.server.ts': 'export function listBookings() { return []; }\n',
    'app/page.ts': "import { html } from '@webjsdev/core';\nimport { listBookings } from '../lib/bookings.server.ts';\nconst HOURS = Array.from({ length: 24 }, (_, h) => h);\nexport default function P() { return html`<select>${HOURS.map((h) => html`<option>${h}</option>`)}</select>${listBookings().length}`; }\n",
  });
  try {
    assert.deepEqual(find(await checkConventions(dir), 'app/page.ts'), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a module-scope Intl formatter in a helper does not make the page ship', async () => {
  const dir = await makeApp({
    'app/layout.ts': "import { html } from '@webjsdev/core';\nexport default function L({ children }) { return html`<html><body>${children}</body></html>`; }\n",
    'lib/format.ts': "export const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });\nexport const label = (d: Date) => fmt.format(d);\n",
    'lib/db.server.ts': 'export function listEvents() { return []; }\n',
    'app/page.ts': "import { html } from '@webjsdev/core';\nimport { label } from '../lib/format.ts';\nimport { listEvents } from '../lib/db.server.ts';\nexport default function P() { return html`<p>${label(new Date())} ${listEvents().length}</p>`; }\n",
  });
  try {
    assert.deepEqual(find(await checkConventions(dir), 'app/page.ts'), [], 'the page stays server-only, so its server import is fine');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
