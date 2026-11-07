import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  itemClass, itemContentClass, itemDescriptionClass, itemGroupClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';

const music = [
  {
    title: 'Midnight City Lights',
    artist: 'Neon Dreams',
    album: 'Electric Nights',
    duration: '3:45',
  },
  {
    title: 'Coffee Shop Conversations',
    artist: 'The Morning Brew',
    album: 'Urban Stories',
    duration: '4:05',
  },
  {
    title: 'Digital Rain',
    artist: 'Cyber Symphony',
    album: 'Binary Beats',
    duration: '3:30',
  },
];

export default function ItemImage() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-6">
      <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'gap-4')}>
        ${music.map((song) => html`
          <a href="#" role="listitem" data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
            <div data-slot="item-media" data-variant="image" class=${itemMediaClass({ variant: 'image' })}>
              <img src=${`https://avatar.vercel.sh/${song.title}`} alt=${song.title} width="32" height="32" class="object-cover grayscale">
            </div>
            <div data-slot="item-content" class=${itemContentClass()}>
              <div data-slot="item-title" class=${cn(itemTitleClass(), 'line-clamp-1')}>
                ${song.title} -${' '}<span class="text-muted-foreground">${song.album}</span>
              </div>
              <p data-slot="item-description" class=${itemDescriptionClass()}>${song.artist}</p>
            </div>
            <div data-slot="item-content" class=${cn(itemContentClass(), 'flex-none text-center')}>
              <p data-slot="item-description" class=${itemDescriptionClass()}>${song.duration}</p>
            </div>
          </a>
        `)}
      </div>
    </div>
  `;
}
