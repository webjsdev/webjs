import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  collapsibleClass, collapsibleTriggerClass, collapsibleContentClass,
} from '#modules/ui/components/collapsible.ts';
import { ChevronsUpDown } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      orderNumber: 'Order #4189',
      status: 'Status',
      shipped: 'Shipped',
      shippingAddress: 'Shipping address',
      address: '100 Market St, San Francisco',
      items: 'Items',
      itemsDescription: '2x Studio Headphones',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      orderNumber: 'الطلب #4189',
      status: 'الحالة',
      shipped: 'تم الشحن',
      shippingAddress: 'عنوان الشحن',
      address: '100 Market St, San Francisco',
      items: 'العناصر',
      itemsDescription: '2x سماعات الاستوديو',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      orderNumber: 'הזמנה #4189',
      status: 'סטטוס',
      shipped: 'נשלח',
      shippingAddress: 'כתובת משלוח',
      address: '100 Market St, San Francisco',
      items: 'פריטים',
      itemsDescription: '2x אוזניות סטודיו',
    },
  },
};

// A native <details> hides everything but its <summary> while closed, so the
// always-visible status row rides inside the summary with the header.
export default function CollapsibleRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <details data-slot="collapsible" dir=${dir} lang=${lang} class=${cn(collapsibleClass(), 'flex w-[350px] flex-col gap-2')}>
      <summary data-slot="collapsible-trigger" class=${cn(collapsibleTriggerClass(), 'flex-col gap-2 font-normal')}>
        <span class="flex items-center justify-between gap-4 self-stretch px-4">
          <h4 class="text-sm font-semibold">${t.orderNumber}</h4>
          <span data-slot="button" data-variant="ghost" data-size="icon" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'size-8')}>
            ${ChevronsUpDown()}
            <span class="sr-only">Toggle details</span>
          </span>
        </span>
        <span class="flex items-center justify-between self-stretch rounded-md border px-4 py-2 text-sm">
          <span class="text-muted-foreground">${t.status}</span>
          <span class="font-medium">${t.shipped}</span>
        </span>
      </summary>
      <div data-slot="collapsible-content" class=${cn(collapsibleContentClass(), 'flex flex-col gap-2')}>
        <div class="rounded-md border px-4 py-2 text-sm">
          <p class="font-medium">${t.shippingAddress}</p>
          <p class="text-muted-foreground">${t.address}</p>
        </div>
        <div class="rounded-md border px-4 py-2 text-sm">
          <p class="font-medium">${t.items}</p>
          <p class="text-muted-foreground">${t.itemsDescription}</p>
        </div>
      </div>
    </details>
  `;
}
