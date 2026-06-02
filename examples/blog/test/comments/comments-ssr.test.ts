/**
 * SSR regression for the comments thread first paint.
 *
 * The server-fetched `initial` comments are passed to <comments-thread> as a
 * prop. They must appear in the SSR'd HTML (the first paint), not pop in after
 * hydration. The component seeds its live `comments` signal from `initial` in
 * willUpdate (which runs at SSR as of the framework's pre-render lifecycle), so
 * renderToString shows the real list. The counterfactual: with no initial
 * comments, the empty-state placeholder is what renders.
 *
 * Run: node --test test/comments/comments-ssr.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import '../../modules/comments/components/comments-thread.ts';

const SAMPLE = [
  { id: 'c1', authorName: 'Ada', createdAt: new Date('2020-01-01').toISOString(), body: 'first-ssr-comment' },
  { id: 'c2', authorName: 'Linus', createdAt: new Date('2020-01-02').toISOString(), body: 'second-ssr-comment' },
];

// Assert on rendered CARD markup, not a body substring: the body text also
// appears inside the `initial="..."` attribute on the tag, so a bare substring
// match would false-pass even if the empty state rendered. The author name in
// a <strong> inside the card list is only present when a comment card rendered.
function rendersCards(out: string): boolean {
  return /<ul[^>]*>[\s\S]*<strong[^>]*>Ada<\/strong>[\s\S]*<strong[^>]*>Linus<\/strong>/.test(out)
    && !/No comments yet/.test(out);
}

test('SSR renders the initial comments via the property form (not the empty state)', async () => {
  const out = await renderToString(html`<comments-thread postId="p1" .initial=${SAMPLE} ?signedIn=${false}></comments-thread>`);
  assert.ok(rendersCards(out), `property form must render comment cards, got:\n${out}`);
});

test('SSR renders the initial comments via the attribute form the post page uses', async () => {
  // The post page renders `initial=${JSON.stringify(comments)}` (a string
  // attribute), so this is the path that actually ships. It exercises both the
  // willUpdate seed AND the Object-attribute entity decoding in the SSR walker.
  const out = await renderToString(html`<comments-thread postId="p1" initial=${JSON.stringify(SAMPLE)} ?signedIn=${false}></comments-thread>`);
  assert.ok(rendersCards(out), `attribute form must render comment cards, got:\n${out}`);
});

test('COUNTERFACTUAL: with no initial comments, the empty-state placeholder renders', async () => {
  const out = await renderToString(html`<comments-thread postId="p1" .initial=${[]} ?signedIn=${false}></comments-thread>`);
  assert.match(out, /No comments yet/, 'empty-state shown when there are no comments');
});
