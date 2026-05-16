# SSR partial navigation — design note

**Status:** SHIPPED (feature/nested-layout-partial-swap, 2026-05-16).
The mechanism described below is implemented and tested. This document
is preserved as the design record; runtime reference for callers lives
in `agent-docs/advanced.md` (Client router section) and the framework
API table in `AGENTS.md`.

**Motivating bug (resolved):** ui-website docs sidenav lost scroll on
every link click because the docs layout sat 2 levels deep under the
root layout, beyond `findLayoutShell`'s body-direct-child probe.
**Previous workaround (now deleted):** `app/docs/layout.ts` saved /
restored `.docs-sidenav` `scrollTop` via `sessionStorage` on every
`webjs:navigate` event. Removed in the same PR as the framework fix.

---

**What actually shipped vs. what's below:**
- The recommendation in this doc was `<webjs-frame>` as the primary
  primitive. During design discussion the decision evolved to make
  layout-marker discovery **auto-derived from folder structure** — so
  layout authors write nothing. `<webjs-frame>` ships as the escape
  hatch for non-layout partial-swap regions (rare).
- The marker format is `<!--wj:children:<segment-path>-->` comment
  pairs (Remix v3 lineage), not the `<webjs-frame>`-element approach
  sketched below.
- Wire-byte optimization, snapshot cache, keyed DOM diff with live-
  attribute preservation, and per-segment `<template id="wj-loading:...">`
  cloning all shipped in the same PR (originally deferred as v2+).

The original `<webjs-frame>`-centric sketch below is preserved as
historical context.

---

## Goal

Preserve the DOM of any layout, at any depth, across same-origin navigations. Re-render only the deepest segment that actually changed.

## Non-goals

- Per-segment data fetching (Remix v3 `<Frame src>` style) — wire model stays one SSR response per nav.
- React-style reconciler with full keyed-DOM diff inside the swap region. Out of scope for v1; can come later.
- Parallel routes / intercepting routes (Next.js feature). Separate design.

## Background — how the four references handle this

| Framework | Mechanism | Wire format | Scope decided by |
|---|---|---|---|
| **Turbo** | `<turbo-frame id="X">` (flat DOM element) | full HTML response, server may optimize via `Turbo-Frame: X` header | Innermost enclosing `<turbo-frame>` of the click — `closest()` |
| **Remix v3** | `<!--rmx:f:id-->...<!--/rmx:f-->` comment markers + per-frame `src` | per-frame HTML or `<template id>` streams | Author-declared `<Frame name="...">` + `rmx-target` on link |
| **Next.js App Router** | Recursive `FlightRouterState` tuple + per-segment `CacheNode` tree | RSC Flight (`react-server-dom-webpack`) | Server walks the tree, returns from divergence point |
| **Lit Labs** | `Routes` controller with `outlet()` + child controllers via `RoutesConnectedEvent` | full template re-render (no partial scoping) | N/A — full subtree re-render every nav |

**Closest fit to webjs's current router:** Turbo. webjs already mirrors Turbo Drive (link interception, body swap, `pushState`, `data-no-router` ≡ `data-turbo="false"`).

## Recommendation

Adopt a Turbo-style frame primitive: `<webjs-frame id="...">`. Layouts that want partial-swap behavior wrap their replaceable region:

```ts
// app/docs/layout.ts
import { html } from '@webjskit/core';
import { sidenav } from './sidenav.ts';

export default function DocsLayout({ children }) {
  return html`
    <div class="docs-grid">
      ${sidenav()}
      <webjs-frame id="docs-content">${children}</webjs-frame>
    </div>
  `;
}
```

### Algorithm — `packages/core/src/router-client.js` delta

Existing `findLayoutShell(body)` stays as a fallback. Add `findActiveFrame(linkEl)`:

