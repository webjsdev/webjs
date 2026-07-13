import { WebComponent, html } from '@webjsdev/core';
import { labelState } from '../app/landing/label-bus.ts';

/*
 * The floating "FRONTEND" / "EVERYTHING IN BETWEEN" text labels, ported from
 * the Remix landing `LabelOverlay`. The particle boot loop projects each
 * preset's 3D label anchors to screen space every frame and writes the result
 * into the shared `labelState` bus; this component reads that bus in its own
 * requestAnimationFrame tick and imperatively creates / updates / removes the
 * label <div>s and their SVG connector <line>s inside its own light DOM.
 *
 * It renders a static shell (a fixed, click-through container holding an <svg>)
 * at SSR; all label geometry is applied client-side. With JS off it is an empty
 * decorative overlay, so it is a pure progressive enhancement.
 */
export class LabelOverlay extends WebComponent {
  private _shell: HTMLDivElement | null = null;
  private _svg: SVGSVGElement | null = null;
  private _frameId = 0;
  private _labelEls = new Map<string, HTMLDivElement>();
  private _lineEls = new Map<string, SVGLineElement>();

  connectedCallback() {
    super.connectedCallback();
    if (!this._frameId) {
      this._frameId = requestAnimationFrame(this._tick);
    }
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._frameId);
    this._frameId = 0;
    this._labelEls.forEach((el) => el.remove());
    this._lineEls.forEach((el) => el.remove());
    this._labelEls.clear();
    this._lineEls.clear();
    this._shell = null;
    this._svg = null;
    super.disconnectedCallback?.();
  }

  private _tick = () => {
    const shell =
      this._shell ??
      (this._shell = this.querySelector<HTMLDivElement>('.rmx-label-overlay-shell'));
    const svg = this._svg ?? (this._svg = this.querySelector<SVGSVGElement>('svg'));

    if (!shell || !svg) {
      this._frameId = requestAnimationFrame(this._tick);
      return;
    }

    shell.style.opacity = String(labelState.opacity);
    const activeIds = new Set<string>();

    for (const label of labelState.labels) {
      activeIds.add(label.id);

      if (!label.visible) {
        this._labelEls.get(label.id)?.remove();
        this._labelEls.delete(label.id);
        this._lineEls.get(label.id)?.remove();
        this._lineEls.delete(label.id);
        continue;
      }

      let labelEl = this._labelEls.get(label.id);
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.style.position = 'absolute';
        labelEl.style.transform = 'translate(-100%, -100%)';
        labelEl.style.fontFamily =
          'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        labelEl.style.fontSize = '10px';
        labelEl.style.fontWeight = '400';
        labelEl.style.textTransform = 'uppercase';
        labelEl.style.color = label.color ?? '#BFC7E2';
        labelEl.style.whiteSpace = 'nowrap';
        labelEl.style.padding = '4px 6px';
        labelEl.style.border = `1px solid ${label.color ?? '#BFC7E2'}`;
        labelEl.style.boxShadow =
          '0 0 2px rgba(191, 199, 226, 0.25), 0 0 6px rgba(191, 199, 226, 0.2), 0 0 14px rgba(191, 199, 226, 0.15), 0 0 20px rgba(191, 199, 226, 0.1), 0 0 30px rgba(191, 199, 226, 0.08)';
        labelEl.style.textShadow =
          '0 0 2px rgba(191, 199, 226, 0.3), 0 0 6px rgba(191, 199, 226, 0.2), 0 0 14px rgba(191, 199, 226, 0.15)';
        labelEl.textContent = label.text;
        shell.appendChild(labelEl);
        this._labelEls.set(label.id, labelEl);
      }

      labelEl.style.left = `${label.labelX}px`;
      labelEl.style.top = `${label.labelY}px`;

      let lineEl = this._lineEls.get(label.id);
      if (!lineEl) {
        lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineEl.setAttribute('stroke', '#BFC7E2');
        lineEl.setAttribute('stroke-width', '1');
        lineEl.setAttribute('stroke-opacity', '0.7');
        svg.appendChild(lineEl);
        this._lineEls.set(label.id, lineEl);
      }

      lineEl.setAttribute('x1', String(label.labelX));
      lineEl.setAttribute('y1', String(label.labelY));
      lineEl.setAttribute('x2', String(label.anchorX));
      lineEl.setAttribute('y2', String(label.anchorY));
    }

    for (const [id, element] of this._labelEls) {
      if (!activeIds.has(id)) {
        element.remove();
        this._labelEls.delete(id);
      }
    }

    for (const [id, element] of this._lineEls) {
      if (!activeIds.has(id)) {
        element.remove();
        this._lineEls.delete(id);
      }
    }

    this._frameId = requestAnimationFrame(this._tick);
  };

  render() {
    return html`
      <div
        class="rmx-label-overlay-shell"
        aria-hidden="true"
        style="position:fixed;inset:0;pointer-events:none;z-index:8;transition:opacity 0.4s ease;opacity:0"
      >
        <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible"></svg>
      </div>
    `;
  }
}

LabelOverlay.register('label-overlay');
