import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { TerminalIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      description: 'Install the packages, then start the dev server.',
      title: 'Terminal',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      description: 'ثبّت الحزم، ثم شغّل خادم التطوير.',
      title: 'الطرفية',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      description: 'התקן את החבילות, ואז הפעל את שרת הפיתוח.',
      title: 'מסוף',
    },
  },
};

const code = `pnpm add ai @ai-sdk/react zod
pnpm dev`;

// The header follows dir="rtl". The content keeps dir="ltr", so the code
// still reads left to right.
export default function CodeBlockRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex w-full max-w-md flex-col gap-3 text-sm" dir=${dir} lang=${lang}>
      <p>${t.description}</p>
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>
            ${TerminalIcon()}
            ${t.title}
          </div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${code}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
      </div>
    </div>
  `;
}
