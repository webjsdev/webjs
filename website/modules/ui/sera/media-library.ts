/**
 * The Media Library screen of the /ui Sera page, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/media-library/ (index.tsx and its
 * preview-header, asset-grid and asset-details components).
 *
 * The header, the type icon and the pagination are exported, since the media
 * library table screen renders the same ones.
 */
import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
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
  itemClass, itemContentClass, itemDescriptionClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import {
  ArrowLeftIcon, CheckIcon, FileTextIcon, ImageIcon, PlusIcon, SearchIcon,
} from '#lib/ui/lucide.ts';
import { ASSETS, type Asset, type AssetType } from './media-library-data.ts';

type DataIcon = 'inline-start' | 'inline-end';

/**
 * A lucide icon carrying shadcn's `data-icon` placement, which the button
 * styles read to tighten the padding on the icon's side. lib/ui/lucide.ts
 * takes only a class, and it lacks a few of the icons these screens use.
 */
function lucide(name: string, body: ReturnType<typeof svg>, cls = '', dataIcon?: DataIcon) {
  return svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-icon=${dataIcon ?? null} class=${'lucide lucide-' + name + (cls ? ' ' + cls : '')}>${body}</svg>`;
}

export const SlidersHorizontalIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('sliders-horizontal', svg`<path d="M10 5H3"></path><path d="M12 19H3"></path><path d="M14 3v4"></path><path d="M16 17v4"></path><path d="M21 12h-9"></path><path d="M21 19h-5"></path><path d="M21 5h-7"></path><path d="M8 10v4"></path><path d="M8 12H3"></path>`, cls, dataIcon);
export const UploadIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('upload', svg`<path d="M12 3v12"></path><path d="m17 8-5-5-5 5"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>`, cls, dataIcon);
export const DownloadIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('download', svg`<path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path>`, cls, dataIcon);
export const CalendarIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('calendar', svg`<path d="M8 2v3"></path><path d="M16 2v3"></path><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18"></path>`, cls, dataIcon);
export const VideoIcon = (cls = '') =>
  lucide('video', svg`<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect>`, cls);
export const MoreVerticalIcon = (cls = '') =>
  lucide('ellipsis-vertical', svg`<circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>`, cls);
const ChevronLeftIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('chevron-left', svg`<path d="m15 18-6-6 6-6"></path>`, cls, dataIcon);
const ChevronRightIcon = (cls = '', dataIcon?: DataIcon) =>
  lucide('chevron-right', svg`<path d="m9 18 6-6-6-6"></path>`, cls, dataIcon);

/** shadcn's AssetTypeIcon, which draws a video, a document or an image. */
export function assetTypeIcon(type: AssetType, cls = '') {
  if (type === 'MP4') return VideoIcon(cls);
  if (type === 'PDF') return FileTextIcon(cls);
  return ImageIcon(cls);
}

/** The screen's outer wrapper, the same on both media library screens. */
export const PREVIEW_CLASS =
  'preview theme-taupe @container/preview w-full flex-1 bg-muted pt-4 font-sans ring-1 ring-foreground/5 [--gap:--spacing(4)] sm:pt-0 md:[--gap:--spacing(6)] xl:[--gap:--spacing(8)] 2xl:py-8 **:[.container]:px-(--gap)';

/** The search field heading each asset card. */
export function assetSearch(id: string) {
  return html`
    <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'w-full')}>
      <label data-slot="input-group-addon" data-align="inline-start" for=${id} class=${inputGroupAddonClass()}>
        ${SearchIcon()}
      </label>
      <input data-slot="input-group-control" id=${id} type="text" placeholder="Search files, tags, or metadata..." aria-label="Search assets" class=${inputGroupInputClass()}>
    </div>
  `;
}

/**
 * shadcn's Pagination with Previous, pages 1 to 3 (the first active) and
 * Next. `text` is the Previous / Next label, which the table screen empties.
 */
export function assetPagination(text?: { previous: string; next: string }) {
  const previous = text?.previous ?? 'Previous';
  const next = text?.next ?? 'Next';
  return html`
    <nav role="navigation" aria-label="pagination" data-slot="pagination" class=${paginationClass()}>
      <ul data-slot="pagination-content" class=${paginationContentClass()}>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to previous page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'cn-pagination-link cn-pagination-previous')}>
            ${ChevronLeftIcon('cn-rtl-flip', 'inline-start')}
            <span class="cn-pagination-previous-text hidden sm:block">${previous}</span>
          </a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-current="page" data-slot="pagination-link" data-active="true" class=${cn(paginationLinkClass({ isActive: true }), 'cn-pagination-link')}>1</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass(), 'cn-pagination-link')}>2</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass(), 'cn-pagination-link')}>3</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to next page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'cn-pagination-link cn-pagination-next')}>
            <span class="cn-pagination-next-text hidden sm:block">${next}</span>
            ${ChevronRightIcon('cn-rtl-flip', 'inline-end')}
          </a>
        </li>
      </ul>
    </nav>
  `;
}

/** shadcn's PreviewHeader for both media library screens. */
export function mediaLibraryHeader() {
  return html`
    <header>
      <div class="container flex flex-col items-center justify-center gap-(--gap) py-(--gap) sm:flex-row sm:justify-between">
        <div class="flex flex-col gap-2 text-center sm:text-left">
          <nav aria-label="breadcrumb" data-slot="breadcrumb" class="cn-breadcrumb">
            <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
              <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
                <a href="#" data-slot="breadcrumb-link" class=${cn(breadcrumbLinkClass(), 'flex items-center gap-1.5')}>
                  ${ArrowLeftIcon('size-3.5')}
                  Asset management
                </a>
              </li>
            </ol>
          </nav>
          <h1 class="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">
            Media Library
          </h1>
        </div>
        <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'gap-2 sm:ml-auto md:gap-4')}>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'bg-background hover:bg-background/80')}>
            ${SlidersHorizontalIcon('', 'inline-start')}
            Filters
          </button>
          <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>
            ${UploadIcon('', 'inline-start')}
            Upload Assets
          </button>
        </div>
      </div>
    </header>
  `;
}

/** The separator under the header, hidden on the narrowest screens. */
export function headerSeparator() {
  return html`<div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'hidden sm:block')}></div>`;
}

function assetGridItem(asset: Asset, selected: boolean) {
  return html`
    <button
      type="button"
      aria-pressed=${selected}
      class="group flex flex-col gap-2.5 text-left outline-none focus-visible:[&>div:first-child]:ring-2 focus-visible:[&>div:first-child]:ring-ring"
    >
      <div class=${cn(
        'relative flex aspect-4/3 items-center justify-center bg-muted/60 ring-1 ring-border/70 transition-shadow ring-inset group-hover:ring-foreground/40',
        selected && 'ring-2 ring-foreground group-hover:ring-foreground',
      )}>
        ${selected ? html`
          <div class="absolute top-2 left-2 flex size-5 items-center justify-center bg-foreground text-background">
            ${CheckIcon('size-3')}
          </div>
        ` : null}
        <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'absolute top-2 right-2 border bg-background px-2 py-1 text-[0.625rem]')}>
          ${asset.type}
        </span>
        ${asset.duration ? html`
          <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'absolute bottom-2 left-2 bg-foreground px-2 py-1 text-background')}>
            ${asset.duration}
          </span>
        ` : null}
        ${assetTypeIcon(asset.type, 'size-7 text-muted-foreground/60')}
      </div>
      <div class="flex flex-col gap-0.5 px-0.5">
        <p class="line-clamp-1 text-sm font-medium">${asset.name}</p>
        <p class="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
          ${asset.date} · ${asset.size}
        </p>
      </div>
    </button>
  `;
}

