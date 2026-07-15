import { WebComponent, html, signal } from '@webjsdev/core';

/*
 * The full-screen black overlay with the animated WebJs runner, ported from
 * the WebJs site's loading-screen plus its landing-enhancements dismissal.
 * It SSRs so the first paint is the runner, then dismisses once the page has
 * settled: after a minimum display time AND the window load event, OR as soon
 * as the particle background signals its first frame.
 *
 * Interactivity is the only thing that needs JS, so the dismissal lives here.
 * With JS off the overlay is hidden via a noscript rule in the layout, so a
 * no-JS reader still reaches the content underneath.
 */

const MIN_MS = 900;

export class LoadingScreen extends WebComponent {
  phase = signal<'show' | 'dismissing' | 'gone'>('show');
  private _t: ReturnType<typeof setTimeout> | undefined;
  private _done = false;

  connectedCallback() {
    super.connectedCallback();
    const start = performance.now();

    const dismiss = () => {
      if (this._done) return;
      this._done = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      this._t = setTimeout(() => {
        this.phase.set('dismissing');
        this._t = setTimeout(() => this.phase.set('gone'), 620);
      }, wait);
    };

    // The particle engine fires this once its first frame is on screen.
    window.addEventListener('particle-ready', dismiss, { once: true });

    // Fallbacks so the overlay never gets stuck if the engine never boots.
    if (document.readyState === 'complete') dismiss();
    else window.addEventListener('load', dismiss, { once: true });
    setTimeout(dismiss, 4000);
  }

  disconnectedCallback() {
    if (this._t) clearTimeout(this._t);
    super.disconnectedCallback?.();
  }

  render() {
    const phase = this.phase.get();
    if (phase === 'gone') return html``;
    const cls = phase === 'dismissing' ? 'loading-screen-overlay is-dismissed' : 'loading-screen-overlay';
    return html`
      <div class=${cls}>
        <svg class="loading-w" viewBox="20 -6 260 176" role="img" aria-label="Loading WebJs">
          <g transform="translate(40,0) skewX(-14)">
            <path class="lw-mark" d="M10 10 L60 150 L110 66 L160 150 L210 10" fill="none" stroke="#fff" stroke-width="32" stroke-linejoin="miter" stroke-linecap="butt"/>
          </g>
          <rect class="lw-strike" x="18" y="79" width="248" height="13" fill="#000"/>
        </svg>
      </div>
    `;
  }
}

LoadingScreen.register('loading-screen');
