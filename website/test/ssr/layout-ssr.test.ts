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

test('the root layout SSR emits no phantom copy-cmd element or copy button', async () => {
  const out = await renderToString(RootLayout({ children: html`<main>content</main>` }));
  // cursor-copy is the copy button's class, present only if a copy-cmd rendered.
  assert.ok(!out.includes('cursor-copy'), 'no phantom copy button rendered from the layout');
  // An actual <copy-cmd ...> tag (not the CSS selector text "copy-cmd {").
  assert.ok(!/<copy-cmd[\s>]/.test(out), 'no phantom copy-cmd element rendered from the layout');
});
