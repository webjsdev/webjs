# GEMINI.md

Gemini CLI reads `GEMINI.md`, not `AGENTS.md`, by default, so this file is a
thin bridge to the single source.

The instructions for this app live in `AGENTS.md` (the cross-agent source) and
the skill at `.agents/skills/webjs/SKILL.md`. Read `AGENTS.md` first, then the
skill (it routes to focused references on demand).

To have Gemini read `AGENTS.md` directly instead of this bridge, add it to
`context.fileName` in `.gemini/settings.json`.
