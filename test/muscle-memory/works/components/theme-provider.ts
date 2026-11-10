// Lit idiom (@lit/context): a `ContextProvider` field with an `initialValue`,
// updated from a reactive property in `willUpdate`, wrapping its children in a
// `<slot>`.
import { WebComponent, html } from '@webjsdev/core';
import type { PropertyValues } from '@webjsdev/core';
import { ContextProvider } from '@webjsdev/core/context';
import { themeContext } from './theme-context.ts';

export class ThemeProvider extends WebComponent {
  static properties = {
    theme: { type: String },
  };

  declare theme: string;

  private _provider = new ContextProvider(this, { context: themeContext, initialValue: 'dark' });

  constructor() {
    super();
    this.theme = 'dark';
  }

  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('theme')) this._provider.setValue(this.theme);
  }

  render() {
    return html`<slot></slot>`;
  }
}

customElements.define('theme-provider', ThemeProvider);
