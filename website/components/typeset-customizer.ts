import { WebComponent, html } from '@webjsdev/core';
import { THEME_STORAGE_KEY, type Theme } from '#lib/theme.ts';
import { findFont, fontStack } from '#modules/ui/typeset/fonts.ts';
import {
  DEFAULTS,
  PARAM_KEYS,
  builderHref,
  coerce,
  parseParams,
  previewHref,
  previewVars,
  shuffleParams,
  type DesignParam,
  type TypesetParam,
  type TypesetParams,
} from '#modules/ui/typeset/params.ts';
import {
  DEFAULT_FONT_SOURCE,
  IMPORT_CSS,
  fontSteps,
  isFontSource,
  presetCode,
  promptText,
  usageCode,
  type FontSource,
} from '#modules/ui/typeset/docs.ts';

type ThemeToggleElement = HTMLElement & { theme?: { set(value: Theme): void } };

// How long the pointer must settle on an item before the preview shows it,
// shadcn's PREVIEW_OVERRIDE_DEBOUNCE_MS.
const PREVIEW_DELAY = 50;

/**
 * `<typeset-customizer>`, the behaviour of the /ui/typeset builder (#1666).
 *
 * It wraps the whole designer, and every piece of markup inside it is the
 * server's (modules/ui/typeset/): the customizer form, the preview frame with
 * its toolbar, and the docs panel. With JavaScript off that markup is a GET
 * form, popovers and links, and works. This element adds what shadcn's React
 * state does there (apps/v4/app/(app)/(typeset)/), and nothing it renders:
 *
 * - A choice applies at once. The URL follows with history.replaceState (the
 *   params ARE the state, as shadcn's nuqs keeps them), the preview frame's
 *   --preview-* properties are rewritten in place (it is same-origin), and the
 *   trigger labels, the links and the docs samples are brought up to date. A
 *   new specimen is the one change that loads a new frame.
 * - Hovering an item previews it in the frame without committing it, and
 *   leaving the menu reverts, as shadcn's preview override does.
 * - The popovers open beside their trigger, shadcn's side="right", and close
 *   when focus moves into the frame (a click there never reaches this
 *   document, the job of shadcn's shield div).
 * - Shuffle (R), Reset (Shift+R), Light/Dark (D), Undo and Redo (Cmd or
 *   Ctrl+Z, Shift for redo), also forwarded from inside the frame, plus the
 *   locks Shuffle respects, and the copy buttons.
 *
 * Undo and redo keep their own stack, like shadcn's TypesetHistoryProvider,
 * since replaceState leaves the browser's history alone.
 */
