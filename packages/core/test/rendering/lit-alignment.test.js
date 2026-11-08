import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../../src/html.js';
import { nothing, noChange } from '../../src/sentinels.js';
import { classMap, styleMap, ifDefined } from '../../src/attribute-directives.js';
import { renderToString, renderToStream } from '../../src/render-server.js';

test('Lit expression semantics match buffered and streaming SSR', async () => {
  const template = html`<p title=${null} data-flag=${false} data-missing=${nothing} data-mixed="a ${nothing} b" class="fixed ${classMap({ active: true, inactive: false })}" style=${styleMap({ color: 'red', '--n': 2 })} lang=${ifDefined(undefined)}>${false}/${true}/${nothing}/${noChange}</p>`;
  const buffered = await renderToString(template, { ssr: false });
  const streamed = (await Array.fromAsync(renderToStream(template, { ssr: false }))).join('');
  assert.equal(streamed, buffered);
  assert.match(buffered, /title=""/); assert.match(buffered, /data-flag="false"/);
  assert.doesNotMatch(buffered, /data-missing|data-mixed|lang=/);
  assert.match(buffered, /fixed +active/); assert.match(buffered, /color:red;--n:2;/);
  assert.match(buffered, />false\/true\/\/<\/p>/);
});
test('quoted specialized bindings are accepted by SSR and invalid mixed values reject', async () => {
  assert.match(await renderToString(html`<input ?disabled="${true}" @click="${() => {}}">`, { ssr: false }), /disabled=""/);
  await assert.rejects(renderToString(html`<input .value="prefix ${'text'}">`, { ssr: false }), /exactly one expression/);
});
