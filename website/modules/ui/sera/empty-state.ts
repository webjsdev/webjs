/**
 * The Sera page's Empty State screen, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/empty-state/ (index.tsx, the preview header
 * and the empty-directory card) element for element as server markup.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import {
  breadcrumbItemClass, breadcrumbLinkClass, breadcrumbListClass,
} from '#modules/ui/components/breadcrumb.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';
import {
  emptyClass, emptyContentClass, emptyDescriptionClass, emptyHeaderClass,
  emptyMediaClass, emptyTitleClass,
} from '#modules/ui/components/empty.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { ArrowLeftIcon, FileTextIcon } from '#lib/ui/lucide.ts';

interface Stage {
  id: string;
  label: string;
  description: string;
  dotClassName: string;
}

const STAGES: Stage[] = [
  {
    id: 'drafting',
    label: 'Drafting',
    description:
      'Start the writing process. Articles here are works in progress, visible only to editors and authors.',
    dotClassName: 'bg-amber-600',
  },
  {
    id: 'in-revision',
    label: 'In Revision',
    description:
      'Content undergoing editorial review. Track changes and word counts as pieces take shape.',
    dotClassName: 'bg-orange-700',
  },
  {
    id: 'final-edit',
    label: 'Final Edit',
    description:
      'The final polish before publication. Ensure all styling and factual checks are complete.',
    dotClassName: 'bg-foreground',
  },
];

// lucide's plus, written out so it can carry the data-icon attribute the
// sera button sizes key their padding on.
const PlusIcon = (dataIcon: string) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon=${dataIcon} class="lucide lucide-plus"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

function previewHeader() {
  return html`
    <header>
      <div class="container flex flex-col items-center justify-center gap-(--gap) py-(--gap) sm:flex-row sm:justify-between">
        <div class="flex flex-col gap-2 text-center sm:text-left">
          <nav aria-label="breadcrumb" data-slot="breadcrumb">
            <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
              <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                <a data-slot="breadcrumb-link" href="#" class=${cn(breadcrumbLinkClass(), 'flex items-center gap-1.5')}>
                  ${ArrowLeftIcon('size-3.5')}
                  Editorial Dashboard
                </a>
              </li>
            </ol>
          </nav>
          <h1 class="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">
            Article Directory
          </h1>
        </div>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'sm:ml-auto')}>
          ${PlusIcon('inline-start')}
          New Article
        </button>
      </div>
    </header>
  `;
}

function emptyDirectory() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'py-24')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col items-center gap-10')}>
        <div data-slot="empty" class=${cn(emptyClass(), 'min-h-96')}>
          <div data-slot="empty-header" class=${emptyHeaderClass()}>
            <div data-slot="empty-icon" data-variant="icon" class=${cn(emptyMediaClass({ variant: 'icon' }), 'size-14 rounded-full bg-muted/70 text-muted-foreground')}>
              ${FileTextIcon('size-5')}
            </div>
            <div data-slot="empty-title" class=${cn(emptyTitleClass(), 'font-heading text-2xl tracking-normal normal-case')}>
              A Blank Canvas
            </div>
            <div data-slot="empty-description" class=${emptyDescriptionClass()}>
              Your editorial directory is currently empty. Start building your
              publication&apos;s next issue by drafting the first piece.
            </div>
          </div>
          <div data-slot="empty-content" class=${emptyContentClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>
              ${PlusIcon('inline-start')}
              Create first article
            </button>
          </div>
        </div>
        <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'max-w-2xl')}></div>
        <div class="grid w-full max-w-2xl grid-cols-1 gap-8 sm:grid-cols-3">
          ${STAGES.map((stage) => html`
            <div class="flex flex-col gap-2">
              <span data-slot="badge" data-variant="default" class=${badgeClass()}>
                <span aria-hidden="true" class=${'size-1.5 rounded-full ' + stage.dotClassName}></span>
                ${stage.label}
              </span>
              <p class="text-xs leading-relaxed text-muted-foreground">
                ${stage.description}
              </p>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

export function emptyState() {
  return html`
    <div class="preview theme-taupe @container/preview w-full flex-1 bg-muted pt-4 font-sans ring-1 ring-foreground/5 [--gap:--spacing(4)] sm:pt-0 md:[--gap:--spacing(6)] xl:[--gap:--spacing(8)] 2xl:py-8 **:[.container]:px-(--gap)">
      ${previewHeader()}
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'hidden sm:block')}></div>
      <div class="container py-(--gap)">
        ${emptyDirectory()}
      </div>
    </div>
  `;
}
