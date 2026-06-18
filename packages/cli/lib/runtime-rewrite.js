/**
 * Bun-first scaffold rewrites (#541).
 *
 * The scaffold authors every template in its node/npm form (ONE source of
 * truth, no drift) and DERIVES the bun-mode variant by transform when the app
 * is scaffolded with `--runtime bun` (or through `bun create webjs`). These are
 * pure string transforms so they unit-test without touching the filesystem.
 *
 * Why a transform and not a second set of template files: the agent-config
 * markdown (AGENTS.md / CONVENTIONS.md / .cursorrules / ...) plus the deploy
 * files (Dockerfile / compose.yaml / ci.yml) are long and change often; a
 * parallel bun copy would silently drift from the node original. A transform
 * keeps the node template canonical and the bun output a deterministic
 * function of it.
 *
 * The runtime axis is ORTHOGONAL to `--template` (the exactly-3-templates
 * invariant is untouched, this is a separate dimension).
 */

/**
 * Rewrite command-shaped npm/npx invocations in prose (markdown / agent config)
 * to their bun equivalents. Ordered so the specific forms (`-D`, `install <pkg>`)
 * win before the generic ones, and so `npm run` becomes `bun --bun run` (the
 * `--bun` overrides the `webjs` bin's `#!/usr/bin/env node` shebang so the
 * script actually executes on Bun, the #541 shebang gotcha).
 *
 * Bare "npm" as a word (e.g. "a third-party npm package", "the npm registry")
 * is left alone: packages still come from npm, only the COMMAND changes.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyProse(s) {
  return s
    // Prose claims about the Dockerfile base + CMD (AGENTS.md "Containerized
    // deploy" / the dev-start parity section), which the bun Dockerfile transform
    // changes. Fixed here so the generated bun app's docs match its Dockerfile.
    .replaceAll('pins `node:24-alpine` (the same Node major CI uses)', 'pins `oven/bun:1`')
    .replaceAll('`CMD ["npm", "start"]`', '`CMD ["bun", "--bun", "run", "start"]`')
    // The "Running on Bun" section frames Bun as opt-in ("force it with --bun").
    // In a bun-flavored app the dev/start scripts ALREADY embed --bun, so reframe
    // it as the configured default (the finding from #569 review).
    .replaceAll('### Running on Bun instead of Node', '### Runtime: this app runs on Bun')
    .replaceAll(
      'The same `package.json` scripts work on\neither; to run under Bun, force it with `--bun` so the server executes on Bun\nrather than the `webjs` bin\'s Node shebang:',
      'This app is configured for Bun. Its `dev` / `start` scripts already force\n`--bun` (which overrides the `webjs` bin\'s Node shebang), so a plain `bun run dev`\nserves on Bun with no extra flag:',
    )
    // Invocation styles first, so "npm create webjs@latest" does not get
    // mangled by the generic "npm <x>" rules below.
    .replaceAll('npm create webjs@latest', 'bun create webjs')
    .replaceAll('npm create webjs', 'bun create webjs')
    // dev-dep installs
    .replace(/npm install -D /g, 'bun add -d ')
    .replace(/npm install --save-dev /g, 'bun add -d ')
    // a package install (followed by a package name) -> `bun add <pkg>`
    .replace(/npm install (?=[A-Za-z@])/g, 'bun add ')
    // bare install / ci -> `bun install`
    .replace(/npm install\b/g, 'bun install')
    .replace(/npm ci\b/g, 'bun install')
    // script runners (the shebang gotcha: needs --bun)
    .replace(/npm run /g, 'bun --bun run ')
    .replace(/npm start\b/g, 'bun --bun run start')
    .replace(/npm test\b/g, 'bun --bun run test')
    // one-off executors
    .replace(/npx /g, 'bunx ');
}

/**
 * Rewrite the scaffolded Dockerfile for a Bun base image.
 *
 * Base decision (acceptance criterion): pure `oven/bun:1` (Debian glibc), NOT a
 * node base with a copied-in bun binary. Justification: the only native dep is
 * `better-sqlite3`, which publishes glibc prebuilds that `bun install` fetches
 * on `oven/bun:1` with no build toolchain (the same "no toolchain needed"
 * property the node:alpine base relied on), and there is no build step (Drizzle
 * has no codegen), so nothing in the image needs Node. `ca-certificates` ships
 * in the Debian base, so the explicit install line is dropped. The healthcheck
 * switches from `node -e` to `bun -e` because the bun image has no `node`.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyDockerfile(s) {
  return s
    // Base image. The explaining comment block (node base, "swap for oven/bun")
    // is replaced with the bun-base rationale.
    .replace(
      /# webjs serves \.ts directly[\s\S]*?since the built-in stripper and recursive fs\.watch need it\.\n/,
      '# webjs serves .ts directly by stripping types at the runtime layer, so there is\n' +
      '# NO JavaScript build step (webjs is buildless end to end; there is no bundler or\n' +
      '# esbuild fallback). This image runs the app on **Bun**, where the type-strip comes\n' +
      '# from `amaro` automatically. webjs ALSO runs on Node 24+ (the built-in\n' +
      '# `module.stripTypeScriptTypes`), so you can swap this base for a `node:24-alpine`\n' +
      '# image and start with `npm start`.\n',
    )
    .replace('FROM node:24-alpine', 'FROM oven/bun:1')
    // ca-certificates ships in the Debian-based oven/bun image; drop the apk line
    // and its alpine-specific comment.
    .replace(
      /# ca-certificates for outbound TLS \(e\.g\. a managed Postgres\)\. better-sqlite3\n# is a prebuilt native module, so no build toolchain is needed here\.\nRUN apk add --no-cache ca-certificates\n\n/,
      '# The oven/bun base ships ca-certificates for outbound TLS (e.g. a managed\n# Postgres). better-sqlite3 publishes a glibc prebuild that `bun install`\n# fetches here, so no build toolchain is needed.\n\n',
    )
    // Lockfile + install
    .replace('COPY package.json package-lock.json* ./', 'COPY package.json bun.lock* ./')
    .replace('RUN npm install --no-audit --no-fund', 'RUN bun install')
    // Healthcheck: bun image has no `node`.
    .replace('CMD ["node", "-e", "fetch(', 'CMD ["bun", "-e", "fetch(')
    // Entrypoint: run start under bun (the start script already carries
    // `bun --bun`, but invoking via bun keeps the whole chain on Bun).
    .replace(
      /# `npm start` is a thin alias[\s\S]*?the migrate no longer depends on an npm `prestart` hook\.\nCMD \["npm", "start"\]/,
      '# `bun --bun run start` runs the `start` script on Bun. `webjs start` runs the\n' +
      '# `webjs.start.before` step (`webjs db migrate`, idempotent / a no-op with no\n' +
      '# pending migrations) IN-PROCESS, then serves on $PORT.\n' +
      'CMD ["bun", "--bun", "run", "start"]',
    );
}

/**
 * Rewrite compose.yaml for bun. The service builds from the (now bun)
 * Dockerfile, so only the healthcheck (`node -e` -> `bun -e`, the bun image has
 * no node) needs changing.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyCompose(s) {
  return s.replace('test: ["CMD", "node", "-e", "fetch(', 'test: ["CMD", "bun", "-e", "fetch(');
}

/**
 * Rewrite the GitHub Actions CI workflow to run on Bun: `oven-sh/setup-bun`
 * instead of `actions/setup-node`, `bun install` instead of `npm ci`, and
 * `bun --bun run <script>` instead of `npm run <script>`.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyCi(s) {
  return s
    // Replace every node setup block with the bun one (4 lines -> 3).
    .replaceAll(
      "- uses: actions/setup-node@v6\n        with:\n          node-version: '24'\n          cache: npm",
      '- uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: latest',
    )
    .replaceAll('- run: npm ci', '- run: bun install')
    .replaceAll('npm install --no-save ', 'bun add --no-save ')
    .replaceAll('npm run ', 'bun --bun run ')
    // The e2e job resolves the Chromium path with `node -e`; a fully-Bun CI uses
    // `bun -e` (bun supports the CommonJS require the snippet uses) so it does not
    // rely on Node being implicitly present on the runner (#569 review).
    .replaceAll('node -e ', 'bun -e ')
    .replaceAll('npx ', 'bunx ');
}
