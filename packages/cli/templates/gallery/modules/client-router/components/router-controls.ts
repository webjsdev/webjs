// Programmatic client navigation. `navigate(url)` does the same soft, in-place
// swap an <a> click does, but from an event handler (after a save, a wizard
// step, etc.). `revalidate(url?)` evicts the browser snapshot cache so the next
// visit refetches fresh HTML instead of the cached page. `disableClientRouter()`
// / `enableClientRouter()` turn soft navigation off / back on at runtime (for a
// moment where you want a full page load, e.g. handing off to a third-party
// flow). All are client-only (they run in the browser), so a component is the
// right home; a page/layout never hydrates. With JS off this component is
// inert, so keep real navigation on plain <a href> and use navigate() only for
// JS-driven flows.
import { WebComponent, html, signal, navigate, revalidate, disableClientRouter, enableClientRouter } from '@webjsdev/core';

export class RouterControls extends WebComponent {
  // Instance signal mirroring whether soft navigation is currently on.
  private soft = signal(true);

  private toggleRouter() {
    if (this.soft.get()) disableClientRouter();
    else enableClientRouter();
    this.soft.set(!this.soft.get());
  }

  render() {
    const soft = this.soft.get();
    return html`
      <div class="flex flex-wrap gap-3 items-center">
        <button
          @click=${() => navigate('/features/client-router/second')}
          class="inline-flex items-center px-4 py-2 rounded-xl bg-card border border-border text-foreground font-medium text-sm cursor-pointer transition-colors hover:border-border-strong">navigate() to page two</button>
        <button
          @click=${() => revalidate()}
          class="text-muted-foreground font-medium text-sm cursor-pointer transition-colors hover:text-foreground underline decoration-dotted underline-offset-4">revalidate() the snapshot cache</button>
        <button
          @click=${() => this.toggleRouter()}
          class="text-muted-foreground font-medium text-sm cursor-pointer transition-colors hover:text-foreground underline decoration-dotted underline-offset-4">${soft ? 'disableClientRouter()' : 'enableClientRouter()'} (soft nav: ${soft ? 'on' : 'off'})</button>
      </div>
    `;
  }
}
RouterControls.register('router-controls');
