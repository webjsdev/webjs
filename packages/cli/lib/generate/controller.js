/**
 * The `controller` generator with Rails' arguments: a name and its actions.
 * In the App Router an action is a page, so
 *
 *   webjs generate controller pages home about
 *
 * writes `app/pages/home/page.ts` and `app/pages/about/page.ts` (an `index`
 * action is `app/pages/page.ts`), and a test that each renders.
 */
import { splitWords } from './names.js';

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./index.js').Plan} Plan
 */

const pascal = (/** @type {string[]} */ w) => w.map((x) => x[0].toUpperCase() + x.slice(1)).join('');

/**
 * @param {AppContext} ctx
 * @param {{ name: string, actions: string[] }} opts
 * @returns {Plan}
 */
export function planController(ctx, opts) {
  if (!ctx.hasPages) throw new Error('This app has no root layout (the api template), so it has no pages. Write a route.ts instead.');
  const words = splitWords(opts.name);
  if (!words) throw new Error(`"${opts.name}" is not a valid name. Use letters and digits, starting with a letter.`);
  const segment = words.join('-');
  const actions = (opts.actions.length ? opts.actions : ['index']).map((a) => {
    const w = splitWords(a);
    if (!w) throw new Error(`"${a}" is not a valid action name.`);
    return w;
  });
  /** @type {Plan} */
  const plan = { files: [], edits: [], notes: [] };
  const paths = [];
  for (const w of actions) {
    const index = w.length === 1 && w[0] === 'index';
    const url = index ? `/${segment}` : `/${segment}/${w.join('-')}`;
    const title = pascal(index ? words : [...words, ...w]).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    paths.push(url);
    plan.files.push({
      path: `app${url}/page.ts`,
      content: `import { html } from '@webjsdev/core';

export const metadata = { title: '${title}' };

export default function ${pascal(index ? words : [...words, ...w])}Page() {
  return html\`
    <section class="mx-auto max-w-2xl grid gap-4 py-10">
      <h1 class="text-2xl font-semibold m-0">${title}</h1>
      <p class="text-muted-foreground m-0">Find me in app${url}/page.ts.</p>
    </section>
  \`;
}
`,
    });
  }
  if (!ctx.skipTests) {
    plan.files.push({
      path: `test/${segment}/${segment}.test.ts`,
      content: `// Each ${segment} page renders, through the real request handler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { testRequest } from '@webjsdev/server/testing';

const app = await createRequestHandler({ appDir: fileURLToPath(new URL('../..', import.meta.url)), dev: true });

for (const path of ${JSON.stringify(paths).replace(/"/g, "'").replace(/,/g, ', ')}) {
  test(path + ' renders', async () => {
    assert.equal((await testRequest(app.handle, path)).status, 200);
  });
}
`,
    });
  }
  return plan;
}
