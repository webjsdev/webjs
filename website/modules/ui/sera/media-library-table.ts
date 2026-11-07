/**
 * The Media Library table screen of the /ui Sera page, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/media-library-table/ (index.tsx and its
 * asset-table and filter-library components). Its header is media-library.ts's.
 */
import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardContentClass, cardFooterClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldClass, fieldGroupClass, fieldLabelClass, fieldLegendClass, fieldSetClass,
} from '#modules/ui/components/field.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { radioClass, radioGroupClass } from '#modules/ui/components/radio-group.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';
import {
  tableBodyClass, tableCellClass, tableClass, tableContainerClass,
  tableHeadClass, tableHeaderClass, tableRowClass,
} from '#modules/ui/components/table.ts';
import { ASSETS, type Asset } from './media-library-data.ts';
import {
  CalendarIcon, MoreVerticalIcon, PREVIEW_CLASS, assetPagination, assetSearch,
  assetTypeIcon, headerSeparator, mediaLibraryHeader,
} from './media-library.ts';

// Ids carry the screen's name, since the Sera page renders several screens.
const PREFIX = 'media-library-table';

// shadcn starts with the first asset selected.
const INITIALLY_SELECTED = new Set(['1']);

function assetRow(asset: Asset) {
  const id = PREFIX + '-select-' + asset.id;
  // shadcn toggles the row's data-state from React state, and a click anywhere
  // on the row toggles it. Here the checkbox is the toggle and the row reads
  // its checked state with has-checked, so the highlight still follows it.
  return html`
    <tr data-slot="table-row" class=${cn(tableRowClass(), 'cursor-pointer has-checked:bg-muted')}>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'pl-6')}>
        <input type="checkbox" data-slot="checkbox" id=${id} aria-label=${'Select ' + asset.name} ?checked=${INITIALLY_SELECTED.has(asset.id)} class=${checkboxClass()}>
      </td>
      <td data-slot="table-cell" class=${tableCellClass()}>
        <div class="relative flex aspect-4/3 w-16 items-center justify-center bg-muted/60 ring-1 ring-border/70 ring-inset">
          ${asset.duration ? html`
            <span class="absolute right-1 bottom-1 bg-foreground/90 px-1 text-[0.5rem] font-semibold tracking-wider text-background">
              ${asset.duration}
            </span>
          ` : null}
          ${assetTypeIcon(asset.type, 'size-4 text-muted-foreground/60')}
        </div>
      </td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-sm font-medium text-foreground')}>
        ${asset.name}
      </td>
      <td data-slot="table-cell" class=${tableCellClass()}>
        <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'border px-2 py-0.5 text-[0.625rem]')}>
          ${asset.type}
        </span>
      </td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-sm')}>${asset.dimensions}</td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-sm')}>${asset.size}</td>
      <td data-slot="table-cell" class=${tableCellClass()}>${asset.uploadedBy}</td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-xs font-semibold tracking-wider text-muted-foreground uppercase')}>
        ${asset.date}
      </td>
      <td data-slot="table-cell" class=${cn(tableCellClass(), 'pr-6 text-right')}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" aria-label=${'Open actions for ' + asset.name} data-slot="button" data-variant="ghost" data-size="icon-xs" class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}>
              ${MoreVerticalIcon()}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content align="end">
            <ui-dropdown-menu-item>Preview</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Download</ui-dropdown-menu-item>
            <ui-dropdown-menu-item variant="destructive">
              Delete
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </td>
    </tr>
  `;
}

