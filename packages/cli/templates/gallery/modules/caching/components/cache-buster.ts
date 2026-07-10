// A button that calls the bustCaches() server action (imported as a typed RPC
// stub). Client-only interactivity, so it lives in a component; with JS off the
// button is inert (cache eviction there happens as a side effect of the write
// action that changed the data).
import { WebComponent, signal, html } from '@webjsdev/core';
import { bustCaches } from '#modules/caching/actions/bust-caches.server.ts';

export class CacheBuster extends WebComponent {
  private status = signal('');

  private async bust() {
    this.status.set('evicting…');
    const result = await bustCaches();
    this.status.set(result.success ? 'caches evicted' : 'failed');
  }

  render() {
    return html`
      <div class="flex items-center gap-3 text-[15px]">
        <button @click=${() => this.bust()}
          class="px-3.5 py-1.5 rounded-xl bg-card border border-border text-foreground text-sm cursor-pointer">revalidate the caches</button>
        <span class="text-muted-foreground">${this.status.get()}</span>
      </div>
    `;
  }
}
CacheBuster.register('cache-buster');
