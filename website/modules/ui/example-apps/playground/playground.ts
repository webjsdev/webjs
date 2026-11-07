import { html, svg } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass } from '#modules/ui/components/dialog.ts';
import {
  alertDialogHeaderClass, alertDialogTitleClass, alertDialogDescriptionClass, alertDialogFooterClass,
} from '#modules/ui/components/alert-dialog.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import { CheckIcon, ChevronsUpDown, CopyIcon, MoreHorizontalIcon, RotateCcwIcon } from '#lib/ui/lucide.ts';
import { models, presets, types, type Model } from './data.ts';

/**
 * shadcn's playground example (apps/v4/app/(app)/examples/playground), the
 * OpenAI playground built from the kit (#1666). The page is server markup;
 * the dialogs, menus, popovers, hover cards, tabs, sliders and command lists
 * are the kit's elements, and `<example-bind>` (../example-bind.ts) mirrors
 * their events into the labels around them the way shadcn's useState does:
 * the chosen preset and model, the highlighted model's details, each slider's
 * value. The page that renders this imports those elements.
 */

const outline = (extra = '') => cn(buttonClass({ variant: 'outline' }), extra);
const secondary = (extra = '') => cn(buttonClass({ variant: 'secondary' }), extra);

function presetSelector() {
  return html`<div data-bind-group class="flex flex-1 md:max-w-[200px] lg:max-w-[300px]">
    <button type="button" popovertarget="pg-presets" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Load a preset..." data-slot="button" class=${outline('flex-1 justify-between')}>
      <span data-bind-label>Load a preset...</span>
      ${ChevronsUpDown('opacity-50')}
    </button>
    <div id="pg-presets" popover data-slot="popover-content" data-side="bottom" data-align="center" class=${cn(popoverContentClass(), 'w-[300px] p-0')}>
      <ui-command label="Presets">
        <ui-command-input placeholder="Search presets..."></ui-command-input>
        <ui-command-list>
          <ui-command-empty>No presets found.</ui-command-empty>
          <ui-command-group heading="Examples">
            ${presets.map((p) => html`<ui-command-item value=${p.name} data-label=${p.name}>
              ${p.name}
              ${CheckIcon('ml-auto opacity-0 in-data-chosen:opacity-100')}
            </ui-command-item>`)}
          </ui-command-group>
          <ui-command-separator></ui-command-separator>
          <ui-command-group>
            <ui-command-item value="more-examples">More examples</ui-command-item>
          </ui-command-group>
        </ui-command-list>
      </ui-command>
    </div>
  </div>`;
}

function presetSave() {
  return html`<ui-dialog>
    <ui-dialog-trigger>
      <button type="button" data-slot="button" class=${secondary()}>Save</button>
    </ui-dialog-trigger>
    <ui-dialog-content>
      <div data-slot="dialog-header" class=${dialogHeaderClass()}>
        <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Save preset</h2>
        <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
          This will save the current playground state as a preset which you can access later or share with others.
        </p>
      </div>
      <div class="grid gap-6 py-4">
        <div class="grid gap-3">
          <label data-slot="label" for="pg-preset-name" class=${labelClass()}>Name</label>
          <input data-slot="input" id="pg-preset-name" autofocus class=${inputClass()}>
        </div>
        <div class="grid gap-3">
          <label data-slot="label" for="pg-preset-description" class=${labelClass()}>Description</label>
          <textarea data-slot="textarea" id="pg-preset-description" class=${textareaClass()}></textarea>
        </div>
      </div>
      <div data-slot="dialog-footer" class=${dialogFooterClass()}>
        <ui-dialog-close>
          <button type="button" data-slot="button" class=${buttonClass()}>Save</button>
        </ui-dialog-close>
      </div>
    </ui-dialog-content>
  </ui-dialog>`;
}

