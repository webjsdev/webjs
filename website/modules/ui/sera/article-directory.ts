/**
 * The Sera page's Article Directory screen, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/article-directory/ (index.tsx, the preview
 * header and the article-directory card) element for element as server markup.
 */
import { html, svg, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass, type BadgeVariant } from '#modules/ui/components/badge.ts';
import {
  breadcrumbItemClass, breadcrumbLinkClass, breadcrumbListClass,
} from '#modules/ui/components/breadcrumb.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  cardClass, cardContentClass, cardFooterClass, cardHeaderClass,
} from '#modules/ui/components/card.ts';
import {
  inputGroupAddonClass, inputGroupClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';
import { progressClass } from '#modules/ui/components/progress.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import {
  tableBodyClass, tableCellClass, tableClass, tableContainerClass,
  tableHeadClass, tableHeaderClass, tableRowClass,
} from '#modules/ui/components/table.ts';
import {
  ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon,
} from '#lib/ui/lucide.ts';

type Status = 'in-revision' | 'final-edit' | 'drafting' | 'published';

interface ArticleRow {
  title: string;
  wordProgress: string;
  author: string;
  issue: string;
  status: Status;
  statusLabel: string;
  progress: number;
}

const ARTICLE_ROWS: ArticleRow[] = [
  {
    title: 'The Future of Sustainable Architecture',
    wordProgress: '1.4k / 2.6k words',
    author: 'Elena Rostova',
    issue: 'Summer 2024',
    status: 'in-revision',
    statusLabel: 'In revision',
    progress: 45,
  },
  {
    title: "Brutalism's Second Act",
    wordProgress: '2.1k / 2.5k words',
    author: 'Marcus Chen',
    issue: 'Summer 2024',
    status: 'final-edit',
    statusLabel: 'Final edit',
    progress: 90,
  },
  {
    title: 'The Typography of Public Spaces',
    wordProgress: '0.5k / 1.5k words',
    author: 'Sarah Jenkins',
    issue: 'Autumn 2024',
    status: 'drafting',
    statusLabel: 'Drafting',
    progress: 20,
  },
  {
    title: 'Rethinking Urban Canopies',
    wordProgress: '1.8k / 1.8k words',
    author: "David O'Connor",
    issue: 'Summer 2024',
    status: 'published',
    statusLabel: 'Published',
    progress: 100,
  },
  {
    title: 'Light, Glass, and the Modern Museum',
    wordProgress: '1.2k / 2.0k words',
    author: 'Amara Osei',
    issue: 'Autumn 2024',
    status: 'in-revision',
    statusLabel: 'In revision',
    progress: 55,
  },
  {
    title: 'Concrete Utopias: Housing in the 21st Century',
    wordProgress: '3.0k / 3.0k words',
    author: 'Tomás Herrera',
    issue: 'Summer 2024',
    status: 'published',
    statusLabel: 'Published',
    progress: 100,
  },
  {
    title: 'Designing for Silence',
    wordProgress: '0.8k / 2.2k words',
    author: 'Ingrid Solberg',
    issue: 'Winter 2024',
    status: 'drafting',
    statusLabel: 'Drafting',
    progress: 30,
  },
  {
    title: 'The Invisible Infrastructure of Cities',
    wordProgress: '2.4k / 2.8k words',
    author: 'James Whitfield',
    issue: 'Autumn 2024',
    status: 'final-edit',
    statusLabel: 'Final edit',
    progress: 85,
  },
];

const STATUS_BADGE_VARIANT: Record<Status, BadgeVariant> = {
  'in-revision': 'outline',
  'final-edit': 'default',
  drafting: 'ghost',
  published: 'secondary',
};

