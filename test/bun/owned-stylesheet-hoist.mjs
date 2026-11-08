/**
 * Cross-runtime proof that the owned-stylesheet hoist (#1669) produces the
 * same document under WHICHEVER runtime executes this file. Run under both:
 *
 *   node test/bun/owned-stylesheet-hoist.mjs
 *   bun  test/bun/owned-stylesheet-hoist.mjs
 *
 * The hoist is a sticky-regex scan over the rendered body inside the SSR
 * document assembly, so a regex difference between V8 and JavaScriptCore
 * would move a stylesheet or strand it in the body. A plain assert script
 * (not `*.test.mjs`), exits non-zero on failure.
 */
import assert from 'node:assert/strict';
import { _buildDocumentParts } from '../../packages/server/src/ssr.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const body =
  '<link rel="stylesheet" href="/tailwind.css">' +
  '<!--wj:children:/:/--><!-- kit --><link rel="preload" as="font" href="/f.woff2">' +
  '<link rel="stylesheet" href="/ui.css"><div>' +
  "<!--wj:children:/ui:/ui--><link rel='stylesheet' href='/nova.css' /><link rel=\"stylesheet\" href=\"/ui.css\"><main></main>" +
  '<!--/wj:children:/ui--></div><!--/wj:children:/-->';

const { prefix, streamBody } = _buildDocumentParts(body, { metadata: {}, moduleUrls: [], dev: false, streaming: false });
const head = prefix.slice(0, prefix.indexOf('</head>'));

assert.ok(head.includes('<link rel="stylesheet" href="/tailwind.css">'), `[${runtime}] the root sheet stays untagged`);
assert.ok(head.indexOf('href="/ui.css" data-wj-style-owner="/"') > head.indexOf('/tailwind.css'), `[${runtime}] ui.css owned by / after the root`);
assert.ok(head.includes("href='/nova.css' data-wj-style-owner=\"/ui\""), `[${runtime}] nova.css owned by /ui`);
assert.equal(head.match(/ui\.css/g).length, 1, `[${runtime}] the second ui.css is dropped`);
assert.equal(/rel=["']stylesheet["']/.test(streamBody), false, `[${runtime}] no stylesheet left in the body`);
assert.ok(streamBody.includes('<!-- kit --><link rel="preload" as="font" href="/f.woff2"><div>'), `[${runtime}] the comment and the preload stay put`);

// A `$` sequence in an href is spliced in literally, and a print copy of a
// file does not stand in for its screen copy.
const dollar = _buildDocumentParts(
  "<!--wj:children:/:/--><link rel=\"stylesheet\" href=\"/x$'y.css\"><link rel=\"stylesheet\" href=\"/p.css\" media=\"print\"><link rel=\"stylesheet\" href=\"/p.css\"><main></main><!--/wj:children:/-->",
  { metadata: {}, moduleUrls: [], dev: false, streaming: false },
).prefix;
assert.ok(dollar.includes("href=\"/x$'y.css\" data-wj-style-owner=\"/\">"), `[${runtime}] a $ sequence is inserted as written`);
assert.equal(dollar.split('</head>').length, 2, `[${runtime}] and the head is closed once`);
assert.equal(dollar.match(/href="\/p\.css"/g).length, 2, `[${runtime}] the print and the screen copy are both kept`);

// With the page url, ./a.css and /docs/a.css name one file, linked once.
const relative = _buildDocumentParts(
  '<link rel="stylesheet" href="/docs/a.css"><!--wj:children:/docs:/docs--><link rel="stylesheet" href="./a.css"><p></p><!--/wj:children:/docs-->',
  { metadata: {}, moduleUrls: [], dev: false, streaming: false, pageUrl: 'http://x/docs/page' },
).prefix;
assert.equal(relative.match(/a\.css/g).length, 1, `[${runtime}] a relative and an absolute href to one file are one sheet`);

console.log(`[${runtime}] owned stylesheet hoist parity OK`);
