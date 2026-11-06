/**
 * Resizable: panels in a row or a column with draggable handles between
 * them. Tier-2. shadcn's is react-resizable-panels; this is the same layout
 * on flex shares and Pointer Events, with no dependency. The server renders
 * the default sizes, so the layout is in the first paint; resizing needs
 * JavaScript.
 *
 * shadcn parity:
 *   ResizablePanelGroup orientation
 *                            → <ui-resizable-panel-group orientation="horizontal" | "vertical">
 *   ResizablePanel (defaultSize, minSize, maxSize)
 *                            → <ui-resizable-panel default-size min-size max-size> (percentages)
 *   ResizableHandle withHandle
 *                            → <ui-resizable-handle with-handle>
 *   onLayout                 → `ui-layout-change` ({ detail: { sizes } }), percentages in order
 *
 * A panel with no `default-size` shares what the sized panels leave (give
 * every panel a size for an exact server-rendered first paint). A drag
 * or a key moves the boundary between the two panels around a handle, each
 * kept within its `min-size` and `max-size`.
 *
 * Keyboard (the WAI-ARIA window splitter): a handle is a focusable
 * separator; the arrows across the group (Left / Right in a row, Up / Down in
 * a column; Left / Right swap under `dir="rtl"`) move it 10 points, Home and
 * End move it as far as the panel before it allows.
 *
 * A11y (handled by the element): each handle is a `role="separator"` with
 * `aria-orientation`, `aria-controls` naming the panel before it, and that
 * panel's size as `aria-valuenow` within its `aria-valuemin` / `aria-valuemax`.
 * Give the panels' content its own headings or labels, since a separator says
 * only how big the panel is.
 *
 * @example
 * ```html
 * <ui-resizable-panel-group orientation="horizontal" class="max-w-md rounded-lg border">
 *   <ui-resizable-panel default-size="50"><div class="flex h-[200px] items-center justify-center p-6">One</div></ui-resizable-panel>
 *   <ui-resizable-handle with-handle></ui-resizable-handle>
 *   <ui-resizable-panel default-size="50" min-size="20"><div class="flex h-full items-center justify-center p-6">Two</div></ui-resizable-panel>
 * </ui-resizable-panel-group>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';

/** The group's classes (the element applies them). */
export const resizablePanelGroupClass = (): string =>
  'cn-resizable-panel-group flex h-full w-full aria-[orientation=vertical]:flex-col';
/** A handle's classes (the element puts them on the handle itself). */
export const resizableHandleClass = (): string =>
  'cn-resizable-handle relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90';
/** A handle's grip. */
export const resizableHandleIconClass = (): string => 'cn-resizable-handle-icon z-10 flex shrink-0';

const GROUP = 'ui-resizable-panel-group';
const STEP = 10;
let uid = 0;

function groupOf(el: Element): UiResizablePanelGroup | null {
  return (typeof el.closest === 'function' ? el.closest(GROUP) : null) as UiResizablePanelGroup | null;
}

function num(v: string | null | undefined, fallback: number): number {
  const n = Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n : fallback;
}

// --------------------------------------------------------------------------
// <ui-resizable-panel-group>
// --------------------------------------------------------------------------

