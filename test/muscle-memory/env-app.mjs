/**
 * A throwaway app for the env-file assertions. `.env` and `.env.local` used to
 * be written into the shared `works/` fixture, and two test files that
 * `npm test` runs in parallel did that, so one could delete the files while the
 * other was booting. Each caller gets its own directory instead.
 */
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * An app whose /greeting page prints MM_GREETING, with `.env` and `.env.local`
 * setting it to different values.
 * @returns {{ dir: string, cleanup: () => void }}
 */
export function makeEnvApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-mm-env-'));
  const files = {
    'package.json': JSON.stringify({ name: 'mm-env', private: true, type: 'module' }),
    'app/greeting/page.ts': "import { html } from '@webjsdev/core';\nexport default function Greeting() { return html`<p>Greeting: ${process.env.MM_GREETING ?? 'unset'}</p>`; }\n",
    '.env': 'MM_GREETING=from-env\n',
    '.env.local': 'MM_GREETING=from-env-local\n',
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Next's order: `.env.local` overrides `.env`, except in test mode (NODE_ENV=test, which `bun test` sets). */
export const EXPECTED_GREETING = () => (process.env.NODE_ENV === 'test' ? /Greeting: from-env</ : /Greeting: from-env-local/);
