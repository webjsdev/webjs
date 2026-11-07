import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { IconPlus } from '#lib/ui/tabler.ts';
import { IconApps, IconArrowUp, IconAt, IconBook, IconCircleDashedPlus, IconPaperclip, IconWorld, IconX } from './icons.ts';
import { t, type RtlLang } from './translations.ts';

/**
 * shadcn's NotionPromptForm from the RTL example (#1666): a prompt box with
 * mentions, a model menu and a sources menu. Picking a page or a person in the
 * mention list turns it into a chip above the prompt, and a chip's click puts
 * it back, through `<example-bind>`'s `data-mention` group; the model menu
 * writes the chosen mode into its button the same way.
 */

const tinyAvatar = (src: string, title: string) => html`<span data-slot="avatar" data-size="sm" class=${cn(avatarClass(), 'size-4')}>
  <img data-slot="avatar-image" src=${src} alt="" class=${avatarImageClass()}>
  <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${title[0]}</span>
</span>`;

export function notionPromptForm(lang: RtlLang) {
  const s = t.notion[lang];
  const pages = [
    [s.meetingNotes, '📝'], [s.projectDashboard, '📊'], [s.ideasBrainstorming, '💡'], [s.calendarEvents, '📅'],
    [s.documentation, '📚'], [s.goalsObjectives, '🎯'], [s.budgetPlanning, '💰'], [s.teamDirectory, '👥'],
    [s.technicalSpecs, '🔧'], [s.analyticsReport, '📈'],
  ].map(([title, image]) => ({ title, icon: html`<span class="flex size-4 items-center justify-center">${image}</span>` }));
  const users = [
    { title: 'vivek', src: '/public/avatars/vivek.jpg' },
    ...['maxleiter', 'evilrabbit'].map((name) => ({ title: name, src: `https://github.com/${name}.png` })),
  ];
  const mentionable = [...pages, ...users.map((u) => ({ title: u.title, icon: tinyAvatar(u.src, u.title) }))];
  const models = [{ name: s.auto }, { name: s.agentMode, badge: s.beta }, { name: s.planMode }];

  return html`<div>
    <form>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="rtl-notion-prompt" class=${cn(fieldLabelClass(), 'sr-only')}>${s.prompt}</label>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <textarea data-slot="input-group-control" id="rtl-notion-prompt" placeholder=${s.placeholder} class=${inputGroupTextareaClass()}></textarea>
          <div role="group" data-slot="input-group-addon" data-align="block-start" data-bind-group data-mention class=${cn(inputGroupAddonClass({ align: 'block-start' }), 'group/mentions')}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" popovertarget="rtl-mentions" aria-haspopup="dialog" aria-expanded="false" aria-label=${s.addContext} data-slot="button" data-variant="outline" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'outline', size: 'sm' }), 'rounded-full transition-transform')}>
                  ${IconAt()} <span class="group-data-has-mentions/mentions:hidden">${s.addContext}</span>
                </button>
              </ui-tooltip-trigger>
              <ui-tooltip-content>${s.mentionTooltip}</ui-tooltip-content>
            </ui-tooltip>
            <div id="rtl-mentions" popover role="dialog" aria-label=${s.addContext} data-slot="popover-content" data-side="bottom" data-align="start" class=${cn(popoverContentClass({ align: 'start' }), 'p-0')}>
              <ui-command label=${s.addContext}>
                <ui-command-input placeholder=${s.searchPages}></ui-command-input>
                <ui-command-list>
                  <ui-command-empty>${s.noPagesFound}</ui-command-empty>
                  <ui-command-group heading=${s.pages}>
                    ${pages.map((p) => html`<ui-command-item value=${p.title}>${p.icon} ${p.title}</ui-command-item>`)}
                  </ui-command-group>
                  <ui-command-group heading=${s.users}>
                    ${users.map((u) => html`<ui-command-item value=${u.title}>${tinyAvatar(u.src, u.title)} ${u.title}</ui-command-item>`)}
                  </ui-command-group>
                </ui-command-list>
              </ui-command>
            </div>
            <div class="-m-1.5 no-scrollbar flex gap-1 overflow-y-auto p-1.5">
              ${mentionable.map((m) => html`<button type="button" hidden data-chip=${m.title} data-slot="button" data-variant="secondary" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'secondary', size: 'sm' }), 'rounded-full pr-2!')}>
                ${m.icon} ${m.title} ${IconX()}
              </button>`)}
            </div>
          </div>
          <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'gap-1')}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" aria-label=${s.attachFile} data-slot="button" data-size="icon-sm" class=${cn(inputGroupButtonClass({ size: 'icon-sm' }), 'rounded-full')}>${IconPaperclip()}</button>
              </ui-tooltip-trigger>
              <ui-tooltip-content>${s.attachFile}</ui-tooltip-content>
            </ui-tooltip>
            <span data-bind-group class="contents">
              <ui-tooltip>
                <ui-tooltip-trigger>
                  <button type="button" id="rtl-notion-model" data-slot="button" data-size="sm" class=${cn(inputGroupButtonClass({ size: 'sm' }), 'rounded-full')}><span data-bind-label>${models[0].name}</span></button>
                </ui-tooltip-trigger>
                <ui-tooltip-content>${s.selectModel}</ui-tooltip-content>
              </ui-tooltip>
              <ui-dropdown-menu trigger="rtl-notion-model" class="absolute">
                <ui-dropdown-menu-content side="top" align="start" class="w-48">
                  <ui-dropdown-menu-group aria-label=${s.selectAgentMode} class="w-48">
                    <ui-dropdown-menu-label class="text-xs text-muted-foreground">${s.selectAgentMode}</ui-dropdown-menu-label>
                    ${models.map((m, i) => html`<ui-dropdown-menu-item type="radio" value=${m.name} data-label=${m.name} ?checked=${i === 0}>
                      ${m.name}
                      ${m.badge ? html`<span data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'h-5 rounded-sm bg-blue-100 px-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-100')}>${m.badge}</span>` : ''}
                    </ui-dropdown-menu-item>`)}
                  </ui-dropdown-menu-group>
                </ui-dropdown-menu-content>
              </ui-dropdown-menu>
            </span>
            <button type="button" id="rtl-notion-scope" data-slot="button" data-size="sm" class=${cn(inputGroupButtonClass({ size: 'sm' }), 'rounded-full')}>${IconWorld()} ${s.allSources}</button>
            <ui-dropdown-menu trigger="rtl-notion-scope" class="absolute">
              <ui-dropdown-menu-content side="top" align="end" class="w-72">
                <ui-dropdown-menu-group>
                  <ui-dropdown-menu-item data-keep-open>
                    <label for="rtl-web-search" class="flex w-full items-center gap-2">${IconWorld()} ${s.webSearch}</label>
                    <ui-switch input-id="rtl-web-search" size="sm" checked class="ms-auto"></ui-switch>
                  </ui-dropdown-menu-item>
                </ui-dropdown-menu-group>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-group>
                  <ui-dropdown-menu-item data-keep-open>
                    <label for="rtl-apps" class="flex w-full items-center gap-2">${IconApps()} ${s.appsIntegrations}</label>
                    <ui-switch input-id="rtl-apps" size="sm" checked class="ms-auto"></ui-switch>
                  </ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>${IconCircleDashedPlus()} ${s.allSourcesAccess}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-sub>
                    <ui-dropdown-menu-sub-trigger>${tinyAvatar('/public/avatars/vivek.jpg', 'vivek')} vivek</ui-dropdown-menu-sub-trigger>
                    <ui-dropdown-menu-sub-content side="left" class="w-72 rounded-lg p-0">
                      <ui-command label=${s.findKnowledge}>
                        <ui-command-input placeholder=${s.findKnowledge}></ui-command-input>
                        <ui-command-list>
                          <ui-command-empty>${s.noKnowledgeFound}</ui-command-empty>
                          <ui-command-group>
                            ${users.map((u) => html`<ui-command-item value=${u.title}>${tinyAvatar(u.src, u.title)} ${u.title} <span class="text-muted-foreground">(${s.workspace})</span></ui-command-item>`)}
                          </ui-command-group>
                        </ui-command-list>
                      </ui-command>
                    </ui-dropdown-menu-sub-content>
                  </ui-dropdown-menu-sub>
                  <ui-dropdown-menu-item>${IconBook()} ${s.helpCenter}</ui-dropdown-menu-item>
                </ui-dropdown-menu-group>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-group>
                  <ui-dropdown-menu-item>${IconPlus()} ${s.connectApps}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-label class="text-xs text-muted-foreground">${s.searchSourcesNote}</ui-dropdown-menu-label>
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-content>
            </ui-dropdown-menu>
            <button type="button" aria-label=${s.send} data-slot="button" data-variant="default" data-size="icon-sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-sm' }), 'ms-auto rounded-full')}>${IconArrowUp()}</button>
          </div>
        </div>
      </div>
    </form>
  </div>`;
}
