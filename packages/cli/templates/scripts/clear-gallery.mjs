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
// It removes the gallery routes + modules + demo metadata routes, resets
// app/page.ts to a minimal home, and drops the demo `todos` table plus the auth
// card's `passwordHash` column from the schema. It KEEPS the agent skill
// (.agents/skills/webjs/), the layout, the database wiring, the theme toggle,
// the example `users` table, AND the design system in `components/ui/` (the
// `buttonClass` / `cardClass` / `inputClass` helpers + `lib/utils/cn.ts`). The
// design system is INFRASTRUCTURE, not a demo: a real app built after this reset
// still imports those helpers, and their teaching comments plus the styling
// reference are where the "own and theme your @webjsdev/ui primitives" pattern
// lives durably (the demos are just the disposable runnable illustration). So
// do NOT add `components/ui` to the removal list below. It is a one-time reset:
// if the gallery is already gone (no app/features/) it does nothing, so a rerun
// never clobbers an app you built.
import { rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rm = (p) => { if (existsSync(join(root, p))) { rmSync(join(root, p), { recursive: true, force: true }); return true; } return false; };

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

// 5) Drop generated migrations + the dev database so the next db:generate is
// clean against the reset schema (safe: the scaffold has no real data yet).
rm('db/migrations');
for (const f of ['db/dev.db', 'db/dev.db-shm', 'db/dev.db-wal']) rm(f);

console.log(`Gallery cleared (${removed} paths removed). The agent skill, your database wiring, and the components/ui/ design system are kept.`);
console.log('Next: regenerate the database (db:generate then db:migrate), then start the dev server and build your app in app/ and modules/.');

function MINIMAL_PAGE() {
  return `import { html } from '@webjsdev/core';
import '#components/theme-toggle.ts';

export const metadata = {
  title: 'Home',
};

export default function Home() {
  return html\`
    <div class="fixed top-4 right-4 z-10"><theme-toggle></theme-toggle></div>
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