```js
function findActiveFrame(linkEl) {
  // Walk up through shadow boundaries and into light DOM via composedPath at call site.
  const frame = linkEl.closest('webjs-frame');
  return frame ? frame.id : null;
}

async function navigate(url, event) {
  const frameId = event ? findActiveFrame(event.target) : null;

  const res = await fetch(url, {
    headers: frameId ? { 'X-Webjs-Frame': frameId } : {},
  });
  if (!res.headers.get('content-type')?.startsWith('text/html')) {
    // existing fallback: full nav
    window.location.href = url;
    return;
  }

  const html = await res.text();
  const incoming = Document.parseHTMLUnsafe(html);

  // 1. Frame path — preferred if active frame exists in both.
  if (frameId) {
    const target = document.querySelector(`webjs-frame#${CSS.escape(frameId)}`);
    const source = incoming.querySelector(`webjs-frame#${CSS.escape(frameId)}`);
    if (target && source) {
      target.replaceChildren(...source.childNodes);
      mergeHead(incoming.head);
      runFrameScripts(target);
      customElements.upgrade(target);
      history.pushState({}, '', url);
      document.dispatchEvent(new CustomEvent('webjs:navigate', { detail: { url, frameId } }));
      return;
    }
  }

  // 2. Existing layout-shell path (one level deep).
  const shell = findLayoutShell(document.body);
  const incomingShell = shell ? findLayoutShell(incoming.body) : null;
  if (shell && incomingShell && shellsMatch(shell, incomingShell)) {
    swapShellContent(shell, incomingShell);
    /* existing path... */
    return;
  }

  // 3. Full body swap (existing fallback).
  document.body.replaceChildren(...incoming.body.childNodes);
  /* existing path... */
}
```

That's the entire detection delta — a `querySelector` keyed by the active frame's id, with the existing logic preserved as fallback.

### `<webjs-frame>` element — ~30 lines

```js
// packages/core/src/webjs-frame.js
import { WebComponent, html } from './index.js';

