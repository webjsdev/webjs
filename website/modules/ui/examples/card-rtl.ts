import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      title: 'Login to your account',
      description: 'Enter your email below to login to your account',
      signUp: 'Sign Up',
      email: 'Email',
      emailPlaceholder: 'm@example.com',
      password: 'Password',
      forgotPassword: 'Forgot your password?',
      login: 'Login',
      loginWithGoogle: 'Login with Google',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      title: 'تسجيل الدخول إلى حسابك',
      description: 'أدخل بريدك الإلكتروني أدناه لتسجيل الدخول إلى حسابك',
      signUp: 'إنشاء حساب',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'm@example.com',
      password: 'كلمة المرور',
      forgotPassword: 'نسيت كلمة المرور؟',
      login: 'تسجيل الدخول',
      loginWithGoogle: 'تسجيل الدخول باستخدام Google',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      title: 'התחבר לחשבון שלך',
      description: 'הזן את האימייל שלך למטה כדי להתחבר לחשבון שלך',
      signUp: 'הירשם',
      email: 'אימייל',
      emailPlaceholder: 'm@example.com',
      password: 'סיסמה',
      forgotPassword: 'שכחת את הסיסמה?',
      login: 'התחבר',
      loginWithGoogle: 'התחבר עם Google',
    },
  },
};

// The provider is the dir attribute: every part styles itself with logical
// properties, so dir="rtl" on the card flips the whole layout.
export default function CardRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div data-slot="card" data-size="default" dir=${dir} lang=${lang} class=${cn(cardClass(), 'w-full max-w-sm')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>${t.title}</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>${t.description}</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <button type="button" data-slot="button" data-variant="link" data-size="default" class=${buttonClass({ variant: 'link' })}>${t.signUp}</button>
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <form>
          <div class="flex flex-col gap-6">
            <div class="grid gap-2">
              <label data-slot="label" for="email-rtl" class=${labelClass()}>${t.email}</label>
              <input data-slot="input" id="email-rtl" type="email" placeholder=${t.emailPlaceholder} required class=${inputClass()}>
            </div>
            <div class="grid gap-2">
              <div class="flex items-center">
                <label data-slot="label" for="password-rtl" class=${labelClass()}>${t.password}</label>
                <a href="#" class="ms-auto inline-block text-sm underline-offset-4 hover:underline">${t.forgotPassword}</a>
              </div>
              <input data-slot="input" id="password-rtl" type="password" required class=${inputClass()}>
            </div>
          </div>
        </form>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex-col gap-2')}>
        <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>${t.login}</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-full')}>${t.loginWithGoogle}</button>
      </div>
    </div>
  `;
}
