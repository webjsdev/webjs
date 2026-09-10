## Summary

<!-- What does this PR do? 1-3 bullet points. -->

## Test plan

- [ ] `webjs ci` passes locally (the `webjs.ci` step list in package.json: `webjs check`, `webjs doctor`, `webjs typecheck`, the dependency audit, and the server / browser / e2e test layers; CI runs the same list)
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated for user-facing changes (`WEBJS_E2E=1 webjs test`)

## Definition of done

Documentation MUST land on the same PR as the code change. Drift is how
a codebase rots. Walk every markdown file in the project (`git ls-files
'*.md'`) and ask whether this PR changed behaviour, surface, or
invariants it describes. For each row below, write `Updated <path>` or
`N/A because <reason>`. Reviewers should reject the PR if this section
is left as the template default. See the **Definition of done** section
in [`CONVENTIONS.md`](../CONVENTIONS.md) for the full guidance.

- [ ] **Tests.** Unit coverage for logic. Real-browser coverage for
      user-facing behaviour.
- [ ] **Every markdown file in the project** that describes the
      changed surface. Common cases (non-exhaustive): `AGENTS.md` (root
      + nested), `CONVENTIONS.md`, `README.md` (root + nested),
      `CHANGELOG.md`, `docs/**/*.md`, `.agents/skills/webjs/**/*.md`,
      `.github/*.md`. The rule is generative: if a markdown file in
      this project mentions a thing this PR changed, it gets touched
      on this PR.
- [ ] **`website/`** (if the project has one). Marketing copy on the
      landing or pricing page when the change touches a claim made
      there.
- [ ] **Scaffold scripts / codegen** (if the project has any). Updated
      when the change affects what new instances generate.
