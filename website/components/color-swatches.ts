import { WebComponent, html } from '@webjsdev/core';
import { toast } from '#modules/ui/components/sonner.ts';

/**
 * `<color-swatches>` adds the copy behaviour to /ui/colors, shadcn's Color
 * and ColorFormatSelector with their useColors store (#1666). The palettes,
 * every swatch and every format menu are server markup, so the page reads
 * with JavaScript off; each swatch button carries its values as
 * `data-<format>` attributes. This element only adds what markup cannot:
 *
 * - a swatch click copies the value in the chosen format, says so in a
 *   toast, and marks the swatch as the last one copied;
 * - the format menus are one choice: picking a format in one sets them all;
 * - the format and the last copied value persist in localStorage under
 *   shadcn's `colors` key, so the choice survives a reload.
 */

const STORE = 'colors';
const FORMATS = ['className', 'hex', 'rgb', 'hsl', 'oklch', 'var'];

interface Stored {
  format: string;
  lastCopied: string;
}

export class ColorSwatches extends WebComponent {
  _format = 'hsl';
  _lastCopied = '';
  _syncing = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
    this.addEventListener('change', this._onChange);
    const stored = this._read();
    if (stored && FORMATS.includes(stored.format)) this._format = stored.format;
    if (stored) this._lastCopied = stored.lastCopied;
    this._applyFormat();
    this._markLastCopied();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('change', this._onChange);
    super.disconnectedCallback();
  }

  _read(): Stored | null {
    try {
      const raw = localStorage.getItem(STORE);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return null;
      const { format, lastCopied } = parsed as Partial<Stored>;
      return { format: typeof format === 'string' ? format : 'hsl', lastCopied: typeof lastCopied === 'string' ? lastCopied : '' };
    } catch {
      return null;
    }
  }

  _write(): void {
    try {
      localStorage.setItem(STORE, JSON.stringify({ format: this._format, lastCopied: this._lastCopied }));
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
  }

  /** Set every format menu to the chosen format, telling each <ui-select>. */
  _applyFormat(): void {
    this._syncing = true;
    for (const select of Array.from(this.querySelectorAll<HTMLSelectElement>('select[data-color-format]'))) {
      if (select.value === this._format) continue;
      select.value = this._format;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this._syncing = false;
  }

  _markLastCopied(): void {
    const attr = `data-${this._format.toLowerCase()}`;
    for (const swatch of Array.from(this.querySelectorAll<HTMLElement>('button[data-swatch]'))) {
      swatch.dataset.lastCopied = String(!!this._lastCopied && swatch.getAttribute(attr) === this._lastCopied);
    }
  }

  _onChange = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    if (this._syncing || !select.matches?.('select[data-color-format]')) return;
    if (!FORMATS.includes(select.value)) return;
    this._format = select.value;
    this._applyFormat();
    this._markLastCopied();
    this._write();
  };

  _onClick = (e: Event): void => {
    const swatch = (e.target as Element).closest?.<HTMLElement>('button[data-swatch]');
    if (!swatch || !this.contains(swatch)) return;
    const value = swatch.getAttribute(`data-${this._format.toLowerCase()}`) ?? '';
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      this._lastCopied = value;
      this._markLastCopied();
      this._write();
      toast.success(`Copied ${value} to clipboard.`);
    }, () => {});
  };

  render() {
    return html`<slot></slot>`;
  }
}
ColorSwatches.register('color-swatches');
