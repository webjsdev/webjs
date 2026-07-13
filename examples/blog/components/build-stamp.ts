import { WebComponent, html } from '@webjsdev/core';

/**
 * `<build-stamp>` is a purely presentational web component: static
 * markup, no reactive properties, no events, no lifecycle hooks, no
 * slot. Its SSR'd HTML is the complete output.
 *
 * It exists to demonstrate (and e2e-pin) display-only component elision.
 * Because it does no client-side work, the framework strips its import
 * from the served page source, so its module is never downloaded by the
 * browser. View the network panel on the home page: build-stamp.ts is
 * absent while interactive components like counter.ts are fetched.
 */
export class BuildStamp extends WebComponent {
  render() {
    return html`<span
      class="font-mono text-[11px] tracking-[0.12em] uppercase text-muted-foreground/70"
      >no-build · zero JS shipped for this badge</span
    >`;
  }
}
BuildStamp.register('build-stamp');