export class TypesetCustomizer extends WebComponent {
  private _params: TypesetParams = { ...DEFAULTS };
  private _past: TypesetParams[] = [];
  private _future: TypesetParams[] = [];
  private _locks = new Set<DesignParam>();
  private _source: FontSource = DEFAULT_FONT_SOURCE;
  private _previewTimer: ReturnType<typeof setTimeout> | undefined;
  private _copyTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  private _frameDoc: Document | null = null;
  private _themeObserver: MutationObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._params = parseParams(new URLSearchParams(location.search));
    this.addEventListener('change', this._onChange);
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerover', this._onPointerOver);
    this.addEventListener('keydown', this._onMenuKey);
    // toggle, pointerleave and load do not bubble, so these listen in the
    // capture phase, which still sees them on the way down. That covers
    // markup the element does not have yet when it connects, too.
    this.addEventListener('toggle', this._onToggle, true);
    this.addEventListener('pointerleave', this._onPointerLeave, true);
    this.addEventListener('load', this._onFrameLoad, true);
    // On a client render the markup is projected into the slot a microtask
    // after the element connects, so enhance it again when it arrives.
    this.addEventListener('slotchange', this._enhance);
    document.addEventListener('keydown', this._onKey);
    window.addEventListener('blur', this._closeAll);
    // Whoever changes the theme (the menu, D, the header's toggle), the frame
    // and the drawer follow it.
    this._themeObserver = new MutationObserver(this._syncTheme);
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this._enhance();
  }


  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerover', this._onPointerOver);
    this.removeEventListener('keydown', this._onMenuKey);
    this.removeEventListener('toggle', this._onToggle, true);
    this.removeEventListener('pointerleave', this._onPointerLeave, true);
    this.removeEventListener('load', this._onFrameLoad, true);
    this.removeEventListener('slotchange', this._enhance);
    document.removeEventListener('keydown', this._onKey);
    window.removeEventListener('blur', this._closeAll);
    this._themeObserver?.disconnect();
    this._detachFrameKeys();
    clearTimeout(this._previewTimer);
    super.disconnectedCallback();
  }

  /** What the server markup cannot do for itself. Safe to run twice. */
  private _enhance = (): void => {
    // The menu items that need this element.
    for (const el of this.querySelectorAll<HTMLButtonElement>('button[data-action]')) el.disabled = false;
    // Bring the markup level with the URL. They agree on a fresh render, but
    // a page restored from the router's snapshot cache carries the attributes
    // it was rendered with, not the choices made since.
    this._syncControls();
    this._syncLinks();
    this._syncDocs();
    this._syncHistoryItems();
    // shadcn's shortcut labels follow the platform.
    if (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)) {
      this._setShortcut('undo', '\u2318Z');
      this._setShortcut('redo', '\u21E7\u2318Z');
    }
    // The Get Code drawer slides in from the right on a wide screen, as shadcn's does.
    if (matchMedia('(min-width: 768px)').matches) {
      for (const content of this.querySelectorAll('ui-drawer-content')) content.setAttribute('direction', 'right');
    }
    this._syncTheme();
    // A frame that finished loading before the element upgraded.
    if (!this._frameDoc && this._frame()?.contentDocument?.readyState === 'complete') this._onFrameLoad();
  };

  /** The params the builder shows now. */
  get params(): TypesetParams {
    return { ...this._params };
  }

  // ---- applying a change ------------------------------------------------

  /** Commit a new set of params: URL, frame, controls and docs. */
  apply(next: TypesetParams, { record = true } = {}): void {
    const prev = this._params;
    if (PARAM_KEYS.every((key) => prev[key] === next[key])) return;
    if (record) {
      this._past.push(prev);
      this._future = [];
    }
    this._params = { ...next };
    history.replaceState(history.state, '', builderHref(next) + location.hash);
    if (next.item !== prev.item) {
      this._frame()?.setAttribute('src', previewHref(next));
    } else {
      this._showInFrame(next);
    }
    this._syncControls();
    this._syncLinks();
    this._syncDocs();
    this._syncHistoryItems();
  }

  shuffle(): void {
    this.apply(shuffleParams(this._params, this._locks));
  }

  /** Every param back to its default, the specimen included, as shadcn's setParams(null). */
  reset(): void {
    this.apply({ ...DEFAULTS });
  }

  undo(): void {
    const prev = this._past.pop();
    if (!prev) return;
    this._future.push(this._params);
    this.apply(prev, { record: false });
  }

  redo(): void {
    const next = this._future.pop();
    if (!next) return;
    this._past.push(this._params);
    this.apply(next, { record: false });
  }

  /** shadcn's Light/Dark: flip the resolved theme, through the site's own theme contract. */
  toggleTheme(): void {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    root.dataset.theme = next;
    document.querySelector<ThemeToggleElement>('theme-toggle')?.theme?.set(next);
    // The frame and the drawer follow through _syncTheme, as they do for the
    // header's own toggle.
  }

  // ---- the frame --------------------------------------------------------

  private _frame(): HTMLIFrameElement | null {
    return this.querySelector('[data-slot="typeset-preview"] iframe');
  }

  /** Write a set of params into the frame's --preview-* properties. */
  private _showInFrame(params: TypesetParams): void {
    const root = this._frameDoc?.querySelector<HTMLElement>('[data-slot="typeset-preview"]');
    if (!root) return;
    for (const [name, value] of Object.entries(previewVars(params))) root.style.setProperty(name, value);
  }

  private _onFrameLoad = (e?: Event): void => {
    if (e && e.target !== this._frame()) return;
    this._detachFrameKeys();
    const doc = this._frame()?.contentDocument ?? null;
    this._frameDoc = doc;
    if (!doc) return;
    // The frame loaded with the params in its src. A change made while it was
    // loading is in this._params, so bring it level.
    this._showInFrame(this._params);
    this._syncTheme();
    // The shortcuts work with focus inside the frame too (shadcn's
    // forward-scripts, without the postMessage hop, since it is same-origin).
    doc.addEventListener('keydown', this._onKey);
  };

  private _detachFrameKeys(): void {
    this._frameDoc?.removeEventListener('keydown', this._onKey);
    this._frameDoc = null;
  }

  // ---- keeping the markup in step ---------------------------------------

  private _syncControls(): void {
    const params = this._params;
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      const key = radio.name as TypesetParam;
      if (key in params) radio.checked = params[key] === radio.value;
    }
    const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"][name="item"]');
    if (hidden) hidden.value = params.item;
    for (const picker of this.querySelectorAll<HTMLElement>('[data-picker]')) {
      const key = picker.dataset.picker as DesignParam;
      const current = picker.querySelector<HTMLElement>('[data-current]');
      if (!current) continue;
      if (key === 'body' || key === 'heading' || key === 'mono') {
        const id = key === 'heading' && params.heading === 'inherit' ? params.body : params[key];
        const font = findFont(id);
        if (!font) continue;
        current.textContent = font.name;
        const sample = picker.querySelector<HTMLElement>('[data-sample]');
        if (sample) sample.style.fontFamily = fontStack(font);
      } else {
        const radio = picker.querySelector<HTMLInputElement>(`input[type="radio"][value="${CSS.escape(params[key])}"]`);
        const label = radio?.closest('label')?.querySelector('[data-label]')?.textContent;
        if (label) current.textContent = label;
      }
    }
    // The heading's "inherit" item is named after the body font.
    const inherit = this.querySelector('[data-picker="heading"] [data-inherit] [data-label]');
    const body = findFont(params.body);
    if (inherit && body) inherit.textContent = body.name;
  }

  private _syncLinks(): void {
    const params = this._params;
    for (const link of this.querySelectorAll<HTMLAnchorElement>('a[data-action="shuffle"]')) {
      link.href = builderHref(shuffleParams(params, this._locks));
    }
    for (const link of this.querySelectorAll<HTMLAnchorElement>('a[data-item]')) {
      const item = link.dataset.item as TypesetParams['item'];
      const active = item === params.item;
      link.href = builderHref({ ...params, item });
      link.dataset.active = String(active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    for (const link of this.querySelectorAll<HTMLAnchorElement>('a[data-open-preview]')) link.href = previewHref(params);
  }

  private _syncDocs(): void {
    const params = this._params;
    const texts: Record<string, string> = {
      import: IMPORT_CSS,
      preset: presetCode(params),
      usage: usageCode(params),
      prompt: promptText(params, this._source, location.origin),
    };
    for (const source of ['google', 'self-hosted'] as const) {
      fontSteps(params, source).forEach((step, i) => { texts[`font-${source}-${i}`] = step.code; });
    }
    for (const pre of this.querySelectorAll<HTMLElement>('[data-typeset-code]')) {
      const text = texts[pre.dataset.typesetCode ?? ''];
      if (text !== undefined && pre.textContent !== text) pre.textContent = text;
    }
  }

  private _syncHistoryItems(): void {
    for (const el of this.querySelectorAll<HTMLButtonElement>('button[data-action="undo"]')) el.disabled = !this._past.length;
    for (const el of this.querySelectorAll<HTMLButtonElement>('button[data-action="redo"]')) el.disabled = !this._future.length;
  }

  private _setShortcut(action: string, text: string): void {
    for (const el of this.querySelectorAll(`[data-shortcut="${action}"]`)) el.textContent = text;
  }

  // ---- events -----------------------------------------------------------

  private _onChange = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === 'radio') {
      const key = target.name as TypesetParam;
      const value = coerce(key, target.value);
      if (value !== null) this.apply({ ...this._params, [key]: value });
      return;
    }
    if (target instanceof HTMLSelectElement && target.hasAttribute('data-font-source-select')) {
      this._setSource(isFontSource(target.value) ? target.value : DEFAULT_FONT_SOURCE);
    }
  };

  private _setSource(source: FontSource): void {
    this._source = source;
    for (const select of this.querySelectorAll<HTMLSelectElement>('[data-font-source-select]')) select.value = source;
    for (const block of this.querySelectorAll<HTMLElement>('[data-font-source]')) block.hidden = block.dataset.fontSource !== source;
    this._syncDocs();
  }

  private _onClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target as Element;
    const lock = target.closest<HTMLElement>('[data-lock]');
    if (lock) {
      const key = lock.dataset.lock as DesignParam;
      const locked = !this._locks.has(key);
      if (locked) this._locks.add(key);
      else this._locks.delete(key);
      lock.setAttribute('aria-pressed', String(locked));
      lock.title = lock.ariaLabel = locked ? 'Unlock' : 'Lock';
      this._syncLinks();
      return;
    }
    const item = target.closest<HTMLAnchorElement>('a[data-item]');
    if (item) {
      e.preventDefault();
      this.apply({ ...this._params, item: item.dataset.item as TypesetParams['item'] });
      return;
    }
    const copy = target.closest<HTMLElement>('[data-copy]');
    if (copy) {
      e.preventDefault();
      void this._copy(copy);
      return;
    }
    const action = target.closest<HTMLElement>('[data-action]');
    if (!action) return;
    const run: Record<string, () => void> = {
      shuffle: () => this.shuffle(),
      reset: () => this.reset(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      theme: () => this.toggleTheme(),
      'copy-link': () => void navigator.clipboard?.writeText(location.href),
    };
    const fn = run[action.dataset.action ?? ''];
    if (!fn) return;
    e.preventDefault();
    fn();
    // A menu command closes the menu, as shadcn's do. The footer's Shuffle has none.
    action.closest<HTMLElement>('[popover]')?.hidePopover();
  };

  /**
   * Carry the page's theme to the frame, a separate document, and to the Get
   * Code drawer. The drawer sits inside the customizer card, which forces the
   * dark scheme, so it would inherit that. shadcn's is portalled out and takes
   * the page's.
   */
  private _syncTheme = (): void => {
    const root = document.documentElement;
    const frameRoot = this._frameDoc?.documentElement;
    if (frameRoot) {
      if (root.dataset.theme) frameRoot.dataset.theme = root.dataset.theme;
      else delete frameRoot.dataset.theme;
    }
    const scheme = getComputedStyle(root).colorScheme;
    for (const content of this.querySelectorAll<HTMLElement>('ui-drawer-content')) content.style.colorScheme = scheme;
  };

  private async _copy(button: HTMLElement): Promise<void> {
    let text: string;
    if (button.dataset.copy === 'css') {
      const res = await fetch('/ui/typeset.css');
      if (!res.ok) return;
      text = await res.text();
    } else {
      text = promptText(this._params, this._source, location.origin);
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    button.setAttribute('data-copied', '');
    clearTimeout(this._copyTimers.get(button));
    this._copyTimers.set(button, setTimeout(() => button.removeAttribute('data-copied'), 2000));
  }

  /** shadcn's hover preview: show the item in the frame, uncommitted. */
  private _onPointerOver = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const radio = (e.target as Element).closest('label')?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!radio || !radio.closest('[popover]')) return;
    const key = radio.name as TypesetParam;
    const value = coerce(key, radio.value);
    if (value === null || key === 'item') return;
    clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(() => this._showInFrame({ ...this._params, [key]: value }), PREVIEW_DELAY);
  };

  private _onPointerLeave = (e: Event): void => {
    if ((e.target as Element).matches?.('[popover][data-picker-content]')) this._endPreview();
  };

  private _endPreview = (): void => {
    clearTimeout(this._previewTimer);
    this._showInFrame(this._params);
  };

  private _popups(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[popover][data-picker-content]')];
  }

  private _closeAll = (): void => {
    for (const popup of this._popups()) {
      if (popup.matches(':popover-open')) popup.hidePopover();
    }
  };

  private _onToggle = (e: Event): void => {
    const popup = e.target as HTMLElement;
    if (!popup.matches?.('[popover][data-picker-content]')) return;
    const trigger = this.querySelector<HTMLElement>(`[popovertarget="${popup.id}"]`);
    const open = (e as ToggleEvent).newState === 'open';
    if (trigger) {
      trigger.toggleAttribute('data-popup-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    }
    if (!open) {
      this._endPreview();
      return;
    }
    if (trigger) this._place(popup, trigger);
    const first = popup.querySelector<HTMLElement>('input[type="radio"]:checked, [role="menuitem"]:not([disabled])');
    first?.focus({ preventScroll: true });
  };

  /**
   * shadcn's Positioner: beside the trigger (side right, 20px off, aligned
   * to its top) from md up, and above the card, centred, on a phone.
   */
  private _place(popup: HTMLElement, trigger: HTMLElement): void {
    const style = popup.style;
    style.margin = '0';
    style.inset = 'auto';
    const r = trigger.getBoundingClientRect();
    const vh = innerHeight;
    if (matchMedia('(min-width: 768px)').matches) {
      const alignOffset = Number(popup.dataset.alignOffset ?? 0);
      const top = Math.max(8, Math.min(r.top + alignOffset + 8, vh - popup.offsetHeight - 8));
      style.left = `${r.right + 20}px`;
      style.top = `${top}px`;
    } else {
      const card = trigger.closest<HTMLElement>('[data-slot="card"]')?.getBoundingClientRect() ?? r;
      style.left = '12px';
      style.top = `${Math.max(8, card.top - 12 - popup.offsetHeight)}px`;
    }
  }

  /** Arrow keys walk a menu's items, as a menu's do. */
  private _onMenuKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const menu = (e.target as Element).closest('[role="menu"]');
    if (!menu) return;
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    const at = items.indexOf(e.target as HTMLElement);
    const next = items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    e.preventDefault();
    next?.focus();
  };

  /** The shortcuts, shadcn's: R, Shift+R, D, Cmd or Ctrl+Z, Shift for redo (Ctrl+Y too). */
  private _onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement ||
      (t instanceof HTMLInputElement && t.type !== 'radio' && t.type !== 'checkbox'));
    if (typing || e.altKey) return;
    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey) {
      const redo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey);
      if (!redo && key !== 'z') return;
      e.preventDefault();
      if (redo) this.redo();
      else this.undo();
      return;
    }
    if (key === 'r') {
      e.preventDefault();
      if (e.shiftKey) this.reset();
      else this.shuffle();
    } else if (key === 'd') {
      e.preventDefault();
      this.toggleTheme();
    }
  };

  render() {
    return html`<slot></slot>`;
  }
}
TypesetCustomizer.register('typeset-customizer');
