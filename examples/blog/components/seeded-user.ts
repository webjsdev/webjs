import { WebComponent, html } from '@webjsdev/core';
import { getSeedUser } from '#modules/seed/queries/get-user.server.ts';

/**
 * `<seeded-user>`: the SSR action-seeding fixture (#472). It awaits a real
 * `'use server'` action in `async render()` (so its data is in the first paint)
 * AND carries an `@click` that bumps `uid` (so it SHIPS, hydrates, and can
 * refetch). On initial load the action result is seeded, so NO action RPC fires
 * on hydration; clicking bumps `uid` to an unseeded id, which DOES fetch.
 */
export class SeededUser extends WebComponent({ uid: Number }) {
  constructor() {
    super();
    this.uid = 1;
  }

  async render() {
    const u = await getSeedUser(this.uid);
    return html`<div class="seeded-user">
      <span class="seeded-name" data-joined=${u.joined.getFullYear()}>${u.name}</span>
      <button class="seeded-bump" @click=${() => { this.uid = this.uid + 1; }}>bump</button>
    </div>`;
  }
}
SeededUser.register('seeded-user');
