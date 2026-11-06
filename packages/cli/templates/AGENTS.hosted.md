# AGENTS.md for {{APP_NAME}}

This is a WebJs app: AI-first, web-components-first, buildless, and
progressively enhanced. A host product runs this app and gives you its own rules
for how to work, in what order, and how to check and version the work. Where they
differ from this file, the host's rules win.

## Learn WebJs when you need it

WebJs is its own framework. It is not React, Next, or Lit, so code from that
muscle memory breaks here. Read before you write a surface for the first time:

- `.agents/skills/webjs/SKILL.md` routes to focused files in `references/`. Load
  only the one for the surface you are touching.
- For one export's signature, run `npx webjs source <Export>`. The source under
  `node_modules/@webjsdev/*` is what runs, so it settles any exact contract.

## Rules that hold in every WebJs app

- Pages and layouts never hydrate. Put interactive behaviour in a small
  `WebComponent` with the `WebComponent({ ... })` factory, and keep it as small as
  the behaviour it owns.
- Writes are server actions in `.server.ts` files. Keep app data in the wired-up
  Drizzle database, never in a JSON file or an in-memory store.
- Type every boundary from its source. Never reach for `any`.
- Use design tokens, never a raw Tailwind colour such as `red-500`, and use the UI
  kit in `components/ui/` instead of hand-rolling a control.
- `npx webjs check` and `npx webjs typecheck` report correctness.
