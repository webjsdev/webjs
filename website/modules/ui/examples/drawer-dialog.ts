import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass,
} from '#modules/ui/components/dialog.ts';
import {
  drawerHeaderClass, drawerTitleClass, drawerDescriptionClass, drawerFooterClass,
} from '#modules/ui/components/drawer.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

// shadcn picks Dialog or Drawer with a useMediaQuery hook. Here both are
// rendered and a breakpoint shows one trigger: the Dialog from md up, the
// Drawer below it. No script decides, so the first paint is already right.
function ProfileForm(id: string, className = '') {
  return html`
    <form class=${cn('grid items-start gap-6', className)}>
      <div class="grid gap-3">
        <label data-slot="label" for=${`email-${id}`} class=${labelClass()}>Email</label>
        <input data-slot="input" type="email" id=${`email-${id}`} value="vivek@example.com" class=${inputClass()}>
      </div>
      <div class="grid gap-3">
        <label data-slot="label" for=${`username-${id}`} class=${labelClass()}>Username</label>
        <input data-slot="input" id=${`username-${id}`} value="@vivek" class=${inputClass()}>
      </div>
      <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Save changes</button>
    </form>
  `;
}

export default function DrawerDialogDemo() {
  return html`
    <div class="hidden md:contents">
      <ui-dialog>
        <ui-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Edit Profile</button>
        </ui-dialog-trigger>
        <ui-dialog-content class="sm:max-w-[425px]">
          <div data-slot="dialog-header" class=${dialogHeaderClass()}>
            <h2 data-slot="dialog-title" class=${dialogTitleClass()}>Edit profile</h2>
            <p data-slot="dialog-description" class=${dialogDescriptionClass()}>
              Make changes to your profile here. Click save when you&apos;re
              done.
            </p>
          </div>
          ${ProfileForm('dialog')}
        </ui-dialog-content>
      </ui-dialog>
    </div>
    <div class="contents md:hidden">
      <ui-drawer>
        <ui-drawer-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Edit Profile</button>
        </ui-drawer-trigger>
        <ui-drawer-content>
          <div data-slot="drawer-header" class=${cn(drawerHeaderClass(), 'text-left')}>
            <h2 data-slot="drawer-title" class=${drawerTitleClass()}>Edit profile</h2>
            <p data-slot="drawer-description" class=${drawerDescriptionClass()}>
              Make changes to your profile here. Click save when you&apos;re done.
            </p>
          </div>
          ${ProfileForm('drawer', 'px-4')}
          <div data-slot="drawer-footer" class=${cn(drawerFooterClass(), 'pt-2')}>
            <ui-drawer-close>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Cancel</button>
            </ui-drawer-close>
          </div>
        </ui-drawer-content>
      </ui-drawer>
    </div>
  `;
}
