import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Carousel docs page body, ported from shadcn's
 * content/docs/components/radix/carousel.mdx (#1666, D15): the same sections
 * in the same order, the prose rewritten where it describes Embla, which the
 * kit does not use (its carousel is CSS scroll snap).
 */
/** The demo shown above the Installation section. */
export const demo = 'carousel-demo';

/** Between the lead demo and Installation. */
export async function intro(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'About')}
    <p>The carousel component is built on CSS scroll snap, so the slides scroll and snap natively by touch, trackpad and wheel with no JavaScript. The <code>&lt;ui-carousel&gt;</code> element adds the previous and next buttons, the arrow keys, and methods for stepping through the slides.</p>
  `;
}

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import '#components/ui/carousel.ts';`, { lineNumbers: true })}
    ${codeFigure(`<ui-carousel>
  <ui-carousel-content>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
  </ui-carousel-content>
  <ui-carousel-previous></ui-carousel-previous>
  <ui-carousel-next></ui-carousel-next>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a carousel:</p>
    ${codeFigure(`ui-carousel
├── ui-carousel-content
│   ├── ui-carousel-item
│   └── ui-carousel-item
├── ui-carousel-previous
└── ui-carousel-next`, { lang: 'text' })}

    ${heading(toc, 2, 'Sizes')}
    <p>To set the size of the items, you can use the <code>basis</code> utility class on the <code>&lt;ui-carousel-item&gt;</code>.</p>
    ${await componentPreview('carousel-size')}
    ${codeFigure(`<!-- 33% of the carousel width. -->
<ui-carousel>
  <ui-carousel-content>
    <ui-carousel-item class="basis-1/3">...</ui-carousel-item>
    <ui-carousel-item class="basis-1/3">...</ui-carousel-item>
    <ui-carousel-item class="basis-1/3">...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}
    ${codeFigure(`<!-- 50% on small screens and 33% on larger screens. -->
<ui-carousel>
  <ui-carousel-content>
    <ui-carousel-item class="md:basis-1/2 lg:basis-1/3">...</ui-carousel-item>
    <ui-carousel-item class="md:basis-1/2 lg:basis-1/3">...</ui-carousel-item>
    <ui-carousel-item class="md:basis-1/2 lg:basis-1/3">...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Spacing')}
    <p>Each item carries a start padding and the track inside <code>&lt;ui-carousel-content&gt;</code> a matching negative start margin, <code>ps-4</code> and <code>-ms-4</code> by default. To change the spacing, set a <code>ps-[VALUE]</code> utility on the <code>&lt;ui-carousel-item&gt;</code> and the negative margin on the track from <code>&lt;ui-carousel-content&gt;</code>.</p>
    ${await componentPreview('carousel-spacing')}
    ${codeFigure(`<ui-carousel>
  <ui-carousel-content class="[&_[data-slot=carousel-content]>div]:-ms-4">
    <ui-carousel-item class="ps-4">...</ui-carousel-item>
    <ui-carousel-item class="ps-4">...</ui-carousel-item>
    <ui-carousel-item class="ps-4">...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}
    ${codeFigure(`<ui-carousel>
  <ui-carousel-content class="[&_[data-slot=carousel-content]>div]:-ms-2 md:[&_[data-slot=carousel-content]>div]:-ms-4">
    <ui-carousel-item class="ps-2 md:ps-4">...</ui-carousel-item>
    <ui-carousel-item class="ps-2 md:ps-4">...</ui-carousel-item>
    <ui-carousel-item class="ps-2 md:ps-4">...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Orientation')}
    <p>Use the <code>orientation</code> attribute to set the orientation of the carousel. A vertical carousel needs a height on <code>&lt;ui-carousel-content&gt;</code>.</p>
    ${await componentPreview('carousel-orientation', { previewClass: 'h-[32rem]' })}
    ${codeFigure(`<ui-carousel orientation="vertical | horizontal">
  <ui-carousel-content>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Options')}
    <p>The carousel is native CSS scroll snap, and slides snap to their start. The one option is the <code>loop</code> attribute, which makes the previous and next buttons (and the arrow keys) wrap around at the ends.</p>
    ${codeFigure(`<ui-carousel loop>
  <ui-carousel-content>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
  </ui-carousel-content>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'API')}
    <p>The <code>&lt;ui-carousel&gt;</code> element is the API: query it and call its methods, or read its state.</p>
    ${await componentPreview('carousel-api', { previewClass: 'sm:h-[32rem]' })}
    ${codeFigure(`import { WebComponent, html, signal } from '@webjsdev/core';
import '#components/ui/carousel.ts';

class SlideCounter extends WebComponent {
  current = signal(1);
  count = signal(0);

  firstUpdated() {
    const carousel = this.querySelector('ui-carousel')!;
    this.count.set(carousel.querySelectorAll('ui-carousel-item').length);
    this.current.set(carousel.selectedIndex + 1);
  }

  render() {
    return html\`
      <ui-carousel @ui-slide-change=\${(e: CustomEvent<{ index: number }>) => this.current.set(e.detail.index + 1)}>
        <ui-carousel-content>
          <ui-carousel-item>...</ui-carousel-item>
          <ui-carousel-item>...</ui-carousel-item>
          <ui-carousel-item>...</ui-carousel-item>
        </ui-carousel-content>
      </ui-carousel>
      <div>Slide \${this.current.get()} of \${this.count.get()}</div>
    \`;
  }
}
SlideCounter.register('slide-counter');`, { lineNumbers: true })}

    ${heading(toc, 2, 'Events')}
    <p>The carousel dispatches a bubbling <code>ui-slide-change</code> event whenever the selected slide changes, with the new index in <code>detail.index</code>.</p>
    ${codeFigure(`const carousel = document.querySelector('ui-carousel');

carousel.addEventListener('ui-slide-change', (e) => {
  // Do something on select.
  console.log(e.detail.index);
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'Plugins')}
    <p>Add behaviour such as autoplay with a few lines in a component of your own that steps the carousel with <code>scrollNext()</code>, here with <code>loop</code> so it wraps back to the first slide.</p>
    ${codeFigure(`import { WebComponent, html } from '@webjsdev/core';
import '#components/ui/carousel.ts';

class AutoplayCarousel extends WebComponent {
  timer = 0;

  connectedCallback() {
    super.connectedCallback();
    const carousel = this.querySelector('ui-carousel')!;
    this.timer = window.setInterval(() => carousel.scrollNext(), 2000);
    // Stop on interaction.
    carousel.addEventListener('pointerdown', () => clearInterval(this.timer), { once: true });
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    super.disconnectedCallback();
  }

  render() {
    return html\`<ui-carousel loop>...</ui-carousel>\`;
  }
}
AutoplayCarousel.register('autoplay-carousel');`, { lineNumbers: true })}
    ${await componentPreview('carousel-plugin', { previewClass: 'sm:h-[32rem]' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('carousel-rtl', { direction: 'rtl', previewClass: 'h-80 sm:h-[32rem]' })}
    <p>When localizing the carousel for RTL languages, set <code>dir</code> on the carousel or any ancestor. The carousel reads its direction from the page, so it scrolls the right way, the arrow keys swap, and the navigation buttons flip their icons on their own.</p>
    ${codeFigure(`<ui-carousel dir="rtl">
  <ui-carousel-content>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
    <ui-carousel-item>...</ui-carousel-item>
  </ui-carousel-content>
  <ui-carousel-previous></ui-carousel-previous>
  <ui-carousel-next></ui-carousel-next>
</ui-carousel>`, { lineNumbers: true })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-carousel')}
    <p>The root. It renders a <code>role="region"</code> with <code>aria-roledescription="carousel"</code>; name it with <code>aria-label</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
          <tr><td><code>loop</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>aria-label</code></td><td><code>string</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Member</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>scrollPrev()</code></td><td><code>() =&gt; void</code></td><td>Step back one slide (to the last with <code>loop</code>).</td></tr>
          <tr><td><code>scrollNext()</code></td><td><code>() =&gt; void</code></td><td>Step on one slide (to the first with <code>loop</code>).</td></tr>
          <tr><td><code>scrollTo(index)</code></td><td><code>(index: number) =&gt; void</code></td><td>Scroll slide <code>index</code> to the start.</td></tr>
          <tr><td><code>selectedIndex</code></td><td><code>number</code></td><td>The slide nearest the start.</td></tr>
          <tr><td><code>canScrollPrev</code></td><td><code>boolean</code></td><td>Whether there is a slide before.</td></tr>
          <tr><td><code>canScrollNext</code></td><td><code>boolean</code></td><td>Whether there is a slide after.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Event</th><th>Detail</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>ui-slide-change</code></td><td><code>{ index: number }</code></td><td>The selected slide changed.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'ui-carousel-content')}
    <p>The scroller. It holds the slides and takes the height of a vertical carousel.</p>

    ${heading(toc, 3, 'ui-carousel-item')}
    <p>One slide, a <code>role="group"</code> with <code>aria-roledescription="slide"</code>. Size it with a <code>basis-*</code> class.</p>

    ${heading(toc, 3, 'ui-carousel-previous / ui-carousel-next')}
    <p>The buttons, named "Previous slide" and "Next slide" and disabled at the ends. They sit outside the carousel's edges, so leave room beside it.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "outline" | "ghost" | "destructive" | "secondary" | "link"</code></td><td><code>"outline"</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"</code></td><td><code>"icon-sm"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
