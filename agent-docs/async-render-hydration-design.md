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

### Still to measure

- Finding 2: wire cost of a hydration annotation vs the current seed block.
- Finding 3: keyed-list / directive reconciliation on the first dependency-change
  render under each model.
- Finding 4: composition with `<webjs-suspense>` (#471), soft-nav, and the
  `static shadow` / `static refresh` elision carve-outs.
- Finding 5: examples/blog prototype numbers (interactivity window, bytes, code
  delta) for the early-bind intermediate option specifically, since it looks like
  the best cost/benefit point so far.

## Recommendation (pending)

Leaning, pending the measurements: do NOT pursue full Model B (a framework-wide
resumable-hydration rewrite is disproportionate to the async-render problem that
prompted this). Instead evaluate the EARLY-BIND intermediate as the way to close
the #528 window, and treat seeding (Model A) as the correct steady-state
mechanism given webjs's re-render-and-replace hydration. If that holds, #535
proceeds (Model A stays), rather than becoming a no-op. To be confirmed by
findings 2 to 5.
