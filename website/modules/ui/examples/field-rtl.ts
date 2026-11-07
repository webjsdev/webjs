import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldSetClass, fieldLegendClass, fieldGroupClass, fieldClass, fieldLabelClass,
  fieldDescriptionClass, fieldSeparatorClass,
} from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const years = ['2024', '2025', '2026', '2027', '2028', '2029'];

const translations = {
  en: {
    dir: 'ltr',
    values: {
      paymentMethod: 'Payment Method',
      secureTransactions: 'All transactions are secure and encrypted',
      nameOnCard: 'Name on Card',
      cardNumber: 'Card Number',
      cardNumberDescription: 'Enter your 16-digit card number',
      month: 'Month',
      year: 'Year',
      cvv: 'CVV',
      monthPlaceholder: 'MM',
      months: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      billingAddress: 'Billing Address',
      billingAddressDescription: 'The billing address associated with your payment method',
      sameAsShipping: 'Same as shipping address',
      comments: 'Comments',
      commentsPlaceholder: 'Add any additional comments',
      submit: 'Submit',
      cancel: 'Cancel',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      paymentMethod: 'طريقة الدفع',
      secureTransactions: 'جميع المعاملات آمنة ومشفرة',
      nameOnCard: 'الاسم على البطاقة',
      cardNumber: 'رقم البطاقة',
      cardNumberDescription: 'أدخل رقم البطاقة المكون من 16 رقمًا',
      month: 'الشهر',
      year: 'السنة',
      cvv: 'CVV',
      monthPlaceholder: 'ش.ش',
      months: ['٠١', '٠٢', '٠٣', '٠٤', '٠٥', '٠٦', '٠٧', '٠٨', '٠٩', '١٠', '١١', '١٢'],
      billingAddress: 'عنوان الفوترة',
      billingAddressDescription: 'عنوان الفوترة المرتبط بطريقة الدفع الخاصة بك',
      sameAsShipping: 'نفس عنوان الشحن',
      comments: 'تعليقات',
      commentsPlaceholder: 'أضف أي تعليقات إضافية',
      submit: 'إرسال',
      cancel: 'إلغاء',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      paymentMethod: 'אמצעי תשלום',
      secureTransactions: 'כל העסקאות מאובטחות ומוצפנות',
      nameOnCard: 'שם על הכרטיס',
      cardNumber: 'מספר כרטיס',
      cardNumberDescription: 'הזן את מספר הכרטיס בן 16 הספרות שלך',
      month: 'חודש',
      year: 'שנה',
      cvv: 'CVV',
      monthPlaceholder: 'MM',
      months: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
      billingAddress: 'כתובת חיוב',
      billingAddressDescription: 'כתובת החיוב המשויכת לאמצעי התשלום שלך',
      sameAsShipping: 'זהה לכתובת המשלוח',
      comments: 'הערות',
      commentsPlaceholder: 'הוסף הערות נוספות',
      submit: 'שלח',
      cancel: 'בטל',
    },
  },
};

export default function FieldRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="w-full max-w-md py-6" dir=${dir} lang=${lang}>
      <form>
        <div data-slot="field-group" class=${fieldGroupClass()}>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${t.paymentMethod}</legend>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.secureTransactions}</p>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-card-name-43j-rtl" class=${fieldLabelClass()}>
                  ${t.nameOnCard}
                </label>
                <input data-slot="input" id="checkout-7j9-card-name-43j-rtl" placeholder="Evil Rabbit" required class=${inputClass()}>
              </div>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-card-number-uw1-rtl" class=${fieldLabelClass()}>
                  ${t.cardNumber}
                </label>
                <input data-slot="input" id="checkout-7j9-card-number-uw1-rtl" placeholder="1234 5678 9012 3456" required class=${inputClass()}>
                <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.cardNumberDescription}</p>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-exp-month-ts6-rtl" class=${fieldLabelClass()}>
                    ${t.month}
                  </label>
                  <ui-select placeholder=${t.monthPlaceholder}>
                    <select id="checkout-exp-month-ts6-rtl" class=${selectTriggerClass()}>
                      <option value="" disabled selected hidden>${t.monthPlaceholder}</option>
                      ${months.map((m, i) => html`<option value=${m}>${t.months[i]}</option>`)}
                    </select>
                  </ui-select>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-7j9-exp-year-f59-rtl" class=${fieldLabelClass()}>
                    ${t.year}
                  </label>
                  <ui-select placeholder="YYYY">
                    <select id="checkout-7j9-exp-year-f59-rtl" class=${selectTriggerClass()}>
                      <option value="" disabled selected hidden>YYYY</option>
                      ${years.map((y) => html`<option value=${y}>${y}</option>`)}
                    </select>
                  </ui-select>
                </div>
                <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                  <label data-slot="field-label" for="checkout-7j9-cvv-rtl" class=${fieldLabelClass()}>${t.cvv}</label>
                  <input data-slot="input" id="checkout-7j9-cvv-rtl" placeholder="123" required class=${inputClass()}>
                </div>
              </div>
            </div>
          </fieldset>
          <div data-slot="field-separator" data-content="false" class=${fieldSeparatorClass()}></div>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <legend data-slot="field-legend" data-variant="legend" class=${fieldLegendClass()}>${t.billingAddress}</legend>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.billingAddressDescription}</p>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
                <input type="checkbox" data-slot="checkbox" id="checkout-7j9-same-as-shipping-wgm-rtl" checked class=${checkboxClass()}>
                <label data-slot="field-label" for="checkout-7j9-same-as-shipping-wgm-rtl" class=${cn(fieldLabelClass(), 'font-normal')}>
                  ${t.sameAsShipping}
                </label>
              </div>
            </div>
          </fieldset>
          <fieldset data-slot="field-set" class=${fieldSetClass()}>
            <div data-slot="field-group" class=${fieldGroupClass()}>
              <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
                <label data-slot="field-label" for="checkout-7j9-optional-comments-rtl" class=${fieldLabelClass()}>
                  ${t.comments}
                </label>
                <textarea data-slot="textarea" id="checkout-7j9-optional-comments-rtl" placeholder=${t.commentsPlaceholder} class=${cn(textareaClass(), 'resize-none')}></textarea>
              </div>
            </div>
          </fieldset>
          <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
            <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>${t.submit}</button>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
              ${t.cancel}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}
