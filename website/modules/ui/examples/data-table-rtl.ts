import { html } from '@webjsdev/core';
import { paymentsTable, type DataTableStrings } from '#lib/ui/data-table-demo.ts';

// The payments table in Arabic, right to left: shadcn's data-table-rtl, the
// same table and behaviour with its translated strings and Arabic currency
// formatting.
const translations: Record<'ar' | 'he', { dir: 'rtl'; locale: string; values: DataTableStrings }> = {
  ar: {
    dir: 'rtl',
    locale: 'ar-SA',
    values: {
      filterEmails: 'تصفية البريد الإلكتروني...',
      columns: 'الأعمدة',
      status: 'الحالة',
      email: 'البريد الإلكتروني',
      amount: 'المبلغ',
      actions: 'الإجراءات',
      copyPaymentId: 'نسخ معرف الدفع',
      viewCustomer: 'عرض العميل',
      viewPaymentDetails: 'عرض تفاصيل الدفع',
      selectAll: 'تحديد الكل',
      selectRow: 'تحديد الصف',
      openMenu: 'فتح القائمة',
      noResults: 'لا توجد نتائج.',
      rowsSelected: 'من',
      rowsSelectedSuffix: 'صف(وف) محدد.',
      previous: 'السابق',
      next: 'التالي',
      success: 'ناجح',
      processing: 'قيد المعالجة',
      failed: 'فشل',
      pending: 'قيد الانتظار',
    },
  },
  he: {
    dir: 'rtl',
    locale: 'he-IL',
    values: {
      filterEmails: 'סנן אימיילים...',
      columns: 'עמודות',
      status: 'סטטוס',
      email: 'אימייל',
      amount: 'סכום',
      actions: 'פעולות',
      copyPaymentId: 'העתק מזהה תשלום',
      viewCustomer: 'צפה בלקוח',
      viewPaymentDetails: 'צפה בפרטי תשלום',
      selectAll: 'בחר הכל',
      selectRow: 'בחר שורה',
      openMenu: 'פתח תפריט',
      noResults: 'אין תוצאות.',
      rowsSelected: 'מתוך',
      rowsSelectedSuffix: 'שורות נבחרו.',
      previous: 'הקודם',
      next: 'הבא',
      success: 'הצליח',
      processing: 'מעבד',
      failed: 'נכשל',
      pending: 'ממתין',
    },
  },
};

export default function DataTableRtl() {
  const lang = 'ar';
  const { dir, locale, values: t } = translations[lang];
  return html`${paymentsTable({ t, dir, lang, locale })}`;
}
