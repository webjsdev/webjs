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

console.log(`[${runtime}] owned stylesheet hoist parity OK`);
