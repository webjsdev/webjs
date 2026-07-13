import { WebComponent, html, signal } from '@webjsdev/core';

/*
 * The vertical dot indicator on the right, ported from the Remix site's
 * section-nav. It tracks which full-height section is in view (scroll spy)
 * and lets you jump between them. Purely an enhancement, so it lives in a
 * component and renders nothing meaningful without JS.
 */

export class SectionNav extends WebComponent {
  active = signal(0);
  private _sections: HTMLElement[] = [];
  private _io: IntersectionObserver | undefined;

  connectedCallback() {
    super.connectedCallback();
    // Sections are the direct <section> children of <main>.
    const main = document.getElementById('main-content');
    this._sections = main ? Array.from(main.querySelectorAll<HTMLElement>('section[id]')) : [];

    this._io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = this._sections.indexOf(e.target as HTMLElement);
            if (i >= 0) this.active.set(i);
          }
        }
      },
      { threshold: 0.5 },
    );
    for (const s of this._sections) this._io.observe(s);
  }

  disconnectedCallback() {
    this._io?.disconnect();
    super.disconnectedCallback?.();
  }

  jump(i: number) {
    this._sections[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render() {
    const active = this.active.get();
    const n = this._sections.length || Number(this.getAttribute('data-count') || 0);
    const dots = Array.from({ length: n }, (_, i) => i);
    return html`
      <nav class="rmx-section-nav" aria-label="Sections">
        ${dots.map(i => html`
          <button
            class="rmx-section-dot"
            aria-label=${'Go to section ' + (i + 1)}
            aria-current=${i === active ? 'true' : 'false'}
            @click=${() => this.jump(i)}
          ></button>
        `)}
      </nav>
    `;
  }
}

SectionNav.register('section-nav');
