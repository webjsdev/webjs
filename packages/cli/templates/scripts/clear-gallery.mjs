#!/usr/bin/env node
// Clear the scaffold's feature gallery to a clean, buildable base.
//
// The scaffold ships a browsable gallery (single-concept demos under
// app/features/, the app/examples/todo app, their modules/, and example
// metadata routes) so an agent can learn the idioms from real, running code.
// The gallery is reference, NOT part of your product. Learn from the demos
// relevant to your task first (the skill at .agents/skills/webjs/ teaches the
// same patterns and SURVIVES this reset, so nothing is lost), then run this
// once to shed the gallery, then grow the app in place.
//
// It strips the app down to a TRULY BAREBONES blank slate: it removes the
// gallery routes + modules + demo metadata routes, the gallery's example design
// system (components/ui/), the example theme-toggle component + its wiring, the
// example test suite (test/hello/), and every empty leftover dir, then resets
// app/page.ts to a minimal home and drops the demo `todos` table plus the auth
// card's `passwordHash` column from the schema. It KEEPS only the buildable
// base: the agent skill (.agents/skills/webjs/), the root layout (with its
// design-token palette + OS-preference dark mode, minus the toggle widget), the
// database wiring, the example `users` table, and `lib/utils/cn.ts` (the
// `webjs ui add` prerequisite).
//
// Why strip so much: the demos, the design system, and the example component /
// tests are all EXAMPLES to learn FROM, not a base to inherit. Leaving them
// nudges the implementing agent to lean on the scaffold's choices instead of
// building the app's own. The DURABLE knowledge is the pattern itself, which
// lives in the skill (.agents/skills/webjs/, re-read every session): learn it
// from the gallery here, then after this reset build your own (run
// `webjs ui add <name>` for UI primitives, cn.ts is kept for it) themed to your
// app. It is a one-time reset: if the gallery is already gone (no app/features/)
// it does nothing, so a rerun never clobbers an app you built.
import { rmSync, rmdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rm = (p) => { if (existsSync(join(root, p))) { rmSync(join(root, p), { recursive: true, force: true }); return true; } return false; };
// Remove a directory ONLY if it exists and is empty (used to clean the empty
// parents a partial gallery removal leaves behind, e.g. app/api after its lone
// auth handler is gone). Never touches a dir that still holds files.
const pruneEmpty = (p) => { const abs = join(root, p); if (existsSync(abs) && readdirSync(abs).length === 0) { rmdirSync(abs); return true; } return false; };

// Guard: the gallery is identified by app/features/. If it is absent, the gallery
// was already cleared (or this is not a gallery scaffold), so exit before any
// destructive write. This keeps a rerun safe and never clobbers a built app (a
// customized app/page.ts, a same-named module, or real migrations).
if (!existsSync(join(root, 'app/features'))) {
  console.log('No gallery found (app/features/ is absent); nothing to clear.');
  process.exit(0);
}

// 1) Gallery route trees + example metadata routes. `app/api/auth` is the auth
// card's createAuth handler (it lives at the app root, not under app/features/,
// because createAuth hardcodes /api/auth/*), and `test/auth` is the auth card's
// request-pipeline test, so both are removed here alongside the card.
const galleryPaths = [
  'app/features', 'app/examples', 'app/sitemaps', 'app/api/auth', 'test/auth',
  'app/icon.ts', 'app/apple-icon.ts', 'app/manifest.ts', 'app/opengraph-image.ts',
  'app/twitter-image.ts', 'app/robots.ts', 'app/sitemap.ts',
  'app/global-error.ts', 'app/global-not-found.ts',
  // The gallery's EXAMPLE design system. Removed so the reset app is a blank
  // slate: the agent builds its own components/ui/ (run `webjs ui add`, cn.ts is
  // kept), learning the pattern from the skill, not inheriting the gallery's.
  'components/ui',
  // Example scaffold artifacts (invariant 2): the theme-toggle component and the
  // example test suite are things to learn from, not the agent's app. Removed
  // for a true blank slate; the layout's theme import is stripped separately
  // below. The agent writes its own tests + components for the real app.
  'components/theme-toggle.ts', 'test/hello',
  // The gallery's markup-chunk helpers. Their only users (the feature pages +
  // the features/examples layouts) are removed above, so drop the example file
  // too; cn.ts + dom.ts (real infrastructure) stay under lib/utils/.
  'lib/utils/ui.ts',
];
// 2) The gallery's feature modules (by name). `auth` is the auth card's server
// modules (createAuth config, password hashing, signup action, current-user
// query), pruned with the rest of the card.
const galleryModules = [
  'async-render', 'auth', 'broadcast', 'caching', 'client-router', 'components',
  'directives', 'file-storage', 'frames', 'optimistic-ui', 'rate-limit',
  'route-handler', 'server-actions', 'sessions', 'stream', 'streaming', 'suspense',
  'todo', 'websockets',
].map((m) => `modules/${m}`);

let removed = 0;
for (const p of [...galleryPaths, ...galleryModules]) if (rm(p)) removed++;

// 3) Reset app/page.ts to a minimal home (no gallery grid, no dead links).
writeFileSync(join(root, 'app/page.ts'), MINIMAL_PAGE());

// 4) Drop the demo `todos` table and the auth card's `passwordHash` column from
// the schema (keep the example `users` table and everything else), reverting the
// schema to the minimal base.
const schemaPath = join(root, 'db/schema.server.ts');
if (existsSync(schemaPath)) {
  let s = readFileSync(schemaPath, 'utf8');
  s = s.replace(/\n(?:\/\/[^\n]*\n)*export const todos = table\('todos',[\s\S]*?\n\}\);\n/, '\n');
  s = s.replace(/defineRelations\(\{ users, todos \}/, 'defineRelations({ users }');
  // Strip the auth `passwordHash` column (and its leading comment lines) from the
  // users table; the rest of the table is the minimal example base.
  s = s.replace(/\n(?:[ \t]*\/\/[^\n]*\n)*[ \t]*passwordHash: text\(\),\n/, '\n');
  writeFileSync(schemaPath, s);
}

// 5) Strip the example theme-toggle from the root layout. The component file was
// removed above; here the layout's registration import is removed so it does not
// reference a missing module. The OS-preference dark-mode inline script + the
// design tokens STAY (they need no component and work with JS off), so the app
// still honours light/dark, just without the manual toggle button.
const layoutPath = join(root, 'app/layout.ts');
if (existsSync(layoutPath)) {
  const l = readFileSync(layoutPath, 'utf8').replace(/^import '#components\/theme-toggle\.ts';\n/m, '');
  writeFileSync(layoutPath, l);
}

// 6) Drop generated migrations + the dev database so the next db:generate is
// clean against the reset schema (safe: the scaffold has no real data yet).
rm('db/migrations');
for (const f of ['db/dev.db', 'db/dev.db-shm', 'db/dev.db-wal']) rm(f);

// 7) Prune the empty leftover dirs a partial removal left behind, so the reset
// tree is a clean blank slate: app/api (held only the gallery auth handler),
// test/unit + test/e2e (empty base placeholders), and test/ itself once its
// example suites are gone. modules/ + components/ are kept as empty build
// targets (the reset home + `webjs ui add` land there). Order matters: prune the
// children before test/ so it reads as empty.
for (const d of ['app/api', 'test/unit', 'test/e2e', 'test']) if (pruneEmpty(d)) removed++;

console.log(`Gallery cleared (${removed} paths removed). The agent skill and your database wiring are kept. Build your own design system: run \`npx webjsdev ui add <name>\` and theme it (see .agents/skills/webjs/references/styling.md).`);
console.log('Next: regenerate the database (db:generate then db:migrate), then start the dev server and build your app in app/ and modules/.');

function MINIMAL_PAGE() {
  return `import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Home',
};

export default function Home() {
  return html\`
    <div class="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-6">
      <h1 class="text-4xl font-bold tracking-tight m-0">Your app</h1>
      <p class="text-base text-muted-foreground leading-relaxed m-0">
        The gallery is cleared. This is <code class="text-[0.9em] text-foreground">app/page.ts</code>. Build your
        app from here. The guide is <code class="text-[0.9em] text-foreground">.agents/skills/webjs/SKILL.md</code>.
      </p>
      <nav class="flex items-center gap-5 text-sm text-muted-foreground">
        <a href="https://docs.webjs.dev" class="hover:text-foreground transition-colors no-underline">Docs</a>
        <a href="https://github.com/webjsdev/webjs" class="hover:text-foreground transition-colors no-underline">GitHub</a>
      </nav>
    </div>
  \`;
}
`;
}