export class UiResizablePanelGroup extends WebComponent({
  orientation: prop<'horizontal' | 'vertical'>(String, { reflect: true }),
}) {
  // The current sizes, in percent, panel by panel; empty until first laid out.
  sizes: number[] = [];

  constructor() {
    super();
    this.orientation = 'horizontal';
  }

  render() {
    return html`<div
      data-slot="resizable-panel-group"
      data-panel-group-direction=${this.orientation}
      aria-orientation=${this.orientation}
      class=${resizablePanelGroupClass()}
    ><slot></slot></div>`;
  }

  /** The panels in this group, in order. */
  panels(): UiResizablePanel[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<UiResizablePanel>('ui-resizable-panel')).filter((p) => groupOf(p) === this);
  }

  /** The handles in this group, in order. */
  handles(): UiResizableHandle[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<UiResizableHandle>('ui-resizable-handle')).filter((h) => groupOf(h) === this);
  }

  /** The default layout: sized panels keep their size, the rest share what is left. */
  initialSizes(panels = this.panels()): number[] {
    const given = panels.map((p) => num(p.getAttribute?.('default-size'), NaN));
    const used = given.filter((n) => !Number.isNaN(n)).reduce((a, b) => a + b, 0);
    const free = given.filter((n) => Number.isNaN(n)).length;
    const share = free ? Math.max(0, 100 - used) / free : 0;
    return given.map((n) => (Number.isNaN(n) ? share : n));
  }

  /** The size a panel is drawn at: its live size once laid out, else its default. */
  sizeOf(panel: UiResizablePanel): number {
    const panels = this.panels();
    const i = panels.indexOf(panel);
    // The server cannot list the panels, so there a panel draws at its own
    // default size: give every panel one for an exact first paint.
    if (i < 0) return num(panel.getAttribute?.('default-size'), 50);
    return (this.sizes.length === panels.length ? this.sizes : this.initialSizes(panels))[i];
  }

  /**
   * Move the boundary after panel `i` by `delta` points, keeping both panels
   * within their limits. Returns whether anything moved.
   */
  resize(i: number, delta: number): boolean {
    const panels = this.panels();
    if (i < 0 || i >= panels.length - 1) return false;
    if (this.sizes.length !== panels.length) this.sizes = this.initialSizes(panels);
    const a = panels[i];
    const b = panels[i + 1];
    const sa = this.sizes[i];
    const sb = this.sizes[i + 1];
    // The move lies between the most either panel can give and take.
    const lo = Math.max(a.min - sa, sb - b.max);
    const hi = Math.min(a.max - sa, sb - b.min);
    const d = Math.min(Math.max(delta, lo), hi);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return false;
    const next = [...this.sizes];
    next[i] = Number((sa + d).toFixed(4));
    next[i + 1] = Number((sb - d).toFixed(4));
    this.sizes = next;
    this._apply();
    this.dispatchEvent(new CustomEvent('ui-layout-change', { bubbles: true, detail: { sizes: [...next] } }));
    return true;
  }

  // Redraw every panel and handle at the current sizes.
  _apply(): void {
    for (const p of this.panels()) p.requestUpdate?.();
    for (const h of this.handles()) h.requestUpdate?.();
  }

  _rtl(): boolean {
    return typeof getComputedStyle === 'function' && getComputedStyle(this).direction === 'rtl';
  }

  /** The group's length along its axis, in pixels. */
  extent(): number {
    const box = this.querySelector?.<HTMLElement>('[data-slot="resizable-panel-group"]');
    const r = box?.getBoundingClientRect();
    if (!r) return 0;
    return this.orientation === 'vertical' ? r.height : r.width;
  }
}
UiResizablePanelGroup.register('ui-resizable-panel-group');

// --------------------------------------------------------------------------
// <ui-resizable-panel>
// --------------------------------------------------------------------------

export class UiResizablePanel extends WebComponent {
  _id = '';

  connectedCallback(): void {
    super.connectedCallback?.();
    this._id ||= `ui-resizable-panel-${++uid}`;
  }

  get min(): number {
    return num(this.getAttribute?.('min-size'), 0);
  }

  get max(): number {
    return num(this.getAttribute?.('max-size'), 100);
  }

  // A panel is the flex child itself, so it carries its own share.
  render() {
    const size = groupOf(this)?.sizeOf(this) ?? 100;
    if (typeof this.setAttribute === 'function') {
      if (this._id) this.setAttribute('id', this._id);
      this.setAttribute('data-slot', 'resizable-panel');
      this.setAttribute('data-panel-size', String(Number(size.toFixed(1))));
      this.setAttribute('style', `flex: ${size} 1 0px; overflow: hidden;`);
    }
    return html`<slot></slot>`;
  }
}
UiResizablePanel.register('ui-resizable-panel');

// --------------------------------------------------------------------------
// <ui-resizable-handle>
// --------------------------------------------------------------------------

