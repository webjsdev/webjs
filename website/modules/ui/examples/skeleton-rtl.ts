import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { skeletonClass } from '#modules/ui/components/skeleton.ts';

const translations = {
  en: { dir: 'ltr' },
  ar: { dir: 'rtl' },
  he: { dir: 'rtl' },
};

export default function SkeletonRtl() {
  const lang = 'ar';
  const { dir } = translations[lang];

  return html`
    <div class="flex items-center gap-4" dir=${dir} lang=${lang} aria-hidden="true">
      <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-12 w-12 rounded-full')}></div>
      <div class="space-y-2">
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-[250px]')}></div>
        <div data-slot="skeleton" class=${cn(skeletonClass(), 'h-4 w-[200px]')}></div>
      </div>
    </div>
  `;
}
