/**
 * The preview block's live waveform card: an audio waveform drawn on a
 * canvas, which shows a "processing" wave on load, follows the microphone
 * once "Start Listening" is pressed, and switches between a mirrored static
 * view and a scrolling one. Installed by `npx @webjsdev/ui add preview` at
 * `components/preview/live-waveform.ts`. Ported from shadcn/ui's preview
 * block (its LiveWaveform component and LiveWaveformCard).
 *
 * The card's header is a fragment; the waveform and its three buttons are
 * the `<preview-live-waveform>` element, since they share state. The server
 * renders the first frame of the processing wave as an SVG, so the card reads
 * with JavaScript off; the element swaps in the canvas and animates it. With
 * `prefers-reduced-motion: reduce` the wave holds still until you listen.
 */
import { WebComponent, html, svg, signal } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const HEIGHT = 80;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_RADIUS = 1.5;
const BASE_BAR_HEIGHT = 4;
const FADE_WIDTH = 24;
const HISTORY_SIZE = 120;
const UPDATE_RATE = 30;
// The width the server draws the first frame at, about a preview card's.
const FIRST_FRAME_WIDTH = 330;

type Mode = 'static' | 'scrolling';

/** The processing wave at `time`, one value in [0.05, 1] per bar. */
function processingBars(barCount: number, time: number, mode: Mode): number[] {
  const out: number[] = [];
  const half = Math.floor(barCount / 2);
  for (let i = 0; i < barCount; i++) {
    const pos = mode === 'static' ? (i - half) / half : (i - barCount / 2) / (barCount / 2);
    const centerWeight = 1 - Math.abs(pos) * 0.4;
    const combined = mode === 'static'
      ? Math.sin(time * 1.5 + pos * 3) * 0.25 + Math.sin(time * 0.8 - pos * 2) * 0.2 + Math.cos(time * 2 + pos) * 0.15
      : Math.sin(time * 1.5 + i * 0.15) * 0.25 + Math.sin(time * 0.8 - i * 0.1) * 0.2 + Math.cos(time * 2 + i * 0.05) * 0.15;
    out.push(Math.max(0.05, Math.min(1, (0.2 + combined) * centerWeight)));
  }
  return out;
}

/** The first frame as SVG bars, faded at both edges, for the server's paint. */
function firstFrame() {
  const step = BAR_WIDTH + BAR_GAP;
  const bars = processingBars(Math.floor(FIRST_FRAME_WIDTH / step), 0.03, 'static');
  const centerY = HEIGHT / 2;
  const fade = Math.min(0.3, FADE_WIDTH / FIRST_FRAME_WIDTH);
  return html`<svg data-first-frame aria-hidden="true" class="absolute inset-0 block h-full w-full text-[gray]" viewBox=${`0 0 ${FIRST_FRAME_WIDTH} ${HEIGHT}`} preserveAspectRatio="xMinYMid meet">${svg`
    <defs>
      <linearGradient id="preview-live-waveform-fade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="white" stop-opacity="0"></stop>
        <stop offset=${fade} stop-color="white" stop-opacity="1"></stop>
        <stop offset=${1 - fade} stop-color="white" stop-opacity="1"></stop>
        <stop offset="1" stop-color="white" stop-opacity="0"></stop>
      </linearGradient>
      <mask id="preview-live-waveform-mask"><rect width="100%" height="100%" fill="url(#preview-live-waveform-fade)"></rect></mask>
    </defs>
    <g mask="url(#preview-live-waveform-mask)" fill="currentColor">
      ${bars.map((v, i) => {
        const h = Math.max(BASE_BAR_HEIGHT, v * HEIGHT * 0.8);
        return svg`<rect x=${i * step} y=${centerY - h / 2} width=${BAR_WIDTH} height=${h} rx=${BAR_RADIUS} opacity=${0.4 + v * 0.6}></rect>`;
      })}
    </g>
  `}</svg>`;
}

/**
 * `<preview-live-waveform>`: the waveform and its controls. Light DOM; the
 * canvas loop runs only while the element is connected.
 */
export class PreviewLiveWaveform extends WebComponent {
  readonly active = signal(false);
  readonly processing = signal(true);
  readonly mode = signal<Mode>('static');
  readonly _ready = signal(false);

