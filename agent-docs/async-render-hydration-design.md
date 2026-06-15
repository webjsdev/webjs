# Design record: async-render first-mount hydration (#536)

Status: research in progress. This document is the design record for #536. It
compares two client strategies for how an async-render component (#469) behaves
on its FIRST client mount, and will end in a recommendation plus the measured
trade. It does NOT propose removing bare-await async render; the authoring
primitive stays. Only the client's first-mount strategy is under research.

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

## Findings (filled in as the research proceeds)

To be completed: the binding-feasibility analysis (question 1), the wire-cost
measurement (question 2), the reconciliation analysis (question 3), the
composition analysis (question 4), and the examples/blog prototype numbers
(question 5).

## Recommendation (pending)

To be completed once the findings above are in.
