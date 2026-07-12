---
name: webjs-design-review
description: >-
  Render-and-look review for ANY UI work in a WebJs app. Invoke after building
  or changing a page, layout, or component, and before you report the work done.
  Triggers: "build", "create", "add a page", "component", "layout", "style",
  "design", "UI", "screen", "board", "form", "dashboard", "make it look".
---

# Render the app and LOOK before you call UI work done

You write CSS blind. You never see the pixels, so a whole class of defects ships
silently: `webjs check` passes, `webjs typecheck` passes, the server boots, and
the app still looks broken. A collapsed component, cells of unequal size, a
layout that resizes as it fills with content, text that overflows its box, an
app that just kept the scaffold's colors and chrome, none of these fail a test.
The only thing that catches them is rendering the app and looking at it.

So for ANY work that touches a page, layout, or component, this is the loop:

## 1. Run the app and open what you changed

```sh
webjs dev            # or: webjs start, for the production render
```

Open every route you touched in a real browser. Use the browser MCP
(`mcp__playwright__*` or `mcp__chrome-devtools__*`) if available so you can drive
and screenshot it; otherwise open it yourself and take screenshots.

## 2. Drive EVERY state, not just the first paint

The first paint is the easy case. Bugs hide in the states you reach by
interacting. Play the app the way a user will:

- A game board: play a full game. Fill it. Win. Draw. Reset. Watch whether the
  board or its cells change size as marks appear (they must NOT).
- A list: empty, one item, many items, an item long enough to wrap.
- A form: empty, invalid, submitted, error returned, success.
- Anything async: loading, loaded, error, refetch.

Reload each state. Resize the window narrow (mobile) and wide.

## 3. Confirm the three things a test can't

Look at each state and confirm, with your eyes:

1. **Nothing collapses, overflows, or resizes.** A container is the size it
   should be (not 0-height, not collapsed to its content when it should fill).
   Grid/flex children that should be equal ARE equal, and STAY equal as content
   changes. Text stays inside its box.
2. **The design is this app's OWN.** Not the scaffold shell, not its default
   color tokens. The palette (real `oklch`/hex values, not just shadcn token
   NAMES), the typography, the layout, and the chrome are chosen for THIS app.
   "It still looks like the starter" is a defect to fix, not ship.
3. **Light AND dark both look right.** Toggle the theme. Check contrast, that
   nothing disappears against its background, that borders and shadows read.

## 4. Iterate until it holds, then say what you saw

If any of the above is wrong, fix it and re-render. Do not stop on the first
render. When it holds, state in your final message WHAT you rendered and WHAT
you confirmed (which states, light + dark), so the review is on the record.

---

**Why this is a skill and not just a test:** a real-browser test
(`webjs test --browser`, and the `assertEvenGrid` / layout-stability helpers from
`@webjsdev/core/testing`) catches the mechanical failures (collapse, uneven
cells, reflow) and you SHOULD ship one. But "looks like the scaffold", "the
palette is bland", "the spacing is off", "it's ugly in dark mode" are judgment
calls no assertion makes for you. That is what this human-in-the-loop look is
for. Do both: the test for the mechanical floor, the look for everything above
it. See CONVENTIONS item 6 and `agent-docs/styling.md`.
