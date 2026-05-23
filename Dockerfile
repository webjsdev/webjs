# Single image for the whole monorepo. Each Railway service runs the
# same image with a different start command. Locally:
# `docker compose up --build` runs all three via compose.yaml.
#
# No build step for JS. webjs serves .ts directly via Node's built-in
# `module.stripTypeScriptTypes` (position-preserving whitespace
# replacement, no sourcemap shipped to the browser).
#
# **Node 24+ is REQUIRED** for that path. On Node 22, the runtime falls
# back to esbuild for every .ts file. esbuild's class-declaration
# transformation has been observed to break webjs's SSR walker for
# multi-class component files: Tier-2 components (dialog, tooltip,
# dropdown-menu, etc.) all rendered with the wrong shell because the
# first class's render() was being invoked for every sub-tag. Pinning
# Node 24 here pairs with the AGENTS.md "Node 24+ required" invariant.
#
# Tailwind CSS IS built at image time (CLI, no browser runtime). The
# blog runs `prisma generate` at build and `prisma migrate deploy` at
# start.
FROM node:26-alpine

# openssl is required by Prisma's query engine at runtime.
RUN apk add --no-cache openssl ca-certificates

WORKDIR /app

# --- 1. Install deps (layer cached on manifest changes only) ------------
# Copy every workspace manifest before source so dep changes don't bust
# the source layer and vice versa.
COPY package.json package-lock.json ./
COPY packages/cli/package.json                       ./packages/cli/
COPY packages/core/package.json                      ./packages/core/
COPY packages/server/package.json                    ./packages/server/
COPY packages/ts-plugin/package.json                 ./packages/ts-plugin/
COPY packages/ui/package.json                        ./packages/ui/
COPY packages/ui/packages/registry/package.json      ./packages/ui/packages/registry/
COPY packages/ui/packages/website/package.json       ./packages/ui/packages/website/
COPY examples/blog/package.json                      ./examples/blog/
COPY website/package.json                            ./website/
COPY docs/package.json                               ./docs/

# Copy the CLI's bin/ before install so npm can symlink it into
# /app/node_modules/.bin/webjs. Without this, the bin target doesn't
# exist at install time and npm silently skips the symlink - then
# `npm start` inside any workspace fails with `sh: webjs: not found`.
COPY packages/cli/bin                     ./packages/cli/bin

RUN npm install --no-audit --no-fund

# --- 2. Copy source -----------------------------------------------------
COPY packages  ./packages
COPY examples  ./examples
COPY website   ./website
COPY docs      ./docs
# website/app/changelog/page.ts reads ../../../changelog/<pkg>/*.md at
# SSR time. Without copying the changelog tree into the image, the
# deployed page renders "No entries yet."
COPY changelog ./changelog
# website/app/blog/[slug]/page.ts reads ../../../../blog/<slug>.md at
# SSR time (via modules/blog/queries/list-posts.server.ts). Same
# reason as changelog: without the tree in the image, /blog renders
# "No posts yet."
COPY blog ./blog

# --- 3. Build-time work --------------------------------------------------
# Blog: generate Prisma client (needs schema.prisma in context).
RUN cd examples/blog && npx prisma generate

# UI registry: no build step. The ui-website composes registry JSON on
# demand from packages/ui/packages/registry/ sources via its route handlers
# (see packages/ui/packages/website/app/_lib/registry.server.ts).

# Tailwind: compile per-app CSS (all four use the CLI, no browser runtime).
# Each compose service's command invokes `webjs.js start` directly, which
# bypasses the per-package `prestart: css:build` hook in npm; the CSS has
# to be ready in the image. Keep this list in sync with the apps that
# have a public/input.css and a `css:build` script in their package.json.
RUN npx tailwindcss -i website/public/input.css                       -o website/public/tailwind.css                       --minify \
 && npx tailwindcss -i docs/public/input.css                          -o docs/public/tailwind.css                          --minify \
 && npx tailwindcss -i examples/blog/public/input.css                 -o examples/blog/public/tailwind.css                 --minify \
 && npx tailwindcss -i packages/ui/packages/website/public/input.css  -o packages/ui/packages/website/public/tailwind.css  --minify

# Pre-populate each app's vendor/javascript/ with esm.sh bundles for
# every bare-specifier npm dep used. After this, the production server
# has zero CDN dependency at runtime: every browser request for
# /__webjs/vendor/<pkg>@<version>.js is served from the local disk
# cache baked into the image. Mirrors Rails 7 + importmap-rails's
# `bin/importmap pin` step.
#
# Note: this Dockerfile step is BACKUP coverage. The recommended
# workflow is to commit `vendor/javascript/` to source control, so
# COPY at line 53 above already brings the cache into the image and
# this RUN becomes a no-op. The step here is defense-in-depth: any
# package that the developer forgot to commit gets fetched and cached
# during image build, before the container starts serving traffic.
RUN cd website                           && /app/node_modules/.bin/webjs vendor pin \
 && cd /app/docs                         && /app/node_modules/.bin/webjs vendor pin \
 && cd /app/examples/blog                && /app/node_modules/.bin/webjs vendor pin \
 && cd /app/packages/ui/packages/website && /app/node_modules/.bin/webjs vendor pin \
 ; true # tolerate per-app pin failures so a transient CDN issue does not break the image build

# Defaults (Railway / compose override per service).
ENV NODE_ENV=production
CMD ["node", "--help"]
