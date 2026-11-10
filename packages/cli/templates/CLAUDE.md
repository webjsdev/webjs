@AGENTS.md

This project OVERRIDES Claude Code's never-commit default: commit and push per
logical unit (one feature, one fix) as soon as it is complete, without being
asked. The `.claude/hooks/commit-before-stop.sh` hook enforces it.
