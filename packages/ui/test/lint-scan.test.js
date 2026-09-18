/**
 * `webjsui lint` class-site scanner (`src/lint/scan.js`): the three site
 * shapes, the hole-fragment rule, and the tag-region rule that keeps an
 * escaped code sample from being read as a live class.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scanClassSites, collectHelperImports } from '../src/lint/scan.js';

const names = (sites) => sites.flatMap((s) => s.classes.map((c) => c.name));

test('scan: a static class attribute inside an html template is one site with 1-based positions', () => {
  const src = 'const x = 1;\nconst t = html`<p class="text-sm text-red-600">x</p>`;';
  const sites = scanClassSites(src);
  assert.equal(sites.length, 1);
  assert.equal(sites[0].kind, 'attribute');
  assert.deepEqual(names(sites), ['text-sm', 'text-red-600']);
  const red = sites[0].classes[1];
  assert.equal(red.line, 2);
  assert.equal(red.column, 34);
  assert.equal(src.slice(red.offset, red.offset + red.name.length), 'text-red-600');
});

test('scan: the blog nested-template shape yields a site', () => {
  const src = "html`<form>\n  ${err ? html`<p id=\"email-error\" class=\"text-sm text-red-600\">${err}</p>` : ''}\n</form>`";
  const sites = scanClassSites(src);
  assert.deepEqual(names(sites), ['text-sm', 'text-red-600']);
  assert.equal(sites[0].classes[1].line, 2);
});

test('scan: the escaped code sample in website/app/docs/file-storage/page.ts yields ZERO sites', () => {
  const src = readFileSync(new URL('../../../website/app/docs/file-storage/page.ts', import.meta.url), 'utf8');
  assert.match(src, /&lt;p class="text-sm text-red-600"&gt;/); // the fixture is still there
  assert.deepEqual(scanClassSites(src), []);
  // Prove the scanner walked the whole file rather than bailing: a real tagged
  // site appended after it is still found, and the escaped sample still is not.
  const sites = scanClassSites(src + '\nexport const probe = html`<p class="p-2 text-red-600">x</p>`;');
  assert.deepEqual(names(sites), ['p-2', 'text-red-600']);
  // The same shape in isolation: no `<` opens a tag, so nothing is read.
  const isolated = 'html`<code-block>&lt;p class="text-sm text-red-600"&gt;</code-block>`';
  assert.deepEqual(scanClassSites(isolated), []);
});

test('scan: a token touching a hole is dropped as a fragment', () => {
  assert.deepEqual(names(scanClassSites('html`<p class="text-${size} p-2">`')), ['p-2']);
  assert.deepEqual(names(scanClassSites('html`<p class="p-2 ${x}-y mt-1">`')), ['p-2', 'mt-1']);
  assert.deepEqual(names(scanClassSites('html`<p class="${a} p-2 ${b}">`')), ['p-2']);
});

test('scan: a cn() hole yields the literal classes plus the helper identity, never the option values', () => {
  const src = "html`<button class=${cn(buttonClass({ variant: 'secondary' }), 'w-9 h-9 rounded-full')}>`";
  const sites = scanClassSites(src, { helpers: ['buttonClass'], cnNames: ['cn'] });
  assert.equal(sites.length, 1);
  assert.equal(sites[0].kind, 'hole');
  assert.deepEqual(names(sites), ['w-9', 'h-9', 'rounded-full']);
  assert.deepEqual(sites[0].helpers, ['buttonClass']);
});

test('scan: a conditional class hole yields its literal', () => {
  const sites = scanClassSites("html`<p class=${active ? 'text-red-600' : ''}>`");
  assert.deepEqual(names(sites), ['text-red-600']);
  assert.deepEqual(sites[0].helpers, []);
});

test('scan: a quoted attribute mixing a helper hole and static text is composed with that helper', () => {
  const sites = scanClassSites('html`<button class="${buttonClass()} rounded-full">`', { helpers: ['buttonClass'] });
  assert.deepEqual(names(sites), ['rounded-full']);
  assert.deepEqual(sites[0].helpers, ['buttonClass']);
});

test('scan: a cn() call outside a template is a call site', () => {
  const sites = scanClassSites("const cls = cn(buttonClass({ size: 'sm' }), 'rounded-full', cond && 'p-4');", { helpers: ['buttonClass'] });
  assert.equal(sites.length, 1);
  assert.equal(sites[0].kind, 'call');
  assert.deepEqual(names(sites), ['rounded-full', 'p-4']);
  assert.deepEqual(sites[0].helpers, ['buttonClass']);
});

test('scan: an unrecognized fooClass() is not a helper', () => {
  const sites = scanClassSites("html`<p class=${cn(fooClass(), 'w-9')}>`", { helpers: [] });
  assert.deepEqual(names(sites), ['w-9']);
  assert.deepEqual(sites[0].helpers, []);
});

test('scan: class= in a plain string, a line comment, a block comment, or outside a tag yields nothing', () => {
  const src = [
    "const s = 'class=\"text-red-600\"';",
    '// html`<p class="text-red-600">`',
    '/* <p class="text-red-600"> */',
    'const t = `<p class="text-red-600">`;',
    'html`text class="text-red-600" outside a tag`',
  ].join('\n');
  assert.deepEqual(scanClassSites(src), []);
});

