import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CheckIcon, CopyIcon, XIcon } from '#lib/utils/icons.ts';
import { presetCode, type CreateParams } from './params.ts';
import { themeTokensCss } from './design-system.ts';
import { DEFAULT_PROJECT, PACKAGE_MANAGERS, applyCommand, newProjectCommand } from './project.ts';

/**
 * The configurator's Get Code dialog, shadcn's ProjectForm
 * (apps/v4/app/(app)/(create)/components/project-form.tsx), with its three
 * tabs: New Project, Existing Project and Theme. What each one runs, and why
 * it differs from shadcn's, is in ./project.ts.
 *
 * A native `<dialog>`. The Get Code button opens it with an invoker command
 * (`command="show-modal"`), so it opens with no script where the browser
 * supports that, and <create-customizer> opens it everywhere else. The tabs
 * and the package-manager choice are radio groups the CSS reads, so they
 * switch with no script too, and every command is in the markup for the
 * default options. The project name, runtime and database rewrite the
 * commands, which takes the element, so those fields show once it is defined.
 */

const RADIO_PILL =
  'cursor-pointer rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground has-checked:bg-neutral-700/70 has-checked:text-foreground has-focus-visible:ring-1 has-focus-visible:ring-ring';

function copyButton(action: string, label: string) {
  return html`<button type="button" data-action=${action} aria-label=${label} title=${label} class="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground [create-customizer:not(:defined)_&]:hidden">
    <span class="contents [[data-copied]>&]:hidden">${CopyIcon('size-3.5')}</span>
    <span class="hidden [[data-copied]>&]:contents">${CheckIcon('size-3.5')}</span>
  </button>`;
}

/** The package-manager switch and one command per manager, shown by the checked one. */
function commandTabs(group: string, commands: Record<string, string>, action: string) {
  return html`<div class="group/pm min-w-0 overflow-hidden rounded-xl ring-1 ring-border">
    <div class="flex items-center gap-1 py-1 pr-1.5 pl-1 font-mono" role="radiogroup" aria-label="Package manager">
      ${PACKAGE_MANAGERS.map((pm) => html`<label class=${RADIO_PILL}><input type="radio" name=${`${group}-pm`} value=${pm} ?checked=${pm === DEFAULT_PROJECT.pm} class="sr-only" data-project-field="pm">${pm}</label>`)}
      ${copyButton(action, 'Copy command')}
    </div>
    ${PACKAGE_MANAGERS.map((pm) => html`<div data-pm=${pm} class="hidden border-t bg-popover p-3 group-has-[input[value=npm]:checked]/pm:data-[pm=npm]:block group-has-[input[value=pnpm]:checked]/pm:data-[pm=pnpm]:block group-has-[input[value=yarn]:checked]/pm:data-[pm=yarn]:block group-has-[input[value=bun]:checked]/pm:data-[pm=bun]:block">
      <div class="no-scrollbar overflow-x-auto"><code class="font-mono text-sm whitespace-nowrap" data-command=${group}>${commands[pm]}</code></div>
    </div>`)}
  </div>
  <button type="button" data-action=${action} class=${`${buttonClass()} h-9 w-full [create-customizer:not(:defined)_&]:hidden`}>
    <span class="contents [[data-copied]>&]:hidden">Copy Command</span>
    <span class="hidden [[data-copied]>&]:contents">Copied</span>
  </button>`;
}

function tabRadio(value: string, label: string, checked: boolean) {
  return html`<label class=${RADIO_PILL}><input type="radio" name="project-tab" value=${value} ?checked=${checked} class="sr-only">${label}</label>`;
}

