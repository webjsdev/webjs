import { WebComponent, html, css } from '@webjsdev/core';

/**
 * `<slot-card-shadow>` is the shadow-DOM twin of <slot-card>. Same
 * render() template, only `static shadow = true` differs. Used by the
 * e2e parity test to verify that flipping the DOM mode does not
 * require any template rewrite: native browser slot projection in
 * shadow DOM produces equivalent observable behaviour to the
 * framework's light-DOM projection.
 */
export class SlotCardShadow extends WebComponent {
  static shadow = true;
  static styles = css`
    article { display: block; padding: 1.5rem; border: 1px solid #ddd; border-radius: 0.5rem; }
    header { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #eee; font-weight: 600; }
    div[data-region="body"] { font-size: 0.875rem; }
    footer { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #eee; font-size: 0.75rem; color: #888; }
  `;
  render() {
    return html`
      <article>
        <header data-region="header">
          <slot name="header"></slot>
        </header>
        <div data-region="body">
          <slot></slot>
        </div>
        <footer data-region="footer">
          <slot name="footer">no actions</slot>
        </footer>
      </article>
    `;
  }
}
SlotCardShadow.register('slot-card-shadow');