const STATUS_DOT_CLASSNAME: Record<Status, string> = {
  'in-revision': 'bg-amber-600/80',
  'final-edit': 'bg-foreground/90',
  drafting: 'bg-muted-foreground/60',
  published: 'bg-emerald-600/80',
};

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
            <ol data-slot="breadcrumb-list" class=${cn(breadcrumbListClass(), 'justify-center md:justify-start')}>
              <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                <a data-slot="breadcrumb-link" href="#" class=${cn(breadcrumbLinkClass(), 'inline-flex items-center gap-1.5')}>
                  ${ArrowLeftIcon('size-3')}
                  Editorial Dashboard
                </a>
              </li>
            </ol>
          </nav>
          <h1 class="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">
            Article Directory
          </h1>
        </div>
        <div>
          <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'gap-2 sm:ml-auto md:gap-4')}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>
              ${PlusIcon('inline-start')}
              New Article
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function articleRow(row: ArticleRow) {
  return html`
    <tr data-slot="table-row" class=${tableRowClass()}>
      <td data-slot="table-cell" class=${tableCellClass()}>
        <div class="flex flex-col gap-1">
          <p class="font-heading text-xl tracking-tight text-foreground">
            ${row.title}
          </p>
          <p class="text-xs text-muted-foreground">
            ${row.wordProgress}
          </p>
        </div>
      </td>
      <td data-slot="table-cell" class=${tableCellClass()}>${row.author}</td>
      <td data-slot="table-cell" class=${tableCellClass()}>${row.issue}</td>
      <td data-slot="table-cell" class=${tableCellClass()}>
        <span data-slot="badge" data-variant=${STATUS_BADGE_VARIANT[row.status]} class=${badgeClass({ variant: STATUS_BADGE_VARIANT[row.status] })}>
          <span class=${cn('size-1.5 rounded-full', STATUS_DOT_CLASSNAME[row.status])}></span>
          ${row.statusLabel}
        </span>
      </td>
      <td data-slot="table-cell" class=${tableCellClass()}>
        <div data-slot="progress" class="flex flex-row-reverse flex-wrap items-center gap-3">
          <span data-slot="progress-value" class="ml-auto text-sm text-muted-foreground tabular-nums">${row.progress + '%'}</span>
          <progress data-slot="progress-track" value=${row.progress} max="100" aria-label=${row.progress + '% complete'} class=${cn(progressClass(), 'w-16')}></progress>
        </div>
      </td>
    </tr>
  `;
}

function articleDirectoryCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <input data-slot="input-group-control" id="sera-article-directory-search" type="search" placeholder="Search articles..." aria-label="Search articles" class=${inputGroupInputClass()}>
          <label data-slot="input-group-addon" data-align="inline-start" for="sera-article-directory-search" class=${inputGroupAddonClass()}>
            ${SearchIcon()}
          </label>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="table-container" class=${tableContainerClass()}>
          <table data-slot="table" class=${tableClass()}>
            <thead data-slot="table-header" class=${tableHeaderClass()}>
              <tr data-slot="table-row" class=${cn(tableRowClass(), 'hover:bg-transparent')}>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Title</th>
                <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[170px]')}>Author</th>
                <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[150px]')}>Issue</th>
                <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[180px]')}>Status</th>
                <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[140px]')}>Progress</th>
              </tr>
            </thead>
            <tbody data-slot="table-body" class=${tableBodyClass()}>
              ${ARTICLE_ROWS.map(articleRow)}
            </tbody>
          </table>
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <nav role="navigation" aria-label="pagination" data-slot="pagination" class=${paginationClass()}>
          <ul data-slot="pagination-content" class=${paginationContentClass()}>
            <li data-slot="pagination-item">
              <a href="#" aria-label="Previous page" data-slot="pagination-link" data-active="false" class=${paginationLinkClass({ size: 'icon-sm' })}>
                ${ChevronLeftIcon('cn-rtl-flip')}
              </a>
            </li>
            ${[1, 2, 3].map((page) => html`
              <li data-slot="pagination-item">
                <a href="#" aria-current=${page === 1 ? 'page' : nothing} data-slot="pagination-link" data-active=${page === 1 ? 'true' : 'false'} class=${paginationLinkClass({ size: 'icon-sm', isActive: page === 1 })}>
                  ${page}
                </a>
              </li>
            `)}
            <li data-slot="pagination-item">
              <a href="#" aria-label="Next page" data-slot="pagination-link" data-active="false" class=${paginationLinkClass({ size: 'icon-sm' })}>
                ${ChevronRightIcon('cn-rtl-flip')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  `;
}

export function articleDirectory() {
  return html`
    <div class="preview theme-taupe @container/preview w-full flex-1 bg-muted pt-4 font-sans ring-1 ring-foreground/5 [--gap:--spacing(4)] sm:pt-0 md:[--gap:--spacing(6)] xl:[--gap:--spacing(8)] 2xl:py-8 **:[.container]:px-(--gap)">
      ${previewHeader()}
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'hidden sm:block')}></div>
      <div class="container py-(--gap)">
        ${articleDirectoryCard()}
      </div>
    </div>
  `;
}
