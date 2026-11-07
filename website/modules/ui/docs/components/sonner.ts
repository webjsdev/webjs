import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Sonner docs page, ported from shadcn's
 * content/docs/components/radix/sonner.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'sonner-demo';

/** The About section, before Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>The kit's toaster is written for WebJs and does not depend on the <code>sonner</code> package. It is one <code>&lt;ui-sonner&gt;</code> viewport you mount once, plus an imperative <code>toast()</code> function with Sonner's API: <code>toast.success()</code>, <code>toast.error()</code>, <code>toast.promise()</code> and the rest.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>Mount the toast viewport once, typically in your root layout:</p>
    ${codeFigure(`<ui-sonner position="bottom-right"></ui-sonner>`)}
    <p>Then call <code>toast()</code> from browser code, such as a component's event handler:</p>
    ${codeFigure(`import { toast } from '#components/ui/sonner.ts';`)}
    ${codeFigure(`toast('Event has been created.');`)}

    ${heading(toc, 2, 'Types')}
    ${await componentPreview('sonner-types')}

    ${heading(toc, 2, 'Description')}
    ${await componentPreview('sonner-description')}

    ${heading(toc, 2, 'Position')}
    <p>Use the <code>position</code> attribute on <code>&lt;ui-sonner&gt;</code> to change the position of the toast.</p>
    ${await componentPreview('sonner-position')}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-sonner')}
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>position</code></td><td><code>"top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"</code></td><td><code>"bottom-right"</code></td></tr>
        </tbody>
      </table>
    </div>
    <p>The viewport is a polite live region labelled "Notifications", so a toast is announced as it appears, and an error toast is announced assertively. Every toast carries a close button. <code>addToast(message, options, type)</code> on the element shows a toast in that viewport only, for a page that mounts more than one.</p>
    ${heading(toc, 3, 'toast')}
    <p><code>toast(message, options)</code> shows a toast and returns its id. <code>toast.success()</code>, <code>toast.info()</code>, <code>toast.warning()</code>, <code>toast.error()</code> and <code>toast.loading()</code> take the same arguments. <code>toast.promise(promise, { loading, success, error })</code> shows a loading toast that turns into the success or error toast when the promise settles, and <code>toast.dismiss(id)</code> removes one.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>id</code></td><td><code>string | number</code></td><td>-</td></tr>
          <tr><td><code>description</code></td><td><code>string</code></td><td>-</td></tr>
          <tr><td><code>duration</code></td><td><code>number</code> (ms)</td><td><code>4000</code>, <code>0</code> for loading</td></tr>
          <tr><td><code>action</code></td><td><code>{ label: string; onClick: () =&gt; void }</code></td><td>-</td></tr>
          <tr><td><code>cancel</code></td><td><code>{ label: string; onClick: () =&gt; void }</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p>A repeated <code>id</code> updates the toast in place. The action and cancel buttons dismiss the toast after their <code>onClick</code> runs.</p>
  `;
}