function assetTable() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        ${assetSearch('media-library-table-search')}
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'px-0 py-0')}>
        <div data-slot="table-container" class=${tableContainerClass()}>
          <table data-slot="table" class=${tableClass()}>
            <thead data-slot="table-header" class=${tableHeaderClass()}>
              <tr data-slot="table-row" class=${tableRowClass()}>
                <th scope="col" aria-label="Select" data-slot="table-head" class=${cn(tableHeadClass(), 'w-10 pl-6')}></th>
                <th scope="col" aria-label="Preview" data-slot="table-head" class=${cn(tableHeadClass(), 'w-20')}></th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Filename</th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Type</th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Dimensions</th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Size</th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Uploaded By</th>
                <th scope="col" data-slot="table-head" class=${tableHeadClass()}>Date</th>
                <th scope="col" aria-label="Actions" data-slot="table-head" class=${cn(tableHeadClass(), 'w-10 pr-6')}></th>
              </tr>
            </thead>
            <tbody data-slot="table-body" class=${tableBodyClass()}>
              ${ASSETS.map((asset) => assetRow(asset))}
            </tbody>
          </table>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'justify-center py-4')}>
        ${assetPagination({ previous: '', next: '' })}
      </div>
    </div>
  `;
}

const FILE_TYPES = [
  { id: 'images', label: 'Images (JPEG, PNG, WEBP)', defaultChecked: true },
  { id: 'video', label: 'Video (MP4, MOV)', defaultChecked: false },
  { id: 'documents', label: 'Documents (PDF)', defaultChecked: false },
  { id: 'audio', label: 'Audio (MP3, WAV)', defaultChecked: false },
];

const DATE_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '24h', label: 'Past 24 hours' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
];

const TAGS = [
  'architecture',
  'brutalism',
  'ceramics',
  'design-week',
  'editorial',
  'exterior',
  'film',
  'food',
  'furniture',
  'interior',
  'kyoto',
  'minimalism',
  'print',
  'sustainability',
  'summer-issue',
  'video',
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
// date-fns's "LLL dd, y", for instance "Nov 01, 2026".
const formatDay = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

function filterLibrary() {
  // shadcn's initial range, the first of this month to three weeks later.
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1 + 21));

  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cn(cardHeaderClass(), 'border-b')}>
        <div data-slot="card-title" class=${cardTitleClass()}>Filter Library</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>File Type</legend>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              ${FILE_TYPES.map((type) => html`
                <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                  <input type="checkbox" data-slot="checkbox" id=${PREFIX + '-' + type.id} ?checked=${type.defaultChecked} class=${checkboxClass()}>
                  <label data-slot="field-label" for=${PREFIX + '-' + type.id} class=${fieldLabelClass()}>${type.label}</label>
                </div>
              `)}
            </div>
          </fieldset>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Date Uploaded</legend>
            <div role="radiogroup" aria-label="Date Uploaded" data-slot="radio-group" class=${radioGroupClass()}>
              ${DATE_OPTIONS.map((option) => html`
                <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                  <input type="radio" data-slot="radio" name="media-library-table-date" value=${option.value} id=${PREFIX + '-date-' + option.value} ?checked=${option.value === 'any'} class=${radioClass()}>
                  <label data-slot="field-label" for=${PREFIX + '-date-' + option.value} class=${fieldLabelClass()}>${option.label}</label>
                </div>
              `)}
            </div>
          </fieldset>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="media-library-table-custom-range" class=${fieldLabelClass()}>Custom Range</label>
            <button
              type="button"
              id="media-library-table-custom-range"
              popovertarget="media-library-table-custom-range-content"
              aria-haspopup="dialog"
              aria-expanded="false"
              data-slot="button"
              data-variant="outline"
              data-size="default"
              class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}
            >
              ${CalendarIcon('', 'inline-start')}
              ${formatDay(from)} – ${formatDay(to)}
            </button>
            <div id="media-library-table-custom-range-content" popover role="dialog" aria-label="Pick a date range" data-slot="popover-content" class=${cn(popoverContentClass({ align: 'end' }), 'w-auto p-0')}>
              <ui-calendar mode="range" value=${iso(from) + '/' + iso(to)} month=${iso(from).slice(0, 7)} number-of-months="2"></ui-calendar>
            </div>
          </div>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>File Size</legend>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between text-xs font-medium tracking-wider text-muted-foreground uppercase">
                <span>0 MB</span>
                <span>500+ MB</span>
              </div>
              <ui-slider>
                <input type="range" min="0" max="100" step="1" value="0" aria-label="Minimum file size" class=${sliderClass()}>
                <input type="range" min="0" max="100" step="1" value="60" aria-label="Maximum file size" class=${sliderClass()}>
              </ui-slider>
              <div class="flex items-center justify-between text-xs font-medium">
                <span>Min: 0 MB</span>
                <span>Max: 300 MB</span>
              </div>
            </div>
          </fieldset>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Tags</legend>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <ui-combobox multiple value="architecture,brutalism">
                <ui-combobox-chips>
                  <ui-combobox-chips-input placeholder="Filter by tag..." aria-label="Tags"></ui-combobox-chips-input>
                </ui-combobox-chips>
                <ui-combobox-content>
                  <ui-combobox-empty>No tags found.</ui-combobox-empty>
                  <ui-combobox-list>
                    ${TAGS.map((item) => html`<ui-combobox-item value=${item}>${item}</ui-combobox-item>`)}
                  </ui-combobox-list>
                </ui-combobox-content>
              </ui-combobox>
            </div>
          </fieldset>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex flex-col gap-2 border-t')}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>Apply Filters</button>
        <button type="button" data-slot="button" data-variant="ghost" data-size="default" class=${cn(buttonClass({ variant: 'ghost' }), 'w-full')}>
          Reset
        </button>
      </div>
    </div>
  `;
}

export function mediaLibraryTable() {
  return html`
    <div class=${PREVIEW_CLASS}>
      ${mediaLibraryHeader()}
      ${headerSeparator()}
      <div class="container grid grid-cols-1 items-start gap-(--gap) py-(--gap) xl:grid-cols-[minmax(0,1fr)_320px]">
        ${assetTable()}
        ${filterLibrary()}
      </div>
    </div>
  `;
}
