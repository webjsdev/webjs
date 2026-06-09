import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

/**
 * Tests for the `no-server-import-in-browser-module` rule. The rule flags a
 * page / layout / component module that SHIPS to the browser (the build does
 * not elide it) and transitively imports a server-only `.server.{ts,js}`
 * module. The critical correctness property is that it reuses the build's
 * elision verdict, so a display-only page the framework elides is NOT flagged
 * even though it imports the same server module: the difference between "this
 * page ships" and "this page elides" is the whole rule.
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

// A genuinely interactive component (reactive primitive import forces it to
// ship), so a page that imports it is NOT elided.
const INTERACTIVE_COMPONENT = `import { WebComponent } from '@webjsdev/core';
import { signal } from '@webjsdev/core';

class CrispWorkspace extends WebComponent {
  static properties = { open: { state: true } };
  declare open: boolean;
  constructor() { super(); this.open = false; }
  render() { return this.html\`<div>workspace</div>\`; }
}
CrispWorkspace.register('crisp-workspace');
`;

test('RULES enumerates no-server-import-in-browser-module', () => {
  const r = RULES.find((r) => r.name === RULE);
  assert.ok(r, 'rule must be listed in RULES');
  assert.ok(/elid/i.test(r.description), 'description should mention elision');
});

// (a) Display-only page that imports auth and IS elided -> NO violation.
// The page does no client work, so the framework elides it (its server import
// is stripped from the served source). This is the legitimate pattern and the
// single biggest false-positive risk; it must pass.
test('elided display-only page importing auth is NOT flagged', async () => {
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
    assert.equal(find(violations).length, 0, 'an elided display-only page must not be flagged');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// (b) Page that imports auth AND a component (so it is NOT elided) -> violation.
// Importing the interactive component to register it forces the page to load in
// the browser, which drags the server-only auth import along: a runtime crash.
test('non-elided page importing auth AND a component IS flagged', async () => {
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
    const hits = find(violations, 'project/page.ts');
    assert.equal(hits.length, 1, 'a non-elided page importing a server module must be flagged exactly once');
    const v = hits[0];
    assert.ok(v.file.includes('project/page.ts'), 'names the offending file');
    assert.ok(v.message.includes('auth.server.ts'), 'names the offending server import');
    assert.ok(/middleware|use server|layout/i.test(v.fix), 'fix names a concrete remedy');
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
// and the chain hint shows the indirection. The page imports a plain helper
// that imports the server module; eliding logic still has the page shipping
// because it also registers a component.
test('indirect server import through a non-server helper IS flagged', async () => {
  const appDir = await makeApp({
    'lib/auth.server.ts': AUTH_SERVER,
    'lib/session.ts': `import { auth } from './auth.server.ts';
export async function currentUser() { return (await auth()).user; }
`,
    'modules/workspace/components/crisp-workspace.ts': INTERACTIVE_COMPONENT,
    'app/project/page.ts': `import { currentUser } from '../../lib/session.ts';
import '../../modules/workspace/components/crisp-workspace.ts';
export default async function ProjectPage() {
  const u = await currentUser();
  return \`<crisp-workspace user="\${u}"></crisp-workspace>\`;
}
`,
  });
  try {
    const violations = await checkConventions(appDir);
    const hits = find(violations, 'project/page.ts');
    assert.equal(hits.length, 1, 'an indirect server import must still be flagged');
    assert.ok(hits[0].message.includes('auth.server.ts'), 'names the server module reached transitively');
    assert.ok(hits[0].message.includes('-> … ->') || hits[0].message.includes('… ->'),
      'message shows the indirection in the chain');
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
  static properties = { name: { state: true } };
  declare name: string;
  constructor() { super(); this.name = ''; }
  async connectedCallback() { super.connectedCallback(); this.name = (await auth()).user; }
  render() { return this.html\`<span>\${this.name}</span>\`; }
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
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// With elision disabled (webjs.elide === false), EVERY module ships, so even a
// display-only page importing a server module is flagged: with elision off the
// page really does ship its server import. This guards the elide-flag wiring.
test('with elision disabled, a display-only page importing auth IS flagged', async () => {
  const appDir = await makeApp({
    'package.json': JSON.stringify({ name: 'app', webjs: { elide: false } }),
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
    assert.equal(find(violations, 'dashboard/page.ts').length, 1,
      'with elision off, a display-only page that imports a server module ships it and is flagged');
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
