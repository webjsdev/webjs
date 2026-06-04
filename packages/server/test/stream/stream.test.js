/**
 * Tests for the server-side stream-action helpers (#248).
 *
 * `stream.*` build the `<webjs-stream>` HTML the client applies surgically;
 * `streamResponse` wraps them in a `Response` carrying the stream content type;
 * `acceptsStream` reports whether a request opted into the stream path (its
 * `Accept` carries the stream MIME), which is how a form degrades to a normal
 * render with JS off.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stream, streamResponse, acceptsStream, STREAM_MIME } from '../../src/stream.js';

test('stream.append wraps the content in a <template> with action + target', () => {
  assert.equal(
    stream.append('comments', '<li>hi</li>'),
    '<webjs-stream action="append" target="comments"><template><li>hi</li></template></webjs-stream>',
  );
});

test('stream.replace / update / prepend / before / after carry their action', () => {
  assert.ok(stream.replace('card', '<div>x</div>').startsWith('<webjs-stream action="replace" target="card">'));
  assert.ok(stream.update('n', '4').startsWith('<webjs-stream action="update" target="n">'));
  assert.ok(stream.prepend('list', '<li>0</li>').startsWith('<webjs-stream action="prepend" target="list">'));
  assert.ok(stream.before('a', '<b/>').startsWith('<webjs-stream action="before" target="a">'));
  assert.ok(stream.after('a', '<b/>').startsWith('<webjs-stream action="after" target="a">'));
});

test('stream.remove needs no template', () => {
  assert.equal(stream.remove('row-7'), '<webjs-stream action="remove" target="row-7"></webjs-stream>');
});

test('the target id is attribute-escaped (no injection via a hostile id)', () => {
  const out = stream.append('a"><script>evil</script>', '<li>x</li>');
  assert.ok(!out.includes('"><script>'), 'a quote in the id cannot break out of the attribute');
  assert.ok(out.includes('&quot;&gt;&lt;script&gt;'), 'the id is escaped');
});

test('streamResponse carries the stream content type and joins parts', async () => {
  const res = streamResponse(stream.append('list', '<li>a</li>'), stream.update('n', '1'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), STREAM_MIME + '; charset=utf-8');
  const body = await res.text();
  assert.ok(body.includes('action="append"') && body.includes('action="update"'), 'both actions in the body');
});

test('acceptsStream is true only when the Accept header carries the stream MIME', () => {
  const mk = (accept) => new Request('http://x/', accept ? { headers: { accept } } : {});
  assert.equal(acceptsStream(mk('text/vnd.webjs-stream.html, text/html')), true);
  assert.equal(acceptsStream(mk('text/html')), false);
  assert.equal(acceptsStream(mk('')), false);
  assert.equal(acceptsStream(mk(null)), false);
  assert.equal(acceptsStream({}), false);
});
