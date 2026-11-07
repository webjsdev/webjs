/**
 * The RTL example's strings, shadcn's apps/v4/app/(app)/examples/rtl/components
 * translations as they are, one block per component, in Arabic and Hebrew.
 */

export type RtlLang = 'ar' | 'he';

export const LANGUAGES: { value: RtlLang; label: string; locale: string }[] = [
  { value: 'ar', label: 'Arabic (العربية)', locale: 'ar-SA' },
  { value: 'he', label: 'Hebrew (עברית)', locale: 'he-IL' },
];

export function readLang(value: unknown): RtlLang {
  return value === 'he' ? 'he' : 'ar';
}

export const t = {
  fieldDemo: {
    ar: {
      paymentMethod: 'طريقة الدفع', secureEncrypted: 'جميع المعاملات آمنة ومشفرة', nameOnCard: 'الاسم على البطاقة',
      namePlaceholder: 'أحمد محمد', cardNumber: 'رقم البطاقة', cardDescription: 'أدخل رقمك المكون من 16 رقمًا.',
      cvv: 'رمز الأمان', month: 'الشهر', year: 'السنة', billingAddress: 'عنوان الفواتير',
      billingDescription: 'عنوان الفواتير المرتبط بطريقة الدفع الخاصة بك', sameAsShipping: 'نفس عنوان الشحن',
      comments: 'تعليقات', commentsPlaceholder: 'أضف أي تعليقات إضافية', submit: 'إرسال', cancel: 'إلغاء',
    },
    he: {
      paymentMethod: 'אמצעי תשלום', secureEncrypted: 'כל העסקאות מאובטחות ומוצפנות', nameOnCard: 'שם על הכרטיס',
      namePlaceholder: 'ישראל ישראלי', cardNumber: 'מספר כרטיס', cardDescription: 'הזן את המספר בן 16 הספרות שלך.',
      cvv: 'קוד אבטחה', month: 'חודש', year: 'שנה', billingAddress: 'כתובת לחיוב',
      billingDescription: 'כתובת החיוב המשויכת לאמצעי התשלום שלך', sameAsShipping: 'זהה לכתובת המשלוח',
      comments: 'הערות', commentsPlaceholder: 'הוסף הערות נוספות', submit: 'שלח', cancel: 'ביטול',
    },
  },
  emptyAvatarGroup: {
    ar: { title: 'لا يوجد أعضاء في الفريق', description: 'قم بدعوة فريقك للتعاون في هذا المشروع.', invite: 'دعوة أعضاء' },
    he: { title: 'אין חברי צוות', description: 'הזמן את הצוות שלך לשתף פעולה בפרויקט זה.', invite: 'הזמן חברים' },
  },
  spinnerBadge: {
    ar: { syncing: 'جارٍ المزامنة', updating: 'جارٍ التحديث', loading: 'جارٍ التحميل' },
    he: { syncing: 'מסנכרן', updating: 'מעדכן', loading: 'טוען' },
  },
  buttonGroupInputGroup: {
    ar: { add: 'إضافة', voicePlaceholder: 'سجل وأرسل صوتًا...', messagePlaceholder: 'أرسل رسالة...', voiceMode: 'الوضع الصوتي' },
    he: { add: 'הוסף', voicePlaceholder: 'הקלט ושלח אודיו...', messagePlaceholder: 'שלח הודעה...', voiceMode: 'מצב קולי' },
  },
  fieldSlider: {
    ar: { title: 'نطاق السعر', description: 'حدد نطاق ميزانيتك', ariaLabel: 'نطاق السعر', currency: '﷼' },
    he: { title: 'טווח מחירים', description: 'הגדר את טווח התקציב שלך', ariaLabel: 'טווח מחירים', currency: '₪' },
  },
  inputGroupDemo: {
    ar: {
      search: 'بحث...', results: '12 نتيجة', example: 'example.com', tooltipContent: 'هذا محتوى في تلميح.',
      askSearchChat: 'اسأل، ابحث أو تحدث...', add: 'إضافة', auto: 'تلقائي', agent: 'وكيل', manual: 'يدوي',
      used: '52% مستخدم', send: 'إرسال',
    },
    he: {
      search: 'חיפוש...', results: '12 תוצאות', example: 'example.com', tooltipContent: 'זה תוכן בטולטיפ.',
      askSearchChat: 'שאל, חפש או שוחח...', add: 'הוסף', auto: 'אוטומטי', agent: 'סוכן', manual: 'ידני',
      used: '52% בשימוש', send: 'שלח',
    },
  },
  inputGroupButton: {
    ar: { inputLabel: 'السعر', info: 'معلومات', priceInfo: 'أدخل السعر بالريال السعودي.', priceDescription: 'سيتم تحويل السعر تلقائياً.', favorite: 'مفضل', currency: 'ر.س' },
    he: { inputLabel: 'מחיר', info: 'מידע', priceInfo: 'הזן את המחיר בשקלים.', priceDescription: 'המחיר יומר אוטומטית.', favorite: 'מועדף', currency: '₪' },
  },
  itemDemo: {
    ar: { twoFactor: 'المصادقة الثنائية', twoFactorDescription: 'التحقق عبر البريد الإلكتروني أو رقم الهاتف.', enable: 'تفعيل', verified: 'تم التحقق من ملفك الشخصي.' },
    he: { twoFactor: 'אימות דו-שלבי', twoFactorDescription: 'אמת באמצעות אימייל או מספר טלפון.', enable: 'הפעל', verified: 'הפרופיל שלך אומת.' },
  },
  appearance: {
    ar: {
      separator: 'إعدادات المظهر', computeEnvironment: 'بيئة الحوسبة', computeDescription: 'اختر بيئة الحوسبة لمجموعتك.',
      kubernetes: 'كوبرنيتس', kubernetesDescription: 'تشغيل أحمال عمل GPU على مجموعة مُهيأة بـ K8s. هذا هو الافتراضي.',
      virtualMachine: 'جهاز افتراضي', vmDescription: 'الوصول إلى مجموعة VM مُهيأة لتشغيل أحمال العمل. (قريبًا)',
      numberOfGpus: 'عدد وحدات GPU', gpuDescription: 'يمكنك إضافة المزيد لاحقًا.', decrement: 'إنقاص', increment: 'زيادة',
      wallpaperTinting: 'تلوين الخلفية', wallpaperDescription: 'السماح بتلوين الخلفية.',
    },
    he: {
      separator: 'הגדרות מראה', computeEnvironment: 'סביבת מחשוב', computeDescription: 'בחר את סביבת המחשוב לאשכול שלך.',
      kubernetes: 'קוברנטיס', kubernetesDescription: 'הפעל עומסי עבודה של GPU באשכול מוגדר K8s. זו ברירת המחדל.',
      virtualMachine: 'מכונה וירטואלית', vmDescription: 'גש לאשכול VM מוגדר להפעלת עומסי עבודה. (בקרוב)',
      numberOfGpus: 'מספר GPUs', gpuDescription: 'תוכל להוסיף עוד מאוחר יותר.', decrement: 'הפחת', increment: 'הגדל',
      wallpaperTinting: 'צביעת טפט', wallpaperDescription: 'אפשר לטפט להיצבע.',
    },
  },
  buttonGroupDemo: {
    ar: {
      goBack: 'رجوع', archive: 'أرشفة', report: 'إبلاغ', snooze: 'تأجيل', moreOptions: 'خيارات أخرى', markAsRead: 'تحديد كمقروء',
      addToCalendar: 'إضافة إلى التقويم', addToList: 'إضافة إلى القائمة', labelAs: 'تصنيف كـ...', personal: 'شخصي', work: 'عمل',
      other: 'أخرى', trash: 'حذف',
    },
    he: {
      goBack: 'חזור', archive: 'ארכיון', report: 'דווח', snooze: 'נודניק', moreOptions: 'אפשרויות נוספות', markAsRead: 'סמן כנקרא',
      addToCalendar: 'הוסף ליומן', addToList: 'הוסף לרשימה', labelAs: 'תייג כ...', personal: 'אישי', work: 'עבודה',
      other: 'אחר', trash: 'מחק',
    },
  },
  fieldCheckbox: {
    ar: { terms: 'أوافق على الشروط والأحكام' },
    he: { terms: 'אני מסכים לתנאים וההגבלות' },
  },
  buttonGroupNested: {
    ar: { previous: 'السابق', next: 'التالي' },
    he: { previous: 'הקודם', next: 'הבא' },
  },
  buttonGroupPopover: {
    ar: {
      copilot: 'المساعد', openPopover: 'فتح القائمة', agentTasks: 'مهام الوكيل', placeholder: 'صف مهمتك بلغة طبيعية.',
      startTask: 'ابدأ مهمة جديدة مع المساعد',
      description: 'صف مهمتك بلغة طبيعية. سيعمل المساعد في الخلفية ويفتح طلب سحب لمراجعتك.',
    },
    he: {
      copilot: 'עוזר', openPopover: 'פתח תפריט', agentTasks: 'משימות סוכן', placeholder: 'תאר את המשימה שלך בשפה טבעית.',
      startTask: 'התחל משימה חדשה עם העוזר',
      description: 'תאר את המשימה שלך בשפה טבעית. העוזר יעבוד ברקע ויפתח בקשת משיכה לבדיקתך.',
    },
  },
  fieldHear: {
    ar: {
      legend: 'كيف سمعت عنا؟', description: 'اختر الخيار الذي يصف أفضل طريقة سمعت عنا من خلالها.',
      socialMedia: 'التواصل الاجتماعي', searchEngine: 'البحث', referral: 'إحالة', other: 'أخرى',
    },
    he: {
      legend: 'איך שמעת עלינו?', description: 'בחר את האפשרות שמתארת בצורה הטובה ביותר כיצד שמעת עלינו.',
      socialMedia: 'חברתיות', searchEngine: 'חיפוש', referral: 'הפניה', other: 'אחר',
    },
  },
  spinnerEmpty: {
    ar: { title: 'جارٍ معالجة طلبك', description: 'يرجى الانتظار بينما نعالج طلبك. لا تقم بتحديث الصفحة.', cancel: 'إلغاء' },
    he: { title: 'מעבד את הבקשה שלך', description: 'אנא המתן בזמן שאנו מעבדים את בקשתך. אל תרענן את הדף.', cancel: 'ביטול' },
  },
  notion: {
    ar: {
      prompt: 'الأمر', placeholder: 'اسأل، ابحث، أو أنشئ أي شيء...', addContext: 'أضف سياق', mentionTooltip: 'اذكر شخصًا أو صفحة أو تاريخًا',
      searchPages: 'البحث في الصفحات...', noPagesFound: 'لم يتم العثور على صفحات', pages: 'الصفحات', users: 'المستخدمون',
      attachFile: 'إرفاق ملف', selectModel: 'اختر نموذج الذكاء الاصطناعي', selectAgentMode: 'اختر وضع الوكيل', webSearch: 'البحث على الويب',
      appsIntegrations: 'التطبيقات والتكاملات', allSourcesAccess: 'جميع المصادر التي يمكنني الوصول إليها',
      findKnowledge: 'ابحث أو استخدم المعرفة في...', noKnowledgeFound: 'لم يتم العثور على معرفة', helpCenter: 'مركز المساعدة',
      connectApps: 'ربط التطبيقات', searchSourcesNote: 'سنبحث فقط في المصادر المحددة هنا.', send: 'إرسال', allSources: 'جميع المصادر',
      auto: 'تلقائي', agentMode: 'وضع الوكيل', planMode: 'وضع التخطيط', beta: 'تجريبي', workspace: 'مساحة العمل',
      meetingNotes: 'ملاحظات الاجتماع', projectDashboard: 'لوحة المشروع', ideasBrainstorming: 'أفكار وعصف ذهني',
      calendarEvents: 'التقويم والأحداث', documentation: 'التوثيق', goalsObjectives: 'الأهداف والغايات', budgetPlanning: 'تخطيط الميزانية',
      teamDirectory: 'دليل الفريق', technicalSpecs: 'المواصفات التقنية', analyticsReport: 'تقرير التحليلات',
    },
    he: {
      prompt: 'פקודה', placeholder: 'שאל, חפש, או צור משהו...', addContext: 'הוסף הקשר', mentionTooltip: 'הזכר אדם, עמוד או תאריך',
      searchPages: 'חפש עמודים...', noPagesFound: 'לא נמצאו עמודים', pages: 'עמודים', users: 'משתמשים',
      attachFile: 'צרף קובץ', selectModel: 'בחר מודל AI', selectAgentMode: 'בחר מצב סוכן', webSearch: 'חיפוש באינטרנט',
      appsIntegrations: 'אפליקציות ואינטגרציות', allSourcesAccess: 'כל המקורות שיש לי גישה אליהם',
      findKnowledge: 'מצא או השתמש בידע ב...', noKnowledgeFound: 'לא נמצא ידע', helpCenter: 'מרכז עזרה',
      connectApps: 'חבר אפליקציות', searchSourcesNote: 'נחפש רק במקורות שנבחרו כאן.', send: 'שלח', allSources: 'כל המקורות',
      auto: 'אוטומטי', agentMode: 'מצב סוכן', planMode: 'מצב תכנון', beta: 'בטא', workspace: 'סביבת עבודה',
      meetingNotes: 'הערות פגישה', projectDashboard: 'לוח מחוונים לפרויקט', ideasBrainstorming: 'רעיונות וסיעור מוחות',
      calendarEvents: 'יומן ואירועים', documentation: 'תיעוד', goalsObjectives: 'מטרות ויעדים', budgetPlanning: 'תכנון תקציב',
      teamDirectory: 'ספריית צוות', technicalSpecs: 'מפרט טכני', analyticsReport: 'דוח אנליטיקה',
    },
  },
};
