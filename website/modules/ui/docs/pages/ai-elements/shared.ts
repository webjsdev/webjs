import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { installTabs } from '#lib/ui/docs/install.ts';
import { componentSource } from '#modules/ui/queries/component-source.server.ts';

/**
 * What every AI Elements page (#1666) shares. A pattern is a composition of
 * kit components the reader copies, so its Installation adds those
 * components, and its Manual tab shows the source of the one it is built on,
 * as shadcn's pages do. This module is not a DOC_PAGES key, so it serves no
 * page of its own.
 */

/** shadcn renders every AI Elements preview in radix-rhea at its natural height. */
export const RHEA = { style: 'rhea', previewClass: 'h-auto' };

/** A docs table in the typeset styles, as the component pages draw them. */
export function table(head: unknown[], rows: unknown[][]) {
  return html`
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
        <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
      </table>
    </div>
  `;
}

/**
 * The Installation section: the sentence naming the components the pattern
 * is built with, then the Command and Manual tabs. `add` is the whole
 * argument list of the add command, `source` the component whose file the
 * Manual tab shows, and `dependencies` what that tab installs first.
 */
export async function installation(toc: TocEntry[], opts: { prose: unknown; add: string; source: string; dependencies?: string[] }) {
  const files = await componentSource(opts.source);
  return html`
    ${heading(toc, 2, 'Installation')}
    <p>${opts.prose}</p>
    ${installTabs(opts.add, {
      source: files?.[0]?.content ?? '',
      title: `components/ui/${opts.source}.ts`,
      dependencies: opts.dependencies,
    })}
  `;
}

/**
 * The "Migrating from AI SDK Elements" section. shadcn's prompt rebuilds a
 * React wrapper in place, which a WebJs app cannot run, so the section says
 * so and maps each of the wrapper's exports onto the parts of this pattern.
 */
export function migrating(toc: TocEntry[], opts: { name: string; file: string; parts: [string, unknown][] }) {
  return html`
    ${heading(toc, 2, 'Migrating from AI SDK Elements')}
    <p>If you used ${opts.name} from <a href="https://elements.ai-sdk.dev">AI SDK Elements</a>, it lives in <code>components/ai-elements/${opts.file}</code> as a React component, so it does not run in a WebJs app. Rebuild it as this pattern. Each export of the wrapper maps onto a part:</p>
    ${table(['AI SDK Elements', 'WebJs UI'], opts.parts.map(([from, to]) => [html`<code>${from}</code>`, to]))}
  `;
}
