/**
 * The preview-03 files chat card: a message carrying an image and a PDF, and
 * a reply that returns two files of its own, each shown as the kit's
 * attachment. A fragment helper, rendered by the server;
 * `<preview-03-chat>` plays the turn.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/files-chat.ts`. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import { chatCard, chatItem, chatMessage, type ChatPrompt } from '../components/chat-card.ts';
import { partFile, type FilePart } from '../components/part-file.ts';
import { partText } from '../components/part-text.ts';

const SCRIPT: Array<{ user: string; userFiles: FilePart[]; text: string; files: FilePart[] }> = [
  {
    user: 'Review these files and tell me what stands out.',
    userFiles: [
      {
        filename: 'workspace.png',
        mediaType: 'image/png',
        url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80',
      },
      {
        filename: 'research-brief.pdf',
        mediaType: 'application/pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      },
    ],
    text: 'The image reads like a focused workspace, while the document should be treated as the source of record. I would summarize the PDF first, then use the image only as supporting context.',
    files: [
      {
        filename: 'annotated-workspace.png',
        mediaType: 'image/png',
        url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&auto=format&fit=crop&q=80',
      },
      {
        filename: 'file-review-notes.pdf',
        mediaType: 'application/pdf',
        url: 'https://example.com/file-review-notes.pdf',
      },
    ],
  },
];

export function filesChat() {
  const prompts: ChatPrompt[] = SCRIPT.map((t) => ({ text: t.user }));
  return chatCard({
    id: 'files-chat-prompt',
    caption: 'Files',
    title: 'File review',
    description: 'Image and document file parts.',
    prompts,
    transcript: SCRIPT.map((t, turn) => html`
      ${chatItem({
        turn, kind: 'user', id: `files-${turn}-user`, anchor: true,
        content: chatMessage({
          role: 'user',
          align: 'end',
          contentClass: 'flex-col items-end gap-2',
          content: html`${t.userFiles.map((part) => partFile({ part }))}${partText({ text: t.user, variant: 'bubble' })}`,
        }),
      })}
      ${chatItem({
        turn, kind: 'reply', id: `files-${turn}-assistant`, delay: 1000,
        content: chatMessage({
          role: 'assistant',
          align: 'start',
          contentClass: 'flex-col items-start gap-2',
          content: html`${t.files.map((part) => partFile({ part }))}${partText({ text: t.text, variant: 'default' })}`,
        }),
      })}
    `),
  });
}
