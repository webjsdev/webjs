import { html } from '@webjsdev/core';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      one: 'One',
      two: 'Two',
      three: 'Three',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      one: 'واحد',
      two: 'اثنان',
      three: 'ثلاثة',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      one: 'אחד',
      two: 'שניים',
      three: 'שלושה',
    },
  },
};

export default function ResizableRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-resizable-panel-group orientation="horizontal" dir=${dir} lang=${lang} class="max-w-sm rounded-lg border">
      <ui-resizable-panel default-size="50">
        <div class="flex h-[200px] items-center justify-center p-6">
          <span class="font-semibold">${t.one}</span>
        </div>
      </ui-resizable-panel>
      <ui-resizable-handle with-handle></ui-resizable-handle>
      <ui-resizable-panel default-size="50">
        <ui-resizable-panel-group orientation="vertical" dir=${dir}>
          <ui-resizable-panel default-size="25">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">${t.two}</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle with-handle></ui-resizable-handle>
          <ui-resizable-panel default-size="75">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">${t.three}</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
      </ui-resizable-panel>
    </ui-resizable-panel-group>
  `;
}
