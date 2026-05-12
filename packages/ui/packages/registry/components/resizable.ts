import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Resizable panel primitives. A flex container of panels separated by
 * drag handles.
 *
 *   <ui-resizable-panel-group direction="horizontal">
 *     <ui-resizable-panel default-size="30"></ui-resizable-panel>
 *     <ui-resizable-handle></ui-resizable-handle>
 *     <ui-resizable-panel default-size="70"></ui-resizable-panel>
 *   </ui-resizable-panel-group>
 *
 * v1 SCOPE: mouse-pointer drag-to-resize only. The handle adjusts the
 * flex-basis of its two adjacent panels by tracking pointer movement.
 *
 * TODO(v2): keyboard support (Arrow keys, Home/End), min/max size
 * enforcement past initial defaults, panel collapse, persistence.
 */

export class UiResizablePanelGroup extends WebComponent {
  static properties = { direction: { type: String, reflect: true } };
  declare direction: 'horizontal' | 'vertical';

  private _slot = '';

  constructor() {
    super();
    this.direction = 'horizontal';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  render() {
    const isVertical = this.direction === 'vertical';
    return html`
      <div
        data-slot="resizable-panel-group"
        data-orientation=${this.direction}
        class=${cn(
          'flex h-full w-full',
          isVertical ? 'flex-col' : 'flex-row',
        )}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiResizablePanelGroup.register('ui-resizable-panel-group');

export class UiResizablePanel extends WebComponent {
  static properties = {
    defaultSize: { type: Number, attribute: 'default-size' },
    minSize: { type: Number, attribute: 'min-size' },
    maxSize: { type: Number, attribute: 'max-size' },
  };
  declare defaultSize: number;
  declare minSize: number;
  declare maxSize: number;

  private _slot = '';

  constructor() {
    super();
    this.defaultSize = 50;
    this.minSize = 10;
    this.maxSize = 90;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    // Apply initial size via inline flex-basis
    queueMicrotask(() => this._applySize(this.defaultSize));
  }

  _applySize(percent: number) {
    this.style.flexBasis = percent + '%';
    this.style.flexGrow = '0';
    this.style.flexShrink = '0';
    this.style.overflow = 'hidden';
  }

  get size(): number {
    const fb = this.style.flexBasis;
    if (fb.endsWith('%')) return parseFloat(fb);
    return this.defaultSize;
  }

  setSize(percent: number) {
    this._applySize(Math.max(this.minSize, Math.min(this.maxSize, percent)));
  }

  render() {
    return html`<div data-slot="resizable-panel" class="h-full w-full">${unsafeHTML(this._slot)}</div>`;
  }
}
UiResizablePanel.register('ui-resizable-panel');

export class UiResizableHandle extends WebComponent {
  static properties = {
    withHandle: { type: Boolean, attribute: 'with-handle' },
  };
  declare withHandle: boolean;

  private _dragging = false;
  private _startPos = 0;
  private _prevPanel: UiResizablePanel | null = null;
  private _nextPanel: UiResizablePanel | null = null;
  private _groupRect: DOMRect | null = null;
  private _isVertical = false;
  private _startPrevSize = 0;
  private _startNextSize = 0;

  constructor() {
    super();
    this.withHandle = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerdown', this._onPointerDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this._onPointerDown);
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }

  _onPointerDown = (e: PointerEvent) => {
    const group = this.closest('ui-resizable-panel-group') as UiResizablePanelGroup | null;
    if (!group) return;
    this._isVertical = group.direction === 'vertical';
    this._groupRect = group.getBoundingClientRect();
    const prev = this.previousElementSibling;
    const next = this.nextElementSibling;
    if (!(prev instanceof UiResizablePanel) || !(next instanceof UiResizablePanel)) return;
    this._prevPanel = prev;
    this._nextPanel = next;
    this._startPrevSize = prev.size;
    this._startNextSize = next.size;
    this._startPos = this._isVertical ? e.clientY : e.clientX;
    this._dragging = true;
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
    e.preventDefault();
  };

  _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging || !this._groupRect || !this._prevPanel || !this._nextPanel) return;
    const cur = this._isVertical ? e.clientY : e.clientX;
    const delta = cur - this._startPos;
    const total = this._isVertical ? this._groupRect.height : this._groupRect.width;
    if (total === 0) return;
    const deltaPct = (delta / total) * 100;
    const newPrev = this._startPrevSize + deltaPct;
    const newNext = this._startNextSize - deltaPct;
    if (newPrev < this._prevPanel.minSize || newNext < this._nextPanel.minSize) return;
    if (newPrev > this._prevPanel.maxSize || newNext > this._nextPanel.maxSize) return;
    this._prevPanel.setSize(newPrev);
    this._nextPanel.setSize(newNext);
  };

  _onPointerUp = () => {
    this._dragging = false;
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  };

  render() {
    const group = this.closest('ui-resizable-panel-group') as UiResizablePanelGroup | null;
    const isVertical = group?.direction === 'vertical';
    return html`
      <div
        role="separator"
        data-slot="resizable-handle"
        aria-orientation=${isVertical ? 'horizontal' : 'vertical'}
        class=${cn(
          'relative flex items-center justify-center bg-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden',
          isVertical
            ? 'h-px w-full cursor-row-resize'
            : 'w-px h-full cursor-col-resize',
        )}
        style=${isVertical ? '' : ''}
      >
        ${this.withHandle
          ? html`<div class=${cn(
              'z-10 flex items-center justify-center rounded-xs border bg-border',
              isVertical ? 'h-3 w-4 rotate-0' : 'h-4 w-3',
            )}>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </div>`
          : html``}
      </div>
    `;
  }
}
UiResizableHandle.register('ui-resizable-handle');
