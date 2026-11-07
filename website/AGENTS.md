# AGENTS.md for the landing site

The webjs marketing / landing site, built on webjs itself. All
framework-wide rules (file conventions, public API, workflow, scaffold
rules, persistence rules, autonomous-mode behaviour) live in the
**framework root [`../AGENTS.md`](../AGENTS.md)** and apply here. Read
that first.

This file only covers what's specific to the landing site.

## Layout

```
website/
  app/
    layout.ts          root layout, the DOCUMENT SHELL only (head, OG/Twitter
                       metadata, analytics, the theme bootstrap, Tailwind
                       tokens). It renders `children` bare and owns no
                       visible chrome, see "Two sections, two chromes" below
    not-found.ts       404 for an URL that matches no route (rendered with no
                       layouts at all, so it stays importable on its own)
    error.ts           last-resort 500 boundary
    (site)/            the marketing section, a ROUTE GROUP (the folder is not
                       in the URL). Every route below this line through
                       founder-resources lives in here
      layout.ts        the marketing chrome: skip link, glow layer, the fixed
                       header (sized by the --header-h token), footer
      not-found.ts error.ts
                       section boundaries, rendered inside (site)/layout.ts so
                       a thrown notFound() or a 500 keeps the chrome
      page.ts          /  → the entire one-page landing site.
                           Hero, features grid, code samples, and agent
                           badges all live here.
    changelog/page.ts  /changelog. Reads ../../../changelog/<pkg>/*.md
                       at SSR time and renders the unified release
                       feed. The deployment image must include the
                       changelog/ tree at the repo root, the
                       Dockerfile's `COPY changelog ./changelog` line
                       is what ships it on Railway.
    blog/              /blog hub + /blog/[slug]. Reads ../../../blog/*.md.
                       WebJs design notes (dated). Emits per-post JSON-LD
                       (BlogPosting + BreadcrumbList). No FAQ.
    articles/          /articles hub + /articles/[slug]. Reads
                       ../../../articles/*.md. Evergreen keyword explainers
                       (tags, no dates). Emits TechArticle + BreadcrumbList
                       + FAQPage.
    compare/           /compare hub + /compare/[slug]. Reads
                       ../../../compare/*.md. Emits per-page JSON-LD
                       (TechArticle + BreadcrumbList + FAQPage).
    docs/              /docs/<topic>, the reference documentation (#1098 moved
                       it here from docs.webjs.dev). layout.ts holds the nav
                       tree + docs-scoped metadata; the shell itself is shared,
                       see lib/ui/docs-shell.ts. Nav labels and section titles
                       are Title Case (the Next.js and Rails convention, not
                       Tailwind's sentence case). A word whose casing is fixed
                       by something other than prose keeps it, which covers
                       code tokens (createAuth, @webjsdev/ui) and brands that
                       start lowercase (macOS, npm). Recasing either one
                       misspells it. Casing is the only thing pinned
                       sidebar-wide: a nav label NEED NOT match the page's
                       own h1, several deliberately do not, and those are
                       correct as they stand. The one exception is the
                       /docs/auth and /docs/authentication pair, where each
                       page's h1 is held byte-equal to its OWN label after
                       one of them once rendered a heading that named the
                       other page (#1103).
                       Do NOT generalise that pin to other pages. The /ui
                       sidebar is exempt from all of the above, since its
                       labels are component names from the live registry.
                       Both rules are enforced in test/ssr/docs-links.test.ts,
                       which carries the specifics and the current counts.
    founder-resources/page.ts
                       /founder-resources, outside services for founders.
                       UNLISTED on purpose: it is reached by direct URL only,
                       so it is absent from the header, the footer, the
                       sitemap, and /llms.txt, and
                       test/ssr/founder-resources-page.test.ts fails if
                       anything links it. It stays indexable and its links
                       are followed (no rel=nofollow). Do not add it to the
                       sitemap.
    ui/                /ui, the @webjsdev/ui section (#1099 moved it here from
                       ui.webjs.dev; #1666 is turning it into a replica of the
                       shadcn/ui site, with its own chrome)
      layout.ts        MINIMAL on purpose: the `.ui-site` token wrapper and the
                       /ui stylesheet link. Every /ui page renders inside it,
                       the bare iframe targets included, so nothing visible
                       may live here
      (chrome)/        the /ui header and footer, a route group so the iframe
                       targets outside it render with no chrome
        layout.ts      the fixed header (sized by the --header-h token) and the
                       footer with the one shadcn/ui credit line, shadcn's
                       SiteHeader and SiteFooter. The header row is shadcn's
                       (below lg the "Menu" drawer, components/ui-mobile-nav.ts;
                       from lg the nav; then search, the GitHub link with its
                       star count, the mode switcher, "+ New") plus the WebJs
                       mark in front, the one deliberate difference (D1); the
                       link back to webjs.dev sits in the drawer and the
                       footer. The layout is async because it awaits the star
                       count (modules/ui/queries/github-stars.server.ts, cached
                       an hour in lib/github-stars.server.ts, the mark alone
                       when GitHub cannot be read). A page carrying
                       data-slot="designer" (the typeset builder) makes it
                       exactly the viewport with no footer, shadcn's
                       has-data-[slot=designer] rule, and a docs page
                       (data-slot="docs") has no footer either, as shadcn's.
                       It also mounts the one `<ui-sonner>` (top center),
                       shadcn's root Toaster, so a page never mounts its own
                       and a docs demo's `data-toast` button always fires.
                       test/ssr/ui-chrome.test.ts
        not-found.ts error.ts
                       section boundaries, rendered inside the /ui chrome
        page.ts        /ui, shadcn's home page: the hero over the card grid
                       (modules/ui/home/), in the luma and rhea styles. The
                       grid has shadcn's five columns (md, lg, 1400px and
                       1900px add one each), with shadcn's faded skeleton
                       rails either side from 2200px
                       (modules/ui/home/skeleton-rails.ts, aria-hidden); below
                       md the page shows a picture
                       of the grid instead (public/images/home-cards-*.png,
                       scripts/shoot-home-cards.mjs), as shadcn's does
        docs/          /ui/docs, shadcn's docs (#1666, D15). layout.ts is the
                       sticky sidebar (lib/ui/docs/sidebar.ts, kept current on
                       a soft navigation by components/ui-docs-sidebar.ts,
                       which scrolls to the active link shadcn's
                       getActiveItem picks: the longest href, then the one
                       nearest the middle, only when out of view) and
                       every page renders through lib/ui/docs/page.ts (title,
                       previous / next, typeset body, On This Page). The nav,
                       its order and the component records live in ONE
                       module, modules/ui/docs/nav.ts. No /ui page may be
                       wider than a 390px phone: the repo-root
                       test/e2e/ui-phone-overflow.test.mjs loads every page
                       /ui/llms.txt lists and checks, and
                       test/ssr/ui-docs-phone.test.ts pins the shell's phone
                       shape (shadcn's title row, callout paragraphs, copy
                       buttons)
          page.ts      /ui/docs, the introduction
          components/page.ts
                       /ui/docs/components, every component page as a link
          directory/page.ts
                       /ui/docs/directory, the registry directory: the
                       registries in modules/ui/directory/registries.ts, with
                       a GET-form search and an Add dialog per registry
          components/[name]/page.ts
                       /ui/docs/components/<name>: the lead demo, Installation
                       (the add command and the baked source), then the
                       component's own sections from
                       modules/ui/docs/components/<name>.ts
        typeset/page.ts
                       /ui/typeset, shadcn's typeset builder: the customizer,
                       the preview frame and the Docs / Prompt panel, all
                       server markup from modules/ui/typeset/. The state is
                       the query string (shadcn's params), the customizer a
                       GET form that works with JS off, and
                       components/typeset-customizer.ts the behaviour
        create/page.ts /ui/create, shadcn's design-system configurator: the
                       customizer (style, base color, theme, chart color,
                       fonts, icon library, radius, menu) and the preview
                       frame, server markup from modules/ui/create/. The
                       state is the query string (`?preset=<code>`, or the
                       fields one by one), the customizer a GET form that
                       works with JS off, its footer shadcn's (Copy Preset,
                       the code as a `--preset` flag; Open Preset, a GET form
                       in a dialog that takes either spelling; Shuffle; Get
                       Code, also in the header from md), and
                       components/create-customizer.ts the behaviour. The
                       header's Create link and "+ New" button lead here
        blocks/page.ts blocks/[category]/page.ts
                       /ui/blocks (shadcn's featured blocks) and
                       /ui/blocks/<category>: the header, the categories nav
                       and one block viewer per block, all through
                       lib/ui/blocks-shell.ts. A fragment rather than a
                       layout, because the nav marks the current category and
                       a layout is not re-rendered between two categories
        colors/page.ts /ui/colors, shadcn's Tailwind palette page: the 26
                       palettes from modules/ui/colors/, each swatch a button
                       carrying its value in every format as data-*
                       attributes, so the page reads with JS off.
                       components/color-swatches.ts adds the copy, the shared
                       format menus and the remembered choice
        sera/page.ts   /ui/sera, shadcn's Sera style showcase: the six preview
                       screens (modules/ui/sera/), all server markup in the
                       sera style and the taupe theme, and below md the
                       screenshots in public/images/ shadcn shows instead
        examples/<name>/page.ts
                       /ui/examples/{dashboard,tasks,playground,authentication,
                       rtl}, shadcn's five example apps, each a whole page built
                       from the kit inside lib/ui/examples-shell.ts (header,
                       examples nav, frame). Their parts live in
                       modules/ui/example-apps/<name>/. dashboard is the
                       dashboard-01 block's mirror called with the options
                       that give it the example's shape, plus the example's
                       Tabler icons and nav data. Below md the shell shows
                       the example's picture, not the example, as shadcn's
                       does; tasks is a server-rendered
                       table whose filters, sort, hidden columns and page are
                       the query string (one GET form plus links, so it works
                       with JS off; <tasks-table> adds live submit and the row
                       selection); authentication binds a real 'use server'
                       action; rtl is the nova style under dir="rtl" with a
                       ?lang= selector and shadcn's Noto Sans Arabic / Hebrew
                       faces from public/rtl-fonts.css, linked by that page
                       only (scripts/fetch-fonts.mjs rtl)
        [name]/page.ts /ui/<name>, the retired interim gallery's address: a
                       308 to /ui/docs/components/<name> for every component
                       record in modules/ui/docs/nav.ts, a 404 otherwise. A
                       thin page rather than a webjs.redirects rule, so the
                       name list is the nav's and static siblings still win
      preview/typeset/[name]/page.ts
                       the typeset builder's iframe target, one of shadcn's
                       specimens with the params as --preview-* properties.
                       Outside (chrome), so it has no header
      preview/[name]/page.ts
                       the configurator's iframe target: preview block <name>
                       (preview, preview-02, preview-03) through the block
                       viewer's render query, inside a data-slot="design-system"
                       wrapper carrying the chosen .style-<name> and the
                       theme, radius and font tokens (modules/ui/create/
                       design-system.ts). A board of kit components stands in
                       until a preview block is in the registry, and a
                       component's `<name>-demo` renders there too (the item
                       explorer). It imports the blocks' elements barrel, as
                       view/[name] does; the menu color is a CSS rule on the
                       wrapper's data-menu-color (inverted) plus
                       public/ui-menu-color.js (translucent)
      view/[name]/page.ts
                       one registry block full screen in new-york, the block
                       viewer's iframe target and its "Open in New Tab". It
                       renders the site's mirror of the block through
                       modules/ui/queries/render-block.server.ts, and an
                       inline script cancels any submit, since a block's form
                       carries no action yet. It imports the generated
                       modules/ui/blocks/elements.ts so a block's own elements
                       (the data table, an animated card) upgrade. Outside
                       (chrome), so no header
      typeset.css/route.ts
                       shadcn's typeset.css as shadcn serves it (the body of
                       public/ui-typeset.css under shadcn's header), for the
                       builder's Copy button and its agent prompt
      r/registries.json/route.ts
                       the registry directory as JSON, shadcn's
                       /r/registries.json
      rss.xml/route.ts the WebJs UI changelog as RSS 2.0, shadcn's /rss.xml:
                       one item per changelog/ui release, linking to its
                       heading on /ui/docs/changelog
      init/route.ts init/md/route.ts
                       shadcn's /init and /init/md for a design-system choice
                       (`?preset=<code>`, or the fields one by one): the
                       registry:base payload `init --preset` applies, and the
                       markdown to set an app up by hand. Built from
                       modules/ui/init/ over the kit's
                       packages/ui/packages/registry/themes/preset.js
      registry/**      the JSON API that shipped CLI versions fetch (see
                       modules/ui/ below). Its paths never move
      llm/[[...slug]]/route.ts
                       every /ui page as markdown, shadcn's /llm/<slug>:
                       /ui/<path> is served at /ui/llm/<path> (/ui/llm is the
                       home page), with each demo's source inlined, the add
                       command and the API tables. Each /ui page's head names
                       it as `<link rel="alternate" type="text/markdown">`
                       (the (chrome) layout's generateMetadata), and the docs
                       shell carries Copy Page (components/docs-copy-page.ts)
                       and View as Markdown. See lib/ui/llm.server.ts
      llms.txt/route.ts llms-full.txt/route.ts
                       the /ui section's own llms.txt (every /ui page with
                       its description, linked to its markdown, then the
                       example apps) and every /ui page's markdown in one file
    sitemap.ts         /sitemap.xml (enumerates docs + every /ui page +
                       articles + compare + blog)
    robots.ts          /robots.txt (allow-all, points at the sitemap)
    llms.txt/route.ts  /llms.txt (llmstxt.org overview for AI agents): the
                       docs, then every /ui page and the example apps (the
                       gallery demos, the blog, this site, the blocks)
    llms-full.txt/route.ts
                       every doc page, then every /ui page, as markdown
  components/
    theme-toggle.ts    system/light/dark cycle
    copy-cmd.ts        click-to-copy command line (light DOM, always-on button)
    doc-search.ts      the docs sidebar search field
    code-block.ts      every code sample on the site: renders the <pre> (the
                       keyboard focus stop, the optional landmark name) and
                       colours the docs samples in the browser with the one
                       grammar from lib/utils/highlight.ts
    docs-drawer.ts     the /docs + /ui sidebar shell and its mobile drawer:
                       backdrop, toggle, aside, open state, every close path
    docs-command-menu.ts
                       the /ui header search's keyboard shortcuts (Cmd+K,
                       Ctrl+K, "/") and close-on-navigate. The palette itself
                       is server markup, lib/ui/docs/command-menu.ts, offering
                       only the docs pages that exist (docPageExists in
                       modules/ui/docs/nav.ts)
    data-table-demo.ts the Data Table docs demos' behaviour (filter, sort,
                       column visibility, selection, paging) around the
                       server markup in lib/ui/data-table-demo.ts
    message-scroller-demo.ts
                       shadcn's MessageScrollerDemo, the /ui home page's
                       "New Chat" card: a scripted conversation that streams
                       its answers a word at a time, on the kit's
                       <ui-message-scroller>
    typeset-customizer.ts
                       the /ui/typeset builder's behaviour around the server's
                       markup: a choice applies at once (replaceState, the
                       frame's --preview-* rewritten in place), hover preview,
                       popovers placed beside their trigger, R / Shift+R / D /
                       undo and redo (also from inside the frame), locks, copy
    create-customizer.ts
                       the /ui/create configurator's behaviour around the
                       server's markup: a choice applies at once (replaceState
                       with the new preset code, the theme lists following the
                       base color, the frame's design-system wrapper repainted
                       in place), hover preview, undo and redo (Cmd or Ctrl+Z,
                       Shift for redo, Ctrl+Y), Shuffle from shadcn's curated
                       presets keeping the locked fields (R), Reset (Shift+R),
                       Light/Dark (D), the item explorer (Cmd or Ctrl+P, a
                       filter, a pick swaps the frame), the welcome dialog on
                       the first visit, the Get Code dialog's commands, copy
    block-viewer.ts    the /ui block viewer's behaviour around the server's
                       markup (lib/ui/block-viewer.ts): drag-resizing the
                       preview, refresh, the two copy buttons, and the file
                       tree's highlight. Preview / Code, the viewport size and
                       the file choice are radio groups the CSS reads, so they
                       work with JS off
    site-nav-menu.ts   the header's mobile menu, wrapping a native <details>
                       so it still opens with JS off
    ui-mobile-nav.ts   the /ui header's "Menu" drawer, shadcn's MobileNav: a
                       subclass of site-nav-menu.ts with shadcn's look (the
                       two bars crossing into an X, a panel over the page
                       under the header), keeping every dismissal. Its links
                       (the header links, the docs Sections, every docs
                       group) are slotted from lib/ui/mobile-nav-links.ts
    ui-mode-switcher.ts
                       the /ui header's light / dark switch, shadcn's
                       ModeSwitcher: two states, flipping the resolved theme,
                       stored under lib/theme.ts's key, and pushed into any
                       same-origin frame on the page (the configurator and
                       typeset previews, the block viewer)
    color-swatches.ts  the /ui/colors behaviour around the server's markup: a
                       swatch copies its value in the chosen format (with a
                       toast), the format menus share one choice, and the
                       choice persists in localStorage under shadcn's key
    docs-copy-page.ts  the /ui docs pages' Copy Page button and its menu,
                       shadcn's DocsCopyPage: Copy Page fetches the page's
                       /ui/llm markdown on the click and copies it, and the
                       chevron menu holds View as Markdown, Open in ChatGPT
                       and Open in Claude. Like shadcn's it sits in a
                       `hidden sm:block` wrapper, so a phone's title row holds
                       only the arrows. Rendered whole by the server; with
                       scripting off (`noscript:`) the copy button and menu
                       give way to a View as Markdown link in their place
                       (test/components/browser/docs-copy-page.test.js)
    docs-copy-code.ts  shadcn's CopyButton on every /ui docs code block
                       (lib/ui/docs/code.ts and the package-manager block in
                       lib/ui/docs/install.ts): copies the figure's code, or
                       the selected tab's command, read from the figure, so
                       the source is in the HTML once. Hidden until defined;
                       the code reads the same with JS off
                       (test/components/browser/docs-copy-code.test.js)
                       (components/ui/ is intentionally EMPTY here, left free
                       for `webjs ui add` to own, exactly as the scaffold
                       expects, and gitignored so it stays that way. The
                       /ui previews' copies live in modules/ui/components/
                       instead, see below. Enforced by
                       test/ssr/kit-surfaces.test.ts, because eleven copies of
                       that mirror were once committed here by accident and
                       sat unimported until someone read the directory.)
  lib/
    design/            the design system, one subsystem in one folder
      recipes.ts       class recipes + the scale (BTN_*, EYEBROW, layout widths)
      brand.ts         the logo lockup and monogram fragments
      tokens.ts        the palette as data, painted by /brand
    ui/                composed page fragments, one per file. SSR-time functions
                       returning `html`; nothing here registers a custom element
      page-header.ts   hub eyebrow + title + lede
      ui-page-header.ts
                       shadcn's /ui PageHeader (announcement, heading,
                       description, actions) and PageNav, for the /ui section
                       pages (blocks, charts)
      block-viewer.ts  shadcn's BlockViewer as server markup (blockViewer)
                       and its docs-page preview frame (blockPreview); the
                       behaviour is components/block-viewer.ts. Below lg the
                       viewer, and below md the preview, show the block's
                       screenshot (public/images/blocks/) in place of the
                       frame, as shadcn's do
      blocks-shell.ts  the /ui/blocks page chrome: header, categories nav
                       (shadcn's lib/categories.ts), the featured list
      examples-shell.ts
                       the /ui/examples page chrome: header, examples nav
                       (shadcn's examples-nav.tsx) and the example's frame. A
                       fragment for the same reason as blocks-shell.ts
      selector-themes.ts
                       the 8 themes the ThemeSelector offers and the pure
                       ?theme= helpers, apart so a pure module can read them
      theme-selector.ts
                       shadcn's ThemeSelector and CopyCodeButton for a section
                       nav: a GET form on ?theme= (works with JS off) whose
                       region wears the .theme-<name> class, and a dialog with
                       the theme's CSS; components/theme-selector.ts applies a
                       change in place and keeps data-theme-link links on it
      data-table-demo.ts
                       the payments table both Data Table docs demos render
      cta-panel.ts     the closing call to action
      site-footer.ts   the footer, rendered by the (site) chrome layout
      docs-shell.ts    the shell stylesheet (.prose-docs typography, the sticky
                       desktop column) plus the function that turns a nav tree
                       into markup and slots it into <docs-drawer>. SHARED by
                       /docs and /ui so the two sections cannot drift apart.
                       The drawer's markup and behaviour are NOT here, they are
                       components/docs-drawer.ts
    scroll-lock.ts     refcounted page scroll lock, sharing the UI kit's
                       globalThis counter so a drawer and a <ui-dialog>
                       interoperate. Measures and compensates the viewport
                       widening that hiding the scrollbar causes (#1147)
    theme.ts           the theme storage key and forced values, read by the
                       layout's bootstrap script, theme-toggle.ts and
                       ui-mode-switcher.ts
    github-stars.server.ts
                       the webjsdev/webjs star count from the GitHub REST API
                       for the /ui header: cached an hour, a stale value
                       served while one refresh runs, a 2s timeout, a failure
                       retried after five minutes, `GITHUB_TOKEN` used when
                       set. It makes no request under `node --test` (or with
                       `WEBJS_GITHUB_STARS=off`), since every test file that
                       renders a /ui page would otherwise spend one of the 60
                       unauthenticated requests an hour. Not an action (its
                       reset and fetcher swap are for tests); the layout
                       reaches it through modules/ui/queries/github-stars.server.ts
    escape-target.ts   the one rule deciding whether an Escape press belongs to
                       the field the reader is editing. Shared, because every
                       dismissible surface has to answer it identically
    utils/             pure helpers (compute, never render)
      highlight.ts     SSR syntax highlighter for the code samples
      frontmatter.ts   parse changelog/blog markdown frontmatter
      faq.ts           parse a `## FAQ` markdown section into FAQPage JSON-LD
      cn.ts dom.ts icons.ts
                       GITIGNORED. The kit's helpers (and its Lucide icons),
                       mirrored to the exact path `webjs ui add` writes them
                       to in a real app
    links.ts           cross-app URLs + in-app paths for the header and footer
    samples.ts         the code samples shown on the marketing pages
    ui/llm.server.ts   the /ui section for agents (#1666): `listUiPages` is the
                       page list /llms.txt, /ui/llms.txt and the sitemap all
                       print, DERIVED from the nav, the component records,
                       DOC_PAGES, the registry blocks, the route table's
                       static /ui pages and the dynamic pages a section links
                       (/ui/charts/<type>), so a new page cannot be missing.
                       `renderUiMarkdown` runs the page module the router
                       would run, renders it with custom elements unexpanded,
                       and converts the HTML with lib/html-to-markdown.ts, so
                       the markdown is the page and there is no second copy to
                       keep in step. The docs shell's `data-slot="docs-body"`
                       and `docs-description` and the preview's `data-demo`
                       are what it reads. Every result (each page's
                       markdown, the page list, both corpora) is cached in
                       process, keyed to `sourceFingerprint()`, a hash of the
                       mtime and size of every file the pages are built from,
                       re-taken at most once a second: a deploy starts empty
                       and a dev edit invalidates. Responses carry an ETag and
                       answer If-None-Match with a 304. A page that throws is
                       listed from its metadata rather than failing the index.
                       test/ssr/ui-llms.test.ts
    ui/llm-path.ts     /ui/<path> to /ui/llm/<path>, browser-safe
    html-to-markdown.ts
                       a small parser and converter for HTML this site
                       renders: headings, lists, tables, code figures fenced
                       with their language and title, previews reduced to
                       their source, chrome and hidden text dropped
    docs-llms.server.ts  enumerates the doc pages on disk (sitemap, llms.txt).
                       Strips tags at every stage and decodes entities exactly
                       ONCE, at the end. Decoding earlier puts a bare `<` in
                       front of a later tag strip, which then matches to the
                       next `>` anywhere in the document and deletes
                       everything between the two. That once cost
                       `/docs/metadata-routes` 5 of its 9 code samples and
                       deleted an escaped tag from 253 prose lines across the
                       corpus. It also keeps the template holes a reader
                       actually sees: `\${x}` is ESCAPED (literal text, not an
                       interpolation) and `${"lit"}` interpolates a known
                       literal, so both are preserved, while only a bare
                       `${x}` is render-time and gets dropped. Treating all
                       three alike printed `<form action=\>` on 12 corpus
                       lines, teaching an LLM the one shape invariant 12
                       exists to rule out. Everything it takes from a docs
                       page is copied out of page SOURCE, which is a JS
                       template literal, so all four paths fold their
                       backslash escapes: a fenced sample at capture, a kept
                       hole as it parks, ordinary prose in one pass once the
                       hole passes have run, and a description inside
                       `plainText` (which is where it belongs rather than at
                       a call site, because only 8 of 44 pages declare
                       `metadata.description` and the other 36 fall back to
                       their first `<p>`, so both sites need it). Those three
                       all fold BEFORE their single entity decode, which is
                       the browser's own order, since JS cooks the literal
                       first and the HTML parser only ever sees cooked text.
                       A title is the exception that proves it: it folds at
                       its call site because it never passes through
                       `plainText`, and it decodes nothing at all, since it
                       is read from a quoted metadata string rather than out
                       of markup. The prose fold runs AFTER the hole passes
                       because those are what tell `\${x}` (literal text)
                       from `${x}` (render-time, and dropped), so folding
                       first would drop the literal. Fold exactly once per
                       path: a second fold eats an authored `\\`, which is
                       why no `plainText` call site folds and a test reads
                       the call sites to keep it that way. Only the hole
                       half existed, which is why the corpus printed
                       `<form action=\${createPost}>` on 5 lines and
                       ``html\`...\` `` on 23 more, where the rendered page
                       shows `<form action=${createPost}>` and a plain
                       backtick. A backslash now surviving out of a DOCS PAGE
                       is one an author WROTE as `\\`, so a page escaping a
                       letter (`/\s+/g`, which cooks to `/s+/g` and rendered
                       that way live on two pages) is a page bug, guarded by
                       a test rather than by convention. That says nothing
                       about the rest of /llms-full.txt: `renderLlmsFull`
                       appends the repo-root skill markdown verbatim, never
                       through `bodyToMarkdown`, and those `.md` files are
                       not template literals, so their single `\` is correct
                       at source and reaches the corpus unfolded.
  modules/
    ui/components/     GITIGNORED mirror of the @webjsdev/ui registry sources,
                       written by scripts/copy-registry.mjs. NEVER hand-write
                       here: it is wiped every dev cycle. It lives under the
                       /ui section's own module rather than in components/ui/
                       because it is /ui INFRASTRUCTURE (live previews),
                       not this site's UI kit. That keeps components/ui/ free
                       so `webjs ui add` works here the same way it does in a
                       scaffolded app.
    ui/examples/<name>.ts  one docs demo per file (D14): a default export
                       returning an `html` template. ui/queries/render-demo.server.ts
                       renders it (custom elements left unexpanded, so the page
                       expands each once) and reads the same file for the Code
                       tab, behind a name allowlist since it is RPC-callable.
                       ui/elements.ts imports every Tier-2 element once, from
                       app/ui/layout.ts, so a demo string's elements upgrade
    ui/example-apps/<name>/  the parts of one /ui example app (data, fragments,
                       and the one element an example needs, like
                       tasks/tasks-table.ts). example-bind.ts is the shared
                       element that mirrors kit events into the playground's
                       and rtl's server markup
    ui/queries/registry.server.ts  composes the registry JSON on demand from
                       packages/ui/packages/registry/ (the source of truth).
                       This is what /ui/registry/** serves.
    ui/queries/blocks.server.ts  the blocks per category and one block's
                       files at their install targets, with imports rewritten
                       the way `add` writes them (the viewer's Code view)
    ui/queries/render-block.server.ts  renders a block's page for /ui/view,
                       behind a name allowlist, like render-demo.server.ts
    ui/blocks/         GITIGNORED mirror of the registry blocks, written by
                       scripts/copy-registry.mjs with each import that leaves
                       the block pointed at the site's kit mirror, so a block
                       shares the one kit instance the rest of /ui uses. It
                       also writes elements.ts, a barrel importing every block
                       file that registers a custom element
    ui/utils/          tier classification (the /ui/docs introduction's counts)
                       and the registry route headers
    ui/typeset/        the typeset builder (#1666): params.ts (shadcn's params,
                       parse / serialize / shuffle, pure so the element shares
                       it), fonts.ts (the faces, which scripts/fetch-fonts.mjs
                       also reads), docs.ts (the Docs and Prompt text, true for
                       a WebJs app), the customizer / preview-frame /
                       docs-panel fragments, icons.ts, and fixtures/ (shadcn's
                       five specimens, behind a .server.ts index so the
                       preview page ships no script)
    ui/colors/         palette-data.ts (shadcn's Tailwind palette data, copied
                       from its registry/_legacy-colors.ts) and colors.ts
                       (getColors: every shade in every format, plus the text
                       colour that reads on it)
    ui/sera/           the /ui/sera preview screens, one module each
                       (audience-analytics, article-directory, empty-state,
                       edit-article, media-library, media-library-table, and
                       the media library's data), ported from shadcn's
                       app/(app)/(styles)/sera as server markup
    ui/init/           preset-request.ts (a query string to a validated preset
                       config, shadcn's parse-config) and instructions.ts (the
                       /ui/init/md markdown)
    ui/create/         the configurator (#1666): params.ts (the state, parse /
                       normalize / href / curated shuffle, pure so the element
                       shares it), design-system.ts (a choice as the
                       preview's CSS custom properties, the menu-color rule,
                       the theme tokens), project.ts (the Get Code commands,
                       mapped truthfully onto `create-webjs` plus
                       `@webjsdev/ui init --preset`), the customizer /
                       preview-frame (with the item explorer) / project-form /
                       open-preset / welcome-dialog fragments, and
                       placeholder.ts (the stand-in preview)
    ui/queries/github-stars.server.ts
                       the action the /ui chrome layout awaits for the star
                       count, over lib/github-stars.server.ts
    ui/queries/create-items.server.ts
                       what the item explorer lists: the registry's blocks
                       (shadcn drops numbered names) and every component with
                       a `<name>-demo`
    ui/design-system/  GITIGNORED mirror of the kit's design-system data
                       (packages/ui/packages/registry/themes/{base-colors,
                       themes,fonts,preset}.js), written by copy-registry.mjs,
                       so the configurator runs the same theme builder and
                       preset code in the browser as `init --preset` runs
  scripts/             manual dev tools, NOT part of build/deploy
    fetch-fonts.mjs    download the self-hosted woff2 fonts with next/font's
                       user agent, so the /ui faces are the files
                       ui.shadcn.com serves (test/ssr/ui-fonts.test.ts pins
                       their hashes; the site's Geist Mono is weight 400
                       alone, as shadcn's is, and the variable one is
                       'Geist Mono' for the previews). The
                       typeset faces are declared in public/typeset-fonts.css,
                       linked only by the typeset pages, and the Sera page's
                       Playfair Display in public/sera-fonts.css, linked only
                       by /ui/sera; the configurator's EB Garamond and
                       Instrument Serif in public/create-fonts.css, linked only
                       by its preview frame, app/ui/preview/[name])
    generate-og.mjs    regenerate the OG social card (needs playwright + ImageMagick)
    audit-390.mjs audit-390-overlays.mjs
                       the phone-width audit against a local shadcn/ui site:
                       each page pair at 390x844 in light and dark, full-page
                       shots plus what sticks out past the screen, and the
                       overlay docs pages with their lead demo open
    shoot-home-cards.mjs
                       regenerate public/images/home-cards-{light,dark}.png,
                       the /ui home page's card grid as it shows below md,
                       from a running site (needs playwright)
    shoot-example-images.mjs
                       regenerate public/images/examples/<name>-{light,dark}.png,
                       the pictures the /ui example pages show below md in
                       place of the example, as shadcn's do (sizes in
                       modules/ui/example-apps/images.ts; needs playwright)
    shoot-block-images.mjs
                       regenerate public/images/blocks/<name>-{light,dark}.png,
                       each listed block's /ui/view frame at shadcn's 1440 by
                       900, the picture the block viewer shows below lg
                       (needs playwright and ImageMagick). A new block needs a
                       run, which test/ssr/ui-blocks.test.ts enforces
    copy-registry.mjs  mirror the kit sources into modules/ui/components/ +
                       lib/utils/{cn,dom}.ts, and the registry blocks into
                       modules/ui/blocks/.
                       Runs via webjs.dev.before / webjs.start.before and is
                       baked into the deploy image (#526), so a component page
                       never boots without its imports. It also writes the
                       scoped kit styles and the theme classes (below)
    build-ui-themes.mjs
                       the .theme-<name> classes for shadcn's 24 themes, from
                       the kit's themes.js, into
                       node_modules/.cache/ui-styles/themes.css (run by
                       copy-registry.mjs, imported by public/ui-input.css)
  public/              favicon, og image, self-hosted fonts, static assets
    sera-fonts.css     the /ui/sera faces (Noto Sans, Playfair Display), linked
                       only by that page
    images/            sera-0{1,2,3,6}-{light,dark}.png, shadcn's Sera
                       screenshots, which /ui/sera shows below md, and
                       home-cards-{light,dark}.png, the /ui home grid's
                       picture for the same width; blocks/ holds the block
                       screenshots (scripts/shoot-block-images.mjs)
```

## How lib/ grows

The scaffold starts flat (a lone `lib/utils/ui.ts` and nothing else), and this
site follows the same rule it grew by: a file stays loose at `lib/*.ts` while
it is a standalone app-wide value, and a SUBSYSTEM gets its own `lib/<name>/`
folder once it reaches about three related files. The design system
(`lib/design/`) and the composed page fragments (`lib/ui/`) both crossed that
bar; `links.ts` and `samples.ts` have not, so they stay loose. Fragments in
`lib/ui/` are one file per fragment for the same reason the framework keeps
one action per file: the filename is the index. This is the app-wide fragment
tier at its grown-up size; the skill's `references/styling.md` names all three
sizes (`modules/<feature>/utils/ui/` for one feature, `lib/utils/ui.ts` for
app-wide helpers, `lib/ui/` for a subsystem like this one). An app with a
handful of small helpers is right to keep them in `lib/utils/ui.ts` instead;
this site split because its fragments compose.

The site is intentionally one page in long-form scroll. When you edit
copy, find the section in `app/page.ts` (search for the visible text
that needs to change) and update inline.

## How to add a feature card

The features grid is driven by the `PILLARS` array near the top of
`app/page.ts`. Each entry is `{ icon, title, desc }`, where `icon` is a
key into the local `ICON` map (for example `ICON.bolt`). Add a new entry
in the correct order and the grid reflows automatically. If no existing
icon fits, add one to the `ICON` map first.

## SEO surfaces (articles, blog, comparisons, structured data)

The site targets real search keywords ("web components framework", "no
build javascript framework", and so on) and "WebJs vs X" queries. Content
is split by editorial intent, which is what decides where a piece goes:

- **`/articles`** is evergreen, keyword-targeted explainers on the web
  platform ("what a web components framework is", "run TypeScript with no
  build step"). Timeless reference, presented WITHOUT dates. An article is
  an `articles/<slug>.md` file. Only write one for a term with real search
  demand where WebJs is a legitimate answer (validate the query first; a
  coined phrase nobody searches does not belong here). Articles carry a
  `## FAQ` (SEO landing pages, like `/compare`).
- **`/blog`** is dated WebJs design notes ("the decisions, the trade-offs,
  the things that did not work"). A `blog/<slug>.md` post, FAQ-free, in
  the author's first-person voice. A general web-platform explainer does
  NOT belong here (that is why the split exists); it goes in `/articles`.
- **`/compare`** is "WebJs vs <framework>" head-to-heads (`compare/<slug>.md`).
- Do NOT let two pages chase the same exact keyword (cannibalization);
  an article owns the general term, a blog post owns the WebJs-specific angle.
- **FAQ convention.** End an article or comparison body with a `## FAQ`
  section, each question a `### <question>` heading followed by its answer
  paragraph. `lib/utils/faq.ts` (`parseFaq`) turns that into a `FAQPage` JSON-LD
  block. The FAQ is BOTH rendered (normal markdown) and emitted as schema,
  so the two never drift (Google discounts FAQ schema that is not visible
  on the page). Blog posts do NOT use FAQ.
- **JSON-LD** is set via `metadata.jsonLd` (the framework emits a
  `<script type="application/ld+json">`): `TechArticle` + `BreadcrumbList`
  + `FAQPage` on articles and comparisons, `BlogPosting` + `BreadcrumbList`
  on blog posts, and `WebSite` + `Organization` + `SoftwareApplication` on
  the home page (jsonLd-only `export const metadata`, so it does not split
  the layout-sourced title). Article schemas carry an `image`. Keep the
  schema honest: it must match the visible page content.
- **Entity nodes carry an `@id` and share one `sameAs`.** Several nodes name
  the project with the same `name` and `url`, so each declares an `@id`
  (`#website`, `#organization`, `#software`) or a crawler cannot tell one
  entity described several ways from several entities. The
  `SoftwareApplication` on `/what-is-webjs` reuses `#software` deliberately,
  so its richer description merges into the home node. Every node that
  identifies the project reads the shared `SAME_AS` export from
  `lib/links.ts` rather than listing properties inline, and
  `test/docs/site-entity-graph.test.mjs` fails if a new one does neither.
- **`/robots.txt`, `/sitemap.xml`, `/llms.txt`** are generated from the
  live content queries, so a new article, comparison, or post needs no
  edit to those files.

## Two sections, two chromes

The site has two sections with different headers and footers: the marketing
site and the component library under `/ui` (#1666). The chrome therefore
belongs to a SECTION layout, never to `app/layout.ts`:

- `app/(site)/layout.ts` owns the marketing chrome.
- `app/ui/(chrome)/layout.ts` owns the `/ui` chrome. Its parent,
  `app/ui/layout.ts`, stays minimal (the `.ui-site` tokens and the stylesheet
  link), because the bare iframe targets under `/ui/view` and `/ui/preview`
  render inside it too and must show no chrome.

Do not make the root layout branch on the pathname instead. On a GET soft
navigation the client sends `X-Webjs-Have`, the server short-circuits at the
shared root boundary and never calls the root layout again, so a visitor going
from `/` to `/ui` would keep the marketing header. A group layout sits INSIDE
the root's children range, which is the range a navigation between the two
sections replaces, so the chrome swaps with no full page load. That is also why
the root layout must keep rendering `${children}` with nothing around it.

`/ui` also has its own stylesheet, `public/ui.css`, built from
`public/ui-input.css` (`npm run css:build:ui`, and in `webjs.dev.before`,
`webjs.dev.regenerate`, `webjs.start.before` and the Dockerfile). It carries
no kit style. All nine compile one file each into
`public/ui-styles/<name>.css` (`scripts/build-ui-styles.mjs`, run by the same
four hooks), and a page links only the styles its `.style-<name>` wrappers
name, listed once in `lib/ui/style-links.ts`: new-york for the chrome and the
block frames, nova where a docs preview renders, and so on. A style sheet is
about 300 KB of rules, many of them `:has()`, so linking one a page does not
render slows every style recalculation on it.
`test/ssr/ui-style-links.test.ts` renders every `/ui` page and frame and
fails when a wrapper's sheet is not linked. `ui.css` also carries shadcn's 24 themes as
`.ui-site .theme-<name>` classes in `light-dark()` form, so a region wearing
`theme-blue` repaints the way it does on shadcn's site; they are generated from
the kit's own theme data (`scripts/build-ui-themes.mjs`), so the site and
`init --preset` cannot disagree. The `dark` and `not-dark` variants and the theme
mapping live in `public/ui-theme.css`, which both builds import ahead of the
styles, since a style's `@apply` can use a variant only once it exists. Each
region names its own `.style-<name>` wrapper (`.ui-site` carries none). The
builds compile each style as an `@scope` block that stops at any nested style
wrapper (`scripts/scope-ui-styles.mjs`, run by `copy-registry.mjs` and by
`build-ui-styles.mjs`, writing to `node_modules/.cache/ui-styles/scoped/`), so
the NEAREST wrapper wins: a nova demo inside the new-york docs chrome takes
only nova, the way shadcn's baked imports do. The registry's style files stay
byte-for-byte shadcn's, since the CLI bake reads them. `ui.css` holds the
`/ui` tokens on `.ui-site` and the utilities `/ui` code uses, and it stands
ALONE: a `/ui` path loads `ui.css` and no `tailwind.css`, so `ui.css` imports
Tailwind's preflight itself (declaring the same layer order
`@import "tailwindcss"` does) and the rules both sheets need come from
`public/shared-base.css`, which both inputs import. Loading both used to match
every shared utility and `:has()` rule twice, which made a menu open slow. So
the root layout links NEITHER: `app/(site)/layout.ts` links `tailwind.css` and
`app/ui/layout.ts` links `ui.css`, each as the first thing it renders. The
framework moves a stylesheet link that leads a layout's or page's output into
`<head>` and switches it off when a soft navigation leaves that layout
(#1669), so a crossing between the sections swaps one sheet for the other. A
`/ui` path that 404s or throws renders `app/ui/not-found.ts`
or `app/ui/error.ts`, in `/ui` classes, since the root boundaries are styled
by `tailwind.css`. The fonts the configurator and typeset frames name
(Inter and JetBrains Mono among them) are declared in
`public/typeset-fonts.css`, not borrowed from `tailwind.css`. Each `/ui` page
and frame links the kit styles `lib/ui/style-links.ts` lists as the first
thing in its own markup (new-york, which `app/ui/(chrome)/layout.ts` also
links for its own header, nova on the docs pages, rhea on the AI Elements
pages, luma on blocks and charts), so each is moved into `<head>` and dropped
when it repeats a file already linked. A link that does not lead its template
stays in `<body>`, where it is not reliably render-blocking (#406). The router
loads a stylesheet the incoming page brings before it swaps the page in
(#1666), so a soft navigation paints styled on its first frame. The links that commonly cross sections (the marketing header and footer
UI links, the docs sidebar link, the `/ui` links back in the menu drawer
and the footer) also carry
`data-no-router`, so the usual path is a full load. Both stylesheets declare
the same `dark:` variant on `data-theme`, so a theme choice holds across the
two sections. `test/e2e/ui-chrome-swap.test.mjs` proves the swap in a browser.

Anything that reads a marketing route from the filesystem names the group
folder: `lib/docs-llms.server.ts` walks `app/(site)/docs`, and the tests import
`#app/(site)/...`. A test asserting on chrome renders both layouts through
`test/helpers/site-shell.ts`.

## Header

`app/(site)/layout.ts` renders the marketing header. It is
`position: fixed`, NOT sticky: a sticky header flickers on iOS WebKit during
a client-router navigation (#610), so the height is reserved on the content
through the `--header-h` token on `:root`. The header is sized BY that token
(`.site-top > header { height: var(--header-h) }`) and nothing measures it: a
measuring script read 0 from a detached header after a full-body swap and
slid the content under the bar (#1660). The root layout sets the marketing
value (61px) and `html { scroll-padding-top: var(--header-h) }`, so an
`#anchor` jump stops below the bar. The `/ui` header
(`app/ui/(chrome)/layout.ts`) is fixed the same way; `public/ui-input.css`
sets `--header-h` to its height (shadcn's `--header-height`, 3.5rem, 4rem
from 64rem) on any page that has it.

There is no announcement banner. One used to sit above the header, and
`--header-h` is why its removal is not free: re-adding a strip means adding
its height to the token.

The header's mobile menu is `components/site-nav-menu.ts` (on /ui, its
subclass `components/ui-mobile-nav.ts`), and the fixed
position is why it carries
`border-right: var(--wj-scrollbar-compensation, 0px) solid transparent`. A
scroll lock hides the page scrollbar, which widens the viewport, and a fixed
element lays out against the initial containing block where no padding can
reach it. `lib/scroll-lock.ts` publishes that measured width for it to opt into
(#1144, #1147).

## What stays inline script in the layouts

Only one thing, and it is genuinely boot work rather than interactivity: the
**theme bootstrap**, in the root layout's head, which must run before first
paint or a reader who chose dark sees the light palette flash. It cannot
import, so it interpolates the storage key from `lib/theme.ts`. The header
height used to be measured by an inline script too; it is a CSS token now
(see Header above).

Everything else that used to live there is a component now. The drawer and the
header menu were once one delegated click listener plus one delegated keydown
listener reaching across the document with `querySelector` and body attributes,
with the markup in a different file. If you find yourself adding a third
delegated listener here, write a component instead.

TWO cross-component contracts run between the drawer and the header menu, and
both are easy to break by accident.

**The first is priority.** The drawer listens for Escape in the CAPTURE phase
and calls `preventDefault()`, and the header menu listens in the BUBBLE phase
and bails on `defaultPrevented`. That is what makes one Escape close only the drawer when
both are open, without either component importing the other, and it holds
whatever order the elements registered in.

It holds at the TARGET too. The dispatch algorithm walks the propagation path
twice, invoking each node once per traversal and honouring the capture flag on
both, so a capture listener on `document` runs before a bubble listener on
`document` even for an event dispatched directly at `document` and even when the
bubble one registered first. Measured in Chromium: registering bubble then
capture and dispatching on `document` yields `capture, bubble`.

What a test DOES have to get right is `cancelable: true`. `preventDefault()` on a
non-cancelable event is a silent no-op, so `defaultPrevented` stays false and
both surfaces close. Dispatching from inside the tree rather than at `document`
is worth doing for realism, but it is not what makes the priority work.

**The second is deferral, and it does NOT run through `defaultPrevented`.** When
an Escape belongs to the field the reader is editing (a non-empty, mutable
`input[type=search]`, the only field Escape natively clears), every open surface
must decline it, and each one decides that by calling the same
`escapeBelongsToField` from `lib/escape-target.ts`. Two rules follow from that
and neither is obvious:

- The drawer must **not** call `preventDefault()` on the deferral path. It is
  the natural way to tell the menu "this press is taken", and it is wrong,
  because suppressing the default cancels the native clear the deferral exists
  to protect. Agreement comes from both surfaces applying the same rule, not
  from a flag on the event.
- The rule is intentionally document-wide rather than scoped to the surface that
  contains the field, because a field inside ONE surface must also stop the
  OTHER dismissing, and a containment test in the other surface answers false
  for exactly that case.

Both surfaces also close on `popstate` and `webjs:before-cache`, not only on
`webjs:navigate`. A back or forward that hits the router's snapshot cache
applies the swap and returns before `webjs:navigate` is dispatched, so popstate
is the only timely signal there, and `webjs:before-cache` strips the open state
before the snapshot is serialized so a forward restore does not bring the
surface back open.

`webjs:before-cache` carries a timing trap worth knowing. The router dispatches
it synchronously and reads `documentElement.outerHTML` in the same task, a
couple of statements later with no await in between, so ONLY a synchronous
mutation is captured. Setting a reactive property is not enough on its own,
because the host attribute reflects at once while EVERY template hole is a
render-time write committed a microtask later and misses the snapshot.

Both surfaces therefore write their child state directly in the handler. The
menu closes its `<details>` element, which is what shows the panel and drives
the icon swap. The drawer writes `aria-expanded` on its toggle, which is not
visual (its CSS selects the reflected host attribute, so a restored page looks
right) but would otherwise announce an expanded drawer that is closed. If you
add a hole that encodes dismissible state, it belongs in that handler too.

## How to update headline / hero copy

`app/page.ts`: the hero block is at the top of the default-exported
function. Edit the inline `<h1>` / `<p>` text.

## SSR action seeding is OFF for this app

`package.json` sets `"webjs": { "seed": false }`. Seeding (#472) serializes
every `'use server'` result invoked during SSR into the page so a shipping
async component can skip its refetch on hydration. Nothing here consumes that:
no component on this site does an async render or calls an action, and a page
function never re-runs in the browser, so the payload was pure page weight.

It was not small. Before turning it off, `/changelog` carried 304KB of seed in
a 1.1MB response and `/ui/dropdown-menu` 35KB in 141KB, roughly a quarter of
each page, duplicating content already in the visible HTML.

If you add a component here that genuinely wants seeding (an async render
calling an action), re-enable it and delete the assertion in
`test/ssr/ui-gallery.test.ts` that pins this off.

## Style

- Light DOM, Tailwind utilities, `@theme` tokens from the root layout
  (same palette / type scale as the blog and docs).
- **Each per-theme colour is declared ONCE, as `light-dark(LIGHT, DARK)`**,
  and the three `color-scheme` declarations in `app/layout.ts` pick the side
  (the default follows the OS; the toggle's `[data-theme]` forces one). This
  is the rule the framework teaches its own users, in the skill at
  `.agents/skills/webjs/references/styling.md`. A token that is NOT a colour
  (`--glow-strength`, `--cta-mix`, `--shadow-spread`) cannot ride
  `light-dark()`, so it keeps an explicit override pair: the OS media query
  plus the attribute rule. Nothing else may. Pinned by
  `test/ssr/design-tokens.test.ts` and `test/ssr/kit-surfaces.test.ts`.
- Each section in `page.ts` is a `<section>` wrapper for predictable
  scroll anchors.
- **A code sample under `/docs` or `/ui` is a `<code-block>`, never a bare
  `<pre>`.** `components/code-block.ts` renders the `<pre>` and colours the
  code. Write `<code-block>your code</code-block>` and pass nothing else;
  `label` (which also adds `role="region"`) and `pre-class` exist for the rare
  block that needs them. A bare `<pre>` there loses both the highlighting and
  the focus stop, silently, which is how the site ended up with 480 of them.
  A marketing page holds its samples as JS strings instead, so it writes its
  own `<pre>` around `highlight(SAMPLE)` and colours them at SSR, and it is
  then responsible for the accessibility rules below on its own. Pick by where
  the sample lives: inline template text is a `<code-block>`, a string is a
  `highlight()` call.
- **Code blocks follow three accessibility rules**, and the element is how the
  first two are satisfied without anyone remembering them. A named block takes
  `role="region"`, because ARIA prohibits an author-supplied name on the
  `generic` role a `<pre>` maps to; no two blocks on a page share a name,
  because a named region is a landmark; and a block that can scroll takes
  `tabindex="0"`, because a scroll container no keyboard can reach is unusable
  without a pointer. `test/ssr/pre-block-a11y.test.ts` enforces all three
  across the marketing pages, the error boundary, the markdown post body
  (shared by `/blog/[slug]`, `/articles/[slug]`, and `/compare/[slug]`), every
  page under `app/docs/` and `app/ui/`, and every /ui component docs page. It
  does not keep a list: the section pages are DISCOVERED from the file system
  and the component pages come from the same component records the /ui docs
  sidebar is built from, so a page or a component added tomorrow is covered. It reads
  scrollability from the rendered document, not from the tag, since a docs
  block scrolls because of `.prose-docs pre { overflow-x: auto }` in
  `lib/ui/docs-shell.ts` and nothing on the tag records that.
- **One tokenizer, in `lib/utils/highlight.ts`.** The marketing pages and the
  blog markdown renderer call it at SSR; `<code-block>` calls the same
  `tokenize()` in the browser, because the docs samples are authored as inline
  template text with `&lt;` and `&#123;` escapes and so give the server no
  string to tokenize. There used to be a second ES5 copy served out of
  `public/`, kept in sync by hand, and it drifted. Do not add another.
- **Container tags must balance in every source file that authors markup.**
  `test/repo-health/site-pages-well-formed.test.mjs` counts opens against
  closes for `<pre>`, `<code-block>`, `<div>`, `<ul>`, `<ol>`, and `<table>`
  across all of `website/`, not just `app/docs/`, so the shared chrome under
  `lib/ui/`, `components/`, and `lib/design/` is covered too (every page
  renders through it). The generated mirrors under `modules/ui/components/`
  and `components/ui/`, plus `test/` and `scripts/`, are deliberately outside
  it. An unbalanced container swallows the client router's
  `<!--/wj:children-->` marker into the unclosed tag, and the next navigation
  throws `NotFoundError` from `insertBefore`.

## Run

```sh
cd website && npm run dev       # http://localhost:5001
cd website && npm run typecheck # tsc --noEmit, the same gate CI runs
```

`npm run typecheck` mirrors the kit sources in before it runs `webjs typecheck`,
because the mirror is gitignored and without it `tsc` reports 45 errors that
have nothing to do with your change (17 unresolved-module, 19 implicit-any, 9
side-effect-import) and bury any real one. The CI `apps` job runs the same
script, so a type break reds the build instead of riding onto `main` unnoticed
(#1260).

What it covers is exactly the tsconfig `include`: `app/`, `components/`,
`lib/`, `modules/`, and **`test/`** (#1299). A type error in a test file is a
gate failure here, not something a reviewer has to catch by eye, which is how
an implicitly-`any` parameter once reached review in `test/ssr/docs-links.test.ts`.

Two things about the test half are worth knowing before you edit it.

The `.js` files under `test/` enter the include **parsed but not checked**,
because this app sets `checkJs: false`. There are 9 of them: the 8 browser
tests under `test/components/browser/`, plus the `test/fixtures/` markup
fixture. That is the status quo for every other `.js` file here, so including
`test/` did not widen into them. The rationale lives in this file rather than in the config, because
`tsconfig.json` is strict JSON that the scaffold emits with `JSON.stringify`
and the scaffold tests read back with `JSON.parse`, so it cannot carry a
comment at all.

And a test that renders the root layout calls `RootLayout(layoutProps(children))`,
not `RootLayout({ children })`. `LayoutProps` requires `params`,
`searchParams`, and `url` because the server really does pass all four, so
`test/helpers/layout-props.ts` builds a complete props object. Do not reach for
the other fix and make those fields optional on the public type: a layout that
forgets to accept them would stop being an error for every WebJs app.

Both in-repo apps are gated. `examples/blog` has its own `npm run typecheck`
and its own CI step alongside this one.

`npm run dev` and `webjs dev` behave identically (#550): `webjs.dev.before`
mirrors the kit sources in and compiles `public/tailwind.css`, and
`webjs.dev.regenerate` (#967) re-runs both on request when a source changes, so
neither the mirror nor the stylesheet goes stale without a live watcher. The
mirror has to be refreshed as part of that command rather than only in
`before`, because the generated sources are a scanned `@source`: recompiling
the stylesheet against a stale mirror silently omits the utility classes the
/ui previews need. In prod, `npm start` and `webjs start` are equivalent
too, via `webjs.start.before`.

Every nav entry is an in-app route and needs no env var: Blog, Changelog, Docs, and the UI gallery. (Docs and the gallery used to
need one each. They were separate `docs.webjs.dev` and `ui.webjs.dev` apps
until #1098 and #1099 moved them here under `app/docs/` and `app/ui/`, so
`DOCS_URL` and `UI_URL` are both gone.)

---

Framework-wide rules and full API reference:

@../AGENTS.md
