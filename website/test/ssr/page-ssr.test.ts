/**
 * SSR smoke test for the landing page (app/page.ts), the redesign centerpiece.
 *
 * page.ts ties together the highlighter, copy-cmd, scroll-reveal, and the
 * data-reveal sections. This guards a render crash and the things that would
 * only otherwise surface at dogfood boot: a malformed html`` template, a
 * stray-backtick (invariant 9) regression in a code sample, a dropped command,
 * or the missing main landmark.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from '@webjsdev/core/server';
import LandingPage from '../../app/page.ts';

test('the landing page SSRs with its command, highlighted code, reveal sections, and a main landmark', async () => {
  const out = await renderToString(LandingPage());
  assert.ok(out.length > 1000, 'renders substantial HTML');
  assert.ok(out.includes('npm create webjs@latest my-app'), 'includes the install command');
  assert.match(out, /class="t-(kw|str|fn|type)"/, 'includes highlighted code tokens');
  assert.ok(out.includes('data-reveal'), 'includes the scroll-reveal sections');
  assert.ok(out.includes('<main id="main"'), 'wraps content in a main landmark');
});
