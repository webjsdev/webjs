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
`@webjsdev/core` is a library, no `e2e/` or `smoke/`). Only create
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
  intellisense/test/plugin/        tsserver plugin tests (.test.mjs)
test/                              cross-package only
  ssr/                             SSR pipeline (core + server)
  actions/                         server actions (core + server)
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
`@webjsdev/server` (or any other package) at all, it's
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

The root drivers above ONLY discover the framework packages and the root
cross-package suite (`packages/*/test/` + `test/`). They do NOT walk the in-repo
apps' own test dirs (`website/test/`, `examples/blog/test/`), so those run from
each app's OWN `webjs test` script, not the root runner.

### The Bun test matrix (#509)

webjs runs on Node 24+ or Bun (#508). The **Node suite (`npm test`) is the
source of truth**; a separate, additive **Bun matrix** re-runs the
runtime-sensitive suite under Bun to catch the long tail of cross-runtime
incompatibilities (a `node:*` API Bun implements differently, a crypto/stream
edge case, an error-message-format quirk).

- `node scripts/run-bun-tests.js` (needs `bun` on PATH; `BUN=…` overrides) runs
  the `node:test` files under `test/`, `packages/core/test/`, and
  `packages/server/test/` (excluding `browser/`, `e2e/`, the network-bound
  `vendor/`) file by file via `bun test <file>`, and CLASSIFIES each result:
  **pass**, **skip(node-only)** (a documented file that asserts Node-only
  behavior or trips a Bun-test-runner quirk, listed with a reason in the
  script's `DENYLIST`, its Bun behavior covered elsewhere), **skip(harness)**
  (a Bun `node:test` compat gap, auto-detected by error signature),
  **skip(env)** (needs Redis / a DOM), and **genuine fail** (a real Bun
  failure, which fails the job). Set `WEBJS_BUN_TESTS=<substr,…>` to scope a
  local run.
- CI runs it in the `bun` job alongside `test/bun/smoke.mjs` (#508) and
  `test/bun/listener.mjs` (#511, the listener-shell parity).
- Two cross-runtime test scripts also run under BOTH runtimes: `test/bun/smoke.mjs`
  (boot + SSR + TS strip + a server-action RPC) and `test/bun/listener.mjs`
  (`startServer` over a real socket: SSR + route + SSE + WebSocket). Plain assert
  scripts (not `node:test`) so the same file runs identically on each runtime.

**Dev hot-reload of server modules (cross-runtime, #514).** webjs's dev server
re-imports a `route.ts` / `.server.ts` / page module per request with a
`?t=<timestamp>` query cache-bust to pick up edits. Node honors that query and
re-imports, so under `node --watch` an edit is picked up live. Bun's ESM loader
IGNORES the query string and exposes no module-eviction API, so that mechanism
alone leaves a server-side edit stale on Bun. The CLI closes the gap by
re-execing `webjs dev` under `bun --hot` on Bun (vs `node --watch` on Node),
whose file-watching cache invalidation makes the next re-import fresh with no
restart (`Bun.serve` is reused across hot reloads, so the listener is not
duplicated). The cross-runtime test `test/bun/dev-hot-reload.mjs` proves the
edit-picked-up behaviour on BOTH runtimes (and runs as a dedicated CI step on
Bun). The `api` dev-cache-bust UNIT test asserts the bare server-level `?t=`
mechanism directly (no supervisor), which Bun ignores by design, so it stays on
the Bun-matrix denylist; the user-facing hot reload it underpins is covered on
Bun by the dev-hot-reload script instead. A `--no-hot` flag opts out of the
supervisor on either runtime (run the server in-process, edits need a manual
restart). Component / page / layout SOURCE edits already hot-reload on both
runtimes (the served `.ts`/`.js` is read from disk per request, not imported).

### In-repo app tests in CI (#342)

Each in-repo app (`website`, `examples/blog`) carries its own test suite under
its `test/` dir and runs it through its own `webjs test` script (the website's
`test` runs node + browser; the blog's `test` is node-only). The root runners do
not discover these, so a dedicated `.github/workflows/ci.yml` job, **In-repo app
tests (website + blog)**, runs `npm test --workspace=@webjsdev/website` and
`npm test --workspace=@webjsdev/example-blog` (with Playwright installed for the
website browser tests and the SQLite DB prepared for the blog, the same setup
the `unit` + `e2e` jobs use). It is a required status check, so a regression in
an app's tests gates the merge. The app test dirs are not walked by the root
runner, so the framework-package tests never double-run. `docs` and the
ui-website ship no test suite yet, so they are not in the job.

### Adding a new test

1. Find the feature folder that matches what you're testing
   (`signals`, `routing`, `cache`, `auth`, etc.).
2. If none exists, create one under the right scope (package vs
   root) with the feature's natural name.
3. Drop the test in directly when it's a node test; nest it
   inside `browser/` / `e2e/` / `smoke/` when it's that kind.
4. Use `.test.js` for ESM packages, `.test.mjs` when the
   surrounding package is CJS (e.g. `@webjsdev/intellisense`).

---

## Component test helpers (`@webjsdev/core/testing`)

`import { fixture, ssrFixture, waitForUpdate, assertNoA11yViolations, click, shadowQuery, shadowQueryAll } from '@webjsdev/core/testing'`. The mount + hydrate + a11y helpers run in the WTR Chromium session (real DOM), thin wrappers over the browser already running.

### `fixture()` vs `ssrFixture()`

Both server-render an `html\`…\`` template (via `renderToString`, with DSD) and set the markup into a container so the browser upgrades the custom element. The difference is how they wait:

- **`fixture(template)`** waits two macrotasks. Use it for a quick mount where the SSR-then-hydrate distinction does not matter.
- **`ssrFixture(template)`** awaits the element's NATIVE `updateComplete` promise (the real render-cycle resolution), not a timer, so the post-hydration DOM is observable deterministically. It is the documented SSR + hydrate entry. Its contract: the SSR'd markup and the post-hydration DOM agree, so a hydration mismatch (server renders one thing, client another) is observable by comparing the SSR'd inner HTML against `el.innerHTML` / `el.shadowRoot.innerHTML` after it resolves. The component class must already be registered (the test imports its module, same as `fixture()`).

`waitForUpdate(el)` now also awaits the native `updateComplete` when present (falling back to a macrotask flush for a plain element), so a re-render after a property assignment or signal `set()` settles deterministically.

```js
import { html } from '@webjsdev/core';
import { ssrFixture, waitForUpdate } from '@webjsdev/core/testing';

const el = await ssrFixture(html`<my-counter count="5"></my-counter>`);
assert.ok(el.innerHTML.includes('5'));          // post-hydration DOM

el.count = 10;
await waitForUpdate(el);                          // awaits the real cycle
assert.ok(el.innerHTML.includes('10'));
```

**Hydration-mismatch pattern.** To assert SSR and the hydrated DOM agree, normalise the SSR string (strip the `<!--webjs-hydrate-->` marker, `data-webjs-prop-*` attributes, part comments) and compare against the live `el.innerHTML`. The counterfactual is a component whose `render()` is non-deterministic across the SSR call and the hydration render; `ssrFixture` returns the live hydrated element, so the divergence is detectable. The worked tests live in `packages/core/test/testing/browser/ssr-fixture.test.js`, alongside the broader SSR-vs-client parity corpus in `packages/core/test/rendering/browser/ssr-client-parity.test.js`.

**Testing async render + streaming + error isolation (#469 / #471 / #473).** Split by layer:
- **SSR async render + error isolation** (unit, node, `renderToString`): assert an `async render()` bakes the resolved DATA into the HTML with no fallback markup, and that a throwing component renders a component-scoped error state while siblings render (worked in `packages/core/test/suspense/async-render-ssr.test.js`).
- **`<webjs-suspense>` streaming** (unit, node, `renderToStream` + a `suspenseCtx`): collect the stream and assert the fallback flushes first, then the `<template data-webjs-resolve>` boundaries, and that multiple boundaries fetch concurrently via a timing assertion that fails if serial (worked in `packages/core/test/suspense/webjs-suspense-ssr.test.js`).
- **Client async render** (browser, WTR): mount a component and `await el.updateComplete`, then assert stale-while-revalidate keeps prior content during a gated re-fetch, `renderFallback()` shows only on a re-fetch (never first paint), a rejected render commits `renderError()`, and the race guard drops a superseded resolution. Use a gate promise inside `render()` to control timing (worked in `packages/core/test/suspense/browser/async-render-client.test.js`).
- **Progressive soft-nav streaming** (e2e, `WEBJS_E2E=1`): soft-navigate to a streamed page and assert the fallback is live in the DOM at the moment the URL advances (a buffered swap would only advance the URL once the boundary already resolved), then that the boundary streams in. The DOM-free reader helpers are unit-tested in `packages/core/test/routing/progressive-stream.test.js`.

### `assertNoA11yViolations(el, opts?)` (opt-in)

An OPT-IN accessibility assertion that runs the standard axe-core engine against an element's subtree in the WTR Chromium session. Nothing calls it for you, it is never a forced gate.

axe-core is a TEST-ONLY peer, imported dynamically by the helper, so it is NOT a hard dependency of `@webjsdev/core`. Install it where you run the test (`npm install -D axe-core`; the scaffold and this repo already ship it). If it is missing, the helper throws a clear message: `assertNoA11yViolations needs axe-core. Install it: npm install -D axe-core`.

On zero violations it resolves; on a violation it throws an Error whose message lists each violation's id, impact, a short help string, and the failing nodes' selectors, so the failure is actionable. `opts` passes through to `axe.run` (e.g. `{ rules: { 'color-contrast': { enabled: false } } }`).

```js
import { ssrFixture, assertNoA11yViolations } from '@webjsdev/core/testing';

const el = await ssrFixture(html`<my-form></my-form>`);
await assertNoA11yViolations(el);                // passes a clean subtree

// a <button> with no accessible name, an <input> with no label, an <img>
// with no alt: each throws a named violation. Worked both-direction tests
// live in packages/core/test/testing/browser/a11y.test.js.
```

---

## The handle() test harness (`@webjsdev/server/testing`)

`createRequestHandler({ appDir }).handle(request)` drives the FULL request
pipeline (middleware, routing, SSR, page actions, server-action RPC, auth +
CSRF) and returns a native `Response`. It is the same entry the framework's own
suite uses, so the most realistic way to test an app is to fire a `Request`
through it and assert on the `Response`, no spawned process and no network.

`@webjsdev/server/testing` ships THIN builders over that `handle()`. They are
not a test framework: each is a few lines over native `Request` / `Response`,
and they reuse the REAL cookie / header names and the REAL wire serializer (so a
test exercises the production contract, never a parallel fake).

```js
import { createRequestHandler } from '@webjsdev/server';
import { testRequest, getCsrf, invokeActionForTest, loginAndGetCookies, withSessionCookie }
  from '@webjsdev/server/testing';

const app = await createRequestHandler({ appDir: process.cwd(), dev: true });
```

### testRequest: fire a request, get the Response

```js
const res = await testRequest(app.handle, '/about');
assert.equal(res.status, 200);
assert.match(await res.text(), /About/);
```

A bare path (`/about`) is prefixed with a dummy origin (the pipeline only reads
`pathname` + `search`); a full URL string or a pre-built `Request` works too.
The optional third arg is a standard `RequestInit` (method, headers, body).

### getCsrf + the auth/session helpers

The action RPC endpoint requires a `x-webjs-csrf` header matching the
`webjs_csrf` cookie issued on the first SSR response. `getCsrf(handle)` does the
initial GET and returns `{ token, cookie, header }` so a test can send a
CSRF-valid request. `loginAndGetCookies(handle, { email, password })` drives the
REAL credentials login through `handle()` (the `createAuth` route handler) and
captures the genuine signed session `Set-Cookie`, so a follow-up request can hit
a protected route as the logged-in user:

```js
// unauthenticated protected route is gated
const gated = await testRequest(app.handle, '/dashboard');
assert.equal(gated.status, 302);                     // -> /login

// real login, then reuse the captured cookie
const { cookies } = await loginAndGetCookies(app.handle, { email, password });
const dash = await testRequest(app.handle, '/dashboard', withSessionCookie({}, cookies));
assert.equal(dash.status, 200);
```

The session cookie is the production cookie, captured from a real login, never a
hand-built shape. (The default login path is `/api/auth/signin/credentials`, the
route `createAuth`'s handler routes a credentials login through; override
`opts.loginPath` / `opts.body` for a different wiring.)

### invokeActionForTest: round-trip an action through the REAL endpoint

```js
// modules/posts/actions/create.server.ts exports createPost
const out = await invokeActionForTest(app, 'modules/posts/actions/create.server.ts', 'createPost', [input]);
```

`invokeActionForTest` serializes `args` with the webjs serializer (exactly as
the generated client stub does), POSTs them to the REAL
`/__webjs/action/<hash>/<fn>` endpoint with a valid CSRF cookie + header, and
parses the response with the serializer. The action is addressed by the SHA-256
hash of its `.server.{js,ts}` file path (absolute or appDir-relative) plus the
function name, the same scheme the stub uses (`actionEndpoint(appDir, file, fn)`
returns that path if you need it directly).

**Prefer this over a direct import of the action.** A direct import calls the
function in-process and bypasses three production concerns the endpoint
enforces:

- **the wire serializer** (a `Date` / `Map` / `BigInt` arg or return is
  genuinely encoded + decoded, not passed by reference),
- **CSRF** (a missing token is a 403),
- **prod error sanitization** (a thrown error surfaces as a sanitized
  message-only payload, never the stack or extra error fields).

So `invokeActionForTest` catches a serializer / CSRF / error-sanitization
regression a direct import cannot see. For the negative cases (assert a 403 on
missing CSRF, or inspect a sanitized 500 body), `rawActionRequest(...)` returns
the raw `Response` and never throws on a non-2xx; pass `{ omitCsrf: true }` to
deliberately drop the CSRF pair.

The saas scaffold's `test/auth/auth.test.ts` is a worked example: it drives the
unauthenticated-redirect gate, then a real signup -> login -> dashboard flow
through `handle()` using these helpers.

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

---

## Verifying UI and theming changes

For anything visual (layout, components, themes), a passing unit test or a
clean-looking code diff is not enough. Render it in a real browser and look.

- **Test both light AND dark mode.** Light mode passing proves nothing about
  dark mode. The scaffold drives dark mode through two signals (a `data-theme`
  attribute for the editorial chrome and a `.dark` class for the ui-* kit, see
  `agent-docs/styling.md`), and when neither is set both default to a
  coincidentally matching light, so a desync only shows once dark is active.
  Emulate dark (Playwright `newContext({ colorScheme: 'dark' })` or flip the
  theme toggle) and inspect a component's **computed** `background-color` /
  `color`, not just the page chrome.
- **Read the screenshot.** Capture `page.screenshot({ fullPage: true })` and
  open the PNG; white-on-white or a stray light box is obvious visually and
  invisible in the markup.
- **Guard the wiring in a fast test where you can.** A runtime cascade bug
  needs a browser, but the mechanism that triggers it (e.g. the theme toggle
  setting `.dark`) can be asserted cheaply. See the dark-mode assertions in
  `test/scaffolds/scaffold-integration.test.js`.
