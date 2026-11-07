import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  tableContainerClass, tableClass, tableHeaderClass, tableBodyClass, tableFooterClass,
  tableRowClass, tableHeadClass, tableCellClass, tableCaptionClass,
} from '#modules/ui/components/table.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      caption: 'A list of your recent invoices.',
      invoice: 'Invoice',
      status: 'Status',
      method: 'Method',
      amount: 'Amount',
      paid: 'Paid',
      pending: 'Pending',
      unpaid: 'Unpaid',
      creditCard: 'Credit Card',
      paypal: 'PayPal',
      bankTransfer: 'Bank Transfer',
      total: 'Total',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      caption: 'قائمة بفواتيرك الأخيرة.',
      invoice: 'الفاتورة',
      status: 'الحالة',
      method: 'الطريقة',
      amount: 'المبلغ',
      paid: 'مدفوع',
      pending: 'قيد الانتظار',
      unpaid: 'غير مدفوع',
      creditCard: 'بطاقة ائتمانية',
      paypal: 'PayPal',
      bankTransfer: 'تحويل بنكي',
      total: 'المجموع',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      caption: 'רשימת החשבוניות האחרונות שלך.',
      invoice: 'חשבונית',
      status: 'סטטוס',
      method: 'שיטה',
      amount: 'סכום',
      paid: 'שולם',
      pending: 'ממתין',
      unpaid: 'לא שולם',
      creditCard: 'כרטיס אשראי',
      paypal: 'PayPal',
      bankTransfer: 'העברה בנקאית',
      total: 'סה"כ',
    },
  },
};

const invoices = [
  { invoice: 'INV001', paymentStatus: 'paid', totalAmount: '$250.00', paymentMethod: 'creditCard' },
  { invoice: 'INV002', paymentStatus: 'pending', totalAmount: '$150.00', paymentMethod: 'paypal' },
  { invoice: 'INV003', paymentStatus: 'unpaid', totalAmount: '$350.00', paymentMethod: 'bankTransfer' },
  { invoice: 'INV004', paymentStatus: 'paid', totalAmount: '$450.00', paymentMethod: 'creditCard' },
  { invoice: 'INV005', paymentStatus: 'paid', totalAmount: '$550.00', paymentMethod: 'paypal' },
  { invoice: 'INV006', paymentStatus: 'pending', totalAmount: '$200.00', paymentMethod: 'bankTransfer' },
  { invoice: 'INV007', paymentStatus: 'unpaid', totalAmount: '$300.00', paymentMethod: 'creditCard' },
] as const;

export default function TableRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div data-slot="table-container" class=${tableContainerClass()}>
      <table data-slot="table" dir=${dir} lang=${lang} class=${tableClass()}>
        <caption data-slot="table-caption" class=${tableCaptionClass()}>${t.caption}</caption>
        <thead data-slot="table-header" class=${tableHeaderClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'w-[100px]')}>${t.invoice}</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>${t.status}</th>
            <th scope="col" data-slot="table-head" class=${tableHeadClass()}>${t.method}</th>
            <th scope="col" data-slot="table-head" class=${cn(tableHeadClass(), 'text-right')}>${t.amount}</th>
          </tr>
        </thead>
        <tbody data-slot="table-body" class=${tableBodyClass()}>
          ${invoices.map((invoice) => html`
            <tr data-slot="table-row" class=${tableRowClass()}>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'font-medium')}>${invoice.invoice}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${t[invoice.paymentStatus]}</td>
              <td data-slot="table-cell" class=${tableCellClass()}>${t[invoice.paymentMethod]}</td>
              <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>${invoice.totalAmount}</td>
            </tr>
          `)}
        </tbody>
        <tfoot data-slot="table-footer" class=${tableFooterClass()}>
          <tr data-slot="table-row" class=${tableRowClass()}>
            <td colspan="3" data-slot="table-cell" class=${tableCellClass()}>${t.total}</td>
            <td data-slot="table-cell" class=${cn(tableCellClass(), 'text-right')}>$2,500.00</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}
