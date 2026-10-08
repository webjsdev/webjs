# AGENTS.md for {{APP_NAME}}

This is a WebJs app: AI-first, web-components-first, buildless, and
progressively enhanced. Read this whole file before you edit anything, then
follow it. The steps here are required, not optional.

## Gather context BEFORE you build (required)

WebJs is its own framework. It is not React, Next, or Lit, so writing code from
that muscle memory produces broken WebJs code. Before you write or change
anything, gather context from these sources. Do not skip a step to save time.
This is what separates a working app from a broken one.

1. **Read the skill.** Start with `.agents/skills/webjs/SKILL.md`, then load the
   `references/*.md` files it routes to for the surface you are touching. The
   skill is the guide to building a WebJs app: it helps you choose the right
   layer, reach for the right export, and avoid the mistakes Next.js or Lit
   habits cause. Reading it is never wasted work: it survives the
   gallery-clearing step in the playbook below.
2. **Study the shipped examples, then build on a clean slate.** The template
   playbook below says what ships and the exact order to follow. The workflow
   rules (git, tests, review) are in `.agents/rules/workflow.md`; follow them
   too.
3. **Read the framework source for exact contracts.** WebJs is 100% buildless
   native ES modules, so the source you run IS the source you read. When you
   need a precise API signature or behavior, open the package source under
   `node_modules/@webjsdev/*` directly (each package ships its own `AGENTS.md`).
   The full hosted docs are at https://webjs.dev/docs.

{{PLAYBOOK}}

## Type everything (all templates)

Derive the type at every boundary from its source. Never reach for `any`, and
never `unknown` where a real type exists. The rule is step 8 of the skill's "Default
Workflow"; the full ladder, with an end-to-end example, is
`.agents/skills/webjs/references/typescript.md`.

Keep server-only code (database drivers, secrets, `node:*` builtins) in
`.server.ts` modules. The two kinds (with and without `'use server'`) are the
skill's "Core WebJs Rules" 1 and 2.

## Data (all templates)

Use the wired-up database (Drizzle) for every piece of data the app stores;
the playbook above has the modeling step. Never store app data in a JSON file,
an in-memory array, or localStorage.