// shadcn keeps the selected asset in React state, and a click swaps the
// details card. The page never hydrates, so the first asset stays selected.
function assetGrid(selectedId: string) {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        ${assetSearch('media-library-search')}
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          ${ASSETS.map((asset) => assetGridItem(asset, asset.id === selectedId))}
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-center')}>
        ${assetPagination()}
      </div>
    </div>
  `;
}

const TYPE_LABEL: Record<AssetType, string> = {
  JPEG: 'Image / JPEG',
  PNG: 'Image / PNG',
  WEBP: 'Image / WEBP',
  MP4: 'Video / MP4',
  PDF: 'Document / PDF',
};

const LABEL_CLASS = 'text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase';

function detailsSeparator() {
  return html`<div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>`;
}

function assetDetails(asset: Asset) {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'gap-0')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-6')}>
        <div class="flex aspect-5/4 items-center justify-center bg-muted/60 text-muted-foreground/60 ring-1 ring-border/70 ring-inset">
          ${assetTypeIcon(asset.type, 'size-8')}
        </div>
        <h2 class="line-clamp-2 font-heading text-xl tracking-wide">
          ${asset.name}
        </h2>
        ${detailsSeparator()}
        <dl class="flex flex-col gap-5 text-sm">
          <div class="flex flex-col gap-1.5">
            <dt class=${LABEL_CLASS}>Asset Type</dt>
            <dd>${TYPE_LABEL[asset.type]}</dd>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <dt class=${LABEL_CLASS}>Dimensions</dt>
              <dd>${asset.dimensions}</dd>
            </div>
            <div class="flex flex-col gap-1.5">
              <dt class=${LABEL_CLASS}>File Size</dt>
              <dd>${asset.size}</dd>
            </div>
          </div>
        </dl>
        ${detailsSeparator()}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class=${LABEL_CLASS}>Tags</h3>
            <button type="button" aria-label="Add tag" data-slot="button" data-variant="ghost" data-size="icon-xs" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
              ${PlusIcon()}
            </button>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-2">
            ${asset.tags.map((tag) => html`<span data-slot="badge" data-variant="default" class=${badgeClass()}>${tag}</span>`)}
          </div>
        </div>
        ${detailsSeparator()}
        <div class="flex flex-col gap-3">
          <h3 class=${LABEL_CLASS}>Used In</h3>
          <div class="flex flex-col gap-2">
            ${asset.usedIn.map((usage) => html`
              <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
                <div data-slot="item-content" class=${itemContentClass()}>
                  <div data-slot="item-title" class=${itemTitleClass()}>${usage.title}</div>
                  <p data-slot="item-description" class=${itemDescriptionClass()}>${usage.role}</p>
                </div>
              </div>
            `)}
          </div>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'mt-6 border-t pt-6')}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>
          ${DownloadIcon('', 'inline-start')}
          Download
        </button>
      </div>
    </div>
  `;
}

export function mediaLibrary() {
  const selected = ASSETS[0];
  return html`
    <div class=${PREVIEW_CLASS}>
      ${mediaLibraryHeader()}
      ${headerSeparator()}
      <div class="container grid grid-cols-1 items-start gap-(--gap) py-(--gap) xl:grid-cols-[minmax(0,1fr)_320px]">
        ${assetGrid(selected.id)}
        ${assetDetails(selected)}
      </div>
    </div>
  `;
}
