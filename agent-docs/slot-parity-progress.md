# #1021 implementation progress (light-DOM slot parity)

Working log for the single PR that implements #1021. Delete this file before the
PR is marked ready for review (it is a scratch tracker, not shipped docs). The
durable narrative lives in the PR comments; this file is a quick local checklist
so a resumed session sees phase status at a glance.

## Phase checklist (commit ordering within the one PR)

- [ ] Phase 1a: `adoptSSRAssignments` gets the `isOwnSlot` filter (pre-existing
      #1016 hydration bug) + ordering regression test.
- [ ] Phase 1b: `slotchange` fires async + coalesced (per-host dirty set,
      microtask flush) instead of synchronously.
- [ ] Phase 2: record refactor: ordered `authored: Node[]` + pure `repartition`
      + prune rule + framework-detach WeakSet + park element; `assignedByName`
      derived.
- [ ] Phase 3: `withRendererWrites` window in render-client + host interception
      layer (full virtual-child table) + `HTMLSlotElement.assign`.
- [ ] Phase 4: sensors (bypass backstop + flip sensor, asymmetric drains,
      removal handling, reconnect sweep, drain-before-disconnect).
- [ ] Phase 5: breaking cut: delete `setSlotContent`/`hasSlot`/`this.slots`,
      router seam swap to `projectAuthored` + opacity-window fix, SSR seed
      removal.
- [ ] Phase 6: elision tokens + docs (three gaps, library guidance,
      conditional-on-slot migration) + in-repo app/gallery migration.

## Invariants (do not violate)

1. No async subtree observer that MUTATES renderer-owned DOM.
2. Ownership STRUCTURAL (object identity / framework attr / RENDERING window),
   never comment-marker inference.
3. Idempotent over already-projected output.
4. Router keyed boundaries + full-reload integrity gate untouched.
5. Cross-writer coordination only via the public seam (`projectAuthored`).

## Delivery contract

One issue, one PR, no follow-ups. Phases are commit groups within this PR.
No backward-compat shims (WebJs has no users). Commit + push per sub-step;
narrate each phase as a PR comment for session resilience.