export class UiResizableHandle extends WebComponent({
  withHandle: prop(Boolean, { attribute: 'with-handle' }),
}) {
  _authored: string | null = null;
  _captured = false;
  _drag: { at: number; extent: number } | null = null;

  constructor() {
    super();
    this.withHandle = false;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    this.addEventListener('keydown', this._onKeyDown);
    this.addEventListener('pointerdown', this._onPointerDown);
    this.addEventListener('pointermove', this._onPointerMove);
    this.addEventListener('pointerup', this._onPointerUp);
    this.addEventListener('pointercancel', this._onPointerUp);
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this._onKeyDown);
    this.removeEventListener('pointerdown', this._onPointerDown);
    this.removeEventListener('pointermove', this._onPointerMove);
    this.removeEventListener('pointerup', this._onPointerUp);
    this.removeEventListener('pointercancel', this._onPointerUp);
    super.disconnectedCallback?.();
  }

  // The panel before this handle, whose size the handle reports.
  _index(): number {
    const group = groupOf(this);
    if (!group) return -1;
    const panels = group.panels();
    let before = -1;
    for (let i = 0; i < panels.length; i++) {
      if (panels[i].compareDocumentPosition?.(this) & 4) before = i;
    }
    return before;
  }

  // The handle is the separator itself: a flex child that takes focus.
  render() {
    if (!this._captured) {
      this._authored = this.getAttribute?.('class') ?? null;
      this._captured = true;
    }
    const group = groupOf(this);
    const vertical = group?.orientation === 'vertical';
    const i = typeof this.compareDocumentPosition === 'function' ? this._index() : -1;
    const panel = i >= 0 ? group?.panels()[i] : null;
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('class', cn(resizableHandleClass(), this._authored));
      this.setAttribute('data-slot', 'resizable-handle');
      this.setAttribute('role', 'separator');
      this.setAttribute('tabindex', '0');
      // A row of panels has upright separators, and a column flat ones.
      this.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
      if (panel && group) {
        this.setAttribute('aria-controls', panel.id);
        this.setAttribute('aria-valuenow', String(Math.round(group.sizeOf(panel))));
        this.setAttribute('aria-valuemin', String(panel.min));
        this.setAttribute('aria-valuemax', String(panel.max));
      }
    }
    return this.withHandle
      ? html`<div class=${resizableHandleIconClass()}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-2.5"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg></div>`
      : '';
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    const group = groupOf(this);
    if (!group) return;
    const i = this._index();
    const vertical = group.orientation === 'vertical';
    const flip = !vertical && group._rtl() ? -1 : 1;
    let delta: number | null = null;
    if (!vertical && e.key === 'ArrowLeft') delta = -STEP * flip;
    else if (!vertical && e.key === 'ArrowRight') delta = STEP * flip;
    else if (vertical && e.key === 'ArrowUp') delta = -STEP;
    else if (vertical && e.key === 'ArrowDown') delta = STEP;
    else if (e.key === 'Home') delta = -100;
    else if (e.key === 'End') delta = 100;
    if (delta === null) return;
    e.preventDefault();
    group.resize(i, delta);
  };

  _onPointerDown = (e: PointerEvent): void => {
    const group = groupOf(this);
    if (!group || e.button !== 0) return;
    e.preventDefault();
    this.focus();
    const vertical = group.orientation === 'vertical';
    this._drag = { at: vertical ? e.clientY : e.clientX, extent: group.extent() };
    try { this.setPointerCapture(e.pointerId); } catch { /* a pointer the engine does not track */ }
    this.setAttribute('data-resize-handle-state', 'drag');
  };

  _onPointerMove = (e: PointerEvent): void => {
    const group = groupOf(this);
    if (!this._drag || !group || !this._drag.extent) return;
    const vertical = group.orientation === 'vertical';
    const now = vertical ? e.clientY : e.clientX;
    const px = (now - this._drag.at) * (!vertical && group._rtl() ? -1 : 1);
    if (group.resize(this._index(), (px / this._drag.extent) * 100)) this._drag.at = now;
  };

  _onPointerUp = (e: PointerEvent): void => {
    if (!this._drag) return;
    this._drag = null;
    try { this.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    this.removeAttribute('data-resize-handle-state');
  };
}
UiResizableHandle.register('ui-resizable-handle');