export function projectForm(params: CreateParams) {
  const code = presetCode(params.config);
  const create = Object.fromEntries(PACKAGE_MANAGERS.map((pm) => [pm, newProjectCommand({ ...DEFAULT_PROJECT, pm }, code)]));
  const apply = Object.fromEntries(PACKAGE_MANAGERS.map((pm) => [pm, applyCommand(pm, code)]));
  const field = 'grid gap-2 [create-customizer:not(:defined)_&]:hidden';
  const fieldLabel = 'text-sm font-medium';
  return html`<dialog id="create-project" data-slot="project-form" aria-labelledby="create-project-title" class="group/project m-auto max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl bg-card p-0 text-card-foreground shadow-xl ring-1 ring-foreground/10 [color-scheme:dark] backdrop:bg-black/50">
    <div class="flex items-center gap-2 border-b px-6 py-5">
      <h2 id="create-project-title" class="sr-only">Get Code</h2>
      <div role="radiogroup" aria-label="Project type" class="flex gap-2">
        ${tabRadio('new', 'New Project', true)}
        ${tabRadio('existing', 'Existing Project', false)}
        ${tabRadio('theme', 'Theme', false)}
      </div>
      <form method="dialog" class="ml-auto"><button type="submit" aria-label="Close" class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">${XIcon('size-4')}</button></form>
    </div>
    <div class="no-scrollbar max-h-[calc(100svh-8rem)] overflow-y-auto">
      <section data-tab="new" class="hidden gap-4 px-6 py-5 group-has-[input[name=project-tab][value=new]:checked]/project:grid">
        <div class=${field}>
          <label class=${fieldLabel} for="create-project-name">Project name</label>
          <input id="create-project-name" data-project-field="name" value=${DEFAULT_PROJECT.name} autocomplete="off" spellcheck="false" class="h-9 rounded-md bg-transparent px-3 font-mono text-sm ring-1 ring-border outline-none focus-visible:ring-ring">
        </div>
        <fieldset class=${field}>
          <legend class=${fieldLabel}>Runtime</legend>
          <div class="flex gap-2" role="radiogroup" aria-label="Runtime">
            <label class=${RADIO_PILL}><input type="radio" name="project-runtime" value="node" checked class="sr-only" data-project-field="runtime">Node</label>
            <label class=${RADIO_PILL}><input type="radio" name="project-runtime" value="bun" class="sr-only" data-project-field="runtime">Bun</label>
          </div>
        </fieldset>
        <fieldset class=${field}>
          <legend class=${fieldLabel}>Database</legend>
          <div class="flex gap-2" role="radiogroup" aria-label="Database">
            <label class=${RADIO_PILL}><input type="radio" name="project-db" value="sqlite" checked class="sr-only" data-project-field="db">SQLite</label>
            <label class=${RADIO_PILL}><input type="radio" name="project-db" value="postgres" class="sr-only" data-project-field="db">Postgres</label>
          </div>
        </fieldset>
        <p class="m-0 text-sm text-muted-foreground">A new WebJs app (the full-stack template), with this preset applied to it.</p>
        ${commandTabs('new', create, 'copy-new')}
      </section>
      <section data-tab="existing" class="hidden gap-4 px-6 py-5 group-has-[input[name=project-tab][value=existing]:checked]/project:grid">
        <p class="m-0 text-sm text-muted-foreground">Run this in a WebJs app. It writes the style and the icon library into components.json, and replaces the theme block in your stylesheet in place.</p>
        ${commandTabs('existing', apply, 'copy-existing')}
      </section>
      <section data-tab="theme" class="hidden gap-3 px-6 py-5 group-has-[input[name=project-tab][value=theme]:checked]/project:grid">
        <p class="m-0 text-sm text-muted-foreground">Copy the CSS variables for this preset.</p>
        <div class="min-w-0 overflow-hidden rounded-xl ring-1 ring-border">
          <div class="flex items-center gap-2 py-1 pr-1.5 pl-3">
            <span class="truncate font-mono text-sm text-muted-foreground">styles/globals.css</span>
            ${copyButton('copy-theme', 'Copy theme tokens')}
          </div>
          <div tabindex="0" class="no-scrollbar max-h-72 overflow-auto border-t bg-popover p-3"><code class="block font-mono text-xs whitespace-pre" data-theme-css>${themeTokensCss(params.config)}</code></div>
        </div>
      </section>
    </div>
  </dialog>`;
}
