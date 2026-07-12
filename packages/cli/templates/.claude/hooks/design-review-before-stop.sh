#!/usr/bin/env bash
#
# Claude Code Stop hook: render-and-look before finishing UI work.
#
# An AI agent writes CSS blind (it never renders), and layout / design defects
# have NO failure signal: `webjs check` and `typecheck` pass, the app runs. So a
# collapsed board, uneven cells, a layout that resizes as it fills, or an app
# that just kept the scaffold's design all ship silently. The one thing that
# catches them is looking at the rendered pixels. This backstop fires at the END
# of a turn that touched UI files and reminds you to render the app and inspect
# every state (see the webjs-design-review skill + CONVENTIONS item 6) before you
# stop. Loop-safe (fires at most once per stop) and skipped when no UI changed.
#
# Disable with WEBJS_NO_DESIGN_STOP=1.

set -uo pipefail
payload=$(cat 2>/dev/null || true)

if [ "${WEBJS_NO_DESIGN_STOP:-}" = "1" ]; then exit 0; fi
active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)
if [ "$active" = "true" ]; then exit 0; fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then exit 0; fi

# Did this turn touch UI surface? A component, a page/layout, or app styling.
ui_changed=$(git status --porcelain --untracked-files=all 2>/dev/null \
  | grep -vE '(^|/)(node_modules|\.webjs)(/|$)' \
  | grep -cE '(app/.*(page|layout)\.(t|j)sx?$)|(components/.*\.(t|j)sx?$)|(modules/.*components/.*\.(t|j)sx?$)|(\.css$)' || true)

if [ -z "$ui_changed" ] || [ "$ui_changed" -lt 1 ]; then exit 0; fi

reason="You changed UI in this turn but a design/layout defect has no failing test: check and typecheck pass even when a component collapses, cells are uneven, the layout shifts as it fills, or the app just resembles the scaffold. Before you stop, RENDER the app and LOOK at it: start it (webjs dev / start), open the routes you changed in a browser, and PLAY THROUGH every state (fill the board, win, draw, reload). Confirm (1) nothing collapses or resizes, cells stay equal; (2) the design is the app's OWN (layout, palette, typography, chrome), not the scaffold shell or its default colors; (3) it looks correct in light AND dark. See the webjs-design-review skill and CONVENTIONS item 6. If you already rendered and verified it this turn, say so in your final message. Disable this backstop with WEBJS_NO_DESIGN_STOP=1."

jq -n --arg r "$reason" '{decision: "block", reason: $r}' 2>/dev/null \
  || printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | jq -Rs . 2>/dev/null || echo '""')"

exit 0
