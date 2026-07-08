---
name: webjs-scaffold-sync
description: Use this skill whenever a change affects what `webjs create` GENERATES (a new or changed gallery/showcase demo, a new template, a changed generated file like the layout/home/theme/schema, a new convention that belongs in generated apps, a new scaffold-shipped config/hook) OR when the user asks to sync the scaffold, "update all three templates", check the scaffold is consistent, or teach agents how to use webjs through the scaffold. The scaffold is webjs's PRIMARY teaching surface for AI agents, so a change to it must propagate in lockstep across the generators, the per-agent rule files, the scaffold tests, the framework docs that describe the scaffold, and the preview/example apps. This skill is the authoritative map of every scaffold surface plus the change-type to surface mapping, and the mandatory "generate + boot + check" verification, so no surface is silently skipped. Complements webjs-doc-sync (which owns framework API/behaviour docs); this skill owns what the scaffold emits.
when_to_use: |
  Examples that should trigger this skill:
    "add a new demo to the feature gallery"
    "the gallery should also ship in the saas template"
    "update all three scaffold templates with this"
    "add a backend-features showcase to the api template"
    "make sure the scaffold teaches agents how to do X"
    "did we keep the scaffold rule files in sync?"
    "the saas home / theme / schema changed, sync everything"
    finishing any change to what `webjs create` generates
  Do NOT trigger for: a framework API/behaviour change with no scaffold
  impact (use webjs-doc-sync), or a pure-internal refactor of the CLI
  that does not change generated output.
---

# Keep every scaffold surface in sync with what `webjs create` generates

The scaffold is the **primary way AI agents learn webjs**: an agent reads the
generated gallery/showcase and its comments to learn the idioms, then builds the
real app by adapting them. So a change to what `webjs create` emits is a
first-class change with MANY surfaces, and the recurring failure is updating one
(usually a template file) while the per-agent rule files, the scaffold tests, the
framework docs, and the preview apps drift behind. This skill closes that gap.

It is the sibling of `webjs-doc-sync`. Division of labour:

- **webjs-doc-sync** owns the framework's API/behaviour docs (the root `AGENTS.md`
  API sections, `agent-docs/*.md`, docs-site topic pages, the marketing website).
- **webjs-scaffold-sync** (this skill) owns what the scaffold GENERATES and the
  surfaces that DESCRIBE the scaffold.

They overlap on two surfaces (the scaffold's per-agent rule files, and the
template matrix in the framework docs/README). Whichever skill reaches that
surface must update it; when in doubt run both.

A hard commit gate enforces the FLOOR: `.claude/hooks/require-scaffold-with-src.sh`
BLOCKS a commit that stages framework-feature source (`packages/(core|server|cli)/src`)
with no scaffold surface (`packages/cli/templates` or `packages/cli/lib`) in the
same commit (escape hatch `WEBJS_NO_SCAFFOLD_GATE=1` for a change that genuinely
needs no scaffold update). The hook can only enforce "stage SOME scaffold
surface"; THIS skill does the substantive per-surface judgment and the
generate-boot-check verification.

## The complete scaffold surface map

Treat this as the universe. For any scaffold change, decide per surface whether
it applies, then update or consciously skip each.

1. **The generators** (the code that writes the app):
   - `packages/cli/lib/create.js` (the main generator: layout, home page, the
     theme block, db/schema, the full-stack gallery wiring, the per-template
     gates like `isApi` / `isSaas` / `!isApi`).
   - `packages/cli/lib/saas-template.js` (the saas-only files: auth, login/signup,
     dashboard, the saas schema).
   - `packages/cli/lib/api-gallery.js` (the api backend-features showcase).
   - Any future `*-template.js` / `*-gallery.js` split out for escaping sanity.
2. **The verbatim template files** copied into every app:
   - `packages/cli/templates/gallery/**` (the UI feature gallery + example app,
     shipped in full-stack AND saas).
   - `packages/cli/templates/**` (everything else copied per app: `lib/utils/ui.ts`,
     `public/`, `tsconfig.json`, `gitignore`, `.hooks/`, the metadata/route stubs).
