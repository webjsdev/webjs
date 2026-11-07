import { WebComponent, html } from '@webjsdev/core';

/**
 * `<block-viewer>` adds the behaviour to a /ui block viewer, shadcn's
 * BlockViewer (#1666). The toolbar, the preview frame, the file tree and every
 * file's source are server markup (lib/ui/block-viewer.ts), and the Preview /
 * Code toggle, the viewport size and the file selection are radio groups the
 * CSS reads, so all of that works with JavaScript off. This element only adds
 * what markup cannot:
 *
 * - dragging the handle beside the preview to resize it, as shadcn's
 *   resizable panel does (a viewport choice clears a dragged width);
 * - picking a viewport size switches back to the preview, as in shadcn;
 * - Refresh reloads the frame, and the two copy buttons copy the install
 *   command and the selected file's source, showing a check for a moment;
 * - the file tree's highlight follows the selected file.
 */
export class BlockViewer extends WebComponent {
  _copiedTimer: ReturnType<typeof setTimeout> | undefined;
  _drag: { startX: number; startWidth: number; max: number; min: number } | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerdown', this._onPointerDown);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerdown', this._onPointerDown);
    this._endDrag();
    if (this._copiedTimer) clearTimeout(this._copiedTimer);
    super.disconnectedCallback();
  }

  _panel(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-block-panel]');
  }

  _onChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.blockViewport) {
      // A size choice replaces a dragged width, and shows the preview.
      const panel = this._panel();
      if (panel) panel.style.width = '';
      const preview = this.querySelector<HTMLInputElement>('input[data-block-view="preview"]');
      if (preview) preview.checked = true;
    } else if (input.dataset.blockFile !== undefined) {
      for (const label of Array.from(this.querySelectorAll<HTMLElement>('label[data-file]'))) {
        label.dataset.active = String(label.dataset.file === input.dataset.blockFile);
      }
    }
  };

  _onClick = (e: Event): void => {
    const target = (e.target as Element).closest?.('button');
    if (!target || !this.contains(target)) return;
    if (target.hasAttribute('data-block-refresh')) {
      const frame = this.querySelector<HTMLIFrameElement>('[data-block-panel] iframe');
      if (frame) frame.src = frame.src;
    } else if (target.hasAttribute('data-block-copy')) {
      this._copy(target, target.getAttribute('data-block-copy') ?? '');
    } else if (target.hasAttribute('data-block-copy-file')) {
      const code = target.closest('[data-block-source]')?.querySelector('pre');
      this._copy(target, code?.textContent ?? '');
    }
  };

  _copy(button: HTMLElement, text: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      for (const b of Array.from(this.querySelectorAll('[data-copied]'))) b.removeAttribute('data-copied');
      button.setAttribute('data-copied', '');
      if (this._copiedTimer) clearTimeout(this._copiedTimer);
      this._copiedTimer = setTimeout(() => button.removeAttribute('data-copied'), 2000);
    }, () => {});
  }

  _onPointerDown = (e: PointerEvent): void => {
    const handle = (e.target as Element).closest?.('[data-block-handle]');
    const panel = this._panel();
    const group = panel?.parentElement;
    if (!handle || !panel || !group || e.button !== 0) return;
    e.preventDefault();
    const total = group.getBoundingClientRect().width - handle.getBoundingClientRect().width;
    this._drag = { startX: e.clientX, startWidth: panel.getBoundingClientRect().width, max: total, min: total * 0.3 };
    // The frame would swallow the pointer while it is over it.
    panel.style.pointerEvents = 'none';
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._endDrag);
    window.addEventListener('pointercancel', this._endDrag);
  };

  _onPointerMove = (e: PointerEvent): void => {
    const panel = this._panel();
    if (!this._drag || !panel) return;
    const { startX, startWidth, max, min } = this._drag;
    const width = Math.min(max, Math.max(min, startWidth + e.clientX - startX));
    panel.style.width = `${width}px`;
  };

  _endDrag = (): void => {
    if (!this._drag) return;
    this._drag = null;
    const panel = this._panel();
    if (panel) panel.style.pointerEvents = '';
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._endDrag);
    window.removeEventListener('pointercancel', this._endDrag);
  };

  render() {
    return html`<slot></slot>`;
  }
}
BlockViewer.register('block-viewer');
