import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every `.ts` / `.mts` file the scaffold ships in `templates/` MUST survive the
 * runtime TypeScript stripper (`module.stripTypeScriptTypes`), because webjs is
 * no-build: the served/tested file IS the source, so a template that fails to
 * strip breaks the freshly-scaffolded app the moment that file is loaded.
 *
 * This guards a real shipped bug (#807): the e2e test template's JSDoc header
 * held a doubled-star glob pattern inside the block comment, and the star-star
 * followed by a slash closed the comment early, corrupting the file into a
 * syntax error that `stripTypeScriptTypes` rejects with "Expression expected".
 * It shipped in every scaffold and forced an agent to delete the scaffold tests.
 * A per-template strip check would have caught it the day it was written.
 */

const TEMPLATES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'templates');

/** @param {string} dir @returns {Promise<string[]>} absolute .ts/.mts paths */
async function collectTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await collectTsFiles(abs)));
    } else if (/\.m?ts$/.test(ent.name) && !/\.d\.ts$/.test(ent.name)) {
      out.push(abs);
    }
  }
  return out;
}

test('every .ts/.mts template survives the runtime TypeScript stripper', async () => {
  const files = await collectTsFiles(TEMPLATES_DIR);
  assert.ok(files.length > 0, 'expected at least one .ts template to check');
  const failures = [];
  for (const abs of files) {
    const src = await readFile(abs, 'utf8');
    try {
      stripTypeScriptTypes(src, { mode: 'strip' });
    } catch (err) {
      failures.push(`${relative(TEMPLATES_DIR, abs)}: ${String(err.message).split('\n')[0]}`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `these scaffold templates fail TypeScript stripping and would break a fresh app:\n  ${failures.join('\n  ')}`,
  );
});
