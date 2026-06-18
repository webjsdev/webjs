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
 * files (Dockerfile / ci.yml) are long and change often; a parallel bun copy
 * would silently drift from the node original. A transform keeps the node
 * template canonical and the bun output a deterministic function of it.
 *
 * The runtime axis is ORTHOGONAL to `--template` (the exactly-3-templates
 * invariant is untouched, this is a separate dimension).
 *
 * WHAT RUNS ON BUN, AND WHAT DOES NOT (the load-bearing design decision):
 * the SERVER (the `dev` / `start` scripts) runs on Bun, because that is the
 * app. The dev/build TOOLING (`webjs test` / `db:*` / `check` / `typecheck`)
 * stays on Node, because `webjs test` spawns `node --test` (Bun has no
 * `--test` flag; its runner is `bun test`) and `webjs db migrate` shells
 * `npx drizzle-kit` (no `npx` in a pure Bun image). So:
 *   - the `dev` / `start` scripts force `bun --bun` (the server is Bun),
 *   - every other command stays `bun run` / `webjs ...` (runs on Node via the
 *     `webjs` bin's `#!/usr/bin/env node` shebang),
 *   - the Dockerfile keeps the `node:24-alpine` base and COPIES in the Bun
 *     binary (so `npx` / drizzle-kit / the shebang bins still work AND the
 *     server serves on Bun). A pure `oven/bun` base is NOT used precisely
 *     because `webjs db migrate` needs `npx`, which that image lacks.
 */

/**
 * Rewrite command-shaped npm/npx invocations in prose (markdown / agent config /
 * the starter-test header comments) to their bun equivalents.
 *
 * `npm run dev` / `start` become `bun --bun run` (the `--bun` overrides the
 * `webjs` bin's Node shebang so the SERVER runs on Bun). Every OTHER script
 * becomes a plain `bun run` (Node tooling: forcing `--bun` on `webjs test`
 * would spawn the invalid `bun --test`). Bare "npm" as a word (e.g. "a
 * third-party npm package", "the npm registry") is left alone: packages still
 * come from npm, only the COMMAND changes.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyProse(s) {
  return s
    // Prose claim about the Dockerfile CMD (AGENTS.md dev-start parity section);
    // the bun Dockerfile's CMD becomes `bun --bun run start`. The base stays
    // node:24-alpine (+ a copied Bun binary), so the "pins node:24-alpine" prose
    // is still accurate and is NOT rewritten.
    .replaceAll('`CMD ["npm", "start"]`', '`CMD ["bun", "--bun", "run", "start"]`')
    // The "Running on Bun" section frames Bun as opt-in ("force it with --bun").
    // In a bun-flavored app the dev/start scripts ALREADY embed --bun, so reframe
    // it as the configured default.
    .replaceAll('### Running on Bun instead of Node', '### Runtime: this app runs on Bun')
    .replaceAll(
      'The same `package.json` scripts work on\neither; to run under Bun, force it with `--bun` so the server executes on Bun\nrather than the `webjs` bin\'s Node shebang:',
      'This app is configured for Bun. Its `dev` / `start` scripts already force\n`--bun` (which overrides the `webjs` bin\'s Node shebang), so a plain `bun run dev`\nserves on Bun. The other scripts (test / db / check) run on Node, the runtime\nthe `webjs` tooling targets:',
    )
    // Invocation styles first, so "npm create webjs@latest" does not get
    // mangled by the generic "npm <x>" rules below.
    .replaceAll('npm create webjs@latest', 'bun create webjs')
    .replaceAll('npm create webjs', 'bun create webjs')
    // dev-dep installs (`npm install -D` and the `npm i -D` shorthand)
    .replace(/npm install -D /g, 'bun add -d ')
    .replace(/npm install --save-dev /g, 'bun add -d ')
    .replace(/npm i -D /g, 'bun add -d ')
    // a package install (followed by a package name) -> `bun add <pkg>`
    .replace(/npm install (?=[A-Za-z@])/g, 'bun add ')
    .replace(/npm i (?=[A-Za-z@])/g, 'bun add ')
    // bare install / ci -> `bun install`
    .replace(/npm install\b/g, 'bun install')
    .replace(/npm ci\b/g, 'bun install')
    // The SERVER scripts run on Bun (force --bun, overriding the Node shebang).
    .replace(/npm run dev\b/g, 'bun --bun run dev')
    .replace(/npm run start\b/g, 'bun --bun run start')
    .replace(/npm start\b/g, 'bun --bun run start')
    // Every other script is Node tooling (webjs test -> node --test, db -> npx
    // drizzle-kit): a plain `bun run` lets the shebang pick Node. NEVER --bun
    // here (it would make `webjs test` spawn the invalid `bun --test`).
    .replace(/npm run /g, 'bun run ')
    .replace(/npm test\b/g, 'bun run test')
    // one-off executors
    .replace(/npx /g, 'bunx ');
}

/**
 * Rewrite the scaffolded Dockerfile for Bun.
 *
 * Base decision (acceptance criterion): KEEP the `node:24-alpine` base and COPY
 * in the Bun binary, NOT a pure `oven/bun` image. Justification: the server
 * serves on Bun (`bun --bun run start` selects the `Bun.serve` listener), but
 * the boot-time `webjs db migrate` shells `npx drizzle-kit`, and the `webjs` /
 * drizzle-kit bins use a `#!/usr/bin/env node` shebang. A pure `oven/bun` image
 * has NO `npx` (verified), so the migrate would fail at container start. Keeping
 * the Node base gives `npx` + the Node toolchain while the copied Bun binary
 * serves the app on Bun. This is the same pattern the in-repo example apps
 * deploy with. `bun install` (not `npm install`) uses the committed `bun.lock`,
 * and `trustedDependencies` lets better-sqlite3's prebuild postinstall run.
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyDockerfile(s) {
  return s
    // Top comment: explain the node-base + copied-bun-binary rationale.
    .replace(
      /# webjs serves \.ts directly[\s\S]*?since the built-in stripper and recursive fs\.watch need it\.\n/,
      '# webjs serves .ts directly by stripping types at the runtime layer, so there is\n' +
      '# NO JavaScript build step (webjs is buildless end to end; there is no bundler or\n' +
      '# esbuild fallback). This image SERVES the app on **Bun** (`bun --bun run start`\n' +
      '# selects the Bun.serve listener) while keeping the `node:24-alpine` base for the\n' +
      '# Node toolchain the boot-time `webjs db migrate` needs (it shells `npx\n' +
      '# drizzle-kit`, and a pure oven/bun image has no npx). The Bun binary is copied\n' +
      '# in below. Do not lower the Node base below 24 (the floor the CI workflow and the\n' +
      '# framework pin enforce), since the toolchain and recursive fs.watch need it.\n',
    )
    // Copy the Bun binary (musl, matching the alpine base) in after the apk step.
    .replace(
      'RUN apk add --no-cache ca-certificates\n',
      'RUN apk add --no-cache ca-certificates\n\n' +
      '# Bun binary, so the server serves on Bun while the Node toolchain above stays\n' +
      '# available for `npx drizzle-kit` (the boot migrate) and the shebang bins.\n' +
      'COPY --from=oven/bun:1-alpine /usr/local/bin/bun /usr/local/bin/bun\n',
    )
    // Lockfile + install (bun.lock, bun install).
    .replace(
      '# package-lock.json is optional (it\'s absent when the app was scaffolded with\n# --no-install); the glob keeps the COPY working with or without it.\nCOPY package.json package-lock.json* ./\nRUN npm install --no-audit --no-fund',
      '# bun.lock is optional (absent when scaffolded with --no-install); the glob keeps\n# the COPY working with or without it. trustedDependencies in package.json lets\n# better-sqlite3\'s native-prebuild postinstall run (bun skips postinstalls).\nCOPY package.json bun.lock* ./\nRUN bun install',
    )
    // Entrypoint: serve on Bun. The healthcheck keeps `node -e` (the Node base
    // provides node, so no change is needed there).
    .replace(
      /# `npm start` is a thin alias[\s\S]*?the migrate no longer depends on an npm `prestart` hook\.\nCMD \["npm", "start"\]/,
      '# `bun --bun run start` runs the `start` script on Bun (the server serves via\n' +
      '# Bun.serve). `webjs start` runs the `webjs.start.before` step (`webjs db migrate`,\n' +
      '# which shells drizzle-kit through the Node toolchain in this image), idempotent /\n' +
      '# a no-op with no pending migrations, then serves on $PORT.\n' +
      'CMD ["bun", "--bun", "run", "start"]',
    );
}

/**
 * Rewrite the GitHub Actions CI workflow for Bun: ADD `oven-sh/setup-bun`
 * alongside `actions/setup-node` (kept, because the `webjs` test/db/check
 * tooling runs on Node), install with `bun install` (uses bun.lock), and run
 * scripts with a plain `bun run` (the script bodies' `webjs ...` resolve to Node
 * via the shebang, and dev/start are not run in CI). The `node -e` Chromium-path
 * step stays (Node is present from setup-node).
 *
 * @param {string} s
 * @returns {string}
 */
export function bunifyCi(s) {
  return s
    // Keep the Node setup (the tooling needs it), add Bun for `bun install`.
    // Drop `cache: npm` (the cache is bun's now; setup-bun caches by default).
    .replaceAll(
      "- uses: actions/setup-node@v6\n        with:\n          node-version: '24'\n          cache: npm",
      "- uses: actions/setup-node@v6\n        with:\n          node-version: '24'\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: latest",
    )
    .replaceAll('- run: npm ci', '- run: bun install')
    .replaceAll('npm install --no-save ', 'bun add --no-save ')
    .replaceAll('npm run ', 'bun run ')
    .replaceAll('npx ', 'bunx ');
}