3. **The per-agent rule files** (LOCKSTEP: all carry the SAME rules in each
   agent's format, the #134/#136 divergence lesson). A convention/workflow change
   for generated apps must land in ALL of them together:
   - `packages/cli/templates/AGENTS.md`
   - `packages/cli/templates/CLAUDE.md`
   - `packages/cli/templates/CONVENTIONS.md`
   - `packages/cli/templates/.cursorrules`
   - `packages/cli/templates/.github/copilot-instructions.md`
   - `packages/cli/templates/.agents/rules/workflow.md`
   - `packages/cli/templates/.gemini/**`, `.opencode/**`, `.claude/**` (whatever
     per-agent rule files the scaffold currently ships; enumerate, do not assume)
4. **The scaffold tests**: `test/scaffolds/*.test.js` (e.g. `scaffold-gallery`,
   `scaffold-ui-integration`). A new demo/template/generated-file assertion goes
   here, including the counterfactual (a per-template exclusion test).
5. **The framework docs that DESCRIBE the scaffold** (shared with doc-sync):
   - Root `AGENTS.md` "Scaffolding" section.
   - The docs site: `docs/app/docs/getting-started/page.ts` (+ `backend-only`,
     `ai-first`, `conventions` where they describe generated structure).
   - `README.md` (the template matrix + the "scaffold is the tutorial" note).
6. **The CLI surface**: `packages/cli/` `--template` validation + `--help`/usage
   text when a template or flag is added or renamed.
7. **The preview / example / dogfood apps**: `examples/blog/` and any in-repo
   apps, plus the local preview apps the user tests, when a convention they
   demonstrate changes.

## Change-type to surface mapping

| Change | Surfaces that MUST be checked |
|---|---|
| New / changed **gallery or showcase demo** | the template file(s) or generator strings for the demo + the home-page `features`/index array + the scaffold AGENTS.md gallery list + `test/scaffolds/*` FEATURES/assertions + **generate + boot the affected template** |
| New / removed **template** | the `create.js` template branch (+ a `*-template.js` if large) + the "only N templates exist" list in EVERY per-agent rule file + the framework `AGENTS.md`/getting-started/README template matrix + the CLI `--template` validation + `--help` + `test/scaffolds/*` |
| New **convention/rule** for generated apps | ALL per-agent rule files in lockstep (surface 3) + repo `CONVENTIONS.md` if the repo demonstrates it + `agent-docs` only if it also changes a framework API |
| Changed **generated file** (layout, theme, home, schema, middleware) | the generator (`create.js`/`*-template.js`) + any scaffold test asserting it + any doc/preview describing it + **regenerate + boot** |
| New **scaffold-shipped config/hook** (`.hooks/`, `webjs.*` in the generated `package.json`, a check rule) | `templates/**` + `webjs doctor`/`check` that reads it + the per-agent rule files if agents must know it |
| Which **templates ship the gallery** (scoping) | the `copyGallery` / gallery gate in `create.js` + the "full-stack only / full-stack and saas" wording in the per-agent rule files AND the framework docs (grep the old scoping phrase everywhere) |
| Pure-internal CLI refactor (no change to generated output) | NONE. Record that no scaffold surface applies. |

## Per-change sync procedure

1. Identify the change's IDENTIFYING TOKENS: the demo route (`app/features/<x>`,
   `app/api/features/<x>`), the template name, the generated file path, the
   convention phrase, or the scoping phrase (e.g. "full-stack only").
2. Grep those tokens across every scaffold surface:
   ```sh
   git grep -n -iE '<token1>|<token2>' -- \
     'packages/cli/lib/**' 'packages/cli/templates/**' 'test/scaffolds/**' \
     AGENTS.md README.md 'docs/app/docs/**'
   ```
3. Update every surface the mapping says applies. For a SCOPING or wording change
   (e.g. "gallery is full-stack only" becoming "full-stack and saas"), the grep
   MUST surface and fix every copy, in the rule files AND the framework docs.
4. **VERIFY BY GENERATING (mandatory, non-negotiable).** The generators emit
   strings, so a template-literal / escaping / interpolation bug is invisible in
   the generator's own syntax and only appears in the GENERATED app. For each
   affected template, generate an app and prove it:
   ```sh
   # generate (files only is enough for structure/typecheck; install to boot)
   node -e "import('packages/cli/lib/create.js').then(m => m.scaffoldApp('probe', '/tmp/x', { template: 'saas', install: false }))"
   # then in the generated app: webjs check (only no-scaffold-placeholder should
   # remain), webjs typecheck (clean), and boot it to hit the new route(s).
   ```
   A scaffold change is NOT done until a freshly generated app of each affected
   template BOOTS, serves the new/changed route, passes `webjs check` (only the
   intended `no-scaffold-placeholder` markers), and `webjs typecheck` is clean.
5. Run the scaffold tests (`node --test 'test/scaffolds/*.test.js'`) and add/adjust
   assertions (a new demo in the FEATURES list, a per-template inclusion/exclusion
   test, the counterfactual).
6. Respect the prose-punctuation invariant (#11) in every comment and doc, and
   keep each demo densely commented (a header stating the webjs concept + the
   why, inline comments on the non-obvious idiom, a `webjs-scaffold-placeholder`
   marker). The scaffold teaches by its comments; a thin demo is a bug.

## Audit-mode procedure (sweep the scaffold for drift)

1. List the shipped scaffold changes (new demos, new template, scoping changes,
   changed generated files).
2. For each, pull its tokens and run the surface grep above.
3. A surface is a GAP when the mapping says it applies but the token is absent or
   describes stale behaviour there (a classic gap: a demo added to the full-stack
   home but missing from the saas home, or a scoping phrase updated in one rule
   file but not the other five).
4. For a bulk audit, file a grounded follow-up via **webjs-file-issue** per gap
   (title `scaffold: <surface> missing <thing>`); for a single in-flight change,
   just fix all surfaces on the same PR.

## What this skill does NOT do

- It does not regenerate `llms.txt` / `llms-full.txt` (live-generated) or the
  website changelog (auto from PR titles).
- It does not own framework API/behaviour docs (that is `webjs-doc-sync`); when a
  change touches both a framework API and the scaffold, run both skills.
- It does not decide whether a CLI change alters generated output; that judgement
  is step 1, and a pure-internal refactor correctly updates no scaffold surface.
