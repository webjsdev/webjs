---
name: webjs-blog-write
description: Use this skill whenever the task is to write, draft, or substantially edit a webjs blog post (a marketing/engineering post under the repo-root `blog/` directory that the website publishes). It carries the author's voice, the hard prose rules (no em-dashes, no internal PR/issue numbers, no process tells), the SEO-first topic and front-matter conventions, the de-duplication check against every existing post, and the mandatory dogfood verification of every factual claim before a feature post ships. Invoke it BEFORE writing any blog prose so the post lands in the house voice and does not need a later cleanup pass.
when_to_use: |
  Examples that should trigger this skill:
    "write a blog post about the new streaming actions feature"
    "draft an SEO blog for the path-alias imports"
    "we shipped X but never blogged it, can you write one"
    "add a blog post explaining CSRF without tokens"
    "find blog topics from the changelog and write them"
    editing an existing blog post's prose in a non-trivial way
  Do NOT trigger for: filing an issue (webjs-file-issue), syncing framework
  API docs or the docs site (webjs-doc-sync), or the docs site's own
  `docs/app/docs/**` pages (those are reference docs, not blog posts).
---

# Write a webjs blog post

The repo publishes engineering blog posts from the repo-root `blog/` directory. The website reads them directly (`website/modules/blog/queries/list-posts.server.ts`, `BLOG_DIR = <repo>/blog`), parses the front matter, and sorts by `date` descending. A post is one markdown file at `blog/<slug>.md`. This skill is how a new post lands in the author's voice, ranks for search, and states only claims that are actually true, without a later cleanup pass.

## Step 0 (mandatory, do this FIRST): analyze the author's current style

Do NOT write from a fixed style spec. The voice is defined by the corpus, and the corpus changes over time, so a hard-coded spec goes stale. Before writing a single sentence:

1. Read a broad sample of `blog/*.md` (at least six to eight posts spanning different topics and dates, including the two or three most recent by `date`). Read whole posts, not just the openings.
2. From that reading, note for yourself: how the author opens a post, how paragraphs are paced, how code is introduced, how sections are titled, how a post closes, and which words and rhythms recur. The sections below capture what has been true so far, but the corpus you just read is the authority. If it has drifted from this description, follow the corpus and update this skill.

The patterns that have held so far (confirm them against what you read):

- **First person, opinionated, honest.** The author writes as themselves ("I wanted the opposite", "kept biting me", "I did not find one I enjoyed using"). Personal origin and motivation are welcome.
- **A concrete hook, never a definition.** Posts open on a scenario, an attack, a painful task, or a plain-language framing ("Let me start with the attack, because the name is scarier than the idea"). The "Let me show you" / "Let me start with" opener is part of the house voice, keep it.
- **Beginner-friendly.** Every acronym or jargon term is expanded in parentheses on first use, for example "SSR (server-side rendering)" or "an async generator (a function that yields values over time instead of returning once)".
- **Second person in walkthroughs.** Once into the mechanics, the author addresses "you" and shows real `ts` / `sh` code blocks.
- **The painful old way, then the WebJs way.** Most feature posts show the tedious status-quo pattern first (a useEffect + spinner, thirty lines of optimistic bookkeeping, a native-addon compile), then the WebJs version that removes it.
- **Section headers are single `#`, sentence case, often with a trailing clause.** For example "# The classic answer, and why it is fiddly" or "# What the sourcemap layer cost".
- **Length is roughly 700 to 1100 words.** Substance over padding.
- **Most posts close with a "# The takeaway" section** (about 29 of 41 do). Use it unless the post reads better without one.
- **Contrast with the tool the reader knows.** React, Next.js, Rails, Lit, Remix, Astro. Explain what that tool does and why WebJs chose differently, on WebJs's own terms.

## Front matter (copy this exact shape)

```
---
title: "<SEO title in Title Case>"
date: <ISO 8601 with the +05:30 offset, e.g. 2026-07-10T10:00:00+05:30>
slug: <kebab-case, matches the filename without .md>
description: "<one to three sentences, SEO-rich, names WebJs and the key search terms a reader would type>"
tags: <comma-separated, lower-case>
author: Vivek
---
```

