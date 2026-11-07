import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass, codeBlockLineClass,
  type CodeBlockLineVariant,
} from '#modules/ui/components/code-block.ts';
import {
  sheetHeaderClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass, traceDescriptionClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ChevronRightIcon, FilePenIcon, FilePlusIcon, GitCommitHorizontalIcon,
} from '#lib/ui/lucide.ts';

const files = [
  {
    path: 'app/login/page.tsx',
    added: false,
    additions: 2,
    deletions: 2,
    diff: [
      '@@ -14,7 +14,7 @@ export default async function LoginPage({',
      '   searchParams,',
      ' }) {',
      '   const { next } = await searchParams',
      '-  const redirectTo =',
      '-    next && next.startsWith("/") ? next : "/"',
      '+  const redirectTo = safeRedirect(next)',
      '+',
      '   return <LoginForm redirectTo={redirectTo} />',
      ' }',
    ].join('\n'),
  },
  {
    path: 'lib/auth/redirect.ts',
    added: true,
    additions: 7,
    deletions: 0,
    diff: [
      '@@ -0,0 +1,7 @@',
      '+export function safeRedirect(next: string | undefined) {',
      '+  if (!next || !next.startsWith("/") || next.startsWith("//")) {',
      '+    return "/"',
      '+  }',
      '+',
      '+  return next',
      '+}',
    ].join('\n'),
  },
];

function line(text: string, variant: CodeBlockLineVariant, extra = '') {
  // An empty line holds a newline, so copying a selection keeps blank lines.
  return html`<span data-slot="code-block-line" data-variant=${variant} class=${cn(codeBlockLineClass({ variant }), extra)}><span data-slot="code-block-line-content" class="min-w-0">${text === '' ? String.fromCharCode(10) : text}</span></span>`;
}

function DiffLines(diff: string) {
  return diff.split('\n').map((text) => {
    if (text.startsWith('@@')) return line(text, 'default', 'text-muted-foreground');
    const variant = text.startsWith('+') ? 'added' : text.startsWith('-') ? 'removed' : 'default';
    return line(text.slice(1), variant);
  });
}

// Each file is a sheet whose trigger wraps the file's line.
export default function TraceCommit() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${GitCommitHorizontalIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>Committed a1b2c3: Fix the login redirect</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="trace" class=${traceClass()}>
            ${files.map((file) => html`
              <ui-sheet>
                <ui-sheet-trigger>
                  <button type="button" class="flex w-fit max-w-full min-w-0 text-start outline-none">
                    <span data-slot="trace-line" class=${traceLineClass()}>
                      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${file.added ? FilePlusIcon() : FilePenIcon()}</span>
                      <span data-slot="trace-title" class=${traceTitleClass()}>${file.added ? 'Added' : 'Edited'} ${file.path}</span>
                      <span data-slot="trace-description" class=${cn(traceDescriptionClass(), 'font-mono')}>+${file.additions} −${file.deletions}</span>
                      <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
                    </span>
                  </button>
                </ui-sheet-trigger>
                <ui-sheet-content side="right">
                  <div data-slot="sheet-header" class=${sheetHeaderClass()}>
                    <h2 data-slot="sheet-title" class=${cn(sheetTitleClass(), 'font-mono')}>${file.path}</h2>
                    <p data-slot="sheet-description" class=${sheetDescriptionClass()}>
                      ${file.additions} additions, ${file.deletions} deletions
                    </p>
                  </div>
                  <div data-slot="code-block" data-variant="default" data-size="default" class=${cn(codeBlockClass(), 'mx-6 mb-6 w-auto')}>
                    <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${DiffLines(file.diff)}</code></pre>
                  </div>
                </ui-sheet-content>
              </ui-sheet>
            `)}
          </div>
        </div>
      </details>
    </div>
  `;
}
