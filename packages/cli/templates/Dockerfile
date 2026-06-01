# Production image for the {{APP_NAME}} webjs app.
#
# Works with a plain `docker build` / `docker compose up`, and is the same
# artifact the webdeploy hosting tool (ubicloud + uncloud) builds and ships.
#
# webjs serves .ts directly via Node's built-in type-stripping — there is NO
# JavaScript build step. **Node 24+ is REQUIRED**: on older Node the runtime
# falls back to esbuild, whose class-declaration transform breaks webjs's SSR
# walker for multi-class component files. Do not lower this base image
# below 24 (the same version the CI workflow and the framework pin).
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

# `npm start` runs `prestart: prisma migrate deploy` (idempotent — a no-op when
# there are no migrations yet) and then `webjs start`, which serves on $PORT.
CMD ["npm", "start"]
