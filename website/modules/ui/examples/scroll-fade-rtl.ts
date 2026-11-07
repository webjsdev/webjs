import { html } from '@webjsdev/core';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      design: 'Design',
      engineering: 'Engineering',
      marketing: 'Marketing',
      product: 'Product',
      research: 'Research',
      sales: 'Sales',
      support: 'Support',
      operations: 'Operations',
      finance: 'Finance',
      legal: 'Legal',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      design: 'تصميم',
      engineering: 'هندسة',
      marketing: 'تسويق',
      product: 'منتج',
      research: 'أبحاث',
      sales: 'مبيعات',
      support: 'دعم',
      operations: 'عمليات',
      finance: 'مالية',
      legal: 'قانوني',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      design: 'עיצוב',
      engineering: 'הנדסה',
      marketing: 'שיווק',
      product: 'מוצר',
      research: 'מחקר',
      sales: 'מכירות',
      support: 'תמיכה',
      operations: 'תפעול',
      finance: 'כספים',
      legal: 'משפטי',
    },
  },
};

export default function ScrollFadeRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border" dir=${dir} lang=${lang}>
      <div class="scroll-fade-x no-scrollbar overflow-x-auto">
        <div class="flex w-max gap-1.5 p-1.5">
          ${Object.values(t).map((tag) => html`
            <div class="shrink-0 rounded-lg bg-muted px-3 py-2.5 text-sm">${tag}</div>
          `)}
        </div>
      </div>
    </div>
  `;
}
