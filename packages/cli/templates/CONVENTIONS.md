# Conventions for {{APP_NAME}}

The conventions for building a WebJs app live in the agent skill. **Read
`AGENTS.md` first, then `.agents/skills/webjs/SKILL.md`** (it routes to focused
references under `.agents/skills/webjs/references/`, loaded on demand). This file
only says where each rule lives, so no rule is stated twice.

- **Build order** (study the showcase: a full-stack app's gallery under
  `app/features/` and `app/examples/todo`, the api template's
  `app/api/features/`; then `npm run gallery:clear`, data, UI, verify):
  the playbook in `AGENTS.md`.
- **Data** (the wired-up Drizzle database, never a JSON file, an in-memory
  array or Map, or localStorage): `AGENTS.md`, "Data".
- **Layout** (`app/` is routing only, logic in `modules/<feature>/`): the
  skill's "Project Layout".
- **Server boundary, progressive enhancement, typing**: the skill's "What WebJs
  Is", "Core WebJs Rules", and "Default Workflow".
- **Git, tests, and `npm run ci`**: `.agents/rules/workflow.md`.
