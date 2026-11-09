---
name: webjs-scaffold-sync
description: Use this skill whenever a change affects what `webjs create` GENERATES (a template, a changed generated file like the layout/home/theme/schema, a scaffold-shipped config or hook) OR the brief every scaffolded AGENTS.md carries, OR a demo in the standalone feature gallery (`gallery/`, gallery.webjs.dev), OR when the user asks to sync the scaffold or check it is consistent. A scaffolded app is deliberately minimal and its only agent doc is the brief (single-sourced in packages/mcp/src/brief.js): agents build from Lit and Next.js habits, and `webjs check` refuses what those habits get wrong. This skill maps every surface such a change touches and runs the mandatory "generate + boot + check" verification. Complements webjs-doc-sync (which owns framework API/behaviour docs).
when_to_use: |
  Examples that should trigger this skill:
    "add a new demo to the feature gallery"
    "change what the scaffold home page / layout / schema looks like"
    "does the brief still hold after this change?"
    "is the scaffold consistent with the framework?"
    finishing any change to what `webjs create` generates OR to the brief
  Do NOT trigger for: a framework API/behaviour change with no scaffold
  impact (use webjs-doc-sync), or a pure-internal refactor of the CLI
  that does not change generated output.
---

# Keep the scaffold, the brief and the gallery in sync

The model: **a scaffolded app is minimal, and agents rely on muscle memory.**
`webjs create` emits a root layout, a starting home page, a theme toggle, the
Drizzle db wiring and one starter test (the `api` template: health and users
endpoints over typed server actions). Its only agent doc is `AGENTS.md`, which is
the brief and nothing else, plus a three-line `CLAUDE.md` bridge. There is no
gallery, no playbook, no rule directory and no skill in a generated app, by
design: every token an agent spends reading framework docs is one it does not
spend on the app.

So where a Lit or Next.js habit fails, the fix order is: (1) make WebJs behave
like Lit or Next.js; (2) otherwise refuse it LOUDLY in `webjs check` and at
load or render time, with the fix in the message; (3) only then, a line in the
brief. Never answer a gap with more scaffold prose.

## The surfaces

1. **The brief.** `packages/mcp/src/brief.js`, pasted verbatim into
   `packages/cli/templates/AGENTS.md` and the root `AGENTS.md`
   (`test/repo-health/brief-parity.test.mjs` holds them identical). It changes
   only when a Lit or Next.js habit can no longer produce correct code. Keep it
   short; `test/scaffolds/scaffold-integration.test.js` caps the scaffold
   AGENTS.md length.
2. **The generator.** `packages/cli/lib/create.js` writes the layout, home
   page, theme toggle, schema, package.json and tsconfig. Template strings, so
   an escaping bug only shows in a generated app.
3. **The template files.** `packages/cli/templates/**`, copied into every app:
   AGENTS.md, CLAUDE.md, the `.claude/` hooks (check-on-edit, branch guard,
   tests gate, commit-before-stop), `.hooks/pre-commit`, CI, Dockerfile,
   `public/sw.js`, the starter test.
4. **The feature gallery.** The standalone repo-root app `gallery/`, deployed
   at gallery.webjs.dev, one runnable demo per capability. It ships in NO
   scaffold. A new framework feature usually earns a demo here, and
   `test/scaffolds/gallery-coverage.json` must classify every new
   `@webjsdev/core` / `@webjsdev/server` export and routing convention stem (a
   gallery demo, or an honest `exempt`), or `gallery-coverage.test.js` reds CI.
   Gallery behaviour tests live in `test/examples/gallery/`.
5. **The scaffold tests.** `test/scaffolds/*.test.js` (generated structure,
   check-clean on both templates, Bun flavouring, the ui kit bootstrap).
6. **The docs that describe the scaffold.** Root `AGENTS.md` (Code workflow
   item 3), `packages/cli/AGENTS.md`, `packages/cli/README.md`, `README.md`, and
   the docs site: `getting-started`, `ai-first`, `conventions`, `backend-only`.
7. **The CLI surface.** `--template` validation and the help text in
   `packages/cli/bin/webjs.js`.

## Procedure

1. Name the change's tokens (a generated path, a template name, a brief line,
   a gallery route) and grep them across the surfaces:
   ```sh
   git grep -n -iE '<token>' -- 'packages/cli/**' 'packages/mcp/src/brief.js' \
     'test/scaffolds/**' 'gallery/**' AGENTS.md README.md 'website/app/(site)/docs/**'
   ```
2. Update every surface that applies, and record the ones that do not.
3. **Verify by generating (mandatory).** For each affected template, generate
   an app with the branch's packages linked (never the npm-published ones),
   then run `webjs check` (zero violations), `webjs typecheck` (clean), and
   boot it in-process with `createRequestHandler` to hit the changed routes.
   Run both templates in parallel when both are affected.
4. Run `node --test test/scaffolds/*.test.js test/examples/gallery/*.test.mjs`
   and add assertions for the change, including the counterfactual.
5. Respect the prose-punctuation invariant (#11) in every comment and doc.

## What this skill does NOT do

It does not own framework API or behaviour docs (that is `webjs-doc-sync`), and
a pure-internal CLI refactor with no change to generated output updates no
scaffold surface.
