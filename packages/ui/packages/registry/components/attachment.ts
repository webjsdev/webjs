/**
 * Attachment: a file or image attached to a message or a form, as a compact
 * card with its media, name, details and actions. Tier-1 class helper;
 * compose with plain elements.
 *
 * shadcn parity:
 *   AttachmentGroup            → attachmentGroupClass()
 *   Attachment (variant, size) → attachmentClass({ ... }), alias attachmentVariants
 *   AttachmentMedia            → attachmentMediaClass({ ... }), alias attachmentMediaVariants
 *   AttachmentContent / AttachmentTitle / AttachmentDescription
 *                              → attachmentContentClass() / attachmentTitleClass() / attachmentDescriptionClass()
 *   AttachmentActions / AttachmentAction / AttachmentTrigger
 *                              → attachmentActionsClass() / attachmentActionClass() / attachmentTriggerClass()
 *
 * Every part takes its `data-slot`, which the styles key on.
 *
 * A11y (required for accessible output): the file name is the attachment's
 * accessible name, so keep it in real text (the title), not only in an image.
 * An image preview needs `alt` (or `alt=""` when the title already names it).
 * Each icon-only action (remove, download) is a `<button>` with an
 * `aria-label` naming the file ("Remove report.pdf"), and a trigger that opens
 * the file is a real link or button.
 *
 * Design tokens used: --border, --muted, --muted-foreground, --background.
 *
 * @example
 * ```html
 * <div class=${attachmentClass()} data-slot="attachment">
 *   <div class=${attachmentContentClass()} data-slot="attachment-content">
 *     <span class=${attachmentTitleClass()} data-slot="attachment-title">report.pdf</span>
 *     <span class=${attachmentDescriptionClass()} data-slot="attachment-description">2.4 MB</span>
 *   </div>
 * </div>
 * ```
 */
import { cn } from '../lib/utils.ts';

const ATTACHMENT_BASE =
  'cn-attachment group/attachment relative flex max-w-full min-w-0 shrink-0 flex-wrap border bg-card text-card-foreground transition-colors has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed';

const ATTACHMENT_SIZES = {
  default: 'cn-attachment-size-default',
  sm: 'cn-attachment-size-sm',
  xs: 'cn-attachment-size-xs',
} as const;

const ATTACHMENT_ORIENTATIONS = {
  horizontal: 'cn-attachment-orientation-horizontal items-center',
  vertical: 'cn-attachment-orientation-vertical flex-col',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function attachmentClass(opts: { size?: keyof typeof ATTACHMENT_SIZES; orientation?: keyof typeof ATTACHMENT_ORIENTATIONS } & { className?: string } = {}): string {
  return cn(ATTACHMENT_BASE, ATTACHMENT_SIZES[opts.size ?? 'default'], ATTACHMENT_ORIENTATIONS[opts.orientation ?? 'horizontal'], opts.className);
}

/**
 * shadcn's name for {@link attachmentClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function attachmentVariants(opts: { size?: keyof typeof ATTACHMENT_SIZES; orientation?: keyof typeof ATTACHMENT_ORIENTATIONS } & { className?: string } = {}): string {
  return attachmentClass(opts);
}

const ATTACHMENT_MEDIA_BASE =
  'cn-attachment-media relative flex aspect-square shrink-0 items-center justify-center overflow-hidden group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive [&_svg]:pointer-events-none';

const ATTACHMENT_MEDIA_VARIANTS = {
  icon: 'cn-attachment-media-variant-icon',
  image: 'cn-attachment-media-variant-image *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover',
} as const;

/** The part, with its variant options. Set its `data-slot` and any `data-variant` / `data-size` to match. */
export function attachmentMediaClass(opts: { variant?: keyof typeof ATTACHMENT_MEDIA_VARIANTS } & { className?: string } = {}): string {
  return cn(ATTACHMENT_MEDIA_BASE, ATTACHMENT_MEDIA_VARIANTS[opts.variant ?? 'icon'], opts.className);
}

/**
 * shadcn's name for {@link attachmentMediaClass}, so shadcn code ports verbatim. Like cva,
 * it merges a `className` into the result.
 */
export function attachmentMediaVariants(opts: { variant?: keyof typeof ATTACHMENT_MEDIA_VARIANTS } & { className?: string } = {}): string {
  return attachmentMediaClass(opts);
}

/** Set `data-slot="attachment-content"` on the element. */
export function attachmentContentClass(): string {
  return 'cn-attachment-content max-w-full min-w-0 flex-1';
}

/** Set `data-slot="attachment-title"` on the element. */
export function attachmentTitleClass(): string {
  return 'cn-attachment-title block max-w-full min-w-0 truncate group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer';
}

/** Set `data-slot="attachment-description"` on the element. */
export function attachmentDescriptionClass(): string {
  return 'cn-attachment-description block min-w-0 truncate text-muted-foreground group-data-[state=error]/attachment:text-destructive/80';
}

/** Set `data-slot="attachment-actions"` on the element. */
export function attachmentActionsClass(): string {
  return 'cn-attachment-actions flex shrink-0 items-center';
}

/** Set `data-slot="attachment-action"` on the element. */
export function attachmentActionClass(): string {
  return 'cn-attachment-action';
}

/** Set `data-slot="attachment-trigger"` on the element. */
export function attachmentTriggerClass(): string {
  return 'cn-attachment-trigger absolute inset-0 z-10 outline-none';
}

/** Set `data-slot="attachment-group"` on the element. */
export function attachmentGroupClass(): string {
  return 'cn-attachment-group flex min-w-0 scroll-fade-x snap-x snap-mandatory scrollbar-none overflow-x-auto overscroll-x-contain *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start';
}
