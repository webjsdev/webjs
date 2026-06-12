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

test('readStreamedShell delimits a full page at </html> (boundaries may follow)', async () => {
  const resp = streamingResponse(['<html><body><p>hello</p>', '</body></html>']);
  const r = await _readStreamedShell(resp);
  // A full page is delimited at </html>; the applier then finds no boundaries.
  assert.equal(r.streaming, true);
  assert.match(r.shell, /<p>hello<\/p>/);
  assert.match(r.shell, /<\/body><\/html>$/, 'shell ends exactly at </html>');
});

test('readStreamedShell returns the whole fragment when there is no shell close and no boundary', async () => {
  // An X-Webjs-Have partial fragment has no </html> and no boundaries.
  const resp = streamingResponse(['<section><p>partial</p></section>']);
  const r = await _readStreamedShell(resp);
  assert.equal(r.streaming, false);
  assert.match(r.shell, /<section><p>partial<\/p><\/section>/);
});

test('readStreamedShell returns the shell at the sentinel, BEFORE the slow boundary', async () => {
  // The real SSR stream flushes `prefix + body + <!--wj-stream-shell-->` in one
  // chunk, then pauses for the slow data. The shell must resolve on the
  // sentinel, not wait for the boundary template or the trailing </html>.
  const enc = new TextEncoder();
  let pushRest;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode('<html><body><webjs-suspense id="s1"><i>loading</i></webjs-suspense><!--wj-stream-shell-->'));
      pushRest = () => {
        controller.enqueue(enc.encode('<template data-webjs-resolve="s1"><p>real</p></template>\n</body>\n</html>'));
        controller.close();
      };
    },
  });
  const resp = new Response(body, { headers: { 'content-type': 'text/html' } });
  const r = await _readStreamedShell(resp);   // resolves without pushRest()
  assert.equal(r.streaming, true);
  assert.ok(r.reader, 'reader stays open for the boundary');
  assert.match(r.shell, /<webjs-suspense id="s1"><i>loading<\/i><\/webjs-suspense>$/, 'shell ends at the sentinel');
  assert.doesNotMatch(r.shell, /wj-stream-shell|data-webjs-resolve|<\/html>/, 'shell excludes the sentinel, boundary, and closer');
  pushRest();
  try { await r.reader.cancel(); } catch { /* ignore */ }
});

test('readStreamedShell returns the shell at </html>, BEFORE the slow boundary streams', async () => {
  // The real SSR stream flushes the shell + </body></html> first, then the
  // boundary template arrives later (after the slow data). A reader that
  // only delivers the shell chunk so far must still resolve the shell now.
  const enc = new TextEncoder();
  let pushBoundary;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode('<html><body><webjs-suspense id="s1"><i>loading</i></webjs-suspense></body></html>'));
      // The boundary is held back (simulating the slow async data).
      pushBoundary = () => {
        controller.enqueue(enc.encode('<template data-webjs-resolve="s1"><p>real</p></template>'));
        controller.close();
      };
    },
  });
  const resp = new Response(body, { headers: { 'content-type': 'text/html' } });
  const r = await _readStreamedShell(resp);   // must resolve without pushBoundary()
  assert.equal(r.streaming, true);
  assert.ok(r.reader, 'the reader stays open for the boundary');
  assert.match(r.shell, /<webjs-suspense id="s1"><i>loading<\/i><\/webjs-suspense>/);
  assert.match(r.shell, /<\/html>$/, 'shell ends at </html>');
  assert.doesNotMatch(r.shell, /data-webjs-resolve/, 'the slow boundary is NOT in the shell');
  pushBoundary();   // release so the stream can close
  if (pushBoundary && r.reader) { try { await r.reader.cancel(); } catch { /* ignore */ } }
});

test('readStreamedShell splits at an already-buffered fast boundary', async () => {
  // A fully-buffered response (stream ends with the boundary present): split
  // at the boundary marker so the applier gets it in `rest`.
  const resp = streamingResponse([
    '<html><body><x-y id="s1"></x-y><template data-webjs-resolve="s1"><p>real</p></template></body></html>',
  ]);
  const r = await _readStreamedShell(resp);
  assert.equal(r.streaming, true);
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
