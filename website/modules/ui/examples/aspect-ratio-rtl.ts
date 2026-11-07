import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { aspectRatioClass } from '#modules/ui/components/aspect-ratio.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      caption: 'Beautiful landscape',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      caption: 'منظر طبيعي جميل',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      caption: 'נוף יפה',
    },
  },
};

export default function AspectRatioRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <figure class="w-full max-w-sm" dir=${dir} lang=${lang}>
      <div data-slot="aspect-ratio" style="aspect-ratio: 16 / 9" class=${cn(aspectRatioClass(), 'rounded-lg bg-muted')}>
        <img
          src="https://avatar.vercel.sh/shadcn1"
          alt="Photo"
          class="absolute inset-0 h-full w-full rounded-lg object-cover grayscale dark:brightness-20"
        >
      </div>
      <figcaption class="mt-2 text-center text-sm text-muted-foreground">${t.caption}</figcaption>
    </figure>
  `;
}