- `title` and `description` are the SEO surface. Write the `description` for a human scanning a search result: what the post teaches, in the words they would search, mentioning WebJs.
- `slug` must equal the filename. The site keys the URL on it.
- `date` slots the post into the timeline (the index sorts by it, descending). Pick a date that reads sensibly next to the neighbouring posts. You may adjust the dates of a batch of new posts so the cadence looks even, but do not future-date beyond today.

## Hard rules (a commit hook enforces the punctuation ones; the rest are voice)

1. **No em-dashes (U+2014). No hyphen or semicolon used as pause punctuation between words** (no space-hyphen-space, no space-semicolon-space), and **no colon after a code-shaped left-hand side** (rephrase verb-led). This is AGENTS.md invariant 11. `.claude/hooks/block-prose-punctuation.sh` scans new content and BLOCKS a violating commit. Use a period, a comma, parentheses, or a restructure. Plain hyphens in compound words, flags, and filenames are fine.
2. **No internal PR or issue numbers in prose.** A blog reader has no context for `#605` or `#849`. Never write "(#NNN)", "landed in #NNN", "issue #NNN", or "shipped in #NNN and #NNN". State the capability and its behaviour; the tracking number belongs in git and on the issue, not in published copy. (This is exactly what had to be cleaned out of the whole blog set once already.)
3. **No process, reasoning, or AI tells.** Nothing about how the post or the feature was verified ("Verified by dogfooding"), no "self-review", no "as I mentioned earlier", no meta-narration of the writing. The reader wants the capability, not your workflow.
4. **Do not undermine webjs.** Cut self-deprecating maturity lines ("new", "early", "no users at scale yet"). Express honesty as the competitor's genuine strength, not as a WebJs deficiency.
5. **Sell the capability on its own terms.** Do not pitch a WebJs feature as "another tool's branded feature, but native" (no "Turbo Frames, but for WebJs"). Name what it does and why it is good in plain terms.
6. **Defaults, not lock-in.** Drizzle, Tailwind, and SQLite are scaffold DEFAULTS. Never frame WebJs as coupled to them; it is bring-your-own-flexible.

## Process: from topic to a published, true post

1. **Pick an SEO topic backed by shipped work.** Mine the git history, the merged PRs, the per-package changelog, and the closed issues for a real, shipped capability that a developer would search for and that no existing post already covers. High-intent angles (migration from another framework, a concrete how-to) rank best.
2. **De-duplicate against EVERY existing post, directly AND indirectly.** Read the titles and skim the bodies of all `blog/*.md`. A new post must not restate a published one, even partially. If two candidate topics overlap, either merge them or sharpen each to a distinct angle and cross-link rather than repeat. Two posts that share a mechanism should each own a different facet and reference the other, not re-explain it.
3. **For a feature post, verify every factual claim by dogfooding before you publish.** This is not optional for a post that describes runtime behaviour. Scaffold a real app (`webjs create`), boot it (on Node AND Bun where the claim is runtime-sensitive), and confirm each claim with a real probe: `curl` for HTTP and header behaviour, a browser for hydration, streaming, client-router, and a11y. If a claim turns out false, FIX the post to state the truth, and file a framework issue via `webjs-file-issue` if the framework itself is wrong. A blog post that states a behaviour the framework does not have is the failure this step exists to prevent. Do not report a post done off unverified claims.
4. **Write the post** in the voice from Step 0, obeying the hard rules.
5. **Place the file** at repo-root `blog/<slug>.md`. Do not put it under `website/`. Confirm the front matter has `title` and `date` (the index drops files missing either).
6. **Self-check before committing.** Grep your own draft: `grep -nE '#[0-9]{3,4}' blog/<slug>.md` must return nothing, and scan for process tells ("dogfood", "self-review", "verified by"). Confirm no em-dash or banned pause punctuation. Read the whole post once as a reader who has never seen the codebase.

## Related skills

- **webjs-file-issue**: file the tracking issue for the blog work before writing, and file a framework issue if dogfooding surfaces a real bug.
- **webjs-doc-sync**: for the framework's own reference docs (`AGENTS.md`, `agent-docs/`, the docs site under `docs/app/docs/`). A blog post is not a doc-sync surface, and reference docs are not a blog. Keep them separate.
- **webjs-list-todos**: to see what shipped work is open or recently done when hunting for a topic.
