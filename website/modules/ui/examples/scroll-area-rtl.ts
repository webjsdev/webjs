import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { scrollAreaClass } from '#modules/ui/components/scroll-area.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';

const tags = Array.from({ length: 50 }).map(
  (_, i, a) => `v1.2.0-beta.${a.length - i}`,
);

const translations = {
  en: {
    dir: 'ltr',
    values: {
      tags: 'Tags',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      tags: 'العلامات',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      tags: 'תגיות',
    },
  },
};

export default function ScrollAreaRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div data-slot="scroll-area" tabindex="0" role="region" aria-label=${t.tags} dir=${dir} lang=${lang} class=${cn(scrollAreaClass(), 'h-72 w-48 rounded-md border')}>
      <div class="p-4">
        <h4 class="mb-4 text-sm leading-none font-medium">${t.tags}</h4>
        ${tags.map((tag) => html`
          <div class="text-sm">${tag}</div>
          <div role="none" data-slot="separator" data-orientation="horizontal" class=${cn(separatorClass(), 'my-2')}></div>
        `)}
      </div>
    </div>
  `;
}
