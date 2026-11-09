// Lit idiom (@lit/context): a `ContextConsumer` with `subscribe: true`. It
// builds its own `createContext('theme')` rather than importing the provider's,
// which works in Lit because a context IS its key.
import { WebComponent, html } from '@webjsdev/core';
import { ContextConsumer, createContext } from '@webjsdev/core/context';

const themeContext = createContext<string>('theme');

export class ThemeLabel extends WebComponent {
  private _theme = new ContextConsumer(this, { context: themeContext, subscribe: true });

  render() {
    return html`<span>Theme: ${this._theme.value ?? 'none'}</span>`;
  }
}

customElements.define('theme-label', ThemeLabel);