function codeViewer() {
  const s = (cls: string, text: string) => html`<span class=${cls}>${text}</span>`;
  const sky = (t: string) => s('text-sky-300', t);
  const green = (t: string) => s('text-green-300', t);
  const amber = (t: string) => s('text-amber-300', t);
  return html`<ui-dialog>
    <ui-dialog-trigger>
      <button type="button" data-slot="button" class=${secondary()}>View code</button>
    </ui-dialog-trigger>
    <ui-dialog-content>
      <div data-slot="dialog-header" class=${dialogHeaderClass()}>
        <h2 data-slot="dialog-title" class=${dialogTitleClass()}>View code</h2>
        <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
          You can use the following code to start integrating your current prompt and settings into your application.
        </p>
      </div>
      <div class="grid gap-4">
        <div class="rounded-md bg-black p-6">
          <pre tabindex="0" class="overflow-x-auto"><code class="grid gap-1 text-sm text-white [&_span]:h-4"><span>${sky('import')} os</span><span>${sky('import')} openai</span><span></span><span>openai.api_key = os.getenv(${green('"OPENAI_API_KEY"')})</span><span></span><span>response = openai.Completion.create(</span><span> model=${green('"davinci"')},</span><span> prompt=${amber('""')},</span><span> temperature=${amber('0.9')},</span><span> max_tokens=${amber('5')},</span><span> top_p=${amber('1')},</span><span> frequency_penalty=${amber('0')},</span><span> presence_penalty=${green('0')},</span><span>)</span></code></pre>
        </div>
        <div>
          <p class="text-sm text-muted-foreground">
            Your API Key can be found here. You should use environment variables or a secret management tool to expose your key to your applications.
          </p>
        </div>
      </div>
    </ui-dialog-content>
  </ui-dialog>`;
}

function presetShare() {
  return html`<button type="button" popovertarget="pg-share" aria-haspopup="dialog" aria-expanded="false" data-slot="button" class=${secondary()}>Share</button>
  <div id="pg-share" popover role="dialog" aria-labelledby="pg-share-title" data-slot="popover-content" data-side="bottom" data-align="end" class=${cn(popoverContentClass({ align: 'end' }), 'w-[520px]')}>
    <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1 text-center sm:text-left">
      <h3 id="pg-share-title" class="text-lg font-semibold">Share preset</h3>
      <p class="text-sm text-muted-foreground">Anyone who has this link and an OpenAI account will be able to view this.</p>
    </div>
    <div class="relative flex-1">
      <label data-slot="label" for="pg-share-link" class=${cn(labelClass(), 'sr-only')}>Link</label>
      <input data-slot="input" id="pg-share-link" value="https://platform.openai.com/playground/p/7bbKYQvsVkNmVb8NGcdUOLae?model=text-davinci-003" readonly class=${cn(inputClass(), 'h-9 pr-10')}>
      <button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'absolute top-1 right-1 size-7')}>
        <span class="sr-only">Copy</span>
        ${CopyIcon('size-3.5')}
      </button>
    </div>
    </div>
  </div>`;
}

