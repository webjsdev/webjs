# Copilot instructions

This is a thin bridge to the single source. GitHub Copilot always reads this
file; in VS Code it reads `AGENTS.md` directly only when `chat.useAgentsMdFile`
is enabled, so this bridge keeps Copilot pointed at the instructions regardless.

The instructions for this app live in `AGENTS.md` (the cross-agent source) and
the skill at `.agents/skills/webjs/SKILL.md`. Read `AGENTS.md` first, then the
skill (it routes to focused references on demand).
