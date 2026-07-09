// A shadow-DOM component: `static shadow = true` scopes `static styles = css\`\``
// to this element (bare selectors do not leak out), the one place the lit reflex
// to scope CSS is right in webjs. It also shows the rest of the signals API:
// `computed` (a derived signal), `effect` (a browser-side reaction that runs on
// change), and `batch` (coalesce several writes into ONE re-render).
import { WebComponent, html, css, signal, computed, effect, batch } from '@webjsdev/core';

export class ReactiveMeter extends WebComponent {
  static shadow = true;
  static styles = css`
    .row { display: flex; align-items: center; gap: 8px; }
    button {
      padding: 6px 12px; border-radius: 10px; border: 1px solid #8883;
      background: transparent; color: inherit; cursor: pointer; font: inherit;
    }
    .val { font-variant-numeric: tabular-nums; font-weight: 600; }
    .muted { opacity: 0.6; font-size: 13px; }
  `;

  private count = signal(0);
  // computed: recomputed lazily when count changes, cached otherwise.
  private doubled = computed(() => this.count.get() * 2);
  private lastLogged = signal('');
  private disposeEffect?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // effect: runs now and again whenever a signal it reads changes. Browser-only
    // (SSR never calls connectedCallback), so it is the place for reactive
    // side effects.
    this.disposeEffect = effect(() => {
      this.lastLogged.set('count is ' + this.count.get());
    });
  }
  disconnectedCallback() {
    super.disconnectedCallback?.();
    this.disposeEffect?.();
  }

  private bump(n: number) {
    this.count.set(this.count.get() + n);
  }
  // batch: both writes commit together, so the component re-renders ONCE.
  private reset() {
    batch(() => {
      this.count.set(0);
      this.lastLogged.set('reset');
    });
  }

  render() {
    return html`
      <div class="row">
        <button @click=${() => this.bump(-1)}>-1</button>
        <span class="val">${this.count.get()}</span>
        <button @click=${() => this.bump(1)}>+1</button>
        <span class="muted">doubled: ${this.doubled.get()}</span>
        <button @click=${() => this.reset()}>reset</button>
      </div>
      <p class="muted">${this.lastLogged.get()}</p>
    `;
  }
}
ReactiveMeter.register('reactive-meter');
