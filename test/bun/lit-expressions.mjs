// Same assertions execute on Node and Bun; no DOM or transpilation required.
import assert from 'node:assert/strict';
import { html, nothing, noChange } from '@webjsdev/core';
import { classMap, styleMap, ifDefined } from '@webjsdev/core/directives';
import { renderToString, renderToStream } from '@webjsdev/core/server';

const template = html`<p title=${null} data-value=${false} lang=${ifDefined(undefined)} class="fixed ${classMap({ active: true })}" style=${styleMap({ '--n': 2 })} data-mixed="a ${nothing}">${false}/${true}/${noChange}</p>`;
const text = await renderToString(template, { ssr: false });
assert.equal((await Array.fromAsync(renderToStream(template, { ssr: false }))).join(''), text);
assert.match(text, /title=""/); assert.match(text, /data-value="false"/);
assert.doesNotMatch(text, /lang=|data-mixed/); assert.match(text, /false\/true\//);
console.log('Lit expressions: Node/Bun parity passed');
