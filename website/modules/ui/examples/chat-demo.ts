import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ArrowUpIcon, ChevronRightIcon, CircleCheckIcon, GlobeIcon, PaperclipIcon,
  PlusIcon, RotateCwIcon, TelescopeIcon, TerminalIcon,
} from '#lib/ui/lucide.ts';

type Step =
  | { type: 'reasoning'; text: string }
  | { type: 'tool'; command: string; stdout: string };

type Turn = { question: string; steps: Step[]; reply: unknown };

const code = (text: string) => html`<code class="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]">${text}</code>`;

const codeBlock = (text: string) => html`
  <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
    <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${text}</code></pre>
  </div>`;

// shadcn's scripted conversation, settled. The replies are Markdown in
// shadcn's demo; the kit has no Markdown renderer, so they are written out
// as the HTML it would produce.
const turns: Turn[] = [
  {
    question: 'Add a dark mode toggle to the settings page.',
    steps: [
      { type: 'reasoning', text: 'I need to know how themes are set up before I add a toggle. If next-themes is already in the layout, the toggle only has to call setTheme.' },
      { type: 'tool', command: 'rg -l ThemeProvider app', stdout: 'app/layout.tsx' },
    ],
    reply: html`
      <p>next-themes is already set up in ${code('app/layout.tsx')}, so the toggle only has to call ${code('setTheme')}.</p>
      <p><strong>Changes</strong></p>
      <ul class="list-disc space-y-1 ps-5">
        <li>Added ${code('components/mode-toggle.tsx')} with a Light and Dark option.</li>
        <li>Put ${code('<ModeToggle />')} next to the Appearance heading in ${code('app/settings/page.tsx')}.</li>
      </ul>
      ${codeBlock('const { setTheme } = useTheme()')}`,
  },
  {
    question: 'Make it follow the system setting by default.',
    steps: [
      { type: 'reasoning', text: 'The default theme lives on the ThemeProvider. I should check what it is set to now.' },
      { type: 'tool', command: 'rg -n defaultTheme app/layout.tsx', stdout: '12:  <ThemeProvider attribute="class" defaultTheme="light">' },
    ],
    reply: html`
      <p>It was set to ${code('light')}. I updated the ${code('ThemeProvider')} in ${code('app/layout.tsx')}:</p>
      ${codeBlock('<ThemeProvider attribute="class" defaultTheme="system" enableSystem>')}
      <p>New visitors now get the theme from their OS. The toggle also has a <strong>System</strong> option, so anyone who picked Light or Dark can switch back.</p>`,
  },
  {
    question: 'Run the build before I ship it.',
    steps: [
      { type: 'tool', command: 'pnpm build', stdout: '▲ Next.js 16.0.0\n\n✓ Compiled successfully in 4.2s\n✓ Linting and checking validity of types\n✓ Generating static pages (12/12)' },
    ],
    reply: html`
      <p>The build passes, so it is ready to ship.</p>
      <ul class="list-disc space-y-1 ps-5">
        <li>Compiled in <strong>4.2s</strong>.</li>
        <li>No lint or type errors.</li>
        <li>Generated all <strong>12</strong> static pages.</li>
      </ul>`,
  },
];

const chevron = () => html`<span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>`;

function stepRow(step: Step) {
  if (step.type === 'reasoning') {
    return html`
      <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${CircleCheckIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Thought</span>
          </span>
          ${chevron()}
        </summary>
        <div data-slot="trace-collapsible-content" class=${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>${step.text}</div>
      </details>`;
  }
  return html`
    <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>Ran ${step.command}</span>
        </span>
        ${chevron()}
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${step.stdout}</code></pre>
        </div>
      </div>
    </details>`;
}

function turn(t: Turn, i: number) {
  return html`
    <ui-message-scroller-item message-id=${`user-${i}`} scroll-anchor>
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${t.question}</div>
          </div>
        </div>
      </div>
    </ui-message-scroller-item>
    <ui-message-scroller-item message-id=${`assistant-${i}`}>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-3')}>
          <div data-slot="trace" class=${traceClass()}>${t.steps.map(stepRow)}</div>
          <div class="flex flex-col gap-3">${t.reply}</div>
        </div>
      </div>
    </ui-message-scroller-item>`;
}

// The thread once every scripted turn has been sent: the scroller opens at
// the newest message. Sending, Reset and the add menu's items are the
// reader's to wire (see the AI SDK helper page).
export default function ChatDemo() {
  return html`
    <div class="relative flex w-full flex-col gap-4 [[data-slot=preview]:has(&)]:bg-background [[data-slot=preview]:has(&)>div]:p-0!">
      <div class="flex h-200 w-full flex-col gap-4">
        <div class="flex items-start justify-between gap-4 p-8 pb-4">
          <div class="flex flex-col gap-1">
            <div class="font-medium">New Thread</div>
            <div class="text-sm text-muted-foreground">Ask the agent to change your code.</div>
          </div>
          <ui-tooltip>
            <ui-tooltip-trigger>
              <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Reset conversation" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${RotateCwIcon()}</button>
            </ui-tooltip-trigger>
            <ui-tooltip-content><p>Reset</p></ui-tooltip-content>
          </ui-tooltip>
        </div>
        <div class="min-h-0 flex-1">
          <ui-message-scroller>
            <ui-message-scroller-viewport>
              <ui-message-scroller-content aria-label="Conversation" class="gap-6 px-8 py-0">
                ${turns.map(turn)}
              </ui-message-scroller-content>
            </ui-message-scroller-viewport>
            <ui-message-scroller-button></ui-message-scroller-button>
          </ui-message-scroller>
        </div>
        <div class="p-8 pt-0">
          <form class="w-full">
            <div data-slot="input-group" role="group" class=${inputGroupClass()}>
              <textarea data-slot="input-group-control" name="text" placeholder="Ask the agent..." aria-label="Message" class=${cn(inputGroupTextareaClass(), 'min-h-14')}></textarea>
              <div role="group" data-slot="input-group-addon" data-align="block-end" class=${cn(inputGroupAddonClass({ align: 'block-end' }), 'pt-1')}>
                <ui-dropdown-menu>
                  <ui-dropdown-menu-trigger>
                    <button type="button" aria-label="Add context" data-slot="button" data-variant="outline" data-size="icon-sm" class=${inputGroupButtonClass({ variant: 'outline', size: 'icon-sm' })}>${PlusIcon()}</button>
                  </ui-dropdown-menu-trigger>
                  <ui-dropdown-menu-content align="start" side="top" class="w-44">
                    <ui-dropdown-menu-item>${PaperclipIcon()}Add Photos &amp; Files</ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item>${TelescopeIcon()}Deep Research</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${GlobeIcon()}Web Search</ui-dropdown-menu-item>
                  </ui-dropdown-menu-content>
                </ui-dropdown-menu>
                <button type="submit" disabled data-slot="button" data-variant="default" data-size="icon-sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'icon-sm' }), 'ml-auto')}>
                  ${ArrowUpIcon()}<span class="sr-only">Send</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
