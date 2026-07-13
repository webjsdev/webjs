import { WebComponent, html } from '@webjsdev/core';

/*
 * The Remix wordmark that starts full-width under the nav and shrinks into a
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
const LARGE_TOP = 92;
const SMALL_TOP = 24;
const LEFT = 24;
const SCROLL_PX = 120;
const SVG_RATIO = 440 / 43;
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

// Defined ONCE in a 0x0 <defs> svg and referenced via <use>: a template hole
// inside <svg> hydrates its content in the HTML namespace (invisible paths),
// so every svg body below stays a static literal.
const WORDMARK_DEFS = html`
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="rmx-wordmark">
  <path d="M81.5098 0.0492554L81.5088 0.0502319V0.0512085C92.8976 0.0512085 100.766 5.13219 99.084 11.4008L97.9443 15.6459C96.2619 21.9146 85.6671 26.9964 74.2783 26.9965H73.1123L97.0352 42.5922H58.627L39.2881 27.7514C38.5139 27.2578 37.6147 26.9955 36.6963 26.9955H4.36816L7.41406 15.644H64.0391C66.1678 15.644 68.1501 14.6941 68.4648 13.5219H68.4658C68.7805 12.3497 67.3085 11.3989 65.1787 11.3989H8.55371L11.5996 0.0492554H81.5098ZM31.2402 30.9135C32.313 30.9136 33.0943 31.9304 32.8164 32.9653L30.2334 42.5912H0.183594L3.31738 30.9135H31.2402Z" fill="currentColor"></path>
  <path d="M307.883 42.8041L319.33 0.33374H349.554L338.037 42.8041H307.883Z" fill="currentColor"></path>
  <path d="M193.893 0.333862H291.753C304.875 0.333862 313.949 6.16313 311.995 13.3803L304.038 42.8042H273.884L278.002 27.6065L280.375 18.932L281.283 15.601C281.841 13.4497 279.119 11.6454 275.14 11.6454H266.555C266.485 12.2006 266.485 12.7558 266.276 13.3803L258.388 42.8042H228.165L232.283 27.6065L234.656 18.932L235.563 15.601C236.122 13.4497 233.4 11.6454 229.421 11.6454H221.045L212.599 42.8042H182.445L193.893 0.333862Z" fill="currentColor"></path>
  <path d="M394.464 7.36133L404.841 0.59082H439.896L408.101 21.335L428.752 42.499H393.696L386.682 35.3096L375.663 42.499H340.607L373.045 21.335L352.801 0.59082H387.856L394.464 7.36133Z" fill="currentColor"></path>
  <path d="M190.38 0.333679L187.379 11.6452H138.588C138.568 11.6452 138.548 11.6461 138.528 11.6462H131.452L130.339 15.8698H130.354L130.352 15.8786H186.193L183.191 27.2595H127.28L127.211 27.6061C126.583 29.7573 129.305 31.4927 133.283 31.4929H182.004L178.933 42.8044H116.671C103.549 42.8043 94.4745 36.9746 96.4289 29.8268L100.826 13.3806C100.924 13.0184 101.049 12.6599 101.197 12.3054V12.3063L104.353 0.333679H190.38Z" fill="currentColor"></path>
  </g></defs></svg>
`;

export class ScrollLogo extends WebComponent {
  private _ghosts: SVGSVGElement[] = [];
  private _link: HTMLAnchorElement | null = null;
  private _main: SVGSVGElement | null = null;
  private _ghostState: { width: number; top: number }[] = [];
  private _rafId = 0;
  private _lastTime = 0;
  private _largeWidth = 0;
  private _reduced = false;
  private _onScroll = () => this._ensureLoop();
  private _onResize = () => {
    this._largeWidth = window.innerWidth - LEFT * 2;
    this._ensureLoop();
  };

  // Capture refs after the first client render commits: connectedCallback
  // would grab the SSR nodes that hydration then replaces, leaving the rAF
  // loop writing to detached elements.
  firstUpdated() {
    this._link = this.querySelector('a');
    this._main = this._link?.querySelector('svg') ?? null;
    this._ghosts = Array.from(this.querySelectorAll('svg[data-ghost]'));
    this._largeWidth = window.innerWidth - LEFT * 2;
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const t = scrollProgress(window.scrollY);
    const width = lerp(this._largeWidth, SMALL_WIDTH, t);
    const top = lerp(LARGE_TOP, SMALL_TOP, t);
    this._ghostState = GHOST_TAUS.map(() => ({ width, top }));

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);
    this._ensureLoop();
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

    this._commit(targetWidth, targetTop, t >= 1);

    if (active && !this._reduced) {
      this._rafId = requestAnimationFrame((n) => this._tick(n));
    } else {
      this._rafId = 0;
      this._lastTime = 0;
    }
  }

  private _commit(mainWidth: number, mainTop: number, collapsed: boolean) {
    if (this._link && this._main) {
      this._link.style.transform = `translate3d(0, ${mainTop.toFixed(2)}px, 0)`;
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
      ghost.style.transform = `translate3d(0, ${gs.top.toFixed(2)}px, 0)`;
      ghost.style.width = `${gs.width}px`;
      ghost.style.height = `${gs.width / SVG_RATIO}px`;
    }
  }

  render() {
    // The SSR width rides CSS (calc(100vw - 48px)); JS replaces it with a
    // pixel width attribute on the first tick. Ghosts start invisible and
    // flush with the main logo, so nothing shows until real motion.
    return html`
      ${WORDMARK_DEFS}
      ${BRAND_COLORS.map(color => html`
        <svg data-ghost viewBox="0 0 440 43" fill="none" aria-hidden="true" style="color:${color};opacity:0;transform:translate3d(0, ${LARGE_TOP}px, 0)"><use href="#rmx-wordmark"></use></svg>
      `)}
      <a href="/" aria-label="Remix home" style="transform:translate3d(0, ${LARGE_TOP}px, 0)">
        <svg viewBox="0 0 440 43" fill="none" aria-hidden="true"><use href="#rmx-wordmark"></use></svg>
      </a>
    `;
  }
}

ScrollLogo.register('scroll-logo');