function presetActions() {
  return html`<ui-dropdown-menu>
    <ui-dropdown-menu-trigger>
      <button type="button" data-slot="button" class=${cn(buttonClass({ variant: 'secondary', size: 'icon' }))}>
        <span class="sr-only">Actions</span>
        ${MoreHorizontalIcon()}
      </button>
    </ui-dropdown-menu-trigger>
    <ui-dropdown-menu-content align="end">
      <ui-dropdown-menu-item data-open="pg-content-filter">Content filter preferences</ui-dropdown-menu-item>
      <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
      <ui-dropdown-menu-item data-open="pg-delete-preset" class="text-red-600">Delete preset</ui-dropdown-menu-item>
    </ui-dropdown-menu-content>
  </ui-dropdown-menu>
  <ui-dialog id="pg-content-filter">
    <ui-dialog-content>
      <div data-slot="dialog-header" class=${dialogHeaderClass()}>
        <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Content filter preferences</h2>
        <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
          The content filter flags text that may violate our content policy. It's powered by our moderation endpoint which is free to use to moderate your OpenAI API traffic. Learn more.
        </p>
      </div>
      <div class="py-6">
        <h4 class="text-sm text-muted-foreground">Playground Warnings</h4>
        <div class="flex items-start justify-between gap-4 pt-3">
          <ui-switch name="show" input-id="pg-show" checked></ui-switch>
          <label data-slot="label" for="pg-show" class=${cn(labelClass(), 'grid gap-1 font-normal')}>
            <span class="font-semibold">Show a warning when content is flagged</span>
            <span class="text-sm text-muted-foreground">A warning will be shown when sexual, hateful, violent or self-harm content is detected.</span>
          </label>
        </div>
      </div>
      <div data-slot="dialog-footer" class=${dialogFooterClass()}>
        <ui-dialog-close>
          <button type="button" data-slot="button" class=${secondary()}>Close</button>
        </ui-dialog-close>
      </div>
    </ui-dialog-content>
  </ui-dialog>
  <ui-alert-dialog id="pg-delete-preset">
    <ui-alert-dialog-content>
      <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
        <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>Are you absolutely sure?</h2>
        <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>
          This action cannot be undone. This preset will no longer be accessible by you or others you've shared it with.
        </p>
      </div>
      <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
        <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
        <ui-alert-dialog-action variant="destructive" data-toast="This preset has been deleted.">Delete</ui-alert-dialog-action>
      </div>
    </ui-alert-dialog-content>
  </ui-alert-dialog>`;
}

/** A hover card around a label, shadcn's HoverCard openDelay={200} with side="left". */
function hint(trigger: unknown, text: string, opts: { width?: string; align?: string } = {}) {
  return html`<ui-hover-card open-delay="200">
    <ui-hover-card-trigger>${trigger}</ui-hover-card-trigger>
    <ui-hover-card-content side="left" align=${opts.align ?? 'center'} class=${cn(opts.width ?? 'w-[260px]', 'text-sm')}>${text}</ui-hover-card-content>
  </ui-hover-card>`;
}

function modelPeek(m: Model, first: boolean) {
  return html`<div data-peek=${m.name} ?hidden=${!first} class="grid gap-2">
    <h4 class="leading-none font-medium">${m.name}</h4>
    <div class="text-sm text-muted-foreground">${m.description}</div>
    ${m.strengths ? html`<div class="mt-4 grid gap-2">
      <h5 class="text-sm leading-none font-medium">Strengths</h5>
      <ul class="text-sm text-muted-foreground">${m.strengths}</ul>
    </div>` : ''}
  </div>`;
}

function modelSelector() {
  return html`<div data-bind-group class="grid gap-3">
    ${hint(html`<label data-slot="label" for="pg-model" class=${labelClass()}>Model</label>`,
      'The model which will generate the completion. Some models are suitable for natural language tasks, others specialize in code. Learn more.',
      { align: 'start' })}
    <button type="button" id="pg-model" popovertarget="pg-models" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Select a model" data-slot="button" class=${outline('w-full justify-between')}>
      <span data-bind-label>${models[0].name}</span>
      ${ChevronsUpDown('text-muted-foreground')}
    </button>
    <div id="pg-models" popover data-slot="popover-content" data-side="bottom" data-align="end" class=${cn(popoverContentClass({ align: 'end' }), 'w-[250px] overflow-visible p-0')}>
      <div aria-hidden="true" data-slot="hover-card-content" class="absolute top-0 right-full mr-2 hidden min-h-[280px] w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md md:block">
        ${models.map((m, i) => modelPeek(m, i === 0))}
      </div>
      <ui-command label="Models" loop>
        <ui-command-list class="max-h-[400px]">
          <ui-command-input placeholder="Search Models..."></ui-command-input>
          <ui-command-empty>No Models found.</ui-command-empty>
          ${types.map((type) => html`<ui-command-group heading=${type}>
            ${models.filter((m) => m.type === type).map((m, i) => html`<ui-command-item value=${m.name} data-label=${m.name} ?data-chosen=${type === types[0] && i === 0} class="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground">
              ${m.name}
              ${CheckIcon('ml-auto opacity-0 in-data-chosen:opacity-100')}
            </ui-command-item>`)}
          </ui-command-group>`)}
        </ui-command-list>
      </ui-command>
    </div>
  </div>`;
}

