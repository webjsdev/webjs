import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { nativeSelectClass, nativeSelectIconClass, nativeSelectWrapperClass } from '#modules/ui/components/native-select.ts';
import { drawerDescriptionClass, drawerFooterClass, drawerHeaderClass, drawerTitleClass } from '#modules/ui/components/drawer.ts';
import { CheckIcon, ChevronDownIcon, CopyIcon } from './icons.ts';
import type { TypesetParams } from './params.ts';
import {
  DEFAULT_FONT_SOURCE,
  FONT_SOURCES,
  IMPORT_CSS,
  TYPESET_DOCS_URL,
  fontSteps,
  presetCode,
  promptText,
  usageCode,
  type FontSource,
} from './docs.ts';

/**
 * The typeset builder's Docs / Prompt panel, shadcn/ui's TypesetDocsPanel and
 * TypesetGetCodeDrawer (apps/v4/app/(app)/(typeset)/components/docs-panel.tsx
 * and get-code-drawer.tsx, #1666), as server markup in the base-nova look.
 * The text is modules/ui/typeset/docs.ts.
 *
 * Every code sample carries `data-typeset-code="<key>"`, and
 * <typeset-customizer> rewrites those when a choice changes, from the same
 * docs.ts functions, so the samples follow the preview with no reload. That
 * is also why they are plain <pre> blocks rather than <code-block>: shadcn's
 * DocsCode is unhighlighted, and a block whose text the element replaces has
 * no highlighting to keep in step. Each takes `tabindex="0"`, since it
 * scrolls (the site's code-block rule).
 *
 * shadcn's framework select becomes a font-source select (see docs.ts for
 * why). Both sources' steps are rendered and the select shows one. With
 * JavaScript off the default shows.
 */

// <ui-tabs> moves its class onto the element it renders, so the host itself
// is a plain block and breaks the flex column that lets the panel scroll.
// The container makes the host a flex column too.
const TABS_HOST = '[&_ui-tabs]:flex [&_ui-tabs]:min-h-0 [&_ui-tabs]:flex-1 [&_ui-tabs]:flex-col';

function code(key: string, text: string, className = '') {
  return html`<div class="relative rounded-lg bg-muted/60">
    <pre tabindex="0" data-typeset-code=${key} class=${cn('scrollbar-none m-0 overflow-x-auto p-3 font-mono text-sm leading-relaxed', className)}>${text}</pre>
  </div>`;
}

const prose = (text: unknown) => html`<p class="m-0 text-sm leading-relaxed text-muted-foreground">${text}</p>`;

function section(step: number, title: string, body: unknown) {
  return html`<section class="flex flex-col gap-2.5">
    <h3 class="m-0 text-sm font-medium">${step}. ${title}</h3>
    ${body}
  </section>`;
}

// A copy button, shadcn's outline `sm` with the copy icon swapping to a check
// for two seconds. `href`, when given, makes it a link that works with no
// script (the stylesheet opens), and the element copies instead.
function copyButton(label: string, kind: 'css' | 'prompt', href?: string) {
  const cls = cn(buttonClass({ variant: 'outline', size: 'sm' }), 'group/copy w-fit no-underline');
  const body = html`<span class="contents group-data-copied/copy:hidden">${CopyIcon('')}</span><span class="hidden group-data-copied/copy:contents">${CheckIcon('')}</span>${label}`;
  return href
    ? html`<a href=${href} data-copy=${kind} data-slot="button" class=${cls}>${body}</a>`
    : html`<button type="button" data-copy=${kind} data-slot="button" class=${cls}>${body}</button>`;
}

function fontStepsFor(params: TypesetParams, source: FontSource, shown: boolean) {
  return html`<div data-font-source=${source} ?hidden=${!shown} class="flex flex-col gap-2.5">
    ${fontSteps(params, source).map((step, i) => html`${prose(step.prose)}${code(`font-${source}-${i}`, step.code)}`)}
  </div>`;
}

