# Production image for the {{APP_NAME}} webjs app.
#
# Works with a plain `docker build` / `docker compose up`, and is the same
# artifact the webdeploy hosting tool (ubicloud + uncloud) builds and ships.
#
# webjs serves .ts directly by stripping types at the runtime layer, so there is
# NO JavaScript build step (webjs is buildless end to end; there is no bundler or
# esbuild fallback). This image runs the app on **Node 24+**, where the strip is
# the built-in `module.stripTypeScriptTypes`. webjs ALSO runs on **Bun** (where
# the strip comes from `amaro` automatically), so you can swap this base for an
# `oven/bun` image and start the app with `bun --bun run start`. Do not lower the
# Node base below 24 (the floor the CI workflow and the framework pin enforce),
# since the built-in stripper and recursive fs.watch need it.
#
# Security headers are set by the framework, not the proxy. webjs emits
# X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and
# Permissions-Policy on every response, plus Strict-Transport-Security in
# production over HTTPS (detected from X-Forwarded-Proto on the trusted
# edge). So the baseline needs no reverse-proxy config. Override or extend
# per path with package.json "webjs": { "headers": [...] }. See the
# framework AGENTS.md "Secure response headers" section.
FROM node:24-alpine

# ca-certificates for outbound TLS (e.g. a managed Postgres). SQLite uses the
# built-in node:sqlite (no native module, no build toolchain needed).
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Install deps first so this layer is cached unless the manifests change.
# package-lock.json is optional (it's absent when the app was scaffolded with
# --no-install); the glob keeps the COPY working with or without it.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# App source. node_modules and local state are excluded via .dockerignore.
COPY . .

# Drizzle has no client-codegen step, so there is nothing to build here. The
# database is migrated at boot via `webjs start` (the `webjs.start.before`
# step runs `webjs db migrate`). See the CMD note below.

ENV NODE_ENV=production
# webjs start reads $PORT (default 8080). compose / uncloud / Railway set it.
ENV PORT=8080
EXPOSE 8080

# Platform-neutral readiness gate. webjs answers /__webjs/ready with 503 until
# the instance is fully warm (analysis + first vendor attempt), then 200. This
# HEALTHCHECK is honoured by Docker, compose, and most Docker-based platforms,
# so the gate works the same everywhere instead of needing a per-platform file.
# The probe is dependency-free (Node 24's built-in fetch, no curl/wget). For
# platforms that read their own config, point the equivalent knob at the same
# path (Railway healthcheckPath, Render healthCheckPath, Fly [checks], k8s
# readinessProbe); see AGENTS.md "Health and readiness probes".
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/__webjs/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# `npm start` is a thin alias for `webjs start` (#550). `webjs start` runs the
# `webjs.start.before` step (`webjs db migrate`, idempotent / a no-op with no
# pending migrations) IN-PROCESS, then serves on $PORT. `CMD ["webjs", "start"]`
# is now equivalent: the migrate no longer depends on an npm `prestart` hook.
CMD ["npm", "start"]
