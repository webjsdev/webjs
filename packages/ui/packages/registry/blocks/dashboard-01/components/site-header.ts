/**
 * The dashboard-01 site header: the sidebar trigger and the page title, at
 * the height the page sets through `--header-height`. A fragment helper.
 * Ported from shadcn/ui's dashboard-01.
 *
 * Options: `title`, `trigger: false` for a sidebar that does not collapse,
 * `quickCreate` for a "Quick Create" button at the end (`quickCreateIcon` its
 * icon), and `sticky` to pin the header over the scrolling page, as shadcn's
 * examples/dashboard does. The button is a placeholder for your create flow.
 * `github` is the ghost link at the end, shadcn's "GitHub" button pointing at
 * this block's source: point it at your own repository, or pass `false` to
 * leave it out.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import type { TemplateResult } from '@webjsdev/core';
import { buttonClass } from '../../../components/button.ts';
import { separatorClass } from '../../../components/separator.ts';
import { CirclePlusIcon } from '../../../lib/icons.ts';
import '../../../components/sidebar.ts';

export interface SiteHeaderOptions {
  title?: string;
  trigger?: boolean;
  quickCreate?: boolean;
  quickCreateIcon?: TemplateResult;
  sticky?: boolean;
  github?: string | false;
}

const GITHUB = 'https://github.com/webjsdev/webjs/tree/main/packages/ui/packages/registry/blocks/dashboard-01';

export function siteHeader(opts: SiteHeaderOptions = {}) {
  const trigger = opts.trigger ?? true;
  const github = opts.github ?? GITHUB;
  return html`
    <header class=${cn('flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)', opts.sticky && 'sticky top-0 z-10 bg-background/90')}>
      <div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        ${trigger ? html`<ui-sidebar-trigger class="-ml-1"></ui-sidebar-trigger>
        <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass(), 'mx-2 data-[orientation=vertical]:h-4')}></div>` : ''}
        <h1 class="text-base font-medium">${opts.title ?? 'Documents'}</h1>
        ${opts.quickCreate || github ? html`<div class="ml-auto flex items-center gap-2">
          ${opts.quickCreate ? html`<button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(buttonClass({ size: 'sm' }), 'hidden h-7 sm:flex')}>
            ${opts.quickCreateIcon ?? CirclePlusIcon()}
            <span>Quick Create</span>
          </button>` : ''}
          ${github ? html`<a href=${github} rel="noopener noreferrer" target="_blank" data-slot="button" data-variant="ghost" data-size="sm" class=${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'hidden no-underline sm:flex dark:text-foreground')}>GitHub</a>` : ''}
        </div>` : ''}
      </div>
    </header>
  `;
}
