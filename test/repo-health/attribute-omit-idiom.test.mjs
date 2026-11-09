/**
 * In-repo templates omit an attribute the way Lit does (#1682).
 *
 * Since #1683 a plain attribute hole follows Lit: `null` and `undefined`
 * render an EMPTY attribute rather than omitting it. So a hole written for the
 * old rule, `aria-current=${active ? 'page' : null}` or `lang=${lang ?? null}`,
 * now serves `aria-current=""` / `lang=""` (and `lang=""` means "unknown
 * language", not "inherit"). The fix is Lit's own idiom, `: nothing` /
 * `?? nothing`.
 *
 * #1683 migrated the kit components and missed about sixty such holes in the
 * registry blocks and the website. Those files are also what an agent copies
 * from (a block is installed into an app, a docs demo's source is shown on the
 * page), so this scan keeps every in-repo template on the idiom. Escaped
 * `\${` holes inside docs snippets count too, since they are the code a reader
 * copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN = ['packages/ui/packages', 'packages/ui/src', 'packages/cli/templates', 'packages/cli/lib', 'gallery', 'examples', 'website'];
const SKIP = new Set(['node_modules', 'dist', '.webjs', '.git', 'vendor', 'test']);
/** A plain attribute hole whose omit branch is null or undefined. */
const STALE = /(?<![?.@\w])[a-zA-Z][\w-]*=\\?\$\{[^}]*?(?:\?\?\s*|\?[^:}]*:\s*)(?:null|undefined)\s*\}/;

function* files(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (/\.(ts|js|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) yield p;
  }
}

test('no in-repo template omits an attribute with null or undefined', () => {
  const hits = [];
  for (const dir of SCAN) {
    for (const file of files(path.join(root, dir))) {
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('html`') && !src.includes('html\\`')) continue;
      src.split('\n').forEach((line, i) => {
        if (STALE.test(line)) hits.push(`${path.relative(root, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
  }
  assert.deepEqual(hits, [], 'use `: nothing` / `?? nothing` (Lit) to omit an attribute:\n' + hits.join('\n'));
});

test('the scan recognises the stale shapes and passes the Lit idiom', () => {
  assert.ok(STALE.test("<a aria-current=${on ? 'page' : null}>"));
  assert.ok(STALE.test('<div lang=${opts.lang ?? null}>'));
  assert.ok(STALE.test("<span data-x=\\${a ? 'b' : undefined}>"));
  assert.ok(!STALE.test("<a aria-current=${on ? 'page' : nothing}>"));
  assert.ok(!STALE.test('<div lang=${opts.lang ?? nothing}>'));
  assert.ok(!STALE.test('<input ?disabled=${x ?? null}>'), 'a boolean binding is not a plain attribute');
  assert.ok(!STALE.test('<x-y .data=${v ?? null}>'), 'a property binding is not a plain attribute');
});
