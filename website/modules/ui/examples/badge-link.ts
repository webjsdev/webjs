import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { ArrowUpRightIcon } from '#lib/ui/lucide.ts';

export default function BadgeAsLink() {
  return html`
    <a href="#link" data-slot="badge" data-variant="default" class=${badgeClass()}>
      Open Link ${ArrowUpRightIcon()}
    </a>
  `;
}