test('scan: other quoted attributes and regex literals do not desync the walker', () => {
  const src = 'const re = /"/;\nhtml`<a href="/x" title=\'class="q"\' class="p-2" data-x="${y}">`';
  assert.deepEqual(names(scanClassSites(src)), ['p-2']);
});

test('collectHelperImports: recognizes helpers by resolved import path, cn by the utils alias', () => {
  const paths = { filePath: '/app/components/toolbar.ts', appRoot: '/app', uiDir: '/app/components/ui', utilsPath: '/app/lib/utils/cn.ts' };
  const src = [
    "import { buttonClass, type ButtonVariant } from '#components/ui/button.ts';",
    "import { badgeClass } from './ui/badge.ts';",
    "import { cn as cx } from '#lib/utils/cn.ts';",
    "import { fooClass } from '#lib/foo.ts';",
    "import { cn } from 'clsx';",
  ].join('\n');
  const r = collectHelperImports(src, paths);
  assert.deepEqual(r.helpers, ['buttonClass', 'badgeClass']);
  assert.deepEqual(r.cnNames, ['cx']);
});

test('scan: a comparison operand or a case label in a class hole is not a class', () => {
  assert.deepEqual(names(scanClassSites("html`<p class=${cn(buttonClass(), item.kind === 'primary' ? 'w-9' : '')}>`", { helpers: ['buttonClass'] })), ['w-9']);
  assert.deepEqual(names(scanClassSites("html`<p class=${'x' == kind ? 'p-2' : kind != 'y' ? 'p-3' : 'p-4'}>`")), ['p-2', 'p-3', 'p-4']);
  assert.deepEqual(names(scanClassSites("switch (k) { case 'primary': return cn(buttonClass(), 'w-9'); }", { helpers: ['buttonClass'] })), ['w-9']);
});

test('scan: commented-out markup inside an html template opens no tag', () => {
  const src = 'html`<!-- <div class="text-red-600"> --><p class="p-2">${x}</p><!-- ${y} -->`';
  assert.deepEqual(names(scanClassSites(src)), ['p-2']);
  // A hole inside the comment is still lexed, so a backtick in it cannot end the template early.
  const tricky = 'html`<!-- ${html`<i class="mt-1">`} --><p class="p-3">`';
  assert.deepEqual(names(scanClassSites(tricky)), ['p-3']);
});

test('collectHelperImports: a comment inside a multi-line import list is not a binding', () => {
  const paths = { filePath: '/app/components/x.ts', appRoot: '/app', uiDir: '/app/components/ui', utilsPath: '/app/lib/utils/cn.ts' };
  const src = "import {\n  buttonClass, // the primary\n  /* badges */ badgeClass,\n} from '#components/ui/button.ts';";
  assert.deepEqual(collectHelperImports(src, paths).helpers, ['buttonClass', 'badgeClass']);
});

test('scan: a plain template literal in a cn() call or a class hole is read, split at its holes', () => {
  assert.deepEqual(names(scanClassSites("const c = cn('a', `bg-pink-500 p-[3px]`);")), ['a', 'bg-pink-500', 'p-[3px]']);
  const composed = scanClassSites('const t = html`<b class=${cn(buttonClass(), `w-9 text-${size} h-9`)}>`;', { helpers: ['buttonClass'] });
  assert.deepEqual(names(composed), ['w-9', 'h-9']);
  assert.deepEqual(composed[0].helpers, ['buttonClass']);
  const hole = scanClassSites('const t = html`<b class=${`p-4 bg-red-500 ${extra}`}>`;');
  assert.deepEqual(names(hole), ['p-4', 'bg-red-500']);
  assert.equal(hole[0].classes[1].column, 'const t = html`<b class=${`p-4 '.length + 1);
  // Outside a collecting site a template is still just a value.
  assert.deepEqual(scanClassSites('const s = `bg-red-500`;'), []);
});

test('collectHelperImports: an aliased helper and a default-plus-named import are both recognized', () => {
  const r = collectHelperImports(
    "import { buttonClass as bc, badge } from '#components/ui/button.ts';\nimport Def, { cn } from '#lib/utils/cn.ts';",
    { filePath: '/app/app/page.ts', appRoot: '/app', uiDir: '/app/components/ui', utilsPath: '/app/lib/utils/cn.ts' },
  );
  assert.deepEqual(r.helpers, ['bc']);
  assert.deepEqual(r.helperExports, { bc: 'buttonClass' });
  assert.deepEqual(r.cnNames, ['cn']);
});

test('scan: a hole starts a fresh expression, so a regex leading it is not lexed as a division', () => {
  // Read as a division, the quote inside the regex opens a string that runs to
  // the end of the line and swallows the template's closing backtick.
  const src = 'const t = html`<p class="a">${/"/.test(s) ? 1 : 2}</p>`;\nconst u = html`<p class="b">`;';
  assert.deepEqual(names(scanClassSites(src)), ['a', 'b']);
});