function sliderSelector(o: { id: string; label: string; max: number; step: number; value: number; hint: string }) {
  return html`<div data-bind-group class="grid gap-2 pt-2">
    <ui-hover-card open-delay="200">
      <ui-hover-card-trigger>
        <div class="grid gap-4">
          <div class="flex items-center justify-between">
            <label data-slot="label" for=${o.id} class=${labelClass()}>${o.label}</label>
            <span data-bind-value="0" class="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">${o.value}</span>
          </div>
          <ui-slider>
            <input type="range" id=${o.id} min="0" max=${o.max} step=${o.step} value=${o.value} aria-label=${o.label} class=${sliderClass()}>
          </ui-slider>
        </div>
      </ui-hover-card-trigger>
      <ui-hover-card-content side="left" align="start" class="w-[260px] text-sm">${o.hint}</ui-hover-card-content>
    </ui-hover-card>
  </div>`;
}

// The three Mode tab icons, shadcn's inline SVGs.
const rect = (x: number, y: number, w: number) => svg`<rect x=${x} y=${y} width=${w} height="2" rx="1" fill="currentColor"></rect>`;
const completeIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" class="h-5 w-5">${rect(4, 3, 12)}${rect(4, 7, 12)}${rect(4, 11, 3)}${rect(4, 15, 3)}${rect(8.5, 11, 3)}${rect(8.5, 15, 3)}${rect(13, 11, 3)}</svg>`;
const insertIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" class="h-5 w-5"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.491 7.769a.888.888 0 0 1 .287.648.888.888 0 0 1-.287.648l-3.916 3.667a1.013 1.013 0 0 1-.692.268c-.26 0-.509-.097-.692-.268L5.275 9.065A.886.886 0 0 1 5 8.42a.889.889 0 0 1 .287-.64c.181-.17.427-.267.683-.269.257-.002.504.09.69.258L8.903 9.87V3.917c0-.243.103-.477.287-.649.183-.171.432-.268.692-.268.26 0 .509.097.692.268a.888.888 0 0 1 .287.649V9.87l2.245-2.102c.183-.172.432-.269.692-.269.26 0 .508.097.692.269Z" fill="currentColor"></path>${rect(4, 15, 3)}${rect(8.5, 15, 3)}${rect(13, 15, 3)}</svg>`;
const editIcon = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" class="h-5 w-5">${rect(4, 3, 12)}${rect(4, 7, 12)}${rect(4, 11, 3)}${rect(4, 15, 4)}${rect(8.5, 11, 3)}<path d="M17.154 11.346a1.182 1.182 0 0 0-1.671 0L11 15.829V17.5h1.671l4.483-4.483a1.182 1.182 0 0 0 0-1.671Z" fill="currentColor"></path></svg>`;

function submitRow() {
  return html`<div class="flex items-center gap-2">
    <button type="button" data-slot="button" class=${buttonClass()}>Submit</button>
    <button type="button" data-slot="button" class=${secondary()}>
      <span class="sr-only">Show history</span>
      ${RotateCcwIcon()}
    </button>
  </div>`;
}

