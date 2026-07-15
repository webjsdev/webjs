import { WebComponent, html } from '@webjsdev/core';

/*
 * The WebJs wordmark that starts full-width under the nav and shrinks into a
 * small fixed logo in the top-left corner as the page scrolls, trailed by
 * five brand-colored "ghost" copies that fan out during fast scrolling and
 * settle when motion stops (a port of the real site's ScrollLogo).
 *
 * SSR paints the full-width state via CSS custom properties (width
 * calc(100vw - 48px), top 92px), so the first paint is correct with no JS.
 * The browser then drives the shrink imperatively in a rAF loop, writing
 * transforms/widths straight to the SVG elements. There is no re-render on
 * scroll; render() runs once.
 */

const SMALL_HEIGHT = 16;
const LARGE_TOP = 170;
const SMALL_TOP = 24;
const LEFT = 24;
const SCROLL_PX = 120;
const SVG_RATIO = 760 / 170;
// Cap the large (top) wordmark so a short word keeps natural proportions
// instead of stretching edge to edge. Matches the CSS SSR clamp in home.css.
const MAX_LARGE_WIDTH = 560;
const SMALL_WIDTH = SMALL_HEIGHT * SVG_RATIO;

const BRAND_COLORS = ['#2dacf9', '#7ce95a', '#ffdf5f', '#fa73da', '#ff3c32'];
// Seconds-scale exponential time constants; each ghost settles toward the
// target independently, so the trail fans out during fast scrolling and
// collapses smoothly when motion stops.
const GHOST_TAUS = [0.018, 0.03, 0.045, 0.06, 0.08];
// Width delta (px between ghost and main) that maps to full ghost opacity.
const OPACITY_FALLOFF_PX = 18;
const SETTLE_EPSILON = 0.2;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function scrollProgress(scrollY: number) {
  const linear = clamp01(scrollY / SCROLL_PX);
  return linear < 0.5
    ? 4 * linear * linear * linear
    : 1 - Math.pow(-2 * linear + 2, 3) / 2;
}

// The wordmark rides a CSS mask over a plain <span> (the same technique as
// the package badges): mask-image of the SVG asset, background currentColor.
// Inline SVG was abandoned twice over: a template hole inside <svg> hydrates
// in the HTML namespace (invisible paths), and a shared <defs> + <use> clone
// does not pick up the animated --brand-cycle fill in Chromium.

export class ScrollLogo extends WebComponent {
  private _ghosts: HTMLElement[] = [];
  private _link: HTMLAnchorElement | null = null;
  private _main: HTMLElement | null = null;
  private _ghostState: { width: number; top: number }[] = [];
  private _rafId = 0;
  private _lastTime = 0;
  private _largeWidth = 0;
  private _vw = 0;
  private _reduced = false;
  private _onScroll = () => this._ensureLoop();
  private _onResize = () => {
    this._largeWidth = Math.min(window.innerWidth - LEFT * 2, MAX_LARGE_WIDTH);
    this._vw = window.innerWidth;
    this._ensureLoop();
  };

  // Capture refs after the first client render commits: connectedCallback
  // would grab the SSR nodes that hydration then replaces, leaving the rAF
  // loop writing to detached elements.
  firstUpdated() {
    this._link = this.querySelector('a');
    this._main = this._link?.querySelector('span') ?? null;
    this._ghosts = Array.from(this.querySelectorAll('span[data-ghost]'));
    this._largeWidth = Math.min(window.innerWidth - LEFT * 2, MAX_LARGE_WIDTH);
    this._vw = window.innerWidth;
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const t = scrollProgress(window.scrollY);
    const width = lerp(this._largeWidth, SMALL_WIDTH, t);
    const top = lerp(LARGE_TOP, SMALL_TOP, t);
    this._ghostState = GHOST_TAUS.map(() => ({ width, top }));

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);
    this._ensureLoop();
    // The wordmark's animated brand color is handled purely in CSS now: the
    // masked span paints `currentColor`, which inherits the anchor's animated
    // `color: var(--brand-cycle)`. See home.css and the styling docs gotcha
    // (#961) for why a direct `background: var(--brand-cycle)` under an <a href>
    // needed this and why currentColor sidesteps the Chromium paint bug.
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  private _ensureLoop() {
    if (this._rafId) return;
    this._lastTime = 0;
    this._rafId = requestAnimationFrame((now) => this._tick(now));
  }

