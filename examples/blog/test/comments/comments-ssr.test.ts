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

test('SSR renders the server-provided initial comments (not the empty state)', async () => {
  const out = await renderToString(html`<comments-thread postId="p1" .initial=${SAMPLE} ?signedIn=${false}></comments-thread>`);
  assert.match(out, /first-ssr-comment/, 'first initial comment is in the SSR HTML');
  assert.match(out, /second-ssr-comment/, 'second initial comment is in the SSR HTML');
  assert.doesNotMatch(out, /No comments yet/, 'the empty-state placeholder is not shown when comments exist');
});

test('COUNTERFACTUAL: with no initial comments, the empty-state placeholder renders', async () => {
  const out = await renderToString(html`<comments-thread postId="p1" .initial=${[]} ?signedIn=${false}></comments-thread>`);
  assert.match(out, /No comments yet/, 'empty-state shown when there are no comments');
});
