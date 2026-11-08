import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from '#modules/ui/components/button.ts';
import { badgeClass, type BadgeVariant } from '#modules/ui/components/badge.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardActionClass, cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';
import {
  itemGroupClass, itemClass, itemContentClass, itemTitleClass,
  itemDescriptionClass, itemMediaClass, itemFooterClass,
} from '#modules/ui/components/item.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';
import { progressClass } from '#modules/ui/components/progress.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';

/**
 * Fragment helpers for the /ui home page cards (#1666), one per shadcn part.
 *
 * Each renders the element shadcn's component renders: the same tag, the same
 * `data-slot`, and the kit's base-form classes, which the page's style
 * wrapper (`.style-rhea`) turns into the look. The style rules key on
 * `data-slot` (`has-data-[slot=card-footer]` and the like), so the slot is
 * not decoration. A card then reads like the TSX it was ported from.
 *
 * These are page fragments, not components: the home page never hydrates, so
 * none of this reaches the browser.
 */

type Body = unknown;

export const Card = (cls: string, body: Body) =>
  html`<div data-slot="card" data-size="default" class=${cn(cardClass(), cls)}>${body}</div>`;
export const CardHeader = (cls: string, body: Body) =>
  html`<div data-slot="card-header" class=${cn(cardHeaderClass(), cls)}>${body}</div>`;
export const CardTitle = (cls: string, body: Body) =>
  html`<div data-slot="card-title" class=${cn(cardTitleClass(), cls)}>${body}</div>`;
export const CardDescription = (cls: string, body: Body) =>
  html`<div data-slot="card-description" class=${cn(cardDescriptionClass(), cls)}>${body}</div>`;
export const CardAction = (body: Body) =>
  html`<div data-slot="card-action" class=${cardActionClass()}>${body}</div>`;
export const CardContent = (cls: string, body: Body) =>
  html`<div data-slot="card-content" class=${cn(cardContentClass(), cls)}>${body}</div>`;
export const CardFooter = (cls: string, body: Body) =>
  html`<div data-slot="card-footer" class=${cn(cardFooterClass(), cls)}>${body}</div>`;

export const Button = (
  opts: { variant?: ButtonVariant; size?: ButtonSize; cls?: string; label?: string; type?: 'button' | 'submit' },
  body: Body,
) =>
  html`<button type=${opts.type ?? 'button'} data-slot="button" data-variant=${opts.variant ?? 'default'} data-size=${opts.size ?? 'default'} aria-label=${opts.label ?? nothing} class=${cn(buttonClass({ variant: opts.variant, size: opts.size }), opts.cls)}>${body}</button>`;

export const Badge = (variant: BadgeVariant, cls: string, body: Body) =>
  html`<span data-slot="badge" data-variant=${variant} class=${cn(badgeClass({ variant }), cls)}>${body}</span>`;

export const ItemGroup = (cls: string, body: Body) =>
  html`<div role="list" data-slot="item-group" class=${cn(itemGroupClass(), cls)}>${body}</div>`;
export const Item = (opts: { variant?: 'default' | 'outline' | 'muted'; cls?: string; href?: string; role?: string }, body: Body) => {
  const cls = cn(itemClass({ variant: opts.variant ?? 'default' }), opts.cls);
  return opts.href
    ? html`<a href=${opts.href} data-slot="item" data-variant=${opts.variant ?? 'default'} data-size="default" class=${cn(cls, 'no-underline')}>${body}</a>`
    : html`<div role=${opts.role ?? nothing} data-slot="item" data-variant=${opts.variant ?? 'default'} data-size="default" class=${cls}>${body}</div>`;
};
export const ItemContent = (cls: string, body: Body) =>
  html`<div data-slot="item-content" class=${cn(itemContentClass(), cls)}>${body}</div>`;
export const ItemTitle = (body: Body) =>
  html`<div data-slot="item-title" class=${itemTitleClass()}>${body}</div>`;
export const ItemDescription = (cls: string, body: Body) =>
  html`<p data-slot="item-description" class=${cn(itemDescriptionClass(), cls)}>${body}</p>`;
export const ItemMedia = (body: Body) =>
  html`<div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>${body}</div>`;
export const ItemFooter = (body: Body) =>
  html`<div data-slot="item-footer" class=${itemFooterClass()}>${body}</div>`;

export const FieldGroup = (body: Body) =>
  html`<div data-slot="field-group" class=${fieldGroupClass()}>${body}</div>`;
export const Field = (cls: string, body: Body) =>
  html`<div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), cls)}>${body}</div>`;
export const FieldLabel = (opts: { for?: string; id?: string }, body: Body) =>
  html`<label data-slot="field-label" for=${opts.for ?? nothing} id=${opts.id ?? nothing} class=${fieldLabelClass()}>${body}</label>`;
export const FieldDescription = (body: Body) =>
  html`<p data-slot="field-description" class=${fieldDescriptionClass()}>${body}</p>`;

export const Input = (opts: { id?: string; type?: string; placeholder?: string; value?: string }) =>
  html`<input data-slot="input" id=${opts.id ?? nothing} type=${opts.type ?? 'text'} placeholder=${opts.placeholder ?? nothing} value=${opts.value ?? nothing} class=${inputClass()}>`;
export const Textarea = (opts: { id?: string; placeholder?: string; cls?: string }) =>
  html`<textarea data-slot="textarea" id=${opts.id ?? nothing} placeholder=${opts.placeholder ?? nothing} class=${cn(textareaClass(), opts.cls)}></textarea>`;
export const Progress = (value: number, aria: { label?: string; labelledby?: string; valuetext?: string }) =>
  html`<progress data-slot="progress" value=${value} max="100" aria-label=${aria.label ?? nothing} aria-labelledby=${aria.labelledby ?? nothing} aria-valuetext=${aria.valuetext ?? nothing} class=${progressClass()}></progress>`;
export const Separator = () =>
  html`<div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>`;
