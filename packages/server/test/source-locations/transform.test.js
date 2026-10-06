/**
 * Unit tests for the dev source-location transform (#1499).
 *
 * `annotateSourceLocations` stamps `data-webjs-src="<file>:<line>"` on element
 * opening tags in the STATIC text of `html` tagged templates. These pin what it
 * annotates, what it must leave alone (holes, raw text, svg descendants,
 * comments, other tags), that it never moves a line, and that the lexer is not
 * fooled by strings, comments, or regex literals that look like templates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import {
  annotateSourceLocations as annotate,
  isSourceLocationCandidate,
  sourceLocationFile,
  sourceLocationsRequested,
} from '../../src/dev-source-locations.js';

const F = 'components/x.ts';
const at = (line) => ` data-webjs-src="${F}:${line}"`;

test('annotates each element opening tag with its own line', () => {
  const src = 'const t = html`\n  <main>\n    <p class="a">hi</p>\n  </main>`;\n';
  const out = annotate(src, F);
  assert.equal(out, `const t = html\`\n  <main${at(2)}>\n    <p${at(3)} class="a">hi</p>\n  </main>\`;\n`);
});

test('never adds or removes a line', () => {
  const src = 'x = html`<a>\n<b>\n${y}\n<c></c>`;\nconst after = 1;\n';
  const out = annotate(src, F);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.equal(out.split('\n')[4], 'const after = 1;');
});

test('attribute, property, event and boolean holes keep their names and positions', () => {
  const src = 'html`<button class="x ${c}" .value=${v} @click=${() => go()} ?disabled=${d}>ok</button>`';
  const out = annotate(src, F);
  assert.equal(
    out,
    `html\`<button${at(1)} class="x \${c}" .value=\${v} @click=\${() => go()} ?disabled=\${d}>ok</button>\``,
  );
});

test('a multi-line hole keeps every later element on its exact line', () => {
  const src = [
    'html`<ul>',          // 1
    '  ${items.map((i) =>', // 2
    '    html`<li>${i}</li>`', // 3
    '  )}',                // 4
    '  <footer></footer>', // 5
    '</ul>`',
  ].join('\n');
  const out = annotate(src, F);
  assert.match(out, new RegExp(`<ul${at(1)}>`));
  assert.match(out, new RegExp(`<li${at(3)}>`), 'the nested template in the hole is annotated');
  assert.match(out, new RegExp(`<footer${at(5)}>`));
});

test('an object-literal hole with braces does not end the template early', () => {
  const src = 'html`<my-el .cfg=${{ a: { b: 1 } }}><span>x</span></my-el>`';
  const out = annotate(src, F);
  assert.match(out, new RegExp(`<my-el${at(1)} \\.cfg=`));
  assert.match(out, new RegExp(`<span${at(1)}>`));
});

test('closing tags, comments and doctype are untouched', () => {
  const src = 'html`<!doctype html><!-- <div> --><p></p>`';
  assert.equal(annotate(src, F), `html\`<!doctype html><!-- <div> --><p${at(1)}></p>\``);
});

test('raw-text bodies (script, style, textarea, title) are not scanned for tags', () => {
  const src = 'html`<textarea><b>not a tag</b></textarea><style>a<b{}</style><script>if(a<b){}</script><i></i>`';
  const out = annotate(src, F);
  assert.match(out, new RegExp(`<textarea${at(1)}><b>not a tag</b></textarea>`));
  assert.match(out, /<style>a<b\{\}<\/style>/, 'style is never annotated, nor its body');
  assert.match(out, /<script>if\(a<b\)\{\}<\/script>/);
  assert.match(out, new RegExp(`<i${at(1)}></i>`), 'scanning resumes after the raw text');
});

test('svg: the root is annotated, its descendants are not', () => {
  const src = 'html`<svg viewBox="0 0 1 1"><g><path d="M0"/></g></svg><p></p>`';
  const out = annotate(src, F);
  assert.equal(
    out,
    `html\`<svg${at(1)} viewBox="0 0 1 1"><g><path d="M0"/></g></svg><p${at(1)}></p>\``,
  );
});

test('a > inside a quoted attribute value does not end the tag', () => {
  const src = 'html`<input value="a>b<c"/><p></p>`';
  assert.equal(annotate(src, F), `html\`<input${at(1)} value="a>b<c"/><p${at(1)}></p>\``);
});

test('document-shell and head elements are skipped', () => {
  const src = 'html`<html><head><meta charset="utf-8"><title>t</title></head><body><div></div></body></html>`';
  const out = annotate(src, F);
  assert.equal(out.match(/data-webjs-src/g).length, 1, 'only the <div> is annotated');
  assert.match(out, new RegExp(`<div${at(1)}>`));
});

test('css, svg and untagged templates are never annotated', () => {
  const src = 'const a = css`<div>`; const b = svg`<g></g>`; const c = `<p></p>`; const d = obj.html`<p></p>`;';
  assert.equal(annotate(src, F), src);
});

test('strings, comments and regex literals that look like templates are skipped', () => {
  const src = [
    "const s = 'html`<p>`';",
    'const d = "html`<p>`";',
    '// html`<p>`',
    '/* html`<p>` */',
    'const r = /html`<p>`/g;',
    'const q = a / 2 / b;',
    'const t = html`<em></em>`;',
  ].join('\n');
  const out = annotate(src, F);
  assert.equal(out.match(/data-webjs-src/g).length, 1);
  assert.match(out, new RegExp(`<em${at(7)}>`));
});