/** The tabs, shared by the xl panel and the Get Code drawer. */
export function docsContent(params: TypesetParams, origin: string) {
  return html`<ui-tabs value="docs" class="flex min-h-0 flex-1 flex-col gap-0">
    <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
      <ui-tabs-list>
        <ui-tabs-trigger value="docs">Docs</ui-tabs-trigger>
        <ui-tabs-trigger value="prompt">Prompt</ui-tabs-trigger>
      </ui-tabs-list>
      <div class=${nativeSelectWrapperClass()}>
        <select data-font-source-select aria-label="Font source" data-size="sm" class=${nativeSelectClass()}>
          ${FONT_SOURCES.map((option) => html`<option value=${option.value} ?selected=${option.value === DEFAULT_FONT_SOURCE}>${option.label}</option>`)}
        </select>
        ${ChevronDownIcon(nativeSelectIconClass())}
      </div>
    </div>
    <div class="min-h-0 flex-1 scroll-fade scrollbar-none overflow-y-auto p-4 md:p-6">
      <ui-tabs-content value="docs" class="flex flex-col gap-6">
        ${section(1, 'Create typeset.css', html`
          ${prose(html`Copy the stylesheet into <code class="font-mono">public/typeset.css</code>, next to your <code class="font-mono">public/input.css</code>, then import it:`)}
          ${copyButton('Copy typeset.css', 'css', '/ui/typeset.css')}
          ${code('import', IMPORT_CSS)}`)}
        ${section(2, 'Add the fonts', html`
          ${FONT_SOURCES.map((option) => fontStepsFor(params, option.value, option.value === DEFAULT_FONT_SOURCE))}`)}
        ${section(3, 'Create your custom typeset', code('preset', presetCode(params)))}
        ${section(4, 'Wrap your content', code('usage', usageCode(params)))}
      </ui-tabs-content>
      <ui-tabs-content value="prompt" class="flex flex-col gap-2.5">
        ${prose('One prompt with your picks baked in. Copy it and paste it into your coding agent.')}
        ${code('prompt', promptText(params, DEFAULT_FONT_SOURCE, origin), 'max-h-102 scroll-fade overflow-y-auto whitespace-pre-wrap')}
        ${copyButton('Copy Prompt', 'prompt')}
      </ui-tabs-content>
    </div>
  </ui-tabs>`;
}

/**
 * shadcn's "Read the docs". This site has no typeset docs page yet, and the
 * stylesheet is shadcn's unchanged, so shadcn's page is the true reference.
 * (Asking modules/ui/docs/nav.ts would ship this page to the browser: the
 * elision analyser reads that module as client work.)
 */
function readTheDocs() {
  return html`<a href=${TYPESET_DOCS_URL} target="_blank" rel="noopener noreferrer" data-slot="button" class=${cn(buttonClass({ variant: 'link', size: 'sm' }), 'text-muted-foreground')}>Read the docs</a>`;
}

/** The right-hand panel, from xl up. */
export function docsPanel(params: TypesetParams, origin: string) {
  return html`<div data-slot="typeset-docs" class="hidden w-88 flex-col items-start gap-3 xl:flex 2xl:w-104">
    <div class=${cn('isolate flex max-h-[calc(100vh-16rem)] w-full flex-col overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/10', TABS_HOST)}>
      ${docsContent(params, origin)}
    </div>
    ${readTheDocs()}
  </div>`;
}

/** Below xl the panel moves into a drawer, opened from the customizer's Get Code button. */
export function getCodeDrawer(params: TypesetParams, origin: string, triggerClass: string) {
  return html`<ui-drawer class="contents *:data-[slot=drawer]:contents">
    <ui-drawer-trigger class="contents *:data-[slot=drawer-trigger]:contents"><button type="button" data-slot="button" class=${triggerClass}>Get Code</button></ui-drawer-trigger>
    <ui-drawer-content direction="bottom" class=${cn('flex flex-col data-[vaul-drawer-direction=bottom]:max-h-[85svh]', TABS_HOST)}>
      <div class=${drawerHeaderClass()}>
        <h2 data-slot="drawer-title" class=${drawerTitleClass()}>Get Code</h2>
        <p data-slot="drawer-description" class=${drawerDescriptionClass()}>Install typeset with the values you picked.</p>
      </div>
      ${docsContent(params, origin)}
      <div class=${drawerFooterClass()}>
        <ui-drawer-close><button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>Done</button></ui-drawer-close>
      </div>
    </ui-drawer-content>
  </ui-drawer>`;
}
