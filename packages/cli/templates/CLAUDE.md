@AGENTS.md

# Committing per logical unit (this OVERRIDES Claude Code's default)

Claude Code's built-in default is to NEVER commit unless the user explicitly
asks. **For this project that default does NOT apply.** Commit and push per
logical unit (one feature, one fix, one rename, one doc rewrite) as soon as it
is complete, WITHOUT being asked. Do not save all the work for one commit at the
end. A finished implementation with zero commits is a mistake here, because git
history is the user's revert and cherry-pick safety net.

The full git contract (branches, commit messages, attribution) is
`.agents/rules/workflow.md` "Git rules"; the
`.claude/hooks/guard-branch-context.sh` hook refuses a commit on `main`. Two hooks back this up: the
`.claude/hooks/nudge-uncommitted.sh` PostToolUse hook reminds you while
uncommitted changes pile up during work, and the
`.claude/hooks/commit-before-stop.sh` Stop hook stops you from ending a turn
with a pile of uncommitted work still on a feature branch.
