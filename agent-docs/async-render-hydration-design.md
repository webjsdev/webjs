# Design record: async-render first-mount hydration (#536)

Status: COMPLETE, revised after a cross-framework review. The recommendation
SPLIT into two orthogonal axes (see "Revised recommendation" at the end, which
supersedes the earlier single-axis "Recommendation" section, kept below for the
reasoning trail):
  1. Server-data embed ("seeding"): KEEP. It is the universal industry pattern.
     #535 proceeds.
  2. Hydration model (re-render-and-replace vs marker-based adopt): webjs is the
     lone outlier; every mainstream framework AND Lit (webjs's API model) adopts.
     This is now a genuine open initiative worth its own issue, NOT settled.
This document is the design record for #536. It does NOT propose removing
bare-await async render; the authoring primitive stays. Only the client's
first-mount strategy was under research.

## Background: the three decoupled concerns of async render (#469)

A component may write `async render() { const u = await getUser(this.id); return html\`<h3>${u.name}</h3>\`; }`. The model has three separate parts:

1. SSR always blocks, so the resolved DATA is in the first paint (PE-safe).
2. The client re-fetch default is stale-while-revalidate.
3. `renderFallback()` is the optional re-fetch loading UI, never shown on first paint.

This record is about a fourth, implicit concern that sits under part 2: on the
FIRST client mount of a shipping async component, does the client re-run
`render()` at all?

## What happens today: re-run plus seed

Confirmed in `packages/core/src/component.js` (`update` + `_commitAsync`, around
L1230 to L1298):

- `update()` calls `this.render()`. For an async render that returns a promise,
  it routes to `_commitAsync(pending)`.
- `_commitAsync` keeps the existing DOM visible (on first paint, the SSR DOM,
  never a fallback, see the `__firstRendered` guard around L1280) and awaits the
  promise. When it resolves, `clientRender(tpl, this._renderRoot)` commits.
- The ONLY reason first mount re-runs `render()` is that `clientRender(tpl, root)`
  is how event listeners get BOUND. The binding points live in the resolved
  template, and the template does not exist until the awaited render resolves.

So a shipping async component, on hydration, re-invokes its action. Seeding
(#472, `packages/core/src/action-seed-client.js` `takeSeed`) makes that
re-invocation resolve from the SSR-embedded seed instead of the network, so the
re-render is an effective no-op that reproduces identical DOM.

That single choice ("re-run, then suppress the fetch via a seed") is the root of
a large amount of machinery:

- Seeding (#472, plus the #535 facade refactor) exists to make the on-hydration
  re-invocation instant.
- The #528 cold-hydration interactivity window is the gap before the deferred
  first commit lands (events are unbound until it does).
- The first-paint stale-while-revalidate special-case and the `renderFallback()`
  first-paint carve-out.
- Per-render abort (#492) of a superseded first render.

## The two models under comparison

### Model A: re-run plus seed (current)

Re-execute `render()` on first mount to locate binding points; seed the action
result so the re-execution does not hit the network.

- Pro: the client patcher needs no new capability. It already re-renders to
  hydrate a sync component, so the async path reuses the same commit.
- Con: the seed subsystem, the #528 window, the first-paint SWR special-case.

### Model B: hydrate-in-place / resumable

Serialize enough about the SSR render (the template identity plus the static
binding positions, especially the event-handler holes, which usually do NOT
depend on the fetched data) so the client can attach listeners to the existing
SSR DOM WITHOUT re-executing the data fetch. Re-run `render()` only on a real
dependency change (a prop / signal the component reads), which legitimately goes
to the network for fresh data, where no seed is wanted anyway.

- Pro: retires seeding (and #535), closes #528 by construction (listeners bind
  to SSR DOM immediately, no deferral), removes the first-paint SWR special-case.
- Con: this is the resumable-hydration model (Qwik, Marko, Astro islands). It
  needs a new hydration-annotation capability in the client patcher and the SSR
  walker. It TRADES the seed subsystem for an annotation subsystem rather than
  eliminating complexity outright.

## Open questions the research must answer

1. Can event-handler / property holes be re-bound from a serialized
   template-shape annotation WITHOUT re-running `render()`? The handlers are
   usually static references; the fetched data fills text/attribute holes that
   are already correct in the SSR DOM.
2. Wire cost of the hydration annotation vs the current seed block. Net bytes
   could go up or down. Measure on examples/blog.
3. How does it interact with the patcher's keyed-list / directive reconciliation
   on the FIRST post-hydration dependency-change render (that render still needs
   a faithful starting vnode)?
4. Does it compose with `<webjs-suspense>` streaming (#471), soft-nav apply, and
   the two elision carve-outs (`static shadow`, `static refresh`)?
5. Prototype on examples/blog measuring the interactivity window (the #528
   metric), wire bytes, and code deleted vs added.

## Relationship to #535 (important)

#535 (capture seeds by wrapping the evaluated module namespace, retiring the
source-rewrite facade) hardens and refactors the SEED subsystem. That subsystem
only exists to serve Model A. So:

- If this research recommends Model B (hydrate-in-place), the seed subsystem is
  retired wholesale, which makes #535 a NO-OP: there is no seed facade left to
  refactor, so #535 is superseded rather than implemented.
- If this research recommends keeping Model A, #535 proceeds as scoped, and this
  record documents why Model A won.

So #535 is a dependent / sibling of #536, NOT independent work. #535 is gated on
this record landing. The seeding-on-Bun parity work (#534, already merged) is
independent of both: it keeps the CURRENT (Model A) feature consistent across
runtimes regardless of the eventual outcome here, since Model B, even if chosen,
is a large change that will not ship for a while.

## Findings

### Finding 1: webjs has NO DOM-adoption hydration today (the decisive constraint)

This is the finding that reframes the whole comparison. webjs "hydration" is not
hydration in the React/Lit sense of attaching listeners to existing SSR nodes.
It is RE-RENDER AND REPLACE. Traced in `packages/core/src/render-client.js`:

- `render(value, container)` (L88) on a light-DOM host sees the
  `<!--webjs-hydrate-->` marker, REMOVES it (L105 to L107), then calls
  `createInstance(tr, container)` (L109).
- `createInstance` (L456) does `templateEl.content.cloneNode(true)` (L458) and
  `container.replaceChildren(startNode, ...frag.childNodes, endNode)` (L471).

So the SSR DOM is DISCARDED and replaced by a freshly cloned template instance.
The "no flash" guarantee rests entirely on the client output being byte-identical
to the SSR output (the comment at L100 to L103 says exactly this). This is true
for EVERY component, sync and async alike. There is no code path anywhere that
binds a listener onto an existing SSR node.

Consequence for the two models:

- This is WHY seeding (Model A) exists and why it is shaped the way it is. Since
  hydration always re-runs `render()`, a sync component re-renders for free, and
  an async component re-renders by re-fetching. You cannot serialize the rendered
  template to skip the re-run, because the template contains FUNCTION holes (the
  `@event` handlers) that are not serializable. So the framework serializes the
  DATA (the action result, which IS serializable) and re-runs `render()` locally
  to regenerate both the data holes AND the function holes. Seeding is the
  minimal, well-matched adaptation of "hydration re-renders" to "render is async",
  not invasiveness for its own sake.
- This is also WHY the #528 window exists: the async first commit is DEFERRED
  (the SSR DOM stays, with listeners UNBOUND, until the fetch resolves and the
  replace happens). The window is a direct consequence of re-render-and-replace
  meeting an awaited render.
- Model B (hydrate-in-place / adopt the SSR DOM) is therefore NOT a localized
  async-render change. It requires giving webjs a DOM-adoption hydration path it
  does not have for ANY component: walk the SSR DOM, match it to the compiled
  template's part positions, and bind listeners onto the existing nodes instead
  of cloning and replacing. That is a framework-wide hydration rewrite (the
  Qwik / resumability model), far larger than the async-render case that
  motivated the question.

### Implication: the real decision is bigger than async render

The lever is not "make async first-mount hydrate-in-place" in isolation. It is
"should webjs adopt a DOM-adoption (resumable) hydration model framework-wide,
replacing re-render-and-replace". That is a strategic architecture question with
broad blast radius (it touches every component's hydration, the patcher, the SSR
walker, and the byte-identical-output contract), and async render is just the
case where the current model's cost is most visible.

A narrower intermediate option worth measuring (does NOT need full resumability):
EARLY-BIND on the SSR DOM. On first mount of an async component, bind the
`@event` listeners onto the existing SSR nodes immediately (before the fetch
resolves), then let the normal re-render-and-replace run when the data arrives.
That would close the #528 window without seeding being on the interactivity
critical path, while keeping re-render-and-replace everywhere else. It still
needs a partial DOM-adoption capability (bind events to SSR nodes) that does not
exist today, but it is a far smaller change than full Model B.

### Finding 2: Model B needs per-part SSR markers on EVERY hole, page-wide

The patcher locates parts via client-compile artifacts that SSR does NOT emit.
Verified: `MARKER` appears 19 times in `render-client.js` and ZERO times in
`render-server.js`. The client `compile()` inserts a `<!--w$N-->` comment for
every child hole and a `data-w$N` sentinel attribute for every
element/event/prop/bool hole (`render-client.js` ~L294 to L320), then
`assignPaths` walks the clone to record each part's node path (~L409). SSR emits
none of these. Its only hydration-relevant annotations are `data-webjs-prop-*`
(custom-element props, position-INDEPENDENT because the attribute name carries
the prop name), a single `<!--webjs-hydrate-->` BOUNDARY marker (one per host,
not per part), and the suspense `data-webjs-resolve` / `data-webjs-fallback`.

So DOM-adoption (binding parts to existing SSR nodes) is impossible today: given
`<p>Alice and Bob</p>` from SSR, the client cannot tell which text is a static
string and which is a resolved hole, nor how many holes there are. Model B would
require SSR to emit a position marker for EVERY dynamic hole on EVERY page (every
child hole, every event/element hole; props already round-trip). That is a
page-wide byte cost (a comment or sentinel per hole, on all SSR output), and it
is paid by every component, not just async ones.

This is the cost/benefit crux: Model B's cost is page-wide, but its benefit is
async-narrow (see Finding 4). That mismatch is the central argument against it.

### Finding 3: re-render-and-replace loses little, because of WHEN and WHAT

The "replace destroys DOM state" worry is much weaker than it first looks.

- FIRST LOAD: the first client render is deferred to a microtask AFTER
  `connectedCallback` (`component.js` ~L793), and on first mount there is no prior
  instance, so it always goes through `createInstance` + `replaceChildren`
  (`render-client.js` ~L94 fast-path is skipped, ~L471 replaces). But this runs
  before user interaction is plausible (the page is static HTML, nothing focused,
  no text typed, no scroll). So the replace is effectively invisible: there is no
  live state to lose yet.
- SOFT NAV: the client router does NOT blindly replace. It reconciles by key
  (`id` / `data-key`), preserves `LIVE_ATTRS` (value/checked/selected/open/...),
  honors `data-webjs-permanent`, and the `cache()` directive detaches-and-reattaches
  instead of destroying (`router-client.js` reconcile path + `render-client.js`
  `cache`). And the `updateInstance` fast-path (same template strings) patches in
  place without replacing nodes, preserving focus/selection/scroll.

So there is no significant correctness bug that DOM-adoption would fix. The
state-preservation that matters is ALREADY provided by keyed reconciliation,
LIVE_ATTRS, `data-webjs-permanent`, `cache()`, and the same-strings fast-path.
Resumable hydration would be solving a problem webjs has largely already solved
by other means.

### Finding 4: seeding is narrow, fail-open, and skipped where it would hurt

Seeding (Model A) is far less pervasive than "most invasive feature" suggests:

- It is SKIPPED for streamed pages: a page with any `<webjs-suspense>` boundary
  emits no seed block (`ssr.js` appends the seed script only when
  `suspenseCtx.pending.length === 0`; a streamable result is never recorded,
  `action-seed.js` ~L114).
- It is MOOT for elided components: a bare async leaf (async render, no other
  client signal, light DOM) is elided (#474), so it never ships and never
  re-fetches, so it never needs a seed. Seeding is load-bearing ONLY for the
  minority of async components that ALSO carry an interactivity signal (the ones
  that ship).
- Its byte cost IS the data the component needs anyway (the rich-serialized
  action result), so it buys a saved round-trip, it is not gratuitous overhead.
- It is consume-once and fail-open: a miss degrades to a normal RPC, and a later
  refetch / arg-change goes to the network.

### Finding 5: #528 is already adequately handled by seeding

The #528 interactivity window is the gap before the deferred async first commit
binds listeners. With seeding ON (now on both runtimes after #534), that first
commit resolves from the embedded seed in roughly one promise tick, NOT a network
round-trip, so the window is small. The EARLY-BIND intermediate (bind `@event`
listeners onto the SSR nodes before the fetch resolves) would ITSELF need an SSR
annotation, because SSR drops `@event` holes entirely (no sentinel, Finding 2),
so it is not free either. Given the window is already small with seeding on,
early-bind is not worth its own SSR-annotation cost right now. If the window ever
proves to matter in practice (measure first), early-bind is the cheaper lever
than full Model B, since it needs only event-position markers, not a marker per
hole.

## Recommendation

KEEP Model A (re-render-and-replace hydration + seeding). Do NOT pursue Model B
(resumable / DOM-adoption hydration). The reasoning, grounded in the findings:

1. Cost/benefit mismatch (Finding 2 + 4). Model B's cost is page-wide (a position
   marker per dynamic hole on all SSR output, for every component). Its benefit is
   async-narrow (skipping a re-fetch that only shipping async components do, which
   seeding already handles and which is skipped for streamed / elided cases).
2. Weak correctness case (Finding 3). First-load replace happens before any live
   state exists, and soft-nav already preserves DOM via keyed reconciliation,
   LIVE_ATTRS, `data-webjs-permanent`, `cache()`, and the same-strings fast-path.
   Resumable hydration fixes no significant real bug.
3. Seeding fits the architecture (Finding 4). Given hydration re-runs `render()`,
   serializing the DATA and re-running locally is the natural minimal adaptation,
   not invasiveness for its own sake.

This decision was made deliberately WITHOUT a backward-compat constraint (webjs
has no users yet, so Model B was weighed on engineering merit alone and still
loses). It can be revisited if real apps later show (a) a measurable #528 window
even with seeding on, or (b) a state-loss bug keyed reconciliation does not cover.
The first would point at EARLY-BIND (event-position markers only), not full
resumability.

### Consequence for #535

Because Model A stays, the seed subsystem stays, so #535 (capture seeds by
wrapping the evaluated module namespace, retiring the source-rewrite facade)
PROCEEDS as scoped. #536 does NOT make #535 a no-op. This is the opposite of the
initial hunch when #536 was filed; the grounded finding is that seeding is the
right steady-state, so hardening it (the #535 fail-open refactor) is worth doing.
#534 (seeding on Bun, merged) was independent of this outcome and remains correct.

## Finding 6: cross-framework comparison (the input that split the decision)

Surveyed local clones of Next.js (16.3, App Router / RSC), Remix v2, Remix 3
(remix-the-web), Nuxt 3, Astro, and Lit (`@lit-labs/ssr`). They split cleanly on
the two axes webjs had been conflating.

SERVER-DATA EMBED (the seeding equivalent): UNIVERSAL. Every framework embeds the
server-computed data into the HTML so the client does NOT re-fetch on hydration:

- Next.js: the RSC Flight payload, inlined as `self.__next_f.push([type, data])`
  `<script>` chunks; the client reconstructs the tree via `createFromReadableStream`,
  no re-fetch.
- Remix v2: `window.__remixContext.state.loaderData` in an inline `<script>`;
  loaders re-run via fetch only on client navigation, not on initial hydrate.
- Remix 3: `<script type="application/json" id="rmx-data">` carrying per-entry
  `{ moduleUrl, exportName, props }`; entries hydrate with the embedded props.
- Nuxt 3: `<script type="application/json" id="__NUXT_DATA__">` (devalue); the
  `isHydrating` flag makes `useAsyncData` read `payload.data[key]` instead of
  fetching.
- Astro: each island's server props serialized into the `<astro-island props>`
  attribute, revived on hydrate, never recomputed.

So webjs seeding is the INDUSTRY-STANDARD pattern, near-identical to Remix 3's
`rmx-data` block and Nuxt's `__NUXT_DATA__`. It is table stakes, not exotic. The
"most invasive feature" label was always about HOW webjs CAPTURES the data (the
load-hook facade), never about the embed itself. This strongly validates keeping
seeding and hardening the capture mechanism (#535).

HYDRATION MODEL: webjs is the LONE OUTLIER. Every surveyed framework ADOPTS the
existing SSR DOM; none re-renders-and-replaces:

- Next.js (React), Remix v2 (React), Nuxt (Vue), Astro (delegated to the island
  framework): adopt via `hydrateRoot` / `createSSRApp`. React surfaces a mismatch
  as a recoverable error and re-renders the subtree; Vue logs a warning (and has
  `data-allow-mismatch`).
- Remix 3 (custom, non-React reconciler): adopts and PATCHES attributes in place,
  guided by `<!-- rmx:h:id -->` markers, logging a mismatch rather than throwing.
  No React-style mismatch error class.
- Lit (`@lit-labs/ssr`), which webjs's component API deliberately mirrors: adopts
  via per-part position markers, `<!--lit-part DIGEST-->`, `<!--/lit-part-->`, and
  `<!--lit-node N-->`. `hydrate()` walks those markers and reconstructs the Part
  data structures bound to the EXISTING DOM, then patches on update. It does not
  clone-and-replace.

This is the input that weakens the earlier mismatch-immunity argument. Two points:

1. Adoption does NOT force React's brittle mismatch behavior. Remix 3 and Vue
   degrade gracefully (patch-in-place / log), and webjs ALREADY has graceful
   in-place patching: the `updateInstance` fast-path and the soft-nav reconciler
   (keyed match, `LIVE_ATTRS`, `data-webjs-permanent`, `cache()`). So "adoption
   reintroduces a corruption bug class" was overstated; the mismatch policy is a
   design choice, and webjs has the pieces for the graceful one.
2. Lit is webjs's stated API north-star ("lit training data transfers directly").
   Lit's OWN SSR hydration is marker-based adopt. webjs re-rendering-and-replacing
   is a divergence from the very model it claims parity with, and it is the
   divergence that produces the per-island re-render + DOM churn and the #528
   window.

## Revised recommendation (supersedes the earlier Recommendation)

The decision splits into two INDEPENDENT axes. They were conflated; separating
them is the main result of this research.

AXIS 1, server-data embed (seeding): KEEP, SETTLED. It is the universal pattern
(Next / Remix / Nuxt / Astro all embed). webjs seeding is correct and should stay
on by default. #535 (harden the capture to be fail-open) PROCEEDS. This is firm.

AXIS 2, hydration model (re-render-and-replace vs marker-based adopt): OPEN, and
the evidence now leans TOWARD adopting the Lit-style marker-based model, NOT
toward keeping re-render-and-replace. Reasons:

- webjs is the only surveyed framework that re-renders-and-replaces; everyone,
  including Lit (the API webjs mirrors), adopts.
- Adoption addresses the real cost the re-render model pays: a per-interactive-island
  render + clone + `replaceChildren` (DOM churn) on first mount, and it closes the
  #528 window by construction (listeners bind to existing DOM immediately).
- The marker byte cost is real but universally accepted, and can be scoped to
  shipping (non-elided) components via webjs's existing elision analysis, so it
  tracks the same interactive surface that pays the re-render today.
- The mismatch concern is manageable: adopt-and-patch-gracefully (Remix 3 / Vue /
  webjs's own soft-nav reconciler), not adopt-and-throw (React).

What keeps Axis 2 OPEN rather than decided: it is a large framework-wide change
(SSR emits per-part markers, a new adopt path in the patcher reusing
`updateInstance`, a mismatch policy), and the current re-render model is simpler
and brute-force mismatch-immune. The upside is real but so is the cost, so it
deserves its own scoped initiative with a prototype + measurement (interactivity
window, bytes, code delta), not a snap decision here.

Crucially, the two axes are ORTHOGONAL. Adoption does NOT remove the need for
seeding: an adopting async component still runs `render()` to recover handlers and
dirty-check values, which still re-invokes the action, which still needs the seed
to avoid a network re-fetch. So even if Axis 2 moves to adoption, seeding stays
and #535 stays relevant. Adoption removes the clone-and-replace, not the data need.

NET: keep seeding (Axis 1, #535 proceeds). Open a SEPARATE initiative to evaluate
moving webjs to Lit-style marker-based adopt hydration (Axis 2), framework-wide,
with a prototype and measurement, since the cross-framework + lit-parity evidence
makes it the likely better long-term model and it is the real fix for the
re-render cost and the #528 window.

## Appendix: the Lit `hydrate()` blueprint (read firsthand)

Read `packages/labs/ssr-client/src/lib/hydrate-lit-html.ts` and the marker
emission in `packages/labs/ssr/src/lib/render-value.ts` directly. This is the
concrete reference design for an Axis-2 adopt path in webjs.

MARKERS (emitted by SSR, walked on the client):
- `<!--lit-part DIGEST-->` opens the root/template ChildPart; DIGEST is a hash of
  the template `strings` (a small DJB2-ish hash, base64, explicitly designed to be
  reproducible across languages/environments and safe inside a comment).
- `<!--lit-part-->` opens a nested dynamic child-expression part; `<!--/lit-part-->`
  closes a part.
- `<!--lit-node N-->` is emitted ONLY for an element that has attribute / property
  / element / event bindings (or a custom element needing `defer-hydration`
  removal); N is the depth-first node index in the template. So markers are
  proportional to the BINDING count, not the node count.

CLIENT `hydrate(rootValue, container, options)`:
- `rootValue` is the EVALUATED `TemplateResult`. So the render function DOES run
  on hydrate (to recover handler references and prime dirty-check values); what is
  avoided is the clone-and-replace of DOM.
- A `TreeWalker` over comment nodes reconstructs `ChildPart` / `TemplateInstance` /
  `AttributePart` objects bound to the EXISTING SSR nodes, then sets
  `container._$litPart$ = rootPart` so subsequent `render()` calls patch in place
  via the normal update path. No DOM is created or replaced.
- The event/attribute split (lines ~408 to 426) is the key trick: plain attribute
  parts are primed with `noCommit` (the value is already correct in the SSR DOM,
  so the DOM is not touched), but EVENT and PROPERTY parts ARE committed during
  hydrate (they were never serialized into HTML, so the listener is attached to the
  existing node). This is precisely "bind interactivity onto the SSR DOM without
  rebuilding it".

MISMATCH POLICY (correction to Finding 6): Lit is STRICT, not graceful. The root
marker's digest is recomputed on the client and compared (line ~278); a mismatch
THROWS (line ~302), the same adopt-and-throw posture as React. The graceful
adopt-and-patch exemplar is Remix 3 (and Vue logs a warning). So for webjs, the
mismatch policy is an explicit DESIGN CHOICE that does not come free with adoption:
Lit-strict (digest-validated, throw, simplest, surfaces author errors loudly) vs
Remix3-graceful (patch in place, log, never user-visible breakage). Given webjs's
PE/correctness thesis and that it ALREADY has graceful in-place patching (the
soft-nav reconciler with `LIVE_ATTRS` / `data-webjs-permanent` / `cache()`), the
graceful policy is the natural fit, but it is a deliberate divergence from Lit's
own hydrate, not something inherited.

WHAT WEBJS WOULD PORT for Axis 2:
1. SSR-side: emit the digest + `lit-part` / `lit-node`-equivalent markers, scoped
   to SHIPPING (non-elided) components, computing the digest identically to the
   client.
2. Client-side: a new `adopt()` path (parallel to `createInstance`) that walks the
   markers and binds the existing `compile()` part list onto the SSR nodes, reusing
   the existing `updateInstance` for subsequent renders. The event/attr `noCommit`
   split maps directly onto webjs's part kinds (event/prop committed, plain attr
   primed).
3. A chosen mismatch policy (recommend graceful patch, reusing the soft-nav
   reconciler's posture, with a dev-only warning).
4. Composition with `<webjs-suspense>` streaming, soft-nav apply, and the elision
   carve-outs (`static shadow`, `static refresh`).
