import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

/**
 * Tests for `dark-theme-unreachable` (#1625): an app that defines colour tokens
 * but never applies a dark half ships dead CSS and ignores the OS setting. The
 * scaffold's stylesheet keeps a `.dark { ... }` block, so the common failure is
 * a root layout that neither uses light-dark() nor runs a theme script.
 */
const RULE = 'dark-theme-unreachable';

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-dark-theme-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}
const hits = (v) => v.filter((x) => x.rule === RULE);

/** The ui-kit theme block the scaffold keeps after gallery:clear: a light root and a .dark block. */
const KIT_CSS = `@import "tailwindcss";
@theme inline { --color-background: var(--background); --color-foreground: var(--foreground); }
:root { --background: oklch(1 0 0); --foreground: oklch(0.145 0 0); }
.dark { --background: oklch(0.145 0 0); --foreground: oklch(0.985 0 0); }
`;
const PLAIN_LAYOUT = `import { html } from '@webjsdev/core';
export default function RootLayout({ children }) {
  return html\`<link rel="stylesheet" href="/public/tailwind.css"><main>\${children}</main>\`;
}
`;

test('the rule is registered', () => {
  assert.ok(RULES.some((r) => r.name === RULE), 'RULES lists dark-theme-unreachable');
});

test('flags tokens with a .dark block that nothing ever applies', async () => {
  const dir = await makeApp({ 'public/input.css': KIT_CSS, 'app/layout.ts': PLAIN_LAYOUT });
  try {
    const v = hits(await checkConventions(dir));
    assert.equal(v.length, 1, JSON.stringify(v));
    assert.equal(v[0].file, 'public/input.css');
    assert.match(v[0].message, /light value only/);
    assert.match(v[0].fix, /light-dark\(LIGHT, DARK\)/);
    assert.match(v[0].fix, /prefers-color-scheme: dark/);
    assert.match(v[0].fix, /head <script>/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('flags tokens written in the root layout <style> with a single value', async () => {
  const dir = await makeApp({
    'app/layout.ts': `import { html } from '@webjsdev/core';
export default function RootLayout({ children }) {
  return html\`<style>:root { --background: #fff; --foreground: #111; }</style>\${children}\`;
}
`,
  });
  try {
    const v = hits(await checkConventions(dir));
    assert.equal(v.length, 1);
    assert.equal(v[0].file, 'app/layout.ts');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('passes with light-dark() tokens in the layout, the scaffold shape', async () => {
  const dir = await makeApp({
    'public/input.css': KIT_CSS,
    'app/layout.ts': `import { html } from '@webjsdev/core';
export default function RootLayout({ children }) {
  return html\`<style>:root { color-scheme: light dark; --background: light-dark(#fff, #111); --foreground: light-dark(#111, #eee); }</style>\${children}\`;
}
`,
  });
  try { assert.equal(hits(await checkConventions(dir)).length, 0); } finally { await rm(dir, { recursive: true, force: true }); }
});

test('passes with a prefers-color-scheme half in the stylesheet, whichever scheme it names', async () => {
  for (const scheme of ['dark', 'light']) {
    const dir = await makeApp({
      'public/input.css': KIT_CSS + `@media (prefers-color-scheme: ${scheme}) { :root { --background: oklch(0.2 0 0); --foreground: oklch(0.98 0 0); } }\n`,
      'app/layout.ts': PLAIN_LAYOUT,
    });
    try { assert.equal(hits(await checkConventions(dir)).length, 0, scheme); } finally { await rm(dir, { recursive: true, force: true }); }
  }
});

test('passes with a head script in the root layout that applies the theme', async () => {
  const dir = await makeApp({
    'public/input.css': KIT_CSS,
    'app/layout.ts': `import { html } from '@webjsdev/core';
export default function RootLayout({ children }) {
  return html\`<script>if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');</script>\${children}\`;
}
`,
  });
  try { assert.equal(hits(await checkConventions(dir)).length, 0); } finally { await rm(dir, { recursive: true, force: true }); }
});

test('silent when the app defines no colour tokens; ignores the compiled tailwind.css and comments', async () => {
  const dir = await makeApp({
    'public/input.css': '@import "tailwindcss";\n/* --background: #fff is set per page */\n',
    'public/tailwind.css': ':root{--background:#fff;--foreground:#000}',
    'app/layout.ts': PLAIN_LAYOUT,
  });
  try { assert.equal(hits(await checkConventions(dir)).length, 0); } finally { await rm(dir, { recursive: true, force: true }); }
});
