## Summary

<!-- What does this PR do? 1-3 bullet points. -->

## Test plan

- [ ] Unit tests added/updated (`webjs test` passes)
- [ ] E2E tests added/updated for user-facing changes (`webjs test --e2e` passes)
- [ ] `webjs check` passes (no convention violations)

## Definition of done

Documentation MUST land on the same PR as the code change. Drift is how a
codebase rots. For each surface below, write `Updated <path>` or
`N/A because <reason>`. If you find yourself writing `N/A` for every
surface except tests, that is a smell. Reviewers should reject the PR if
this section is left as the template default.

- [ ] **Tests.** Unit coverage for logic. Real-browser coverage for
      user-facing behaviour.
- [ ] **`AGENTS.md`.** Updated if any API surface, invariant, or
      file-routing rule changed.
- [ ] **`CONVENTIONS.md`.** Updated if a project-level convention
      changed (e.g. a new architectural rule, a new agent workflow
      step). Conventions go in CONVENTIONS.md; lint rules go in
      `package.json` under `"webjs": { "conventions": { … } }`.
- [ ] **`README.md`.** Updated if install / use / public surface
      changed.
- [ ] **`docs/`** (if the project has one). Updated for every
      user-visible change.
- [ ] **`website/`** (if the project has one). Updated when landing
      copy or pricing-page claims touch the change.
- [ ] **Scaffold scripts / templates** (if the project ships any).
      Updated when the change affects what new instances generate.

See the **Definition of done** section in
[`CONVENTIONS.md`](../CONVENTIONS.md) for the full per-surface guidance.
