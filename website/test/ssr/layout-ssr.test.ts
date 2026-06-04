/**
 * SSR guard for the root layout.
 *
 * A literal custom-element tag written inside the foundation <style> block
 * (for example "<copy-cmd>" in a CSS comment) is picked up by the SSR pass and
 * rendered as a real element, which once produced a phantom copy-cmd whose
 * button floated at the page edge. The layout legitimately contains the
 * copy-cmd CSS selector text, but it must render no copy-cmd ELEMENT and no
 * copy button. This test renders the layout and asserts neither appears.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import RootLayout from '../../app/layout.ts';
import LandingPage from '../../app/page.ts';

test('the root layout SSR emits no phantom copy-cmd element or copy button', async () => {
  const out = await renderToString(RootLayout({ children: html`<main>content</main>` }));
  // cursor-copy is the copy button's class, present only if a copy-cmd rendered.
  assert.ok(!out.includes('cursor-copy'), 'no phantom copy button rendered from the layout');
  // An actual <copy-cmd ...> tag (not the CSS selector text "copy-cmd {").
  assert.ok(!/<copy-cmd[\s>]/.test(out), 'no phantom copy-cmd element rendered from the layout');
});

test('the skip-to-content link targets the page main landmark (paired)', async () => {
  // Compose the layout around the real page, the way the SSR pipeline does,
  // so the skip-link href and the landmark id are checked as a matching pair.
  const out = await renderToString(RootLayout({ children: LandingPage() }));
  const m = out.match(/href="#([\w-]+)"[^>]*>\s*Skip to content/);
  assert.ok(m, 'a skip-to-content link with an href fragment is rendered');
  assert.ok(out.includes(`<main id="${m[1]}"`), `the #${m[1]} target landmark exists on the page`);
});