export class WebjsFrame extends WebComponent {
  static properties = { id: { type: String, reflect: true } };
  render() { return html`<slot></slot>`; }
}
WebjsFrame.register('webjs-frame');
```

Light DOM (default) — no shadow boundary, no slot mechanics. The element exists purely as a swap anchor with an addressable `id`. Children are normal light-DOM children that the router replaces via `replaceChildren`.

### Server side — `X-Webjs-Frame` request header (optional optimization)

When set, the SSR pipeline can return only the matching frame's HTML wrapped in a minimal stub document, skipping the rest of the layout chain. Wire is still plain HTML (no new format). v1 ships **without** this optimization — full SSR response, client extracts what it needs. The header is forward-compat for the perf pass.

### Head merging

Same as today's `mergeHead`: replace `<title>`, merge `<meta>` tags by `name`/`property`, append new `<link>`/`<style>` elements, dedupe.

### Script handling inside the swap region

Re-execute `<script>` elements that match the existing one-level-shell path's `runScripts` logic. Idempotent registration via `Class.register()` makes this safe; the framework already handles `customElements.define` collisions.

## Edge cases

| Case | Behavior |
|---|---|
| Click on a link inside `<webjs-frame>` but `data-no-router` | Full browser navigation (existing semantics) |
| Click on a link *outside* any frame, both pages share a `findLayoutShell` match | Falls through to existing layout-shell path |
| Frame in old page but not in new (route change leaves the layout tree) | Frame lookup fails → fall to layout-shell or full body swap. Correct. |
| Nested `<webjs-frame>`s | Innermost wins — `closest('webjs-frame')` returns the nearest enclosing frame. Mirrors Turbo behavior. |
| Form submission inside a frame | Same — POST response gets the same frame-extract treatment. (Implement in form-submit path alongside link-click.) |
| Hash-fragment-only navigation | Existing behavior — no fetch, browser handles. |
| `data-frame="_top"` on a link | Escapes the enclosing frame, full nav. (Turbo precedent.) |

## What this fixes

- **ui-website docs sidenav scroll**: docs layout wraps content in `<webjs-frame id="docs-content">`. Sidenav lives *outside* the frame. Navigation between `/docs/components/a` → `/docs/components/b` only swaps frame children; the sidenav DOM is untouched; `<aside>` scroll position is preserved natively. The `sessionStorage` workaround in `app/docs/layout.ts` can be deleted.
- **Any nested-layout app**: the same primitive works whether the partial-swap region is 2, 3, or 5 levels deep.
- **Mixed layouts**: pages that don't opt-in fall through to the existing one-level shell detection or full body swap. No regression risk.

## What's deliberately deferred (future passes)

1. **Keyed `data-key` DOM diff inside the frame.** Adopt Remix v3's `diff-dom.ts` algorithm to preserve input values, `<details>` open state, popover state, scroll positions on inner scroll containers across nav. Today's `replaceChildren` is coarse — fine for v1 since the frame *itself* is preserved (outer scroll, sidenav, etc.).
2. **`X-Webjs-Frame` server optimization** to avoid re-rendering layouts the client already has.
3. **Server-pushed partial updates** (turbo-stream equivalent) — `<webjs-stream action="replace" target="...">`. Separate feature, useful for SSE/WebSocket-driven UI.
4. **Frame-scoped error boundaries** — if a frame fetch 5xxs, render only the frame's `error.ts`, not the whole page.

## Implementation plan

1. **`packages/core/src/webjs-frame.js`** — new file, the custom element.
2. **`packages/core/index.js`** — export `WebjsFrame`. Re-export `<webjs-frame>` via auto-registration import (so any app that imports `@webjskit/core` gets it).
3. **`packages/core/src/router-client.js`** — add `findActiveFrame()`, frame-swap branch in `navigate()`. Preserve existing `findLayoutShell` and full-body fallback.
4. **`packages/core/src/router-client.js` (form path)** — apply the same frame-extract to form submit responses.
5. **`packages/server/src/dev.js`** — accept `X-Webjs-Frame` header in dev mode (no-op for v1 but adds the request signal for telemetry).
6. **Tests:**
   - `test/unit/router-client.test.js` — frame detection, querySelector with various ids, fallback when source frame missing.
   - `test/e2e/nested-layout-frame.test.js` — load `/docs/components/a`, scroll sidenav, click `/docs/components/b`, assert scroll preserved AND only frame children swapped.
7. **Docs:**
   - `AGENTS.md` — add `<webjs-frame>` to the public API table.
   - `agent-docs/advanced.md` — new "Frames" section under the client-router doc.
   - `docs/` app — a new docs page showing the pattern.
8. **`packages/cli/templates/`** — none for v1 (frames are opt-in, no scaffold change needed).
9. **ui-website cleanup** — remove the `sessionStorage` workaround in `app/docs/layout.ts` after the frame lands and tests prove scroll preservation.

## Open questions

1. **Should `<webjs-frame>` ship a `src=""` attribute** for lazy loading like turbo-frame does? Probably yes eventually, but not for v1 — the motivating use case is layout-scope, not lazy data.
2. **Should there be a sub-element registry** (something like `data-layout="docs"` as a shorthand)? Keep it explicit for v1 — one mechanism. Consider sugar later.
3. **`X-Webjs-Frame` header naming** — `Webjs-Frame` (like `Turbo-Frame`) is shorter. Either works; v1 implements neither for response routing so the bikeshed is deferred.

## References

- Turbo source: `frame_controller.js:132-148` (response parse), `frame_renderer.js:5-16` (swap), `link_interceptor.js:48` (innermost-frame rule)
- Remix v3 source: `packages/component/src/lib/frame.ts:1134-1146` (comment markers), `diff-dom.ts:124-162` (live-attr preservation list)
- Next.js source: `packages/next/src/client/components/router-reducer/ppr-navigations.ts:230,251,292,354,486` (cache reuse vs create), `walk-tree-with-flight-router-state.tsx:106-112` (server-side tree walk)
- webjs current: `packages/core/src/router-client.js` (`findLayoutShell`, single body-children scan)
