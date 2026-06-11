/**
 * Progressive soft-nav streaming helpers (#473), DOM-free units.
 *
 * `readStreamedShell` returns the shell as soon as the first streamed boundary
 * template appears (so the router can swap it in before the slow boundary
 * arrives), and `takeResolveUnit` extracts each complete
 * `<template data-webjs-resolve>` unit, depth-tracking nested templates.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { _readStreamedShell, _takeResolveUnit } from '../../src/router-client.js';

/** Build a Response whose body streams the given chunks in order. */
function streamingResponse(chunks) {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/html' } });
}

test('readStreamedShell returns the whole body when there are no boundaries', async () => {
  const resp = streamingResponse(['<html><body><p>hello</p>', '</body></html>']);
  const r = await _readStreamedShell(resp);
  assert.equal(r.streaming, false);
  assert.match(r.shell, /<p>hello<\/p>/);
  assert.match(r.shell, /<\/body><\/html>/);
});

test('readStreamedShell splits the shell at the first streamed boundary', async () => {
  const resp = streamingResponse([
    '<html><body><webjs-suspense id="s1"><i>loading</i></webjs-suspense></body></html>',
    '<template data-webjs-resolve="s1"><p>real</p></template><script>swap()</script>',
  ]);
  const r = await _readStreamedShell(resp);
  assert.equal(r.streaming, true);
  assert.match(r.shell, /<webjs-suspense id="s1"><i>loading<\/i><\/webjs-suspense>/);
  assert.doesNotMatch(r.shell, /data-webjs-resolve/, 'the shell stops before the boundary template');
  assert.match(r.rest, /^<template data-webjs-resolve="s1">/, 'the leftover begins at the boundary');
});

test('takeResolveUnit extracts one complete boundary and the remainder', () => {
  const buf = '<template data-webjs-resolve="s1"><p>a</p></template><script>x</script><template data-webjs-resolve="s2">';
  const u = _takeResolveUnit(buf);
  assert.ok(u);
  assert.equal(u.id, 's1');
  assert.equal(u.content, '<p>a</p>');
  assert.match(u.rest, /^<script>x<\/script><template data-webjs-resolve="s2">/);
});

test('takeResolveUnit returns null until the closing tag has streamed', () => {
  assert.equal(_takeResolveUnit('<template data-webjs-resolve="s1"><p>partial'), null);
});

test('takeResolveUnit depth-tracks a NESTED template (a streamed shadow component)', () => {
  // The resolved content carries a <template shadowrootmode> for a shadow
  // component; the naive first-</template> would close too early.
  const buf =
    '<template data-webjs-resolve="s1">' +
    '<my-card><template shadowrootmode="open"><p>shadow</p></template></my-card>' +
    '</template><script>x</script>';
  const u = _takeResolveUnit(buf);
  assert.ok(u, 'the unit is complete');
  assert.equal(u.id, 's1');
  assert.match(u.content, /<template shadowrootmode="open"><p>shadow<\/p><\/template>/, 'inner template preserved');
  assert.match(u.rest, /^<script>x<\/script>/);
});
