# CLAUDE.md — {{APP_NAME}}

This file is a thin pointer. Read these in order before editing anything:

1. **[AGENTS.md](./AGENTS.md)** — Full webjs API reference, file conventions,
   invariants, recipes, directives, lifecycle, controllers, context, task,
   scaffold rules (only three templates exist), persistence rules (Prisma
   + SQLite, never JSON files), workflow rules. Pay special attention to
   the **"If you just scaffolded this app"** section at the top.
2. **[CONVENTIONS.md](./CONVENTIONS.md)** — Project-specific conventions
   for module architecture, testing rules, component patterns, code style.
   Users may override sections.
3. **https://docs.webjs.com** — Full hosted docs when AGENTS.md and
   CONVENTIONS.md don't cover what you need.

All non-negotiable rules (workflow, tests, docs, scaffold-as-reference,
Prisma-not-JSON persistence) are in AGENTS.md / CONVENTIONS.md — they are
NOT duplicated here.
