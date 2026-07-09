/**
 * Tests for the /compare outbound-link behavior (#856).
 *
 * Two surfaces: the shared markdown renderer's absolute-vs-internal link
 * branching, and the compare [slug] page's competitor eyebrow link. Both
 * open off-site links in a new tab with the site's screen-reader cue, and
 * keep internal links navigating in place.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from '@webjsdev/core/server';
import { renderPostBody } from '#modules/blog/utils/render-post.ts';
import ComparePage from '#app/compare/[slug]/page.ts';

test('external markdown links open in a new tab with the a11y cue; internal links do not', () => {
  const external = renderPostBody('See the [Remix 3 beta](https://remix.run/blog/remix-3-beta-preview).');
  assert.match(external, /href="https:\/\/remix\.run\/blog\/remix-3-beta-preview"/, 'keeps the external href');
  assert.match(external, /target="_blank"/, 'external link opens in a new tab');
  assert.match(external, /rel="noopener noreferrer"/, 'external link carries rel noopener noreferrer');
  assert.match(external, /\(opens in a new tab\)/, 'external link appends the screen-reader cue');

  // An uppercase scheme is still external (schemes are case-insensitive).
  const upper = renderPostBody('[x](HTTPS://example.com)');
  assert.match(upper, /target="_blank"/, 'uppercase-scheme link is treated as external');

  // Counterfactual: an internal link must stay same-tab (no target/cue).
  const internal = renderPostBody('Read the [docs](/docs).');
  assert.match(internal, /href="\/docs"/, 'keeps the internal href');
  assert.doesNotMatch(internal, /target="_blank"/, 'internal link stays in place');
  assert.doesNotMatch(internal, /opens in a new tab/, 'internal link gets no new-tab cue');
});

test('a double quote in a link URL cannot break out of the href attribute', () => {
  const out = renderPostBody('[x](https://e.com/?q="bad")');
  assert.doesNotMatch(out, /\?q="bad"/, 'the raw quote is not emitted inside the attribute');
  assert.match(out, /%22/, 'the quote is percent-escaped in the href');
});

test('a link URL containing balanced parens is captured whole, not truncated', () => {
  const out = renderPostBody('[Ruby](https://en.wikipedia.org/wiki/Ruby_(programming_language))');
  // Counterfactual: the old `[^)]+` capture stopped at the first `)`, so the
  // href lost its `)` tail. The full URL must survive.
  assert.match(out, /href="https:\/\/en\.wikipedia\.org\/wiki\/Ruby_\(programming_language\)"/, 'href keeps the full parenthesized URL');
  assert.match(out, /target="_blank"/, 'still classified as an external link');
  // Counterfactual: the truncated form left a stray `)` right after the closing
  // </a>. The whole-URL form emits no such orphan.
  assert.doesNotMatch(out, /<\/a>\)/, 'no orphaned closing paren after the link');
});

test('an empty link URL stays literal text (no empty-href anchor)', () => {
  const out = renderPostBody('see [x]() here');
  assert.doesNotMatch(out, /<a /, 'does not emit an anchor for an empty URL');
  assert.match(out, /\[x\]\(\)/, 'leaves the malformed link as literal text');
});

test('the compare page shows a visible outbound link to the competitor site in a new tab', async () => {
  const out = await renderToString(await ComparePage({ params: { slug: 'webjs-vs-nextjs' } }));
  // A visible, underlined "Visit the Next.js site" link (distinguishable while
  // reading, not hover-only), pointing at nextjs.org, new tab, with the cue.
  assert.match(out, /<a href="https:\/\/nextjs\.org"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*class="[^"]*underline/, 'renders an underlined outbound link');
  assert.match(out, /Visit the Next\.js site/, 'the link is clearly labeled');
  assert.match(out, /\(opens in a new tab\)/, 'the outbound link carries the screen-reader cue');
});