  private _tick(now: number) {
    const dt = this._lastTime === 0 ? 0 : Math.min((now - this._lastTime) / 1000, 0.1);
    this._lastTime = now;

    const t = scrollProgress(window.scrollY);
    const targetWidth = lerp(this._largeWidth, SMALL_WIDTH, t);
    const targetTop = lerp(LARGE_TOP, SMALL_TOP, t);

    let active = false;
    for (let i = 0; i < GHOST_TAUS.length; i++) {
      const gs = this._ghostState[i];
      // Framerate-independent exponential approach toward the target.
      const alpha = this._reduced ? 1 : 1 - Math.exp(-dt / GHOST_TAUS[i]);
      gs.width += (targetWidth - gs.width) * alpha;
      gs.top += (targetTop - gs.top) * alpha;
      if (
        Math.abs(targetWidth - gs.width) > SETTLE_EPSILON ||
        Math.abs(targetTop - gs.top) > SETTLE_EPSILON
      ) {
        active = true;
      }
    }
    if (!active || this._reduced) {
      for (const gs of this._ghostState) {
        gs.width = targetWidth;
        gs.top = targetTop;
      }
    }

    // Center the large wordmark, then drift it to the top-left corner as it
    // shrinks. x goes from 0 (centered) to the corner offset at full collapse.
    const cornerX = LEFT + SMALL_WIDTH / 2 - this._vw / 2;
    const targetX = lerp(0, cornerX, t);
    this._commit(targetWidth, targetTop, targetX, t >= 1);

    if (active && !this._reduced) {
      this._rafId = requestAnimationFrame((n) => this._tick(n));
    } else {
      this._rafId = 0;
      this._lastTime = 0;
    }
  }

  private _commit(mainWidth: number, mainTop: number, mainX: number, collapsed: boolean) {
    if (this._link && this._main) {
      this._link.style.transform = `translate(calc(-50% + ${mainX.toFixed(2)}px), ${mainTop.toFixed(2)}px)`;
      this._link.classList.toggle('is-collapsed', collapsed);
      // Inline styles, not width attributes: the stylesheet's SSR fallback
      // (calc(100vw - 48px)) would win over a presentation attribute.
      this._main.style.width = `${mainWidth}px`;
      this._main.style.height = `${mainWidth / SVG_RATIO}px`;
    }
    for (let i = 0; i < this._ghosts.length; i++) {
      const gs = this._ghostState[i];
      const ghost = this._ghosts[i];
      const deltaW = gs.width - mainWidth;
      // Opacity tracks how far this ghost trails the main logo, so it fades
      // in and out smoothly without any hard threshold.
      const intensity = clamp01(Math.abs(deltaW) / OPACITY_FALLOFF_PX);
      const opacity = intensity * (0.55 - i * 0.075);
      ghost.style.opacity = opacity.toFixed(3);
      ghost.style.transform = `translate(calc(-50% + ${mainX.toFixed(2)}px), ${gs.top.toFixed(2)}px)`;
      ghost.style.width = `${gs.width}px`;
      ghost.style.height = `${gs.width / SVG_RATIO}px`;
    }
  }

  render() {
    // The SSR width rides CSS (calc(100vw - 48px)); JS replaces it with a
    // pixel width attribute on the first tick. Ghosts start invisible and
    // flush with the main logo, so nothing shows until real motion.
    return html`
      ${BRAND_COLORS.map(color => html`
        <span data-ghost class="rmx-wordmark" aria-hidden="true" style="color:${color};opacity:0;transform:translate(-50%, ${LARGE_TOP}px)"></span>
      `)}
      <a href="/" aria-label="WebJs home" style="transform:translate(-50%, ${LARGE_TOP}px)">
        <span class="rmx-wordmark" aria-hidden="true"></span>
      </a>
    `;
  }
}

ScrollLogo.register('scroll-logo');