  _canvas: HTMLCanvasElement | null = null;
  _raf = 0;
  _time = 0;
  _lastUpdate = 0;
  _bars: number[] = [];
  _history: number[] = [];
  _lastActive: number[] = [];
  _transition = 0;
  _fading = 0;
  _stream: MediaStream | null = null;
  _audio: AudioContext | null = null;
  _analyser: AnalyserNode | null = null;
  _reduced = false;
  _resize: ResizeObserver | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._ready.set(true);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._resize?.disconnect();
    this._stopMic();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._canvas = this.querySelector('canvas');
    const box = this._canvas?.parentElement;
    if (!this._canvas || !box) return;
    this._resize = new ResizeObserver(() => this._sizeCanvas());
    this._resize.observe(box);
    this._sizeCanvas();
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  _sizeCanvas() {
    const canvas = this._canvas;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const rect = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async _startMic() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this._audio = new AudioContext();
      this._analyser = this._audio.createAnalyser();
      this._analyser.fftSize = 256;
      this._analyser.smoothingTimeConstant = 0.8;
      this._audio.createMediaStreamSource(this._stream).connect(this._analyser);
      this._history = [];
    } catch {
      // No microphone, or permission refused: the bars stay at rest.
      this.active.set(false);
    }
  }

  _stopMic() {
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
    if (this._audio && this._audio.state !== 'closed') this._audio.close();
    this._audio = null;
    this._analyser = null;
  }

  _toggleActive() {
    const next = !this.active.get();
    this.active.set(next);
    if (next) {
      this.processing.set(false);
      this._startMic();
    } else {
      this._stopMic();
      this._fading = 1;
    }
  }

  _toggleProcessing() {
    const next = !this.processing.get();
    this.processing.set(next);
    if (next) {
      this._transition = 0;
      if (this.active.get()) {
        this.active.set(false);
        this._stopMic();
      }
    } else {
      this._fading = 1;
    }
  }

  _toggleMode() {
    this.mode.set(this.mode.get() === 'static' ? 'scrolling' : 'static');
  }

  _sample(width: number) {
    const analyser = this._analyser;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const relevant = data.slice(Math.floor(data.length * 0.05), Math.floor(data.length * 0.4));
    if (this.mode.get() === 'static') {
      const half = Math.floor(Math.floor(width / (BAR_WIDTH + BAR_GAP)) / 2);
      const value = (i: number) => Math.max(0.05, Math.min(1, relevant[Math.floor((i / half) * relevant.length)] / 255));
      const bars: number[] = [];
      for (let i = half - 1; i >= 0; i--) bars.push(value(i));
      for (let i = 0; i < half; i++) bars.push(value(i));
      this._bars = bars;
      this._lastActive = bars;
    } else {
      let sum = 0;
      for (const v of relevant) sum += v;
      this._history.push(Math.min(1, Math.max(0.05, sum / relevant.length / 255)));
      if (this._history.length > HISTORY_SIZE) this._history.shift();
      this._lastActive = [...this._history];
    }
  }

  _frame(now: number) {
    this._raf = requestAnimationFrame((t) => this._frame(t));
    const canvas = this._canvas;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const step = BAR_WIDTH + BAR_GAP;
    const barCount = Math.floor(rect.width / step);
    const mode = this.mode.get();
    const active = this.active.get();
    const processing = this.processing.get();

    if (active && now - this._lastUpdate > UPDATE_RATE) {
      this._lastUpdate = now;
      this._sample(rect.width);
    } else if (processing && !active && !(this._reduced && this._time > 0)) {
      this._time += 0.03;
      this._transition = Math.min(1, this._transition + 0.02);
      let bars = processingBars(barCount, this._time, mode);
      if (this._lastActive.length && this._transition < 1) {
        bars = bars.map((v, i) => {
          const last = this._lastActive[Math.min(i, this._lastActive.length - 1)] || 0;
          return last * (1 - this._transition) + v * this._transition;
        });
      }
      if (mode === 'static') this._bars = bars;
      else this._history = bars;
    } else if (!active && !processing && this._fading > 0) {
      this._fading = Math.max(0, this._fading - 0.03);
      const k = this._fading;
      this._bars = k ? this._bars.map((v) => v * k) : [];
      this._history = k ? this._history.map((v) => v * k) : [];
    }

    ctx.clearRect(0, 0, rect.width, rect.height);
    const centerY = rect.height / 2;
    ctx.fillStyle = 'gray';
    const draw = (x: number, value: number) => {
      const h = Math.max(BASE_BAR_HEIGHT, value * rect.height * 0.8);
      ctx.globalAlpha = 0.4 + value * 0.6;
      ctx.beginPath();
      ctx.roundRect(x, centerY - h / 2, BAR_WIDTH, h, BAR_RADIUS);
      ctx.fill();
    };
    if (mode === 'static') {
      for (let i = 0; i < barCount && i < this._bars.length; i++) draw(i * step, this._bars[i] || 0.1);
    } else {
      for (let i = 0; i < barCount && i < this._history.length; i++) {
        draw(rect.width - (i + 1) * step, this._history[this._history.length - 1 - i] || 0.1);
      }
    }
    if (rect.width > 0) {
      const fade = Math.min(0.3, FADE_WIDTH / rect.width);
      const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(fade, 'rgba(255,255,255,0)');
      gradient.addColorStop(1 - fade, 'rgba(255,255,255,0)');
      gradient.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  render() {
    const active = this.active.get();
    const processing = this.processing.get();
    const mode = this.mode.get();
    const ready = this._ready.get();
    const label = active ? 'Live audio waveform' : processing ? 'Processing audio' : 'Audio waveform idle';
    const button = (on: boolean, text: string, onClick: () => void) => html`<button
      type="button"
      data-slot="button"
      data-variant=${on ? 'default' : 'outline'}
      data-size="sm"
      aria-pressed=${on}
      class=${buttonClass({ variant: on ? 'default' : 'outline', size: 'sm' })}
      @click=${onClick}
    >${text}</button>`;
    return html`
      <div data-slot="card-content" class=${cardContentClass()}>
        <div role="img" aria-label=${label} class="relative h-full w-full" style=${`height: ${HEIGHT}px`}>
          ${!active && !processing ? html`<div class="absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted border-muted-foreground/20"></div>` : ''}
          ${ready ? '' : firstFrame()}
          <canvas class="block h-full w-full" aria-hidden="true"></canvas>
        </div>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'gap-2')}>
        ${button(active, `${active ? 'Stop' : 'Start'} Listening`, () => this._toggleActive())}
        ${button(processing, `${processing ? 'Stop' : 'Start'} Processing`, () => this._toggleProcessing())}
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })} @click=${() => this._toggleMode()}>${mode === 'static' ? 'Static' : 'Scrolling'}</button>
      </div>
    `;
  }
}
PreviewLiveWaveform.register('preview-live-waveform');

export function liveWaveformCard() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Live Audio Waveform</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Real-time microphone input visualization with audio reactivity</div>
      </div>
      <preview-live-waveform class="contents"></preview-live-waveform>
    </div>
  `;
}
