/**
 * Unit tests for head-bound tag hoisting (#406).
 *
 * The framework hoists a contiguous leading run of <script> / <style> /
 * <link> tags out of the rendered body and into <head>, so render-blocking
 * assets (notably <link rel="stylesheet">) land where the browser reliably
 * honours them. The bug: an HTML comment interleaved with those tags (e.g.
 * "<!-- Self-hosted fonts -->" between a favicon <link> and the stylesheet
 * <link>, as in website/app/layout.ts) terminated the run, stranding the
 * stylesheet in <body>. A <link rel="stylesheet"> in <body> is not reliably
 * render-blocking, so the page painted unstyled first (FOUC on webjs.dev).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _hoistHeadTags } from '../../src/ssr.js';

const HEAD = '<head>\n<title>x</title>\n</head>';

test('hoists a contiguous run of head-bound tags', () => {
  const body = '<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/app.css"><main>hi</main>';
  const { head, body: out } = _hoistHeadTags(HEAD, body);
  assert.ok(head.includes('rel="icon"'));
  assert.ok(head.includes('rel="stylesheet"'));
  assert.equal(out.includes('rel="stylesheet"'), false, 'stylesheet must leave the body');
  assert.ok(out.includes('<main>hi</main>'));
});

test('a comment between head-bound tags does NOT strand the later tag (#406)', () => {
  // This is the regression: favicon, then a comment, then the stylesheet.
  const body =
    '<link rel="icon" href="/favicon.ico">' +
    '<!-- Self-hosted fonts -->' +
    '<link rel="stylesheet" href="/tailwind.css">' +
    '<main>content</main>';
  const { head, body: out } = _hoistHeadTags(HEAD, body);

  // Both links must reach <head> despite the interleaved comment.
  assert.ok(head.includes('rel="icon"'), 'favicon hoisted');
  assert.ok(head.includes('rel="stylesheet"'), 'stylesheet hoisted past the comment');

  // The stylesheet must NOT remain in the body (that is the FOUC).
  assert.equal(
    out.includes('rel="stylesheet"'),
    false,
    'stylesheet must not be stranded in the body',
  );

  // The comment is consumed (not re-emitted into the body), and real
  // content survives.
  assert.equal(out.includes('Self-hosted fonts'), false);
  assert.ok(out.includes('<main>content</main>'));
});

test('multiple comments interleaved still hoist every tag', () => {
  const body =
    '<!-- icons -->' +
    '<link rel="icon" href="/a.ico">' +
    '<!-- preconnect -->' +
    '<link rel="preconnect" href="https://fonts.example">' +
    '<!-- styles -->' +
    '<style>.x{}</style>' +
    '<link rel="stylesheet" href="/s.css">' +
    '<header>nav</header>';
  const { head, body: out } = _hoistHeadTags(HEAD, body);
  assert.ok(head.includes('rel="icon"'));
  assert.ok(head.includes('rel="preconnect"'));
  assert.ok(head.includes('<style>.x{}</style>'));
  assert.ok(head.includes('rel="stylesheet"'));
  assert.ok(out.includes('<header>nav</header>'));
  assert.equal(out.includes('rel="stylesheet"'), false);
});

test('a webjs client-router marker terminates the run (not swallowed)', () => {
  // A pathological layout that renders children right after its head tags:
  // the <!--wj:children:…--> marker must stay in the body so the client
  // router can find its nesting slot. It must NOT be consumed like a plain
  // comment.
  const body =
    '<link rel="stylesheet" href="/s.css">' +
    '<!--wj:children:/:/-->' +
    '<p>page</p>' +
    '<!--/wj:children:/-->';
  const { head, body: out } = _hoistHeadTags(HEAD, body);
  assert.ok(head.includes('rel="stylesheet"'), 'stylesheet still hoists');
  assert.ok(out.includes('<!--wj:children:/:/-->'), 'children boundary preserved in body');
  assert.ok(out.includes('<!--/wj:children:/-->'), 'closing children boundary preserved');
});

test('a comment with no following head tag leaves the body untouched', () => {
  // No head-bound tags at all: nothing hoists, body is returned verbatim
  // (the comment must not be silently dropped).
  const body = '<!-- a banner comment -->\n<main>just content</main>';
  const { head, body: out } = _hoistHeadTags(HEAD, body);
  assert.equal(head, HEAD, 'head unchanged when nothing hoists');
  assert.equal(out, body, 'body returned verbatim');
});
