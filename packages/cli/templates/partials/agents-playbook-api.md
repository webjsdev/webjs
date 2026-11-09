## Build a backend API (api template)

This template has NO UI: no layout, no pages, no components, no CSS. It ships a
backend-features showcase under `app/api/features/` (the `route()` adapter,
input validation, rate limiting), with logic in `modules/`. Build in this order.

1. **Study the showcase, then clear it.** Read the endpoints under
   `app/api/features/`, then run `npm run gallery:clear` to reset to a clean
   base.
2. **Model the data.** Define real models in `db/schema.server.ts`, run
   `npm run db:generate` and `npm run db:migrate`, then write
   `db/seed.server.ts` and run `npm run db:seed`. Reads go in
   `modules/<feature>/queries/*.server.ts`, writes in
   `modules/<feature>/actions/*.server.ts`, one function per file.
3. **Build endpoints.** A `route.ts` exports `GET` / `POST` / `PUT` / `PATCH` /
   `DELETE` handlers, each `(request, { params })` returning a `Response` or a
   plain value (which is sent as JSON). The `route()` adapter from
   `@webjsdev/server` publishes a `'use server'` action as REST.
4. **Secure every endpoint.** A `route.ts` handler gets no CSRF check and no
   error sanitizing, so authenticate every mutating endpoint, validate its
   input, rate-limit it, and log without secrets. For cross-origin access use
   `cors()` from `@webjsdev/server`, with an explicit origin allowlist whenever
   `credentials: true`.
5. **Verify.** `npm run ci` runs every gate in `package.json` `webjs.ci`
   (check, doctor, typecheck, audit, then the test layers), the same list the
   GitHub workflow runs. Boot `npm run dev` and run
   `npx webjs status /api/your-route` after each edit.

### Commands

```sh
npm install
npm run gallery:clear   # shed the backend-features showcase before building
npm run dev             # dev server at http://localhost:8080
npm run start           # production server
npm test                # unit + browser tests
npm run typecheck
npm run ci              # every gate, one command (the webjs.ci steps in package.json)
npm run check           # correctness checks
npm run doctor          # project health (severity per check: webjs.doctor.gate)
npm run db:generate && npm run db:migrate
```
