/**
 * Unit tests for the Bun-first scaffold transforms (#541), the pure functions
 * that derive the bun-mode variant of each canonical node template.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bunifyProse, bunifyDockerfile, bunifyCi,
} from '../../lib/runtime-rewrite.js';

test('bunifyProse: server scripts force --bun, tooling scripts stay on Node', () => {
  // dev/start are the server (must be Bun) -> --bun.
  assert.equal(bunifyProse('npm run dev'), 'bun --bun run dev');
  assert.equal(bunifyProse('npm run start'), 'bun --bun run start');
  assert.equal(bunifyProse('npm start'), 'bun --bun run start');
  // tooling (webjs test -> node --test, db -> npx drizzle-kit) stays on Node:
  // plain `bun run`, NEVER --bun (which would spawn the invalid `bun --test`).
  assert.equal(bunifyProse('npm run db:generate'), 'bun run db:generate');
  assert.equal(bunifyProse('npm run test:server'), 'bun run test:server');
  assert.equal(bunifyProse('npm test'), 'bun run test');
  assert.equal(bunifyProse('npm run check'), 'bun run check');
});

test('bunifyProse: rewrites npm install / create / npx forms', () => {
  assert.equal(bunifyProse('npm ci'), 'bun install');
  assert.equal(bunifyProse('npm install'), 'bun install');
  assert.equal(bunifyProse('npm install dayjs'), 'bun add dayjs');
  assert.equal(bunifyProse('npm install -D axe-core'), 'bun add -d axe-core');
  assert.equal(bunifyProse('npm i -D puppeteer-core'), 'bun add -d puppeteer-core');
  assert.equal(bunifyProse('npx playwright install'), 'bunx playwright install');
  assert.equal(bunifyProse('npm create webjs@latest my-app'), 'bun create webjs my-app');
  assert.equal(bunifyProse('npm create webjs my-app'), 'bun create webjs my-app');
});

test('bunifyProse: leaves bare "npm" registry references alone', () => {
  // The COMMAND changes, the registry noun does not (packages still come from npm).
  assert.equal(
    bunifyProse('Adding a third-party npm package follows the same `npm install` flow'),
    'Adding a third-party npm package follows the same `bun install` flow',
  );
  assert.equal(
    bunifyProse('npm security advisories against pinned versions'),
    'npm security advisories against pinned versions',
  );
});

test('bunifyProse: rewrites the CMD prose, keeps the node:24-alpine base claim', () => {
  // The base stays node:24-alpine (+ a copied Bun binary), so that prose is NOT
  // rewritten; only the CMD (which becomes `bun --bun run start`) is.
  assert.equal(
    bunifyProse('The Dockerfile pins `node:24-alpine` (the same Node major CI uses)'),
    'The Dockerfile pins `node:24-alpine` (the same Node major CI uses)',
  );
  assert.equal(
    bunifyProse('`CMD ["npm", "start"]` and `CMD ["webjs", "start"]`'),
    '`CMD ["bun", "--bun", "run", "start"]` and `CMD ["webjs", "start"]`',
  );
});

test('bunifyProse: reframes the opt-in "Running on Bun" section as the default', () => {
  assert.equal(
    bunifyProse('### Running on Bun instead of Node'),
    '### Runtime: this app runs on Bun',
  );
  const optIn = 'The same `package.json` scripts work on\neither; to run under Bun, force it with `--bun` so the server executes on Bun\nrather than the `webjs` bin\'s Node shebang:';
  const out = bunifyProse(optIn);
  assert.match(out, /already force/);
  assert.doesNotMatch(out, /to run under Bun, force it with/);
});

test('bunifyDockerfile: keeps node base, copies bun binary, bun install, bun start', () => {
  const node = [
    '# webjs serves .ts directly by stripping types at the runtime layer, so there is',
    '# something something. Do not lower the Node base below 24 (the floor the CI workflow',
    '# and the framework pin enforce),',
    '# since the built-in stripper and recursive fs.watch need it.',
    'FROM node:24-alpine',
    '',
    '# ca-certificates for outbound TLS (e.g. a managed Postgres). better-sqlite3',
    '# is a prebuilt native module, so no build toolchain is needed here.',
    'RUN apk add --no-cache ca-certificates',
    '',
    'WORKDIR /app',
    "# package-lock.json is optional (it's absent when the app was scaffolded with",
    '# --no-install); the glob keeps the COPY working with or without it.',
    'COPY package.json package-lock.json* ./',
    'RUN npm install --no-audit --no-fund',
    'COPY . .',
    'HEALTHCHECK --interval=15s CMD ["node", "-e", "fetch(\'x\')"]',
    '# `npm start` is a thin alias for `webjs start` (#550). It runs the',
    '# `webjs.start.before` step before serving, so',
    '# the migrate no longer depends on an npm `prestart` hook.',
    'CMD ["npm", "start"]',
  ].join('\n');
  const out = bunifyDockerfile(node);
  // Node base stays (the tooling needs npx/node); the Bun binary is copied in.
  assert.match(out, /FROM node:24-alpine/);
  assert.match(out, /COPY --from=oven\/bun:1-alpine \/usr\/local\/bin\/bun \/usr\/local\/bin\/bun/);
  assert.match(out, /COPY package\.json bun\.lock\* \.\//);
  assert.match(out, /RUN bun install/);
  assert.doesNotMatch(out, /npm install/);
  // Healthcheck stays on node (the base provides it).
  assert.match(out, /CMD \["node", "-e"/);
  // Server serves on Bun.
  assert.match(out, /CMD \["bun", "--bun", "run", "start"\]/);
  assert.doesNotMatch(out, /CMD \["npm", "start"\]/);
});

test('bunifyCi: keeps setup-node, adds setup-bun, bun install, plain bun run', () => {
  const node = [
    '      - uses: actions/setup-node@v6',
    '        with:',
    "          node-version: '24'",
    '          cache: npm',
    '      - run: npm ci',
    '      - run: npm run check',
    '      - run: npm run db:generate && npm run db:migrate',
    '      - run: npm install --no-save puppeteer-core',
    '      - run: npx playwright install --with-deps chromium',
  ].join('\n');
  const out = bunifyCi(node);
  // Node is kept (webjs test/db tooling runs on it); Bun is added for install.
  assert.match(out, /uses: actions\/setup-node@v6/);
  assert.match(out, /uses: oven-sh\/setup-bun@v2/);
  assert.match(out, /bun-version: latest/);
  assert.doesNotMatch(out, /cache: npm/);
  assert.match(out, /- run: bun install/);
  assert.doesNotMatch(out, /npm ci/);
  // Plain `bun run` (NOT --bun): the scripts are Node tooling via the shebang.
  assert.match(out, /- run: bun run check/);
  assert.match(out, /bun run db:generate && bun run db:migrate/);
  assert.doesNotMatch(out, /bun --bun run/);
  assert.match(out, /bun add --no-save puppeteer-core/);
  assert.match(out, /bunx playwright install/);
  // The `node -e` Chromium-path step stays (the Node base provides node).
  assert.match(bunifyCi('        run: X=$(node -e "1") >> $E'), /node -e /);
});
