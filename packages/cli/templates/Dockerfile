# Production image for the {{APP_NAME}} webjs app.
#
# Works with a plain `docker build` / `docker compose up`, and is the same
# artifact the webdeploy hosting tool (ubicloud + uncloud) builds and ships.
#
# webjs serves .ts directly via Node's built-in type-stripping, so there is
# NO JavaScript build step. **Node 24+ is REQUIRED**: on older Node the runtime
# falls back to esbuild, whose class-declaration transform breaks webjs's SSR
# walker for multi-class component files. Do not lower this base image
# below 24 (the same version the CI workflow and the framework pin).
#
# Security headers are set by the framework, not the proxy. webjs emits
# X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and
# Permissions-Policy on every response, plus Strict-Transport-Security in
# production over HTTPS (detected from X-Forwarded-Proto on the trusted
# edge). So the baseline needs no reverse-proxy config. Override or extend
# per path with package.json "webjs": { "headers": [...] }. See the
# framework AGENTS.md "Secure response headers" section.
FROM node:24-alpine

# openssl + ca-certificates are required by Prisma's query engine at runtime.
RUN apk add --no-cache openssl ca-certificates

WORKDIR /app

# Install deps first so this layer is cached unless the manifests change.
# package-lock.json is optional (it's absent when the app was scaffolded with
# --no-install); the glob keeps the COPY working with or without it.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# App source. node_modules and local state are excluded via .dockerignore.
COPY . .

# Generate the Prisma client at build time (every scaffold ships a
# prisma/schema.prisma). If you remove Prisma from the app, delete this line.
RUN npx prisma generate

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

# `npm start` runs `prestart: prisma migrate deploy` (idempotent, a no-op when
# there are no migrations yet) and then `webjs start`, which serves on $PORT.
CMD ["npm", "start"]
