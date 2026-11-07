/**
 * Message: one entry in a conversation (a chat bubble with its avatar,
 * header and footer), and the group that stacks several. Tier-1 class
 * helper; compose with plain elements, and pair with the bubble helpers for
 * the speech bubble itself.
 *
 * shadcn parity:
 *   MessageGroup     → messageGroupClass()
 *   Message          → messageClass(), with data-align="start" | "end"
 *   MessageAvatar    → messageAvatarClass()
 *   MessageContent   → messageContentClass()
 *   MessageHeader    → messageHeaderClass()
 *   MessageFooter    → messageFooterClass()
 *
 * `data-align="end"` on the message mirrors it to the inline end (the user's
 * own messages), and the footer follows. Alignment is logical, so it flips
 * under `dir="rtl"`.
 *
 * A11y (required for accessible output): render the conversation as a list
 * (`<ol>` of messages, or `role="log"` on the container when new messages
 * arrive live, which also makes them announced). Each message should say who
 * sent it in text a screen reader reaches, the header or a visually hidden
 * name, and an avatar image needs `alt` (or `alt=""` when the name is
 * already in the header).
 *
 * Design tokens used: --muted, --muted-foreground.
 *
 * @example
 * ```html
 * <ol class=${messageGroupClass()} role="log" aria-label="Conversation">
 *   <li class=${messageClass()} data-align="end">
 *     <div class=${messageContentClass()}>
 *       <div class=${messageHeaderClass()}>You</div>
 *       <p>Can you ship it today?</p>
 *     </div>
 *   </li>
 * </ol>
 * ```
 */

/** The stack of messages. */
export function messageGroupClass(): string {
  return 'cn-message-group flex min-w-0 flex-col';
}

/** One message row. `data-align="end"` mirrors it to the inline end. */
export function messageClass(): string {
  return 'cn-message group/message relative flex w-full min-w-0 data-[align=end]:flex-row-reverse';
}

/** The sender's avatar beside the message. */
export function messageAvatarClass(): string {
  return 'cn-message-avatar flex w-fit shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-muted';
}

/** The column holding the header, the bubble and the footer. */
export function messageContentClass(): string {
  return 'cn-message-content flex w-full min-w-0 flex-col wrap-break-word';
}

/** The sender name and time above the bubble. */
export function messageHeaderClass(): string {
  return 'cn-message-header flex max-w-full min-w-0 items-center';
}

/** Actions or status below the bubble. */
export function messageFooterClass(): string {
  return 'cn-message-footer flex max-w-full min-w-0 items-center group-data-[align=end]/message:justify-end';
}