export function playground() {
  return html`<example-bind class="flex flex-1 flex-col">
    <div class="container flex flex-col items-start justify-between gap-2 py-4 sm:flex-row sm:items-center sm:gap-0 md:h-16">
      <h2 class="pl-0.5 text-lg font-semibold">Playground</h2>
      <div class="ml-auto flex w-full gap-2 sm:justify-end">
        ${presetSelector()}
        ${presetSave()}
        <div class="hidden gap-2 md:flex">
          ${codeViewer()}
          ${presetShare()}
        </div>
        ${presetActions()}
      </div>
    </div>
    <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
    <ui-tabs value="complete" class="flex flex-1 flex-col">
      <div class="container flex flex-1 flex-col py-6">
        <div class="grid flex-1 items-stretch gap-6 md:grid-cols-[1fr_200px]">
          <div class="hidden flex-col gap-6 sm:flex md:order-2">
            <div class="grid gap-3">
              ${hint(html`<span class="text-sm leading-none font-medium">Mode</span>`,
                'Choose the interface that best suits your task. You can provide: a simple prompt to complete, starting and ending text to insert a completion within, or some text with instructions to edit it.',
                { width: 'w-[320px]' })}
              <ui-tabs-list class="grid w-full grid-cols-3">
                <ui-tabs-trigger value="complete"><span class="sr-only">Complete</span>${completeIcon}</ui-tabs-trigger>
                <ui-tabs-trigger value="insert"><span class="sr-only">Insert</span>${insertIcon}</ui-tabs-trigger>
                <ui-tabs-trigger value="edit"><span class="sr-only">Edit</span>${editIcon}</ui-tabs-trigger>
              </ui-tabs-list>
            </div>
            ${modelSelector()}
            ${sliderSelector({ id: 'pg-temperature', label: 'Temperature', max: 1, step: 0.1, value: 0.56, hint: 'Controls randomness: lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.' })}
            ${sliderSelector({ id: 'pg-maxlength', label: 'Maximum Length', max: 4000, step: 10, value: 256, hint: 'The maximum number of tokens to generate. Requests can use up to 2,048 or 4,000 tokens, shared between prompt and completion. The exact limit varies by model.' })}
            ${sliderSelector({ id: 'pg-top-p', label: 'Top P', max: 1, step: 0.1, value: 0.9, hint: 'Control diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered.' })}
          </div>
          <div class="flex flex-1 flex-col *:data-[slot=tab-content]:flex-1 md:order-1">
            <ui-tabs-content value="complete" class="mt-0 border-0 p-0">
              <div class="flex h-full flex-col gap-4">
                <textarea data-slot="textarea" aria-label="Prompt" placeholder="Write a tagline for an ice cream shop" class=${cn(textareaClass(), 'min-h-[400px] flex-1 p-4 md:min-h-[700px] lg:min-h-[700px]')}></textarea>
                ${submitRow()}
              </div>
            </ui-tabs-content>
            <ui-tabs-content value="insert" class="mt-0 flex flex-col gap-4 border-0 p-0">
              <div class="grid h-full grid-rows-2 gap-6 lg:grid-cols-2 lg:grid-rows-1">
                <textarea data-slot="textarea" aria-label="Prompt" placeholder="We're writing to [inset]. Congrats from OpenAI!" class=${cn(textareaClass(), 'h-full min-h-[300px] p-4 lg:min-h-[700px] xl:min-h-[700px]')}></textarea>
                <div class="rounded-md border bg-muted"></div>
              </div>
              ${submitRow()}
            </ui-tabs-content>
            <ui-tabs-content value="edit" class="mt-0 flex flex-col gap-4 border-0 p-0">
              <div class="grid h-full gap-6 lg:grid-cols-2">
                <div class="flex flex-col gap-4">
                  <div class="flex flex-1 flex-col gap-2">
                    <label data-slot="label" for="pg-input" class=${cn(labelClass(), 'sr-only')}>Input</label>
                    <textarea data-slot="textarea" id="pg-input" placeholder="We is going to the market." class=${cn(textareaClass(), 'flex-1 p-4 lg:min-h-[580px]')}></textarea>
                  </div>
                  <div class="flex flex-col gap-2">
                    <label data-slot="label" for="pg-instructions" class=${labelClass()}>Instructions</label>
                    <textarea data-slot="textarea" id="pg-instructions" placeholder="Fix the grammar." class=${textareaClass()}></textarea>
                  </div>
                </div>
                <div class="min-h-[400px] rounded-md border bg-muted lg:min-h-[700px]"></div>
              </div>
              ${submitRow()}
            </ui-tabs-content>
          </div>
        </div>
      </div>
    </ui-tabs>
    <span class="contents"><ui-sonner></ui-sonner></span>
  </example-bind>`;
}
