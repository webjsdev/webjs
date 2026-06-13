import { WebComponent, html, signal } from '@webjsdev/core';
import { getGreeting } from '../modules/verbdemo/queries/get-greeting.server.ts';
import { bumpGreeting } from '../modules/verbdemo/actions/bump-greeting.server.ts';

/**
 * `<verb-greeting>`: the HTTP-verb action demo (#488). Its async render() awaits
 * a GET action (cacheable, seeded on first paint). The button runs a POST
 * mutation that invalidates the `greeting` tag, then bumps a local signal to
 * re-render; the re-read sees the invalidation and fetches fresh.
 */
export class VerbGreeting extends WebComponent {
  private tick = signal(0);

  async render() {
    this.tick.get(); // re-render dependency
    const g = await getGreeting();
    return html`<div class="verb-greeting">
      <span class="vg-text">${g.text}</span>
      <button class="vg-bump" @click=${async () => { await bumpGreeting(); this.tick.set(this.tick.get() + 1); }}>bump</button>
    </div>`;
  }
}
VerbGreeting.register('verb-greeting');
