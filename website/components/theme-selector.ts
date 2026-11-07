import { WebComponent, html } from '@webjsdev/core';

/**
 * `<theme-selector>`, the script half of lib/ui/theme-selector.ts (#1666).
 * The select is a GET form on `?theme=`, which works with JavaScript off;
 * this applies a change in place instead of reloading:
 *
 * - the region marked `data-theme-target` swaps its `theme-<name>` class (the
 *   default theme wears none), so it repaints at once;
 * - the URL's `?theme=` follows, without a history entry, and so does every
 *   link marked `data-theme-link` and every input marked `data-theme-field`,
 *   so the theme carries to the next page;
 * - the copy dialog shows the chosen theme's name and code.
 */
export class ThemeSelector extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this._onChange);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    super.disconnectedCallback();
  }

  // The markup is the server's; the element only listens.
  render() {
    return html`<slot></slot>`;
  }

  _onChange = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    if (select.name !== 'theme') return;
    const name = select.value;
    const isDefault = name === 'neutral';

    for (const region of Array.from(document.querySelectorAll<HTMLElement>('[data-theme-target]'))) {
      for (const c of Array.from(region.classList)) if (c.startsWith('theme-') && c !== 'theme-container') region.classList.remove(c);
      if (!isDefault) region.classList.add(`theme-${name}`);
    }

    const url = new URL(location.href);
    if (isDefault) url.searchParams.delete('theme');
    else url.searchParams.set('theme', name);
    history.replaceState(history.state, '', url);

    for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-theme-link]'))) {
      const href = new URL(link.href, location.href);
      if (isDefault) href.searchParams.delete('theme');
      else href.searchParams.set('theme', name);
      link.setAttribute('href', href.pathname + href.search);
    }

    // A form elsewhere on the page that carries the theme (the tasks table's
    // filters) submits the new one.
    for (const field of Array.from(document.querySelectorAll<HTMLInputElement>('input[data-theme-field]'))) field.value = name;

    for (const out of Array.from(this.querySelectorAll<HTMLElement>('[data-theme-name]'))) out.textContent = name;
    for (const block of Array.from(this.querySelectorAll<HTMLElement>('[data-theme-code]'))) block.hidden = block.dataset.themeCode !== name;
  };
}

ThemeSelector.register('theme-selector');
