/**
 * A streamed Suspense boundary whose template arrives in more than one piece
 * must still swap in whole.
 *
 * The browser parser inserts a `<template data-webjs-resolve>` element before
 * it has parsed the template's content, and appends that content as the bytes
 * arrive. The boot resolver's MutationObserver fired on the insertion, so when
 * a response split inside a boundary (a network chunk, or the parser yielding
 * under load) it cloned a truncated `content` into the page, and the inline
 * `__webjsResolve` script that follows the template then found it gone. The
 * blog's differential-elision e2e caught it under load as a `<muted-text>`
 * with no projected slot.
 *
 * This serves the REAL boot script (`suspenseBootScript`) from a raw server
 * that pauses in the middle of the template, which forces the split every run,
 * and asserts the resolved markup is complete. The counterfactual serves the
 * pre-fix observer (no completeness check) the same way and shows it truncates,
 * so the test cannot pass vacuously.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/suspense-partial-template.test.mjs
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { suspenseBootScript } from '../../packages/server/src/ssr/head.js';

/** The observer as it was before the fix: it resolves on insertion. */
const PRE_FIX_BOOT = suspenseBootScript('').replace('&&n.nextSibling', '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} boot */
function serve(boot) {
  return http.createServer(async (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    // Padding past the parser's first-chunk buffering, so the shell is parsed
    // and the observer is live before the boundary streams.
    res.write(`<!doctype html><html><head>${boot}</head><body><main>` +
      `<p><webjs-boundary id="b1">computing…</webjs-boundary></p>` + ' '.repeat(4096));
    await sleep(150);
    res.write('<template data-webjs-resolve="b1"><muted-text><slot data-webjs-light>');
    await sleep(300);
    res.write('posts loaded</slot></muted-text></template>' +
      '<script>window.__webjsResolve&&__webjsResolve("b1")</script></main></body></html>');
    res.end();
  }).listen(0);
}

describe('E2E: a Suspense template split across chunks resolves whole', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser;
  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });
  after(async () => { if (browser) await browser.close(); });

  /** @param {string} boot */
  async function resolvedMain(boot) {
    const srv = serve(boot);
    const page = await browser.newPage();
    try {
      await page.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
      return await page.evaluate(() => {
        const main = document.querySelector('main');
        return {
          slotText: main.querySelector('muted-text slot')?.textContent ?? null,
          boundaryLeft: !!main.querySelector('webjs-boundary'),
          templateLeft: !!document.querySelector('template[data-webjs-resolve]'),
        };
      });
    } finally {
      await page.close();
      srv.close();
    }
  }

  test('the resolved boundary carries all of its streamed content', async () => {
    const r = await resolvedMain(suspenseBootScript(''));
    assert.deepEqual(r, { slotText: 'posts loaded', boundaryLeft: false, templateLeft: false });
  });

  test('counterfactual: the pre-fix observer swaps in a truncated template', async () => {
    const r = await resolvedMain(PRE_FIX_BOOT);
    assert.notEqual(PRE_FIX_BOOT, suspenseBootScript(''), 'the counterfactual must differ from the shipped script');
    assert.equal(r.boundaryLeft, false);
    assert.notEqual(r.slotText, 'posts loaded', 'the pre-fix resolver should have cloned the template before its text arrived');
  });
});
