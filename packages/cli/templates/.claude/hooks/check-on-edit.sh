#!/usr/bin/env bash
#
# PostToolUse hook (scaffolded by `webjs create`): after an Edit/Write to an app
# source file (.js / .ts under this app, outside node_modules), run
# `webjs check --json` and return the EDITED file's violations to the agent,
# each with the WebJs fix, so a wrong Lit or Next.js habit is corrected in the
# same turn rather than at CI.
#
# Silent when the file is clean, is not app source, or the app has no local
# `webjs` bin (it never installs anything). It reports only the edited file, so
# a pre-existing violation elsewhere does not repeat on every edit. The check
# takes about a second on a scaffolded app. For a TypeScript file it also runs
# `webjs typecheck` and returns that file's type errors the same way (a few
# seconds; WEBJS_NO_TYPECHECK_ON_EDIT=1 skips just that part).
#
# Set WEBJS_NO_CHECK_ON_EDIT=1 to skip.

[ "$WEBJS_NO_CHECK_ON_EDIT" = "1" ] && exit 0

payload="$(cat)"
node "$(dirname "$0")/check-on-edit.mjs" "$payload"
exit 0