test('TypeScript syntax (generics, annotations) lexes fine', () => {
  const src = [
    'function f<T extends Record<string, number>>(x: T): Array<T> {',
    '  const y = <T>x;',
    '  return [x];',
    '}',
    'export class C extends WebComponent {',
    '  render(): TemplateResult { return html`<div class=${this.c as string}></div>`; }',
    '}',
  ].join('\n');
  const out = annotate(src, F);
  assert.match(out, new RegExp(`<div${at(6)} class=`));
});

test('a source with no html template is returned unchanged (same string)', () => {
  const src = 'export const x = `<p>${1}</p>`;\n';
  assert.equal(annotate(src, F), src);
  assert.equal(annotate('const html = 1;', F), 'const html = 1;');
});

test('malformed source fails open (unchanged, no throw)', () => {
  const src = 'const t = html`<p>';
  assert.equal(annotate(src, F), src);
});

test('isSourceLocationCandidate: app modules only, never node_modules or *.server.*', () => {
  const app = '/srv/app';
  assert.equal(isSourceLocationCandidate('/srv/app/app/page.ts', app), true);
  assert.equal(isSourceLocationCandidate('/srv/app/components/x.js', app), true);
  assert.equal(isSourceLocationCandidate('/srv/app/node_modules/pkg/x.js', app), false);
  assert.equal(isSourceLocationCandidate('/srv/app/modules/a/actions/save.server.ts', app), false);
  assert.equal(isSourceLocationCandidate('/srv/other/x.ts', app), false);
  assert.equal(isSourceLocationCandidate('/srv/app/public/style.css', app), false);
});

test('sourceLocationFile is app-relative with forward slashes and inert characters', () => {
  assert.equal(sourceLocationFile(join('/srv/app', 'components', 'x.ts'), '/srv/app'), 'components/x.ts');
  assert.equal(sourceLocationFile('/srv/app/a b/$x`.ts', '/srv/app'), 'a%20b/%24x%60.ts');
});

test('sourceLocationsRequested reads WEBJS_SOURCE_LOCATIONS', () => {
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: '1' }), true);
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: 'true' }), true);
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: '0' }), false);
  assert.equal(sourceLocationsRequested({}), false);
});

test('sourceLocationsRequested: webjs.dev.sourceLocations is the default, the env var wins (#1504)', () => {
  assert.equal(sourceLocationsRequested({}, true), true, 'config on, env unset');
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: '0' }, true), false, 'env off beats config on');
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: 'false' }, true), false);
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: '1' }, false), true, 'env on beats config off');
  assert.equal(sourceLocationsRequested({ WEBJS_SOURCE_LOCATIONS: 'maybe' }, true), true, 'an unrecognised env value defers to the config');
  assert.equal(sourceLocationsRequested({}, 'yes'), false, 'only a literal true in config turns it on');
});
