/**
 * Unit tests for the Bun-first scaffold transforms (#541), the pure functions
 * that derive the bun-mode variant of each canonical node template.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bunifyProse, bunifyDockerfile, bunifyCompose, bunifyCi,
} from '../../lib/runtime-rewrite.js';

test('bunifyProse: rewrites npm command invocations to bun', () => {
  assert.equal(bunifyProse('npm run dev'), 'bun --bun run dev');
  assert.equal(bunifyProse('npm run db:generate'), 'bun --bun run db:generate');
  assert.equal(bunifyProse('npm start'), 'bun --bun run start');
  assert.equal(bunifyProse('npm test'), 'bun --bun run test');
  assert.equal(bunifyProse('npm ci'), 'bun install');
  assert.equal(bunifyProse('npm install'), 'bun install');
  assert.equal(bunifyProse('npm install dayjs'), 'bun add dayjs');
  assert.equal(bunifyProse('npm install -D axe-core'), 'bun add -d axe-core');
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

test('bunifyProse: fixes Dockerfile prose claims to match the bun Dockerfile', () => {
  assert.equal(
    bunifyProse('The Dockerfile pins `node:24-alpine` (the same Node major CI uses)'),
    'The Dockerfile pins `oven/bun:1`',
  );
  assert.equal(
    bunifyProse('`CMD ["npm", "start"]` and `CMD ["webjs", "start"]`'),
    '`CMD ["bun", "--bun", "run", "start"]` and `CMD ["webjs", "start"]`',
  );
});

test('bunifyDockerfile: switches to the oven/bun base + bun install + bun start', () => {
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
  assert.match(out, /FROM oven\/bun:1/);
  assert.doesNotMatch(out, /FROM node:24-alpine/);
  assert.doesNotMatch(out, /apk add/);
  assert.match(out, /COPY package\.json bun\.lock\* \.\//);
  assert.match(out, /RUN bun install/);
  assert.doesNotMatch(out, /npm install/);
  assert.match(out, /CMD \["bun", "-e"/);
  assert.match(out, /CMD \["bun", "--bun", "run", "start"\]/);
  assert.doesNotMatch(out, /CMD \["npm", "start"\]/);
});

test('bunifyCompose: switches the healthcheck off node', () => {
  const node = '      test: ["CMD", "node", "-e", "fetch(\'x\')"]';
  assert.equal(bunifyCompose(node), '      test: ["CMD", "bun", "-e", "fetch(\'x\')"]');
});

test('bunifyCi: setup-bun + bun install + bun --bun run', () => {
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
  assert.match(out, /uses: oven-sh\/setup-bun@v2/);
  assert.match(out, /bun-version: latest/);
  assert.doesNotMatch(out, /setup-node/);
  assert.doesNotMatch(out, /cache: npm/);
  assert.match(out, /- run: bun install/);
  assert.doesNotMatch(out, /npm ci/);
  assert.match(out, /bun --bun run check/);
  assert.match(out, /bun --bun run db:generate && bun --bun run db:migrate/);
  assert.match(out, /bun add --no-save puppeteer-core/);
  assert.match(out, /bunx playwright install/);
});
