#!/usr/bin/env bash
#
# PreToolUse hook: block prose-punctuation patterns the webjs convention bans.
#
# Catches four classes of new content in tool calls:
#
#   1. U+2014 em-dash, anywhere.
#   2. Space-hyphen-space " - " in PROSE contexts (comment lines, markdown
#      lines, headings, blockquotes). Math expressions in code like
#      `Math.abs(a - b)` or `arr.length - 1` are NOT flagged.
#   3. Space-semicolon-space " ; " in PROSE contexts. JS / CSS statement
#      terminators (`;\n`) are NOT flagged.
#   4. Code-shaped left-hand side immediately followed by a colon and prose:
#        - `<code>foo()</code>:` (markdown code-LHS in docs)
#        - `<my-tag>:` (custom-element tag with hyphen)
#        - Inline comment `// foo(): description`
#
# Why this exists: see AGENTS.md "Invariants", item 10. These patterns
# confuse AI agents that try to parse the prose as TypeScript / shorthand-
# method / object-literal syntax, and trip humans reading API docs.
#
# Covers two tool-call paths:
#   * Write / Edit / MultiEdit / NotebookEdit. The hook inspects the NEW
#     content fields of the tool payload. Existing glyphs in old_string
#     are not flagged: you can still Edit a line that contains one to
#     remove it.
#   * Bash. The hook inspects the command string, which catches commit
#     messages (`git commit -m "..."`), heredocs, echo / printf, and any
#     other prose typed at the shell.

set -euo pipefail

payload=$(cat)

