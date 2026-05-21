# Testing in webjs

This doc covers two audiences:

1. **Framework agents** working inside this monorepo (`packages/*`,
   the root `test/`, the e2e suite, the dev server).
2. **App agents** working inside a webjs app scaffolded with
   `webjs create`. App-side conventions also live in the
   scaffold's `CONVENTIONS.md` (which is the authoritative,
   user-customisable copy); this section here is the
   framework-level reference.

Both audiences follow the same shape: **feature folders are
primary, test kind is a subfolder inside the feature only when
that kind is actually present**. The layout mirrors webjs's own
`modules/<feature>/` convention in apps (feature first, kind
second), so the mental model transfers between framework work and
app work.

---

## Test kinds

| Kind | Location | What it does | Runner |
|---|---|---|---|
| **unit + integration** (node) | `test/<feature>/<name>.test.{js,ts,mjs}` | Imports modules and asserts. No spawned process, no network. Includes both true unit tests and in-process integration. | `node --test` |
| **browser** | `test/<feature>/browser/<name>.test.js` | Runs in real Chromium with Playwright. Real DOM, events, `adoptedStyleSheets`, `IntersectionObserver`, shadow / light DOM. | web-test-runner (`wtr`) |
| **e2e** | `test/<feature>/e2e/<name>.test.{ts,mjs}` | Boots a real process (dev server, CLI binary) and drives it through its public interface (HTTP, browser, stdout). Opt in with `WEBJS_E2E=1`. | `node --test` (driver) |
| **smoke** | `test/<feature>/smoke/<name>.test.{js,ts}` | Fast deploy-time sanity check. A subset of e2e in spirit, kept separate so it runs on every deploy. | `node --test` |

Some packages will only have one or two of these kinds (e.g.
`@webjskit/core` is a library, no `e2e/` or `smoke/`). Only create
a kind subfolder when there's at least one test of that kind.
Empty `e2e/` folders are anti-patterns.

---

## Framework layout (this repo)

```
packages/
  core/test/
    signals/                       signal primitive, computed, watcher
      signal.test.js
      signal-spec-conformance.test.js
      signal-ssr.test.js
      browser/                     SignalWatcher + DOM
        signal-component.test.js
        signal-hydration.test.js
        watch-directive.test.js
    rendering/
      render-server.test.js
      render-client.test.js
      browser/
        render-client.test.js
    slots/
      browser/
        slot.test.js
        slot-projection-cycle.test.js
    directives/
      directives.test.js
      browser/
        directives-cache.test.js
        directives-ref.test.js
        …
    lifecycle/, context/, suspense/, task/, …
  server/test/
    routing/      api/      actions/      auth/
    cache/        check/    csrf/         session/
    …
  cli/test/                        scaffold validation only
  ui/test/                         schema, resolver, project-detect, components
    components/browser/            real-browser tests for the kit
  ts-plugin/test/plugin/           tsserver plugin tests (.test.mjs)
test/                              cross-package only
  ssr/                             SSR pipeline (core + server)
  actions/                         expose() (core + server)
  serialization/                   json-negotiation (core + server)
  scaffolds/                       full app boots from CLI scaffolds
  blog/                            examples/blog smoke + browser e2e
    smoke/blog-smoke.test.js
    browser/blog.test.js
  e2e/                             puppeteer-driven full-app journeys
  docs/                            docs site validation
  types/                           type-check fixtures
```

Rule of thumb for **package vs root**: if the test imports from
`@webjskit/server` (or any other package) at all, it's
cross-package and stays at root. If it only imports from one
package, it goes in that package's `test/`.

### Drivers

- `npm test` → `scripts/run-node-tests.js`: enumerates every
  `*.test.{js,mjs}` under `packages/*/test/` and `test/`,
  excluding anything under a `browser/` or `e2e/` segment. Those
  run via their own scripts.
- `npm run test:browser` → `wtr`: globs
  `packages/*/test/**/browser/**/*.test.js` and
  `test/**/browser/**/*.test.js`. The blog browser e2e is
  excluded (it needs the blog dev server up first).
- `npm run test:e2e` → `WEBJS_E2E=1 node --test test/e2e/e2e.test.mjs`.
- `npm run test:all` runs node + browser (not e2e).

### Adding a new test

1. Find the feature folder that matches what you're testing
   (`signals`, `routing`, `cache`, `auth`, etc.).
2. If none exists, create one under the right scope (package vs
   root) with the feature's natural name.
3. Drop the test in directly when it's a node test; nest it
   inside `browser/` / `e2e/` / `smoke/` when it's that kind.
4. Use `.test.js` for ESM packages, `.test.mjs` when the
   surrounding package is CJS (e.g. `@webjskit/ts-plugin`).

---

## App layout (what users get)

A scaffolded webjs app has one `test/` directory at its root,
shaped the same way:

```
test/
  auth/
    auth.test.ts                 # signup / login / currentUser
    password.test.ts             # scrypt hash + verify
    browser/login-form.test.js   # only if exercising DOM
  posts/
    posts.test.ts
    browser/post-editor.test.js
  hello/
    hello.test.ts                # the scaffold's starter test
    browser/hello.test.js
    e2e/hello.test.ts
```

App-side runners:

- `webjs test` → node tests (everything not under `browser/` or `e2e/`).
- `webjs test --browser` → web-test-runner against `test/**/browser/**`.
- `WEBJS_E2E=1 webjs test` adds e2e.

App AI agents read this convention through the scaffold's
`AGENTS.md` and `CONVENTIONS.md`. The scaffold's
`web-test-runner.config.js` globs `test/**/browser/**/*.test.js`.

---

## Choosing where a test goes

A short decision flow:

1. **Does it boot more than one webjs package?**
   - Yes → root `test/<feature>/`.
   - No → `packages/<the-one-package>/test/<feature>/`.
2. **Does it need a browser?**
   - Yes → `…/<feature>/browser/<name>.test.js`.
   - No → `…/<feature>/<name>.test.{js,ts,mjs}`.
3. **Does it spawn a real process (server, CLI subprocess)?**
   - Yes → `…/<feature>/e2e/<name>.test.{ts,mjs}` (and gate
     behind `WEBJS_E2E=1` if it's slow).
4. **Is it a fast post-deploy "does the surface still work" check?**
   - Yes → `…/<feature>/smoke/<name>.test.{js,ts}`.

If the answer to "what feature is this?" is "framework
internals" or "misc", pick the user-facing concern instead
(`routing`, `serializer`, `slots`). If you genuinely cannot pick
a feature, the test is probably testing too many things at once.

---

## What NOT to do

- **Don't recreate the old `test/{unit,browser,e2e}/` shape.**
  Kind is a child of feature, not the other way around.
- **Don't create empty kind folders.** If `e2e/` has no tests
  yet, leave it absent.
- **Don't put package-only tests under root `test/`.** It hurts
  the per-package `npm test --workspace=…` workflow.
- **Don't import from another package's `test/` directory.**
  Test code is not a public surface.
- **Don't add `.unit` / `.integration` filename suffixes.** The
  folder tells you the kind; the filename should match what it
  tests.
