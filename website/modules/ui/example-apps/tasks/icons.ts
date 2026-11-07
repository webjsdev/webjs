import { svg } from '@webjsdev/core';

/**
 * The lucide icons the tasks example draws (lucide 1.70.0, ISC; see
 * packages/ui/THIRD_PARTY_NOTICES.md), local so the example does not pull
 * the whole docs icon set. Generated; each renders what lucide-react renders.
 */
const icon = (name: string, cls: string, body: unknown) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'lucide lucide-' + name + (cls ? ' ' + cls : '')}>${body}</svg>`;

export const CircleHelpIcon = (cls = '') => icon('circle-question-mark', cls, svg`<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>`);
export const CircleIcon = (cls = '') => icon('circle', cls, svg`<circle cx="12" cy="12" r="10"></circle>`);
export const TimerIcon = (cls = '') => icon('timer', cls, svg`<line x1="10" x2="14" y1="2" y2="2"></line><line x1="12" x2="15" y1="14" y2="11"></line><circle cx="12" cy="14" r="8"></circle>`);
export const CircleCheckIcon = (cls = '') => icon('circle-check', cls, svg`<circle cx="12" cy="12" r="10"></circle><path d="m16 9-5.5 5.5L8 12"></path>`);
export const CircleOffIcon = (cls = '') => icon('circle-off', cls, svg`<path d="m2 2 20 20"></path><path d="M8.35 2.69A10 10 0 0 1 21.3 15.65"></path><path d="M19.08 19.08A10 10 0 1 1 4.92 4.92"></path>`);
export const ArrowDownIcon = (cls = '') => icon('arrow-down', cls, svg`<path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>`);
export const ArrowRightIcon = (cls = '') => icon('arrow-right', cls, svg`<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>`);
export const ArrowUpIcon = (cls = '') => icon('arrow-up', cls, svg`<path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path>`);
export const ChevronsUpDownIcon = (cls = '') => icon('chevrons-up-down', cls, svg`<path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path>`);
export const EyeOffIcon = (cls = '') => icon('eye-off', cls, svg`<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path><path d="m2 2 20 20"></path>`);
export const CirclePlusIcon = (cls = '') => icon('circle-plus', cls, svg`<circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path>`);
export const XIcon = (cls = '') => icon('x', cls, svg`<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`);
export const Settings2Icon = (cls = '') => icon('settings-2', cls, svg`<path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle>`);
export const CheckIcon = (cls = '') => icon('check', cls, svg`<path d="M20 6 9 17l-5-5"></path>`);
export const EllipsisIcon = (cls = '') => icon('ellipsis', cls, svg`<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>`);
export const ChevronLeftIcon = (cls = '') => icon('chevron-left', cls, svg`<path d="m15 18-6-6 6-6"></path>`);
export const ChevronRightIcon = (cls = '') => icon('chevron-right', cls, svg`<path d="m9 18 6-6-6-6"></path>`);
export const ChevronsLeftIcon = (cls = '') => icon('chevrons-left', cls, svg`<path d="m11 17-5-5 5-5"></path><path d="m18 17-5-5 5-5"></path>`);
export const ChevronsRightIcon = (cls = '') => icon('chevrons-right', cls, svg`<path d="m6 17 5-5-5-5"></path><path d="m13 17 5-5-5-5"></path>`);
