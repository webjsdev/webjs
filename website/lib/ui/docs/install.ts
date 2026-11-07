import { html } from '@webjsdev/core';
import { codeFigure } from './code.ts';

/**
 * shadcn's package-manager command block (apps/v4/components/code-block-command.tsx)
 * and its Installation tabs (#1666): one command shown four ways, pnpm,
 * npm, yarn and bun, in a code figure with a tab row. The tabs are the kit's
 * <ui-tabs>, so with JavaScript off the first command is shown.
 */

const terminal = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-3 text-code"><path d="M5 7l5 5l-5 5"></path><path d="M12 19l7 0"></path></svg>`;

/** The four package managers' spelling of running a package binary. */
export function packageCommands(args: string): Record<'pnpm' | 'npm' | 'yarn' | 'bun', string> {
  return {
    pnpm: `pnpm dlx @webjsdev/ui ${args}`,
    npm: `npx @webjsdev/ui ${args}`,
    yarn: `yarn dlx @webjsdev/ui ${args}`,
    bun: `bunx --bun @webjsdev/ui ${args}`,
  };
}

export function commandBlock(commands: Record<string, string>) {
  const keys = Object.keys(commands);
  return html`
    <figure data-rehype-pretty-code-figure data-not-typeset>
      <div class="overflow-x-auto">
        <ui-tabs value=${keys[0]} class="gap-0">
          <div class="flex items-center gap-2 border-b border-border/50 px-3 py-1">
            <div class="flex size-4 items-center justify-center rounded-[1px] bg-foreground opacity-70">${terminal}</div>
            <ui-tabs-list class="rounded-none bg-transparent p-0">
              ${keys.map((k) => html`<ui-tabs-trigger value=${k} class="h-7 border border-transparent pt-0.5 shadow-none! data-[state=active]:border-input data-[state=active]:bg-background!">${k}</ui-tabs-trigger>`)}
            </ui-tabs-list>
          </div>
          <div class="no-scrollbar overflow-x-auto">
            ${keys.map((k) => html`
              <ui-tabs-content value=${k} class="mt-0 px-4 py-3.5">
                <pre tabindex="0" class="no-scrollbar overflow-x-auto"><code class="relative font-mono text-sm leading-none" data-language="bash">${commands[k]}</code></pre>
              </ui-tabs-content>`)}
          </div>
        </ui-tabs>
      </div>
    </figure>`;
}

/** One file the Manual tab shows: its source, under the path it lands at. */
export interface ManualFile { source: string; title: string }

/**
 * The Installation section: a Command tab with the add command, and a Manual
 * tab with the steps and the component's source. A component of several
 * files (chart) passes `files`, and the tab shows each under its own path.
 */
export function installTabs(slug: string, manual: { files?: ManualFile[]; source?: string; title?: string; dependencies?: string[] }) {
  const files = manual.files ?? [{ source: manual.source ?? '', title: manual.title ?? '' }];
  return html`
    <ui-tabs value="cli" class="relative mt-6 w-full">
      <ui-tabs-list class="justify-start gap-4 rounded-none bg-transparent px-0">
        <ui-tabs-trigger value="cli" class="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-1 text-base text-muted-foreground shadow-none! data-[state=active]:border-primary data-[state=active]:text-foreground">Command</ui-tabs-trigger>
        <ui-tabs-trigger value="manual" class="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-1 text-base text-muted-foreground shadow-none! data-[state=active]:border-primary data-[state=active]:text-foreground">Manual</ui-tabs-trigger>
      </ui-tabs-list>
      <ui-tabs-content value="cli" class="relative [&>.steps]:mt-6">
        ${commandBlock(packageCommands(`add ${slug}`))}
      </ui-tabs-content>
      <ui-tabs-content value="manual" class="relative [&>.steps]:mt-6">
        <div class="steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step">
          ${manual.dependencies?.length ? html`
            <h3>Install the following dependencies:</h3>
            ${commandBlock(packageCommands(`add ${manual.dependencies.join(' ')}`))}` : ''}
          <h3>Copy and paste the following code into your project.</h3>
          ${files.map((f) => codeFigure(f.source, { title: f.title, lineNumbers: true }))}
          <h3>Update the import paths to match your project setup.</h3>
        </div>
      </ui-tabs-content>
    </ui-tabs>`;
}
