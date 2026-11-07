import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  itemClass, itemMediaClass, itemContentClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      title: 'Processing payment...',
      amount: '$100.00',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      title: 'جاري معالجة الدفع...',
      amount: '١٠٠.٠٠ دولار',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      title: 'מעבד תשלום...',
      amount: '$100.00',
    },
  },
};

export default function SpinnerRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex w-full max-w-xs flex-col gap-4 [--radius:1rem]" dir=${dir} lang=${lang}>
      <div data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          ${spinner()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${cn(itemTitleClass(), 'line-clamp-1')}>${t.title}</div>
        </div>
        <div data-slot="item-content" class=${cn(itemContentClass(), 'flex-none justify-end')}>
          <span class="text-sm tabular-nums">${t.amount}</span>
        </div>
      </div>
    </div>
  `;
}
