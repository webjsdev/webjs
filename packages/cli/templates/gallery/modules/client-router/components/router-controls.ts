// Programmatic client navigation. `navigate(url)` does the same soft, in-place
// swap an <a> click does, but from an event handler (after a save, a wizard
// step, etc.). `revalidate(url?)` evicts the browser snapshot cache so the next
// visit refetches fresh HTML instead of the cached page. `disableClientRouter()`
// / `enableClientRouter()` turn soft navigation off / back on at runtime (for a
// moment where you want a full page load, e.g. handing off to a third-party
// flow). disableClientRouter() removes the document-level <a>/<form> click
// interception, so PLAIN links start doing full page loads again. It does NOT
// affect navigate(), which is an explicit programmatic swap the toggle never
// intercepts, so the plain link below is what visibly changes when you toggle.
// All are client-only (they run in the browser), so a component is the right
// home; a page/layout never hydrates. With JS off the plain link still works
// (progressive enhancement), while the buttons are inert.
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
      <div class="grid gap-3">
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
        <p class="text-sm text-muted-foreground">
          Plain link:
          <a href="/features/client-router/second" class="text-primary underline">/features/client-router/second</a>.
          ${soft
            ? html`The router is on, so this soft-navigates (no full reload). Toggle it off, then click again to watch the browser do a full page load.`
            : html`The router is off, so this now does a FULL page load. The navigate() button still soft-navigates (it is explicit and ignores the toggle).`}
        </p>
      </div>
    `;
  }
}
RouterControls.register('router-controls');
