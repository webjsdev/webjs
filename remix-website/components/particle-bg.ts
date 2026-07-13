import { WebComponent, html } from '@webjsdev/core';

/*
 * The fixed WebGL particle background. It SSRs an empty canvas (so the layout
 * reserves the space and no-JS readers get a plain black canvas), then boots
 * the Three.js engine in the browser only. The engine and Three.js are pulled
 * in through a dynamic import so SSR never touches WebGL or resolves "three".
 *
 * Booting is wrapped so a failure (for example Three.js not yet vendored)
 * degrades to a plain black background and still releases the loading screen,
 * rather than hanging the page.
 */

export class ParticleBg extends WebComponent {
  private _booted = false;

  connectedCallback() {
    super.connectedCallback();
    if (this._booted) return;
    this._booted = true;
    // Defer to the browser task queue so first paint is not blocked.
    queueMicrotask(() => this._boot());
  }

  private async _boot() {
    const canvas = this.querySelector('canvas');
    if (!canvas) return;
    try {
      const mod = await import('#app/landing/particle-boot.ts');
      await mod.startParticles(canvas as HTMLCanvasElement);
    } catch (err) {
      // Engine unavailable: keep the plain black background.
      console.warn('[particle-bg] engine boot skipped:', err);
    } finally {
      // Release the loading screen either way.
      window.dispatchEvent(new Event('particle-ready'));
    }
  }

  render() {
    return html`<canvas style="width:100%;height:100%;display:block"></canvas>`;
  }
}

ParticleBg.register('particle-bg');
