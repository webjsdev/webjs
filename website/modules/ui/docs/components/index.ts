import type { TemplateResult } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';
import type { PreviewOptions } from '#lib/ui/docs/preview.ts';

/**
 * The component docs modules, one per component page that has its content
 * ported (#1666, D15). A component with no module here still has a page,
 * built from its nav record (title, description, installation), until its
 * content lands.
 *
 * Each module exports `demo`, the demo shown above Installation, and a
 * default `body(toc)` for everything after it. String-literal imports, so
 * each module loads only when its page is requested.
 */
export interface ComponentDocModule {
  demo?: string;
  /** How the lead demo is shown, as shadcn's ComponentPreview props set it. */
  demoOptions?: PreviewOptions;
  default: (toc: TocEntry[]) => Promise<TemplateResult> | TemplateResult;
}

export const COMPONENT_DOCS: Record<string, () => Promise<ComponentDocModule>> = {
  'accordion': () => import('./accordion.ts'),
  'alert': () => import('./alert.ts'),
  'alert-dialog': () => import('./alert-dialog.ts'),
  'aspect-ratio': () => import('./aspect-ratio.ts'),
  'attachment': () => import('./attachment.ts'),
  'avatar': () => import('./avatar.ts'),
  'badge': () => import('./badge.ts'),
  'breadcrumb': () => import('./breadcrumb.ts'),
  'bubble': () => import('./bubble.ts'),
  'button': () => import('./button.ts'),
  'button-group': () => import('./button-group.ts'),
  'calendar': () => import('./calendar.ts'),
  'card': () => import('./card.ts'),
  'carousel': () => import('./carousel.ts'),
  'checkbox': () => import('./checkbox.ts'),
  'code-block': () => import('./code-block.ts'),
  'collapsible': () => import('./collapsible.ts'),
  'combobox': () => import('./combobox.ts'),
  'command': () => import('./command.ts'),
  'context-menu': () => import('./context-menu.ts'),
  'date-picker': () => import('./date-picker.ts'),
  'dialog': () => import('./dialog.ts'),
  'direction': () => import('./direction.ts'),
  'drawer': () => import('./drawer.ts'),
  'dropdown-menu': () => import('./dropdown-menu.ts'),
  'empty': () => import('./empty.ts'),
  'field': () => import('./field.ts'),
  'hover-card': () => import('./hover-card.ts'),
  'input': () => import('./input.ts'),
  'input-group': () => import('./input-group.ts'),
  'input-otp': () => import('./input-otp.ts'),
  'item': () => import('./item.ts'),
  'kbd': () => import('./kbd.ts'),
  'label': () => import('./label.ts'),
  'marker': () => import('./marker.ts'),
  'menubar': () => import('./menubar.ts'),
  'message': () => import('./message.ts'),
  'message-scroller': () => import('./message-scroller.ts'),
  'native-select': () => import('./native-select.ts'),
  'navigation-menu': () => import('./navigation-menu.ts'),
  'pagination': () => import('./pagination.ts'),
  'popover': () => import('./popover.ts'),
  'progress': () => import('./progress.ts'),
  'questionnaire': () => import('./questionnaire.ts'),
  'radio-group': () => import('./radio-group.ts'),
  'resizable': () => import('./resizable.ts'),
  'scroll-area': () => import('./scroll-area.ts'),
  'select': () => import('./select.ts'),
  'separator': () => import('./separator.ts'),
  'sheet': () => import('./sheet.ts'),
  'skeleton': () => import('./skeleton.ts'),
  'slider': () => import('./slider.ts'),
  'sonner': () => import('./sonner.ts'),
  'spinner': () => import('./spinner.ts'),
  'switch': () => import('./switch.ts'),
  'table': () => import('./table.ts'),
  'tabs': () => import('./tabs.ts'),
  'textarea': () => import('./textarea.ts'),
  'toggle': () => import('./toggle.ts'),
  'toggle-group': () => import('./toggle-group.ts'),
  'tooltip': () => import('./tooltip.ts'),
  'trace': () => import('./trace.ts'),
  'typography': () => import('./typography.ts'),
};
