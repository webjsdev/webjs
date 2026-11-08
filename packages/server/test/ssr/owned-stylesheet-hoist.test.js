/**
 * A nested layout's or page's stylesheet is hoisted into <head> with the
 * boundary that owns it (#1669).
 *
 * The root hoist only reads the leading run of the whole body and stops at the
 * first boundary marker, so a section layout's `<link rel="stylesheet">` stayed
 * in <body>, which is not reliably render-blocking (#406). Apps worked around
 * it by also emitting the section sheet from the root layout's head, and that
 * copy outlived the section on a soft navigation. Hoisting the leading
 * stylesheet after each boundary marker, tagged with the marker's segment, lets
 * the router drop it when it replaces that range.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoistOwnedStylesheets, stylesheetKeys, STYLE_OWNER_ATTR } from '../../src/ssr/head.js';
import { _buildDocumentParts } from '../../src/ssr.js';

const open = (seg, key = seg) => `<!--wj:children:${seg}:${key}-->`;
const close = (seg) => `<!--/wj:children:${seg}-->`;

test('a stylesheet leading a boundary range moves to the head, tagged with its segment', () => {
  const body = `<header>x</header>${open('/')}\n  <link rel="stylesheet" href="/ui.css">\n  <div class="ui-site">hi</div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, [`<link rel="stylesheet" href="/ui.css" ${STYLE_OWNER_ATTR}="/">`]);
  assert.equal(out.includes('ui.css'), false, 'the link leaves the body');
  assert.ok(out.includes(`${open('/')}\n  \n  <div class="ui-site">hi</div>`), 'the rest of the range is untouched');
});

test('the owner is the segment, not the route-key, of the enclosing marker', () => {
  const body = `${open('/blog/[slug]', '/blog/a')}<link rel="stylesheet" href="/post.css"><p>x</p>${close('/blog/[slug]')}`;
  const { tags } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, [`<link rel="stylesheet" href="/post.css" ${STYLE_OWNER_ATTR}="/blog/[slug]">`]);
});

test('every nested range contributes its own leading stylesheet, in document order', () => {
  const body =
    `${open('/')}<link rel="stylesheet" href="/ui.css"><div>` +
    `${open('/ui')}<link rel="stylesheet" href="/new-york.css"><main>` +
    `${open('/ui/docs')}<link rel="stylesheet" href="/nova.css"><p>page</p>${close('/ui/docs')}` +
    `</main>${close('/ui')}</div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags.map((t) => [/href="([^"]+)"/.exec(t)[1], new RegExp(`${STYLE_OWNER_ATTR}="([^"]+)"`).exec(t)[1]]), [
    ['/ui.css', '/'],
    ['/new-york.css', '/ui'],
    ['/nova.css', '/ui/docs'],
  ]);
  assert.equal(/rel="stylesheet"/.test(out), false);
});

test('a comment and a non-stylesheet link stay in place and do not end the run', () => {
  const body = `${open('/')}<!-- fonts --><link rel="preload" as="font" href="/f.woff2"><link rel="stylesheet" href="/ui.css"><div></div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.equal(tags.length, 1);
  assert.ok(out.includes('<!-- fonts --><link rel="preload" as="font" href="/f.woff2"><div></div>'));
});

test('an element ends the run, so a stylesheet further down stays in the body', () => {
  const body = `${open('/')}<div></div><link rel="stylesheet" href="/late.css">${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, []);
  assert.equal(out, body);
});

test('a stylesheet the head already links is dropped, not hoisted a second time', () => {
  const body = `${open('/')}<link rel="stylesheet" href="/tailwind.css"><div></div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body, new Set(['/tailwind.css']));
  assert.deepEqual(tags, []);
  assert.equal(out.includes('tailwind.css'), false, 'the duplicate leaves the body too');
});

test('two ranges linking the same href hoist it once, owned by the outer one', () => {
  const body = `${open('/')}<link rel="stylesheet" href="/a.css"><div>${open('/x')}<link rel="stylesheet" href="/a.css"><p></p>${close('/x')}</div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, [`<link rel="stylesheet" href="/a.css" ${STYLE_OWNER_ATTR}="/">`]);
  assert.equal(out.includes('a.css'), false);
});

test('an alternate stylesheet, and a body with no boundary, are left alone', () => {
  const alt = `${open('/')}<link rel="alternate stylesheet" href="/dark.css"><div></div>${close('/')}`;
  assert.deepEqual(hoistOwnedStylesheets(alt), { tags: [], body: alt });
  const plain = '<link rel="stylesheet" href="/x.css"><div></div>';
  assert.deepEqual(hoistOwnedStylesheets(plain), { tags: [], body: plain });
});

test('a self-closing link and a single-quoted href are tagged correctly', () => {
  const body = `${open('/')}<link rel='stylesheet' href='/a.css' /><div></div>${close('/')}`;
  const { tags } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, [`<link rel='stylesheet' href='/a.css' ${STYLE_OWNER_ATTR}="/">`]);
});

test('stylesheetKeys reads only active stylesheet links', () => {
  const html = '<link rel="icon" href="/i.svg"><link rel="stylesheet" href="/a.css"><link rel="alternate stylesheet" href="/b.css">';
  assert.deepEqual([...stylesheetKeys(html)], ['/a.css']);
});

test('buildDocumentParts puts owned sheets after the root layout\'s head run (framework shell)', () => {
  const body = `<link rel="stylesheet" href="/tailwind.css">${open('/')}<link rel="stylesheet" href="/ui.css"><main></main>${close('/')}`;
  const { prefix, streamBody } = _buildDocumentParts(body, { metadata: {}, moduleUrls: [], dev: false, streaming: false });
  const root = prefix.indexOf('href="/tailwind.css"');
  const owned = prefix.indexOf(`href="/ui.css" ${STYLE_OWNER_ATTR}="/"`);
  assert.ok(root > 0 && owned > root, 'root sheet first, then the owned one, both in the head');
  assert.ok(owned < prefix.indexOf('</head>'));
  assert.equal(streamBody.includes('.css'), false);
});

test('buildDocumentParts hoists owned sheets under a root layout that writes its own shell', () => {
  const body =
    '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/tailwind.css"></head><body>' +
    `${open('/')}<link rel="stylesheet" href="/ui.css"><link rel="stylesheet" href="/tailwind.css"><main></main>${close('/')}` +
    '</body></html>';
  const { prefix, streamBody } = _buildDocumentParts(body, { metadata: {}, moduleUrls: [], dev: false, streaming: false });
  assert.equal(prefix.match(/tailwind\.css/g).length, 1, 'the root\'s own copy is the only one');
  assert.ok(prefix.indexOf(`href="/ui.css" ${STYLE_OWNER_ATTR}="/"`) > prefix.indexOf('tailwind.css'));
  assert.equal(streamBody.includes('.css'), false);
});

test('a $ sequence in an href or segment is inserted literally, not as a replacement pattern', () => {
  const body = `${open("/a$'b")}<link rel="stylesheet" href="/x$&y.css"><main></main>${close("/a$'b")}`;
  const { prefix } = _buildDocumentParts(body, { metadata: {}, moduleUrls: [], dev: false, streaming: false });
  assert.ok(prefix.includes(`href="/x$&y.css" ${STYLE_OWNER_ATTR}="/a$'b">`), 'the tag is spliced in as written');
  assert.equal(prefix.split('</head>').length, 2, 'the head is closed once, not duplicated by $\'');
});

test('an attribute name inside another attribute\'s quoted value is not read as that attribute', () => {
  const body = `${open('/')}<link title="x rel=stylesheet" rel="preload" as="style" href="/a.css"><div></div>${close('/')}`;
  const { tags, body: out } = hoistOwnedStylesheets(body);
  assert.deepEqual(tags, [], 'a preload whose title mentions rel=stylesheet stays put');
  assert.equal(out, body);
});

test('a print sheet and a screen sheet of one file are two sheets', () => {
  const body = `${open('/')}<link rel="stylesheet" href="/a.css"><div></div>${close('/')}`;
  const { tags } = hoistOwnedStylesheets(body, stylesheetKeys('<link rel="stylesheet" href="/a.css" media="print">'));
  assert.equal(tags.length, 1, 'the screen link is hoisted although the head has the print one');
  assert.deepEqual(
    [...stylesheetKeys('<link rel="stylesheet" href="/a.css" media="print"><link rel="stylesheet" href="/a.css" media="all">')],
    ['/a.css print', '/a.css'],
  );
});