# Pull every field where prose might land. `// empty` keeps missing
# fields silent; `[]?` keeps array iteration safe when absent.
new_content=$(printf '%s' "$payload" | jq -r '
  (.tool_input.content // empty),
  (.tool_input.new_string // empty),
  (.tool_input.new_source // empty),
  (.tool_input.command // empty),
  (.tool_input.edits[]?.new_string // empty)
' 2>/dev/null || true)

if [ -z "$new_content" ]; then
  exit 0
fi

# --- 1. U+2014 em-dash --------------------------------------------------
if printf '%s' "$new_content" | grep -q $'\xe2\x80\x94'; then
  cat >&2 <<'EOF'
BLOCKED: em-dash (U+2014) detected in this tool call.

webjs bans em-dashes repo-wide. Replace every U+2014 character with
a period, comma, colon (on a plain-noun LHS), parentheses, or
restructured sentence. Do NOT replace it with " - " or " ; " or a
trailing colon on code: those are also banned. See rule 2 / 3 / 4
below for the alternatives.

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 2. Pause-hyphen " - " in PROSE contexts ----------------------------
# Only flag lines whose context is clearly prose:
#   - Markdown lines starting with `#`, `>`, `*`, plain text outside code
#     fences (heuristic: line has no `=`, `{`, or `(...)` math)
#   - JSDoc / block comment lines starting with `*`
#   - Single-line comments starting with `//`
#
# Math expressions like `Math.abs(a - b)` or `arr.length - 1` are NOT
# flagged because they appear in code lines (not comments) with code
# context. The hook trades some false negatives in prose for zero false
# positives in code-heavy diffs.

block_pause_hyphen=0

# Comment-line " - " pause: line starts with `//` or ` *` (JSDoc/block) or
# `*` (markdown bold-start would have a letter after, distinguishable),
# followed by prose with `\w+ - \w+` pattern. Specifically: catch lines
# like `// foo - bar`, ` * foo - bar`, `* foo - bar`.
if printf '%s\n' "$new_content" | grep -qE '^[[:space:]]*(//|\*)[[:space:]].*[A-Za-z`)>][[:space:]]-[[:space:]][A-Za-z`(<]'; then
  block_pause_hyphen=1
fi

# Markdown heading " - " pause: line starts with `#` followed by prose
# and ` - ` pattern.
if printf '%s\n' "$new_content" | grep -qE '^#{1,6}[[:space:]].*[A-Za-z`)>][[:space:]]-[[:space:]][A-Za-z`(<]'; then
  block_pause_hyphen=1
fi

# Markdown blockquote " - " pause: line starts with `>` followed by prose
# and ` - ` pattern. (Single `>` blockquote, not table.)
if printf '%s\n' "$new_content" | grep -qE '^>[[:space:]].*[A-Za-z`)>][[:space:]]-[[:space:]][A-Za-z`(<]'; then
  block_pause_hyphen=1
fi

# HTML / markdown <p>, <li>, <td> body " - " pause: line contains a
# closing HTML tag from a prose context, then prose-style ` - `.
if printf '%s\n' "$new_content" | grep -qE '<(p|li|td|h[1-6]|strong|em|blockquote)[^>]*>[^<]*[A-Za-z`)>][[:space:]]-[[:space:]][A-Za-z`(<]'; then
  block_pause_hyphen=1
fi

if [ "$block_pause_hyphen" = "1" ]; then
  cat >&2 <<'EOF'
BLOCKED: pause-hyphen " - " detected in a prose context.

webjs bans plain hyphens used as pause-punctuation in prose. Rewrite
the sentence with a period, comma, colon (on a plain-noun LHS), or
restructured phrasing.

  Bad:  // Foo - bar
  Good: // Foo, with bar
  Good: // Foo. Bar.

  Bad:  <li>Foo - bar.</li>
  Good: <li>Foo, with bar.</li>

Plain hyphens are still fine in compound words (`AI-first`), CLI
flags (`--http2`), filenames, ranges, and math expressions in code
(`arr.length - 1`, `Math.abs(a - b)`). The hook only flags the
` < word > - < word > ` pause-pattern in prose contexts (comments,
markdown headings, blockquotes, HTML prose tags).

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 3. Pause-semicolon " ; " in PROSE contexts -------------------------
# Same prose-context guard as #2.
block_pause_semicolon=0

if printf '%s\n' "$new_content" | grep -qE '^[[:space:]]*(//|\*)[[:space:]].*[A-Za-z`)][[:space:]];[[:space:]][A-Za-z`(]'; then
  block_pause_semicolon=1
fi

if printf '%s\n' "$new_content" | grep -qE '^#{1,6}[[:space:]].*[A-Za-z`)][[:space:]];[[:space:]][A-Za-z`(]'; then
  block_pause_semicolon=1
fi

if printf '%s\n' "$new_content" | grep -qE '^>[[:space:]].*[A-Za-z`)][[:space:]];[[:space:]][A-Za-z`(]'; then
  block_pause_semicolon=1
fi

if printf '%s\n' "$new_content" | grep -qE '<(p|li|td|h[1-6]|strong|em|blockquote)[^>]*>[^<]*[A-Za-z`)][[:space:]];[[:space:]][A-Za-z`(]'; then
  block_pause_semicolon=1
fi

if [ "$block_pause_semicolon" = "1" ]; then
  cat >&2 <<'EOF'
BLOCKED: pause-semicolon " ; " detected in a prose context.

webjs bans semicolons used as pause-punctuation in prose. Rewrite as
two sentences (period) or with a conjunction (", and", ", but", ", so").

  Bad:  // Forms work ; links work too.
  Good: // Forms work. Links work too.
  Good: // Forms work, and links work too.

Semicolons stay fine inside code (JS statement terminators, CSS
declarations) since those are not flagged.

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 4a. <code>foo()</code>: prose ---------------------------------------
# Markdown / HTML definition list with code-call followed by colon and
# lowercase prose. The `)</code>:` shape is unambiguous: this is markdown,
# not code, AND the inner code ends in `()` so the colon visually parses
# as a return-type annotation.
if printf '%s' "$new_content" | grep -qE '\)</code>:[[:space:]][a-z]'; then
  cat >&2 <<'EOF'
BLOCKED: code-LHS colon-then-prose detected ("<code>foo()</code>: ...").

webjs bans `<code>foo()</code>: <prose>` because the colon visually
parses as a TypeScript return-type annotation. Rewrite verb-led.

  Bad:  <code>repeat()</code>: keyed list directive
  Good: <code>repeat()</code> is the keyed list directive
  Good: <code>startServer()</code> creates an HTTP(S) server

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 4b. Custom-element-tag <my-tag>: prose ------------------------------
# HTML reserves hyphenated tag names for custom elements (W3C spec), so
# `<x-y>:` is unambiguous prose, never JSX / TS / CSS.
if printf '%s' "$new_content" | grep -qE '<[a-z][a-z0-9]*(-[a-z0-9]+)+([[:space:]][^>]*)?>:[[:space:]][a-z]'; then
  cat >&2 <<'EOF'
BLOCKED: custom-element-tag colon-then-prose detected ("<my-tag>: ...").

webjs bans `<my-tag>: <prose>` in comments and docs. Rewrite verb-led.

  Bad:  // <ui-dialog>: owns open state, focus trap, escape, scroll lock.
  Good: // <ui-dialog> owns open state, focus trap, escape, scroll lock.
  Bad:  // <ui-dialog-content>: the centered panel.
  Good: // <ui-dialog-content> is the centered panel.

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 4c. Inline / JSDoc comment "foo(): prose" --------------------------
# Match comment-line prefix (`//` or leading `*`) before `\w+(...): ` and
# lowercase prose. Avoids TS return-type annotations because those never
# appear inside comment lines.
if printf '%s\n' "$new_content" | grep -qE '^[[:space:]]*(//|\*)[[:space:]][^(]*[A-Za-z_][A-Za-z0-9_]*\([^)]*\):[[:space:]][a-z]'; then
  cat >&2 <<'EOF'
BLOCKED: comment-line code-LHS colon-then-prose detected ("// foo(): ...").

webjs bans `xyz(): <prose>` inside comments and JSDoc. Rewrite verb-led.

  Bad:  // firstUpdated(): once, on the first render only
  Good: // firstUpdated() runs once, on the first render only
  Bad:  // closest(): null if the click wasn't inside a frame
  Good: // closest() returns null when the click wasn't inside a frame

Rule: AGENTS.md, Invariants section, item 10.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
  exit 2
fi

# --- 5. Lowercase "webjs" at a prose sentence start ---------------------
# The brand renders "WebJs" when it BEGINS a sentence and lowercase
# "webjs" everywhere else. This flags the lowercase form only at a
# sentence-initial PROSE position: after . ! ?, or at a prose line start
# (optionally behind markdown / comment markers and emphasis), or right
# after a prose HTML tag. A following space is required, so "webjs.dev",
# "webjs-suspense", "@webjsdev", and "webjsdev" never match. A "webjs"
# immediately followed by a CLI subcommand (webjs dev, webjs check, ...)
# is a command reference and is kept lowercase, so it is filtered out.
# Inline `code`, fenced blocks, and mid-sentence brand uses are not a
# sentence start and do not match. The rule biases toward false negatives
# (a missed case) over false positives (a wrongly blocked write), the
# same tradeoff as the pause rules above.
webjs_cli='create|dev|start|test|check|db|ui|doctor|types|typecheck|mcp|vendor|add|init|generate|migrate|push|studio|seed|pin|unpin|list|audit|outdated|update|view'

webjs_hits=$(printf '%s\n' "$new_content" | grep -nE \
  -e '[.!?]["'"'"')]?[[:space:]]+(\*\*|__|\*|_|")?webjs(\*\*|__|\*|_|")?[[:space:]]' \
  -e '^[[:space:]]*((//|#{1,6}|>|[-*])[[:space:]]+)*(\*\*|__|\*|_|")?webjs(\*\*|__|\*|_|")?[[:space:]]' \
  -e '<(p|li|td|h[1-6]|strong|em|blockquote)[^>]*>[[:space:]]*(\*\*|__|\*|_|")?webjs(\*\*|__|\*|_|")?[[:space:]]' \
  2>/dev/null || true)

if [ -n "$webjs_hits" ]; then
  # Drop hits whose "webjs" is a CLI subcommand reference (kept lowercase).
  offending=$(printf '%s\n' "$webjs_hits" \
    | grep -vE "webjs[[:space:]]+(${webjs_cli})([[:space:]]|[.,:;)]|\$)" 2>/dev/null || true)
  if [ -n "$offending" ]; then
    cat >&2 <<'EOF'
BLOCKED: lowercase "webjs" at a prose sentence start.

The brand is "WebJs" when it BEGINS a sentence and lowercase "webjs"
everywhere else. Capitalize this occurrence.

  Bad:  webjs ships a cache() helper.
  Good: WebJs ships a cache() helper.
  Bad:  ...round-trips. webjs rewrites the import.
  Good: ...round-trips. WebJs rewrites the import.

Still lowercase (NOT a sentence start, do NOT capitalize these):
  - a CLI command: `webjs dev`, `webjs check`, `webjs create my-app`
  - a domain / package / config / env: webjs.dev, @webjsdev,
    "webjs": { ... }, WEBJS_PUBLIC_*
  - mid-sentence: "Most webjs apps ship without a build step."

Rule: AGENTS.md, Invariants section, item 11.
Hook: .claude/hooks/block-prose-punctuation.sh.
EOF
    exit 2
  fi
fi

exit 0
