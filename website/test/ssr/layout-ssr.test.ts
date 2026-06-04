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
import NotFound from '../../app/not-found.ts';
import ErrorBoundary from '../../app/error.ts';

test('the root layout SSR emits no phantom copy-cmd element or copy button', async () => {
  const out = await renderToString(RootLayout({ children: html`<main>content</main>` }));
  // cursor-copy is the copy button's class, present only if a copy-cmd rendered.
  assert.ok(!out.includes('cursor-copy'), 'no phantom copy button rendered from the layout');
  // An actual <copy-cmd ...> tag (not the CSS selector text "copy-cmd {").
  assert.ok(!/<copy-cmd[\s>]/.test(out), 'no phantom copy-cmd element rendered from the layout');
});

test('every nav landmark carries a distinguishing aria-label', async () => {
  // Multiple <nav> landmarks (header desktop, header mobile-menu, footer)
  // must each have an accessible name so a screen reader's landmark list can
  // tell them apart. Assert no <nav> ships without an aria-label, and that
  // the header and footer names are distinct (both can sit in the a11y tree
  // on a mobile viewport at once).
  const out = await renderToString(RootLayout({ children: LandingPage() }));
  const navs = out.match(/<nav\b[^>]*>/g) || [];
  assert.ok(navs.length >= 2, 'the composed document renders multiple nav landmarks');
  const labels = navs.map((tag) => (tag.match(/aria-label="([^"]+)"/) || [])[1]);
  for (let i = 0; i < navs.length; i++) {
    assert.ok(labels[i], `nav landmark is unlabeled: ${navs[i]}`);
  }
  // Every nav landmark needs a UNIQUE name so the landmark list can tell them
  // apart (two same-named navs read as ambiguous duplicates).
  assert.equal(new Set(labels).size, labels.length, `nav labels must be unique, saw: ${labels.join(', ')}`);
  assert.ok(labels.includes('Footer'), 'the footer nav is labeled Footer');
});

test('external new-tab links announce the context change and hide decorative glyphs', async () => {
  const out = await renderToString(RootLayout({ children: LandingPage() }));
  // Every target="_blank" link carries a visually-hidden new-tab cue.
  assert.ok(out.includes('class="sr-only"> (opens in a new tab)'), 'external links carry an sr-only new-tab cue');
  // The banner's decorative arrow is hidden from the accessible name.
  assert.ok(out.includes('aria-hidden="true">&rarr;</span>'), 'the banner arrow glyph is aria-hidden');
  // The cue rides multiple external links (nav + CTAs + footer), not a single one.
  const count = (out.match(/\(opens in a new tab\)/g) || []).length;
  assert.ok(count >= 5, `the new-tab cue appears on multiple external links (saw ${count})`);
});

test('the nav links to the live example-blog app via a Demo link', async () => {
  // The "Demo" link surfaces the deployed example-blog app (DEMO_URL). It
  // falls back to the production domain, so it renders even with no env var
  // set. Guards against the link being dropped again.
  const out = await renderToString(RootLayout({ children: LandingPage() }));
  assert.ok(out.includes('>Demo<'), 'a Demo nav link is rendered');
  assert.ok(out.includes('https://demo.webjs.dev'), 'the Demo link points at the demo app');
});

test('the skip-to-content link resolves on the 404 and error pages too', async () => {
  // The skip link lives in the layout and wraps EVERY page, so the 404 and
  // error-boundary pages must also expose a #main target, not just the landing
  // page. Compose the layout around each and assert the fragment resolves.
  for (const [name, page] of [['not-found', NotFound()], ['error', ErrorBoundary({ error: new Error('boom') })]] as const) {
    const out = await renderToString(RootLayout({ children: page }));
    const m = out.match(/href="#([\w-]+)"[^>]*>\s*Skip to content/);
    assert.ok(m, `${name}: a skip-to-content link is rendered`);
    assert.ok(out.includes(`<main id="${m[1]}" tabindex="-1"`), `${name}: the #${m[1]} target is a focusable main landmark`);
  }
});

test('the skip-to-content link targets the page main landmark (paired)', async () => {
  // Compose the layout around the real page, the way the SSR pipeline does,
  // so the skip-link href and the landmark id are checked as a matching pair.
  const out = await renderToString(RootLayout({ children: LandingPage() }));
  const m = out.match(/href="#([\w-]+)"[^>]*>\s*Skip to content/);
  assert.ok(m, 'a skip-to-content link with an href fragment is rendered');
  // The target must be programmatically focusable (tabindex="-1") or activating
  // the skip link only scrolls; focus must actually land in the content.
  assert.ok(out.includes(`<main id="${m[1]}" tabindex="-1"`), `the #${m[1]} target is a focusable main landmark`);
});
