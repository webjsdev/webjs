/**
 * The Sera page's Edit Article screen, ported from shadcn's
 * apps/v4/app/(app)/(styles)/sera/edit-article/ (index.tsx, the preview header
 * and the editor workspace) element for element as server markup.
 */
import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import {
  breadcrumbItemClass, breadcrumbLinkClass, breadcrumbListClass,
} from '#modules/ui/components/breadcrumb.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  buttonGroupClass, buttonGroupSeparatorClass,
} from '#modules/ui/components/button-group.ts';
import {
  cardClass, cardContentClass, cardHeaderClass, cardTitleClass,
} from '#modules/ui/components/card.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldClass, fieldGroupClass, fieldLabelClass, fieldLegendClass, fieldSetClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { progressClass } from '#modules/ui/components/progress.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import {
  ArrowLeftIcon, BoldIcon, ImageIcon, ItalicIcon, ListIcon, UnderlineIcon,
} from '#lib/ui/lucide.ts';
import {
  AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ChevronDownIcon, Code2Icon,
  ExternalLinkIcon, Heading1Icon, Heading2Icon, Heading3Icon, LinkIcon,
  ListOrderedIcon, RedoIcon, StrikethroughIcon, TypeIcon, UndoIcon,
} from './edit-article/icons.ts';

interface Milestone {
  id: string;
  name: string;
  complete: boolean;
  note?: string;
}

// shadcn uses the milestone name as the checkbox id. A name with spaces and an
// ampersand is not a usable id, so each carries a slug of its own, prefixed so
// it stays unique on the page every Sera screen renders into.
const MILESTONES: Milestone[] = [
  { id: 'sera-edit-article-outline', name: 'Outline & Commissioning', complete: true },
  { id: 'sera-edit-article-first-draft', name: 'First Draft Submitted', complete: true },
  { id: 'sera-edit-article-review', name: 'Review & Revisions', complete: false, note: 'Waiting on editor' },
  { id: 'sera-edit-article-copy-edit', name: 'Final Copy Edit', complete: false },
  { id: 'sera-edit-article-art-direction', name: 'Art Direction & Layout', complete: false },
];

const ISSUES = [
  { label: 'Spring Issue 2024', value: 'spring-2024' },
  { label: 'Summer Issue 2024', value: 'summer-2024' },
  { label: 'Autumn Issue 2024', value: 'autumn-2024' },
  { label: 'Winter Issue 2024', value: 'winter-2024' },
];

const BLOCK_TYPES = [
  { icon: TypeIcon, label: 'Normal Text' },
  { icon: Heading1Icon, label: 'Heading 1' },
  { icon: Heading2Icon, label: 'Heading 2' },
  { icon: Heading3Icon, label: 'Heading 3' },
  { icon: ListIcon, label: 'Bullet List' },
  { icon: ListOrderedIcon, label: 'Numbered List' },
];

const BLOCK_TYPE_TRIGGER_ID = 'sera-edit-article-block-type';

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
                  Back to articles
                </a>
              </li>
            </ol>
          </nav>
          <h1 class="line-clamp-1 font-heading text-3xl tracking-wide uppercase md:text-3xl lg:text-4xl">
            EDIT ARTICLE
          </h1>
        </div>
        <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'gap-2 md:gap-4')}>
          <span data-slot="badge" data-variant="default" title="2 minutes ago" class=${badgeClass()}>Autosaved</span>
          <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'gap-2 md:gap-4')}>
            <button type="button" data-slot="button" data-variant="link" data-size="default" class=${buttonClass({ variant: 'link' })}>
              Preview
              ${ExternalLinkIcon('inline-end')}
            </button>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Submit Draft</button>
          </div>
        </div>
      </div>
    </header>
  `;
}

const toolbarSeparator = (extra = '') => html`
  <div role="none" data-slot="button-group-separator" data-orientation="vertical" class=${cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass(), 'mx-2', extra, 'data-vertical:h-4 data-vertical:self-center')}></div>
`;

const toolbarButton = (label: string, icon: () => unknown, extra = '') => html`
  <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label=${label} class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), extra)}>
    ${icon()}
  </button>
