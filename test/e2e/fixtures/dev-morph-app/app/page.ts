import { html } from '@webjsdev/core';
import { msg } from '#lib/msg.server.ts';
import { hit } from '#lib/hits.server.ts';

/**
 * An inert page: no component of its own, so it is a plain server-rendered
 * module and an edit to it classifies as `page`. `PAGE_A` is the marker the
 * test rewrites, and the tall div is what makes scroll observable. `msg` is a
 * server-only value the in-place server refresh test edits, and `hits` counts
 * renders in a module no edit touches (#1689).
 */
export default function Home() {
  return html`
    <h1 id="page-marker">PAGE_A</h1>
    <p id="msg">${msg}</p>
    <p id="hits">${hit()}</p>
    <div style="height:3000px"></div>
  `;
}
