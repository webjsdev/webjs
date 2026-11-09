## Build a full-stack app (default template)

This scaffold ships a browsable feature gallery: single-concept demos under
`app/features/`, the `app/examples/todo` app, and an example design system
under `modules/gallery/ui/`, with logic in `modules/`. Build in this order.

1. **Study the gallery, then clear it.** Read the demos that match what you
   are building, then run `npm run gallery:clear`. It removes the gallery, the
   demo `todos` table and its migrations, and resets `app/page.ts` and
   `app/layout.ts` to a blank slate. It keeps the database wiring, the theme in
   `styles/globals.css`, `components/ui/`, and `lib/utils/cn.ts`.
2. **Model the data.** Define real models in `db/schema.server.ts`, run
   `npm run db:generate` and `npm run db:migrate`, then write
   `db/seed.server.ts` and run `npm run db:seed`. Reads go in
   `modules/<feature>/queries/*.server.ts`, writes in
   `modules/<feature>/actions/*.server.ts`, one function per file.
3. **Theme with tokens.** Colors are CSS custom properties (`--background`,
   `--foreground`, `--primary`, `--muted`, `--border` and friends) consumed as
   token utilities (`bg-background`, `text-muted-foreground`), never raw
   Tailwind colors like `red-500`. `npx webjsdev ui init --preset <code>` swaps
   the theme block.
4. **Use the UI kit.** `npx webjsdev ui add <name>` copies a primitive into
   `components/ui/`, which you then own. Read the copied file or run
   `npx webjsdev ui view <name>` for its exact helpers and tags.
5. **Build real routes.** A home page, a list page per resource, a
   `[id]` detail page, and a navbar in `app/layout.ts` pinned with
   `position: fixed` (not `sticky`, which flickers on iOS during a client
   navigation).
6. **Put interactivity in components.** Pages and layouts render on the server
   only, so every click handler and piece of client state lives in a
   `WebComponent`.
7. **Verify.** `npm run ci` runs every gate in `package.json` `webjs.ci`
   (check, doctor, typecheck, audit, then the test layers), the same list the
   GitHub workflow runs. Boot `npm run dev`, run
   `npx webjs status /a-route /another` after each edit, and open every changed
   route in a real browser, since `check` passes even when a layout collapses.

### Commands

```sh
npm install
npm run gallery:clear        # shed the demo gallery before building a real app
npm run dev                  # dev server at http://localhost:8080
npm run start                # production server
npm test                     # unit + browser tests
npm run typecheck
npx webjs regenerate         # compile Tailwind when stale, recording the build
npm run ci                   # every gate, one command (the webjs.ci steps in package.json)
npm run check                # correctness checks
npm run doctor               # project health (severity per check: webjs.doctor.gate)
npx webjsdev ui add <name>   # copy a ui primitive into components/ui/
npx webjsdev ui view <name>  # inspect a primitive's exact signature
npm run db:generate && npm run db:migrate
```
