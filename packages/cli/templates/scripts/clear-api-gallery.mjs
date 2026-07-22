#!/usr/bin/env node
// Clear the api scaffold's backend-features showcase to a clean, buildable base.
//
// The api template ships a browsable showcase (JSON/HTTP endpoints under
// app/api/features/, their modules, an env.ts example, and a starter test) so an
// agent can learn the backend idioms from real, running code. It is the api
// counterpart of the UI gallery's `gallery:clear`. Learn from the demos relevant
// to your task first (the skill at .agents/skills/webjs/ teaches the same
// patterns and SURVIVES this reset), then run this once to shed the showcase, then
// grow the api in place.
//
// It removes the showcase routes + modules + the env.ts example + the widgets
// test, and resets the root app/route.ts to list only the kept baseline endpoints
// (/api/health, /api/users). It KEEPS the agent skill, middleware.ts (CORS), the
// health + users endpoints, modules/users, the database wiring, and the users
// example test. It is a one-time reset: if the showcase is already gone (no
// app/api/features/) it does nothing, so a rerun never clobbers an app you built.
import { rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rm = (p) => { if (existsSync(join(root, p))) { rmSync(join(root, p), { recursive: true, force: true }); return true; } return false; };

// Guard: the showcase is identified by app/api/features/. If it is absent, the
// showcase was already cleared (or this is not an api scaffold), so exit before
// any destructive write. This keeps a rerun safe and never clobbers a built app.
if (!existsSync(join(root, 'app/api/features'))) {
  console.log('No backend-features showcase found (app/api/features/ is absent); nothing to clear.');
  process.exit(0);
}

// 1) The showcase route tree + its module + the env.ts example + the widgets test.
const showcasePaths = [
  'app/api/features',
  'modules/widgets',
  'env.ts',
  'test/unit/widgets.test.ts',
];

let removed = 0;
for (const p of showcasePaths) if (rm(p)) removed++;

// 2) Reset the root app/route.ts to list only the kept baseline endpoints. The
// generated index also lists a `features:` block linking the showcase; strip it
// (and its comment) so the index does not point at routes that no longer exist.
// The regex preserves everything else (the app name, the health + users links).
const routePath = join(root, 'app/route.ts');
if (existsSync(routePath)) {
  let s = readFileSync(routePath, 'utf8');
  s = s.replace(/\n[ \t]*\/\/ The backend-features showcase[^\n]*\n[ \t]*features: \{[\s\S]*?\n[ \t]*\},\n/, '\n');
  writeFileSync(routePath, s);
}

console.log(`Backend-features showcase cleared (${removed} paths removed). The agent skill, your database wiring, and the health + users endpoints are kept.`);
console.log('Next: build your api in app/api/ and modules/, keeping server-only code behind .server.ts.');
