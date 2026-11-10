import { WebComponent, html } from '@webjsdev/core';

/**
 * `<build-stamp>` is a purely presentational web component: static
 * markup, no reactive properties, no events, no lifecycle hooks, no
 * slot. Its SSR'd HTML is the complete output.
 *
 * It still ships, as every component does in Lit: the e2e probe pins that
 * the browser downloads build-stamp.ts next to the interactive counter.ts
 * (#1686). A component that must never reach the browser goes in a
 * `*.server.ts` file instead.
 */
export class BuildStamp extends WebComponent {
  render() {
    return html`<span
      class="font-mono text-[11px] tracking-[0.12em] uppercase text-muted-foreground/70"
      >no-build · served as written</span
    >`;
  }
}
BuildStamp.register('build-stamp');
