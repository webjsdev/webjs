/**
 * The deploy files follow the --db choice (#1490): a `--db postgres` app's
 * compose.yaml runs a Postgres service and points DATABASE_URL at it, and its
 * CI workflow starts a Postgres service container, on BOTH runtimes. A SQLite
 * app's two files are the canonical templates, byte for byte. No template
 * mentions a hosting tool a fresh user has never heard of. Offline
 * (install: false).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'cli', 'templates');

function mute() {
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  return () => { console.log = log; console.error = err; };
}

async function generate(name, opts) {
  const cwd = await mkdtemp(join(tmpdir(), 'webjs-scaffold-db-'));
  const restore = mute();
  try {
    await scaffoldApp(name, cwd, { template: 'full-stack', install: false, ...opts });
  } finally {
    restore();
  }
  const appDir = join(cwd, name);
  const read = (f) => readFileSync(join(appDir, f), 'utf8');
  return { cwd, compose: read('compose.yaml'), ci: read('.github/workflows/ci.yml'), dockerfile: read('Dockerfile') };
}

for (const runtime of ['node', 'bun']) {
  test(`postgres + ${runtime}: compose runs a Postgres service the app waits on`, async () => {
    const app = await generate('pg-app', { db: 'postgres', runtime });
    try {
      const { compose } = app;
      assert.match(compose, /DATABASE_URL: postgres:\/\/webjs:webjs@db:5432\/pg_app$/m,
        'the app points at the db service, by the fold-stable database name');
      assert.doesNotMatch(compose, /file:\/data\/dev\.db/, 'no SQLite file url');
      assert.doesNotMatch(compose, /app-data/, 'no SQLite volume');
      assert.match(compose, /^  db:\n    image: postgres:17-alpine$/m);
      assert.match(compose, /pg_isready -U webjs -d pg_app/);
      assert.match(compose, /depends_on:\n      db:\n        condition: service_healthy/);
      assert.match(compose, /^volumes:\n  db-data:$/m);
      // The runtime axis still applies to the app's own healthcheck.
      assert.match(compose, new RegExp(`test: \\["CMD", "${runtime}", "-e"`));
    } finally {
      await rm(app.cwd, { recursive: true, force: true });
    }
  });

  test(`postgres + ${runtime}: CI starts a Postgres service container`, async () => {
    const app = await generate('pg-app', { db: 'postgres', runtime });
    try {
      const { ci } = app;
      assert.match(ci, /DATABASE_URL: postgres:\/\/webjs:webjs@localhost:5432\/pg_app$/m);
      assert.doesNotMatch(ci, /file:\.\/ci\.db/);
      assert.match(ci, /services:\n      postgres:\n        image: postgres:17-alpine/);
      assert.match(ci, /--health-cmd "pg_isready -U webjs -d pg_app"/);
      assert.match(ci, /- 5432:5432/);
      // The services block sits inside the job, before its steps.
      assert.ok(ci.indexOf('services:') < ci.indexOf('steps:'));
      if (runtime === 'bun') assert.match(ci, /- run: bun run ci$/m);
      else assert.match(ci, /- run: npm run ci$/m);
    } finally {
      await rm(app.cwd, { recursive: true, force: true });
    }
  });

  test(`sqlite + ${runtime}: compose and CI keep the SQLite shape`, async () => {
    const app = await generate('sq-app', { runtime });
    try {
      assert.match(app.compose, /DATABASE_URL: file:\/data\/dev\.db/);
      assert.match(app.compose, /- app-data:\/data/);
      assert.doesNotMatch(app.compose, /postgres:\/\/|image: postgres/);
      assert.match(app.ci, /DATABASE_URL: file:\.\/ci\.db/);
      assert.doesNotMatch(app.ci, /services:/);
    } finally {
      await rm(app.cwd, { recursive: true, force: true });
    }
  });
}

test('sqlite + node: compose and CI are the canonical templates byte for byte', async () => {
  const app = await generate('sq-app', { runtime: 'node' });
  try {
    const tpl = (f) => readFileSync(join(TEMPLATES, f), 'utf8').replace(/\{\{APP_NAME\}\}/g, 'sq-app');
    assert.equal(app.compose, tpl('compose.yaml'));
    assert.equal(app.ci, tpl('.github/workflows/ci.yml'));
  } finally {
    await rm(app.cwd, { recursive: true, force: true });
  }
});

test('no template mentions webdeploy, ubicloud or uncloud', () => {
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'gallery') walk(p); continue; }
      if (/webdeploy|ubicloud|uncloud/i.test(readFileSync(p, 'utf8'))) hits.push(p);
    }
  };
  walk(TEMPLATES);
  assert.deepEqual(hits, []);
});

// #1492: the audit step and its one-place allowlist.
for (const runtime of ['node', 'bun']) {
  test(`${runtime}: the audit step is webjs audit, with a reasoned allowlist and the basic-ftp floor`, async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'webjs-scaffold-audit-'));
    const restore = mute();
    try {
      await scaffoldApp('audit-app', cwd, { template: 'full-stack', install: false, runtime });
    } finally {
      restore();
    }
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, 'audit-app', 'package.json'), 'utf8'));
      const flatten = (steps) => steps.flatMap((s) => (s.steps ? flatten(s.steps) : [s]));
      const audit = flatten(pkg.webjs.ci.steps).find((s) => s.title === 'Security: dependency audit');
      assert.equal(audit.run, 'webjs audit');
      assert.equal(pkg.webjs.audit.level, 'high');
      assert.ok(pkg.webjs.audit.ignore.length > 0);
      for (const entry of pkg.webjs.audit.ignore) {
        assert.match(entry.id, /^GHSA-/);
        assert.ok(entry.reason.length > 40, `${entry.id} carries a real reason`);
      }
      assert.equal(pkg.overrides['basic-ftp'], '^6.2.2');
      assert.equal(pkg.overrides['puppeteer-core'], '^25.7.0');
      // The scaffold's own config passes the CLI's fail-closed reader.
      const { readAuditConfig } = await import('../../packages/cli/lib/audit.js');
      assert.deepEqual(readAuditConfig(pkg).errors, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
}
