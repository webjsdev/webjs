import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { ArrowUpRightIcon } from '#lib/ui/lucide.ts';

// Tabler's folder-code icon, the one shadcn's demo imports from
// @tabler/icons-react.
const IconFolderCode = () =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="tabler-icon tabler-icon-folder-code"><path d="M11 19h-6a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v4"></path><path d="M20 21l2 -2l-2 -2"></path><path d="M17 17l-2 2l2 2"></path></svg>`;

export default function EmptyDemo() {
  return html`
    <div data-slot="empty" class=${emptyClass()}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>
          ${IconFolderCode()}
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>No Projects Yet</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>
          You haven&apos;t created any projects yet. Get started by creating
          your first project.
        </div>
      </div>
      <div data-slot="empty-content" class=${cn(emptyContentClass(), 'flex-row justify-center gap-2')}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Create Project</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Import Project</button>
      </div>
      <a href="#" data-slot="button" data-variant="link" data-size="sm" class=${cn(buttonClass({ variant: 'link', size: 'sm' }), 'text-muted-foreground')}>
        Learn More ${ArrowUpRightIcon()}
      </a>
    </div>
  `;
}
