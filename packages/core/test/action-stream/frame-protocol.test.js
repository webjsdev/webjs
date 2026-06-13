/**
 * Streaming RPC wire protocol (#489): the length-prefixed frame format the
 * server encodes a streamed result with and the client stub decodes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeFrame, createFrameDecoder, FRAME_CHUNK, FRAME_END, FRAME_ERROR, STREAM_CONTENT_TYPE,
} from '@webjsdev/core';

const enc = new TextEncoder();
const dec = new TextDecoder();

test('the stream content type is the webjs stream MIME', () => {
  assert.equal(STREAM_CONTENT_TYPE, 'application/vnd.webjs+stream');
});

test('encodeFrame lays out [type][len:4 BE][payload]', () => {
  const f = encodeFrame(FRAME_CHUNK, enc.encode('hi'));
  assert.equal(f[0], FRAME_CHUNK);
  assert.deepEqual([...f.slice(1, 5)], [0, 0, 0, 2]);
  assert.equal(dec.decode(f.slice(5)), 'hi');
});

test('an END frame is a 5-byte header with zero length and no payload', () => {
  const f = encodeFrame(FRAME_END);
  assert.equal(f.length, 5);
  assert.equal(f[0], FRAME_END);
  assert.deepEqual([...f.slice(1, 5)], [0, 0, 0, 0]);
});

test('round-trips a sequence of CHUNK frames then END', () => {
  const d = createFrameDecoder();
  const bytes = [
    ...encodeFrame(FRAME_CHUNK, enc.encode('a')),
    ...encodeFrame(FRAME_CHUNK, enc.encode('bb')),
    ...encodeFrame(FRAME_END),
  ];
  const frames = d.push(new Uint8Array(bytes));
  assert.equal(frames.length, 3);
  assert.equal(dec.decode(frames[0].payload), 'a');
  assert.equal(dec.decode(frames[1].payload), 'bb');
  assert.equal(frames[2].type, FRAME_END);
});

test('reassembles a frame split across two pushes (partial header AND payload)', () => {
  const d = createFrameDecoder();
  const whole = encodeFrame(FRAME_CHUNK, enc.encode('hello world'));
  // Split mid-payload (after the header + 3 bytes).
  assert.deepEqual(d.push(whole.slice(0, 8)), []); // header complete, payload partial
  const frames = d.push(whole.slice(8));
  assert.equal(frames.length, 1);
  assert.equal(dec.decode(frames[0].payload), 'hello world');
});

test('reassembles a header split across the 5-byte boundary', () => {
  const d = createFrameDecoder();
  const whole = encodeFrame(FRAME_CHUNK, enc.encode('xy'));
  assert.deepEqual(d.push(whole.slice(0, 2)), []); // header incomplete
  assert.deepEqual(d.push(whole.slice(2, 4)), []); // still incomplete
  const frames = d.push(whole.slice(4));
  assert.equal(frames.length, 1);
  assert.equal(dec.decode(frames[0].payload), 'xy');
});

test('decodes two frames arriving glued in one chunk, leftover buffered', () => {
  const d = createFrameDecoder();
  const a = encodeFrame(FRAME_CHUNK, enc.encode('one'));
  const b = encodeFrame(FRAME_ERROR, enc.encode('boom'));
  // Push a + b minus its last byte; b stays buffered until the tail arrives.
  const glued = new Uint8Array([...a, ...b.slice(0, b.length - 1)]);
  let frames = d.push(glued);
  assert.equal(frames.length, 1);
  assert.equal(dec.decode(frames[0].payload), 'one');
  frames = d.push(b.slice(b.length - 1));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].type, FRAME_ERROR);
  assert.equal(dec.decode(frames[0].payload), 'boom');
});

test('handles a large payload whose length high bit is set (unsigned length)', () => {
  // A 200-byte payload: the low byte is 200 (>127), proving the length decode is
  // unsigned (a signed shift would corrupt it). Also exercises a >5-byte frame.
  const big = 'z'.repeat(200);
  const d = createFrameDecoder();
  const frames = d.push(encodeFrame(FRAME_CHUNK, enc.encode(big)));
  assert.equal(frames.length, 1);
  assert.equal(dec.decode(frames[0].payload), big);
});

test('an empty push returns no frames and does not disturb the buffer', () => {
  const d = createFrameDecoder();
  const whole = encodeFrame(FRAME_CHUNK, enc.encode('q'));
  d.push(whole.slice(0, 3));
  assert.deepEqual(d.push(new Uint8Array(0)), []);
  const frames = d.push(whole.slice(3));
  assert.equal(dec.decode(frames[0].payload), 'q');
});