`;

function editorToolbar() {
  return html`
    <div class="flex border-b p-2">
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" id=${BLOCK_TYPE_TRIGGER_ID} data-slot="button" data-variant="ghost" data-size="sm" class=${buttonClass({ variant: 'ghost', size: 'sm' })}>
          Normal Text
          ${ChevronDownIcon('inline-end')}
        </button>
        ${toolbarSeparator()}
        ${toolbarButton('Bold', BoldIcon)}
        ${toolbarButton('Italic', ItalicIcon)}
        ${toolbarButton('Underline', UnderlineIcon)}
        ${toolbarButton('Strikethrough', StrikethroughIcon, 'hidden md:flex')}
        ${toolbarButton('Code', Code2Icon, 'hidden md:flex')}
        ${toolbarSeparator('hidden md:flex')}
        ${toolbarButton('Align Left', AlignLeftIcon, 'hidden md:flex')}
        ${toolbarButton('Align Center', AlignCenterIcon, 'hidden md:flex')}
        ${toolbarButton('Align Right', AlignRightIcon, 'hidden md:flex')}
        ${toolbarSeparator('hidden md:flex')}
        ${toolbarButton('Link', LinkIcon, 'hidden md:flex')}
        ${toolbarButton('Image', ImageIcon, 'hidden md:flex')}
      </div>
      <ui-dropdown-menu trigger=${BLOCK_TYPE_TRIGGER_ID} class="absolute">
        <ui-dropdown-menu-content>
          ${BLOCK_TYPES.map((item) => html`
            <ui-dropdown-menu-item>
              ${item.icon()}
              ${item.label}
            </ui-dropdown-menu-item>
          `)}
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'ml-auto')}>
        ${toolbarButton('Undo', UndoIcon)}
        ${toolbarButton('Redo', RedoIcon)}
      </div>
    </div>
  `;
}

function editorBody() {
  return html`
    <div class="mx-auto flex max-w-2xl flex-1 flex-col gap-8 px-10 py-10 leading-loose md:px-14 lg:py-18">
      <h1 class="font-heading text-4xl leading-12 font-medium tracking-wide uppercase">
        The Future of Sustainable Architecture
      </h1>
      <p>
        As cities continue to expand at an unprecedented rate, the
        architectural paradigm is shifting from mere expansion to
        sustainable integration. The concrete jungles of the 20th century
        are making way for structures that breathe, adapt, and give back to
        their environments.
      </p>
      <p>
        Historically, urban development has been a zero-sum game with
        nature.
      </p>
      <h2 class="font-heading text-2xl tracking-wide uppercase">
        The Living Building Challenge
      </h2>
      <p>
        Sterling&apos;s latest project in downtown Seattle is a testament to
        this new philosophy. &quot;We are no longer designing static
        structures,&quot; Sterling explained during a recent site visit.
        &quot;We are engineering localized ecosystems.&quot;
      </p>
      <p>
        The building features a facade of responsive biomaterials that
        adjust their porosity based on humidity and temperature,
        significantly reducing the need for artificial climate control.
        Rainwater is not merely channeled away but captured, filtered
        through a series of integrated rooftop wetlands, and reused within
        the building&apos;s greywater system.
      </p>
      <p class="text-sm text-muted-foreground">
        This shift requires more than just innovative materials; it demands
        a fundamental change in how we value space. Check with engineering
        team for specific stats.
      </p>
    </div>
  `;
}

function articleDetailsCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-full md:col-span-6 lg:col-span-4')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Article Details</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="sera-edit-article-issue" class=${fieldLabelClass()}>Issue</label>
            <ui-select>
              <select id="sera-edit-article-issue" name="issue" class=${selectTriggerClass()}>
                ${ISSUES.map((issue) => html`
                  <option value=${issue.value} ?selected=${issue.value === 'summer-2024'}>${issue.label}</option>
                `)}
              </select>
            </ui-select>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="sera-edit-article-author" class=${fieldLabelClass()}>Author</label>
            <input data-slot="input" id="sera-edit-article-author" name="author" value="Elena Rostova" class=${inputClass()}>
          </div>
        </div>
      </div>
    </div>
  `;
}

function publicationFlowCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-full md:col-span-6 lg:col-span-4')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Publication Flow</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>Required Milestones</legend>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              ${MILESTONES.map((milestone) => html`
                <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                  <input type="checkbox" data-slot="checkbox" id=${milestone.id} name=${milestone.name} ?checked=${milestone.complete} class=${checkboxClass()}>
                  <label data-slot="field-label" for=${milestone.id} class=${fieldLabelClass()}>
                    ${milestone.name}
                  </label>
                </div>
              `)}
            </div>
          </fieldset>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="sera-edit-article-note" class=${fieldLabelClass()}>Add note for editor</label>
            <textarea data-slot="textarea" id="sera-edit-article-note" name="note" placeholder="This article needs to be revised for clarity and accuracy." class=${textareaClass()}></textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

function wordCountCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'col-span-full lg:col-span-4')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Word Count</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="progress" class="flex flex-wrap gap-3">
          <span data-slot="progress-label" id="sera-edit-article-word-count" class="text-xs font-semibold tracking-wide uppercase">1,402 / 2,000 words</span>
          <span data-slot="progress-value" class="ml-auto text-sm text-muted-foreground tabular-nums">70%</span>
          <progress data-slot="progress-track" value="70" max="100" aria-labelledby="sera-edit-article-word-count" class=${progressClass()}></progress>
        </div>
      </div>
    </div>
  `;
}

function editorWorkspace() {
  return html`
    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section class="flex flex-col border border-border/70 bg-background">
        ${editorToolbar()}
        ${editorBody()}
      </section>
      <aside class="grid grid-cols-12 gap-(--gap) xl:flex xl:flex-col">
        ${articleDetailsCard()}
        ${publicationFlowCard()}
        ${wordCountCard()}
      </aside>
    </div>
  `;
}

export function editArticle() {
  return html`
    <div class="preview theme-taupe @container/preview w-full flex-1 bg-muted pt-4 font-sans ring-1 ring-foreground/5 [--gap:--spacing(4)] sm:pt-0 md:[--gap:--spacing(6)] xl:[--gap:--spacing(8)] 2xl:py-8 **:[.container]:px-(--gap)">
      ${previewHeader()}
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'hidden sm:block')}></div>
      <div class="container py-(--gap)">
        ${editorWorkspace()}
      </div>
    </div>
  `;
}
