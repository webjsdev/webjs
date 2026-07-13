/**
 * OpenCode commit-frequency nudge plugin.
 *
 * Counterpart of the Claude Code, Gemini CLI, and Cursor hooks in
 * `.claude/hooks/`, `.gemini/hooks/`, and `.cursor/hooks/`. After
 * each edit/write tool call, counts uncommitted changes in the
 * working tree. When the count crosses a threshold (default 4,
 * override with the WEBJS_COMMIT_NUDGE_THRESHOLD env var), appends
 * a reminder to the tool result so the agent sees it on the next
 * turn.
 *
 * Soft nudge by design. Does NOT block the edit. The goal is to
 * keep the agent honest about the "commit per logical unit" rule,
 * not to interrupt valid work.
 *
 * Skipped on main/master (different guard rules cover that) and
 * outside a git work tree.
 *
 * Auto-discovered by OpenCode at startup. No opencode.json entry
 * needed. Lives in .opencode/plugins/ at the project root.
 *
 * Docs: https://opencode.ai/docs/plugins/
 */
import type { Plugin } from "@opencode-ai/plugin";

export const NudgeUncommitted: Plugin = async ({ $ }) => {
  const THRESHOLD = Number(process.env.WEBJS_COMMIT_NUDGE_THRESHOLD ?? 4);

  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") return;

      let branch = "";
      try {
        branch = (await $`git symbolic-ref --short HEAD`.text()).trim();
      } catch {
        return; // not in a git work tree
      }
      if (branch === "main" || branch === "master") return;

      let changed = 0;
      try {
        const out = (await $`git status --porcelain`.text()).trim();
        changed = out === "" ? 0 : out.split("\n").length;
      } catch {
        return;
      }
      if (changed < THRESHOLD) return;

      const reason =
        `[webjs] You have ${changed} uncommitted changes on '${branch}'. ` +
        `The webjs convention is small, focused commits per logical unit ` +
        `(one feature, one fix, one rename, one doc rewrite). Before ` +
        `continuing with more edits, group the current changes into a ` +
        `meaningful commit. See AGENTS.md "Git workflow" for the rule ` +
        `and the rationale. To raise the threshold for this hook in ` +
        `long-running tasks, set WEBJS_COMMIT_NUDGE_THRESHOLD.`;

      output.output = output.output ? `${output.output}\n\n${reason}` : reason;
    },
  };
};
