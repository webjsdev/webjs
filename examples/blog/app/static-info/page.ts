import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Static info · webjs blog',
  description: 'A fully-static route that ships zero application JS.',
};

/**
 * `/static-info` is a fully-static route: no custom elements, no events,
 * no signals, no npm imports, no client work. It exists to e2e-pin the
 * inert-route elision claim. Because the page does nothing on the
 * client, the framework drops its page module from the boot script (it
 * is never even downloaded). The root layout is import-only and dropped
 * too (#620); the boot re-emits the layout's theme-toggle component,
 * which loads @webjsdev/core and auto-enables the client router, so SPA
 * navigation away from this page keeps working. The sentinel string
 * below is what the e2e probe asserts on.
 */
export default function StaticInfo() {
  return html`
    <section class="mb-8">
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4">
        Static info
      </h1>
      <p class="text-lede leading-[1.5] text-fg-muted max-w-[56ch] m-0">
        This route ships <strong class="text-fg font-bold">zero application JS</strong>.
        Its page module is inert, so the framework drops it from the boot
        script. What you see is the complete server-rendered output.
      </p>
    </section>
  `;
}
