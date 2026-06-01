import { WebComponent, html } from '@webjsdev/core';

/**
 * `<observed-badge>` is a purely presentational web component: static
 * markup, no events, no reactive properties, no lifecycle hooks, no
 * signals, no slot. On its own the framework would classify it as
 * display-only and elide its module from the browser.
 *
 * It exists to e2e-pin the cross-module-registration fix (#169). The
 * `/observed` route observes this tag with
 * `customElements.whenDefined('observed-badge')`, which forces the
 * component to ship even though its own render is inert. The probe
 * asserts the browser actually downloads THIS module (the observation
 * would silently break if it were elided, since `whenDefined` would
 * never resolve). The counterpart is `<build-stamp>`, an unobserved
 * display-only component that is never downloaded.
 */
export class ObservedBadge extends WebComponent {
  render() {
    return html`<span
      class="font-mono text-[11px] tracking-[0.12em] uppercase text-fg-subtle"
      >observed badge · registers because something waits for it</span
    >`;
  }
}
ObservedBadge.register('observed-badge');
