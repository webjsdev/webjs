/**
 * The chart's geometry: Recharts' maths, ported with no dependency (#1666,
 * D10). Pure functions over numbers and strings, imported by `chart.ts`,
 * which draws with them and re-exports them, so an app reaches them through
 * the chart module.
 *
 * What is here, each matching what Recharts 3 draws for the same input:
 * the nice ticks of a numeric axis (getNiceTickValues), linear, band and
 * point scales, the d3-shape curves (linear, natural, monotone, step), the
 * bar rectangle and pie or radial sector paths with their rounded corners,
 * polar coordinates, stacking (none, sign, expand), the bar slot layout
 * (getBarPositions), and which axis labels fit (getTicks).
 *
 * A11y: none to supply. This module draws nothing; the chart that uses it
 * carries the accessible name and the keyboard access.
 */

/** A curve type, Recharts' `type` on a Line or an Area. */
export type CurveType = 'linear' | 'natural' | 'monotone' | 'monotoneX' | 'step' | 'stepBefore' | 'stepAfter';

// --------------------------------------------------------------------------
// Numbers
// --------------------------------------------------------------------------

export const RADIAN = Math.PI / 180;

// Floating point noise off: 0.1 + 0.2 stays 0.3 for tick values.
function snap(n: number): number {
  return Number(n.toPrecision(12));
}

/** A coordinate as Recharts writes one: at most four decimals, no `-0`. */
export function fmt(n: number, digits = 4): string {
  const k = 10 ** digits;
  const r = Math.round(n * k) / k;
  return String(r === 0 ? 0 : r);
}

/** A number as a tooltip shows one (`toLocaleString`, fixed to en-US so server and client agree). */
export function formatValue(v: unknown): string {
  return typeof v === 'number' ? v.toLocaleString('en-US') : String(v ?? '');
}

export function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

/** A Recharts size: a number, or a percentage of `whole`. */
export function percent(v: number | string | undefined, whole: number, fallback: number): number {
  if (v == null) return fallback;
  if (typeof v === 'number') return v;
  const s = v.trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * whole;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The width of a label in the chart's 12px font, estimated, since the server
 * cannot measure text. Used only to thin crowded axis labels.
 */
export function estimateTextWidth(text: string, fontSize = 12): number {
  let em = 0;
  for (const ch of text) {
    if (/[ilj.,:;'|!]/.test(ch)) em += 0.26;
    else if (/[mwMW]/.test(ch)) em += 0.82;
    else if (ch === ' ') em += 0.28;
    else if (/[0-9]/.test(ch)) em += 0.56;
    else if (/[A-Z]/.test(ch)) em += 0.66;
    else em += 0.52;
  }
  return em * fontSize;
}

// --------------------------------------------------------------------------
// Ticks and scales (Recharts' getNiceTickValues, ported)
// --------------------------------------------------------------------------

function digitCount(v: number): number {
  return v === 0 ? 1 : Math.floor(snap(Math.log10(Math.abs(v)))) + 1;
}

function adaptiveStep(rough: number, allowDecimals: boolean, correction: number): number {
  if (rough <= 0) return 0;
  const dc = digitCount(rough);
  const pow = 10 ** dc;
  const ratio = rough / pow;
  const scale = dc !== 1 ? 0.05 : 0.1;
  const step = snap(snap((Math.ceil(snap(ratio / scale)) + correction) * scale) * pow);
  return allowDecimals ? step : Math.ceil(step);
}

function calculateStep(min: number, max: number, count: number, allowDecimals: boolean, correction = 0): { step: number; tickMin: number; tickMax: number } {
  if (!Number.isFinite((max - min) / (count - 1))) return { step: 0, tickMin: 0, tickMax: 0 };
  const step = adaptiveStep((max - min) / (count - 1), allowDecimals, correction);
  let middle: number;
  if (min <= 0 && max >= 0) middle = 0;
  else {
    middle = (min + max) / 2;
    middle = snap(middle - (middle % step));
  }
  let below = Math.ceil(snap((middle - min) / step));
  let up = Math.ceil(snap((max - middle) / step));
  const scaleCount = below + up + 1;
  if (scaleCount > count) return calculateStep(min, max, count, allowDecimals, correction + 1);
  if (scaleCount < count) {
    if (max > 0) up += count - scaleCount;
    else below += count - scaleCount;
  }
  return { step, tickMin: snap(middle - below * step), tickMax: snap(middle + up * step) };
}

/**
 * Recharts' nice ticks for a numeric axis: `count` round values covering
 * `[min, max]`, extended past the data where that makes them rounder
 * (`[0, 305]` gives `0, 80, 160, 240, 320`).
 */
export function niceTicks(min: number, max: number, count = 5, allowDecimals = true): number[] {
  const n = Math.max(count, 2);
  const [lo, hi] = min > max ? [max, min] : [min, max];
  if (lo === hi) {
    const middleIndex = Math.floor((n - 1) / 2);
    let middle = lo;
    if (lo === 0) middle = middleIndex;
    else if (!allowDecimals || Math.abs(lo) > 1) middle = Math.floor(lo);
    return Array.from({ length: n }, (_, i) => snap(middle + (i - middleIndex)));
  }
  const { step, tickMin, tickMax } = calculateStep(lo, hi, n, allowDecimals);
  const out: number[] = [];
  if (step <= 0) return [tickMin];
  for (let v = tickMin, i = 0; v < tickMax + step * 0.1 && i < 1000; i++, v = snap(tickMin + i * step)) out.push(v);
  return min > max ? out.reverse() : out;
}

/**
 * d3's linear ticks: about `count` round values inside `[start, stop]`,
 * stepping by 1, 2 or 5 times a power of ten. Recharts uses them for an axis
 * with no tick count of its own, a radial bar chart's angle axis.
 */
export function linearTicks(start: number, stop: number, count = 10): number[] {
  const raw = Math.abs(stop - start) / count;
  if (!(raw > 0) || !Number.isFinite(raw)) return [start];
  const power = Math.floor(Math.log10(raw));
  const error = raw / 10 ** power;
  const step = (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1) * 10 ** power;
  const out: number[] = [];
  for (let v = Math.ceil(start / step) * step; v <= stop + step * 1e-9; v = snap(v + step)) out.push(snap(v));
  return out;
}

/** A linear scale from a domain onto a range. */
export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** A band scale with no padding, Recharts' category axis under bars. */
export function bandScale(count: number, start: number, end: number): { bandwidth: number; at: (i: number) => number } {
  const bandwidth = count ? (end - start) / count : 0;
  return { bandwidth, at: (i) => start + i * bandwidth };
}

/** A point scale with no padding, Recharts' category axis under lines and areas. */
export function pointScale(count: number, start: number, end: number): (i: number) => number {
  return (i) => (count <= 1 ? (start + end) / 2 : start + (i * (end - start)) / (count - 1));
}

// --------------------------------------------------------------------------
// Curves (d3-shape's curves, which Recharts draws with)
// --------------------------------------------------------------------------

export type Pt = [number, number];

function naturalControls(x: number[]): [number[], number[]] {
  const n = x.length - 1;
  const a = new Array<number>(n);
  const b = new Array<number>(n);
  const r = new Array<number>(n);
  a[0] = 0; b[0] = 2; r[0] = x[0] + 2 * x[1];
  for (let i = 1; i < n - 1; ++i) { a[i] = 1; b[i] = 4; r[i] = 4 * x[i] + 2 * x[i + 1]; }
  a[n - 1] = 2; b[n - 1] = 7; r[n - 1] = 8 * x[n - 1] + x[n];
  for (let i = 1; i < n; ++i) { const m = a[i] / b[i - 1]; b[i] -= m; r[i] -= m * r[i - 1]; }
  a[n - 1] = r[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; --i) a[i] = (r[i] - a[i + 1]) / b[i];
  b[n - 1] = (x[n] + a[n - 1]) / 2;
  for (let i = 0; i < n - 1; ++i) b[i] = 2 * x[i + 1] - a[i + 1];
  return [a, b];
}

function sgn(x: number): number {
  return x < 0 ? -1 : 1;
}

/**
 * The SVG path of a curve through `points`, as d3-shape draws it (three
 * decimals). `start` is the first command: `M` for a new path, `L` to
 * continue one (an area's baseline).
 */
export function curvePath(points: Pt[], type: CurveType = 'linear', start: 'M' | 'L' = 'M'): string {
  const p = (x: number, y: number) => `${fmt(x, 3)},${fmt(y, 3)}`;
  if (!points.length) return '';
  const [x0, y0] = points[0];
  let d = `${start}${p(x0, y0)}`;
  const n = points.length;
  if (n === 1) return d;
  if (type === 'natural') {
    if (n === 2) return `${d}L${p(points[1][0], points[1][1])}`;
    const [ax, bx] = naturalControls(points.map((q) => q[0]));
    const [ay, by] = naturalControls(points.map((q) => q[1]));
    for (let i = 0; i < n - 1; i++) d += `C${p(ax[i], ay[i])},${p(bx[i], by[i])},${p(points[i + 1][0], points[i + 1][1])}`;
    return d;
  }
  if (type === 'monotone' || type === 'monotoneX') {
    // d3's curveMonotoneX: slopes from the neighbours, never overshooting.
    const xs = points.map((q) => q[0]);
    const ys = points.map((q) => q[1]);
    if (n === 2) return `${d}L${p(xs[1], ys[1])}`;
    const slope3 = (i: number): number => {
      const h0 = xs[i] - xs[i - 1];
      const h1 = xs[i + 1] - xs[i];
      const s0 = (ys[i] - ys[i - 1]) / (h0 || (h1 < 0 ? -0 : 0));
      const s1 = (ys[i + 1] - ys[i]) / (h1 || (h0 < 0 ? -0 : 0));
      const q = (s0 * h1 + s1 * h0) / (h0 + h1);
      return (sgn(s0) + sgn(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
    };
    const slope2 = (i: number, t: number): number => {
      const h = xs[i] - xs[i - 1];
      return h ? (3 * (ys[i] - ys[i - 1]) / h - t) / 2 : t;
    };
    const t = new Array<number>(n);
    for (let i = 1; i < n - 1; i++) t[i] = slope3(i);
    t[0] = slope2(1, t[1]);
    t[n - 1] = slope2(n - 1, t[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      const dx = (xs[i + 1] - xs[i]) / 3;
      d += `C${p(xs[i] + dx, ys[i] + dx * t[i])},${p(xs[i + 1] - dx, ys[i + 1] - dx * t[i + 1])},${p(xs[i + 1], ys[i + 1])}`;
    }
    return d;
  }
  if (type === 'step' || type === 'stepBefore' || type === 'stepAfter') {
    const k = type === 'step' ? 0.5 : type === 'stepBefore' ? 0 : 1;
    for (let i = 1; i < n; i++) {
      const [px, py] = points[i - 1];
      const [x, y] = points[i];
      if (k <= 0) d += `L${p(px, y)}L${p(x, y)}`;
      else { const x1 = px * (1 - k) + x * k; d += `L${p(x1, py)}L${p(x1, y)}`; }
    }
    if (k > 0 && k < 1) d += `L${p(points[n - 1][0], points[n - 1][1])}`;
    return d;
  }
  for (let i = 1; i < n; i++) d += `L${p(points[i][0], points[i][1])}`;
  return d;
}

// --------------------------------------------------------------------------
// Shapes (Recharts' Rectangle and Sector paths)
// --------------------------------------------------------------------------

/** A bar: Recharts' rectangle path, `radius` one number or `[tl, tr, br, bl]`. */
export function rectanglePath(x: number, y: number, width: number, height: number, radius: number | number[] = 0): string {
  const w = Math.round(width * 1e4) / 1e4;
  const h = Math.round(height * 1e4) / 1e4;
  const maxR = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
  const ys = h >= 0 ? 1 : -1;
  const xs = w >= 0 ? 1 : -1;
  const cw = (h >= 0 && w >= 0) || (h < 0 && w < 0) ? 1 : 0;
  const r4 = Array.isArray(radius) ? radius : radius > 0 ? [radius, radius, radius, radius] : null;
  if (maxR > 0 && r4) {
    const r = [0, 1, 2, 3].map((i) => Math.min(r4[i] ?? 0, maxR));
    let d = `M${fmt(x)},${fmt(y + ys * r[0])}`;
    if (r[0] > 0) d += `A ${fmt(r[0])},${fmt(r[0])},0,0,${cw},${fmt(x + xs * r[0])},${fmt(y)}`;
    d += `L ${fmt(x + width - xs * r[1])},${fmt(y)}`;
    if (r[1] > 0) d += `A ${fmt(r[1])},${fmt(r[1])},0,0,${cw},${fmt(x + width)},${fmt(y + ys * r[1])}`;
    d += `L ${fmt(x + width)},${fmt(y + height - ys * r[2])}`;
    if (r[2] > 0) d += `A ${fmt(r[2])},${fmt(r[2])},0,0,${cw},${fmt(x + width - xs * r[2])},${fmt(y + height)}`;
    d += `L ${fmt(x + xs * r[3])},${fmt(y + height)}`;
    if (r[3] > 0) d += `A ${fmt(r[3])},${fmt(r[3])},0,0,${cw},${fmt(x)},${fmt(y + height - ys * r[3])}`;
    return `${d}Z`;
  }
  return `M ${fmt(x)},${fmt(y)} h ${fmt(width)} v ${fmt(height)} h ${fmt(-width)} Z`;
}

/** Recharts' polar coordinates: degrees counter-clockwise from three o'clock. */
export function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(-RADIAN * angle) * radius, y: cy + Math.sin(-RADIAN * angle) * radius };
}

export interface SectorGeometry {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius?: number;
}

function tangentCircle(cx: number, cy: number, radius: number, angle: number, sign: number, isExternal: boolean, cornerRadius: number) {
  const centerRadius = cornerRadius * (isExternal ? 1 : -1) + radius;
  const theta = Math.asin(cornerRadius / centerRadius) / RADIAN;
  const centerAngle = angle + sign * theta;
  const circleTangency = polarToCartesian(cx, cy, radius, centerAngle);
  const lineTangency = polarToCartesian(cx, cy, centerRadius * Math.cos(theta * RADIAN), angle);
  return { circleTangency, lineTangency, theta };
}

/** A pie slice or radial bar: Recharts' sector path, with rounded corners when asked. */
export function sectorPath(s: SectorGeometry): string {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle } = s;
  if (outerRadius < innerRadius || startAngle === endAngle) return '';
  const cr = Math.min(s.cornerRadius ?? 0, (outerRadius - innerRadius) / 2);
  const sign = Math.sign(endAngle - startAngle) || 1;
  if (cr > 0 && Math.abs(startAngle - endAngle) < 360) {
    const so = tangentCircle(cx, cy, outerRadius, startAngle, sign, false, cr);
    const eo = tangentCircle(cx, cy, outerRadius, endAngle, -sign, false, cr);
    const outerArc = Math.abs(startAngle - endAngle) - so.theta - eo.theta;
    if (outerArc >= 0) {
      const P = (q: { x: number; y: number }) => `${fmt(q.x)},${fmt(q.y)}`;
      let d = `M ${P(so.lineTangency)} A${fmt(cr)},${fmt(cr)},0,0,${+(sign < 0)},${P(so.circleTangency)} A${fmt(outerRadius)},${fmt(outerRadius)},0,${+(outerArc > 180)},${+(sign < 0)},${P(eo.circleTangency)} A${fmt(cr)},${fmt(cr)},0,0,${+(sign < 0)},${P(eo.lineTangency)}`;
      if (innerRadius > 0) {
        const si = tangentCircle(cx, cy, innerRadius, startAngle, sign, true, cr);
        const ei = tangentCircle(cx, cy, innerRadius, endAngle, -sign, true, cr);
        const innerArc = Math.abs(startAngle - endAngle) - si.theta - ei.theta;
        d += `L${P(ei.lineTangency)} A${fmt(cr)},${fmt(cr)},0,0,${+(sign < 0)},${P(ei.circleTangency)} A${fmt(innerRadius)},${fmt(innerRadius)},0,${+(innerArc > 180)},${+(sign > 0)},${P(si.circleTangency)} A${fmt(cr)},${fmt(cr)},0,0,${+(sign < 0)},${P(si.lineTangency)}Z`;
      } else d += `L${fmt(cx)},${fmt(cy)}Z`;
      return d;
    }
  }
  const delta = sign * Math.min(Math.abs(endAngle - startAngle), 359.999);
  const end = startAngle + delta;
  const os = polarToCartesian(cx, cy, outerRadius, startAngle);
  const oe = polarToCartesian(cx, cy, outerRadius, end);
  const large = +(Math.abs(delta) > 180);
  let d = `M ${fmt(os.x)},${fmt(os.y)} A ${fmt(outerRadius)},${fmt(outerRadius)},0,${large},${+(startAngle > end)},${fmt(oe.x)},${fmt(oe.y)}`;
  if (innerRadius > 0) {
    const is = polarToCartesian(cx, cy, innerRadius, startAngle);
    const ie = polarToCartesian(cx, cy, innerRadius, end);
    d += ` L ${fmt(ie.x)},${fmt(ie.y)} A ${fmt(innerRadius)},${fmt(innerRadius)},0,${large},${+(startAngle <= end)},${fmt(is.x)},${fmt(is.y)} Z`;
  } else d += ` L ${fmt(cx)},${fmt(cy)} Z`;
  return d;
}

/** A closed polygon through `points` (a radar's area, a polar grid ring). */
export function polygonPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  return `${points.map((q, i) => `${i ? 'L' : 'M'}${fmt(q.x)},${fmt(q.y)}`).join('')}L${fmt(points[0].x)},${fmt(points[0].y)}Z`;
}

// --------------------------------------------------------------------------
// Stacking
// --------------------------------------------------------------------------

/**
 * Stack `keys` over `data`: for each key, the `[low, high]` band of every
 * row. `expand` normalises each row to 0..1 (Recharts' `stackOffset="expand"`),
 * `sign` stacks negative values downward from zero, as Recharts does for bars.
 */
export function stackData(data: Array<Record<string, unknown>>, keys: string[], offset: 'none' | 'expand' | 'sign' = 'none'): Record<string, Array<[number, number]>> {
  const out: Record<string, Array<[number, number]>> = {};
  for (const k of keys) out[k] = [];
  data.forEach((row) => {
    const total = keys.reduce((s, k) => s + Math.abs(num(row[k])), 0) || 1;
    let pos = 0;
    let neg = 0;
    for (const k of keys) {
      let v = num(row[k]);
      if (offset === 'expand') v /= total;
      if (offset === 'sign' && v < 0) { out[k].push([neg + v, neg]); neg += v; }
      else { out[k].push([pos, pos + v]); pos += v; }
    }
  });
  return out;
}

// --------------------------------------------------------------------------
// Axis ticks (Recharts' getTicks: which labels fit)
// --------------------------------------------------------------------------

export interface Tick { value: unknown; label: unknown; coord: number; at?: number }

function isVisible(sign: number, pos: number, size: number, start: number, end: number): boolean {
  if (sign * pos < sign * start || sign * pos > sign * end) return false;
  return sign * (pos - (sign * size) / 2 - start) >= 0 && sign * (pos + (sign * size) / 2 - end) <= 0;
}

/**
 * The ticks an axis shows: every one that fits, keeping the last (Recharts'
 * default `preserveEnd`), `minTickGap` apart. A number keeps every nth + 1.
 */
export function visibleTicks(ticks: Tick[], sizeOf: (t: Tick) => number, start: number, end: number, minTickGap = 5, interval: number | 'preserveEnd' | 'preserveStart' | 'preserveStartEnd' = 'preserveEnd'): Tick[] {
  if (typeof interval === 'number') return ticks.filter((_, i) => i % (interval + 1) === 0).map((t) => ({ ...t, at: t.coord }));
  const sign = ticks.length >= 2 ? Math.sign(ticks[1].coord - ticks[0].coord) || 1 : 1;
  let [s, e] = sign === 1 ? [start, end] : [end, start];
  const out: Array<Tick & { show?: boolean }> = ticks.map((t) => ({ ...t, at: t.coord }));
  const len = out.length;
  if (interval === 'preserveEnd') {
    for (let i = len - 1; i >= 0; i--) {
      const t = out[i];
      const size = sizeOf(t);
      if (i === len - 1) {
        const gap = sign * (t.coord + (sign * size) / 2 - e);
        t.at = gap > 0 ? t.coord - gap * sign : t.coord;
      }
      if (isVisible(sign, t.at ?? t.coord, size, s, e)) {
        e = (t.at ?? t.coord) - sign * (size / 2 + minTickGap);
        t.show = true;
      }
    }
  } else {
    let count = len;
    if (interval === 'preserveStartEnd' && len) {
      const tail = out[len - 1];
      const size = sizeOf(tail);
      const gap = sign * (tail.coord + (sign * size) / 2 - e);
      tail.at = gap > 0 ? tail.coord - gap * sign : tail.coord;
      if (isVisible(sign, tail.at, size, s, e)) { e = tail.at - sign * (size / 2 + minTickGap); tail.show = true; }
      count = len - 1;
    }
    for (let i = 0; i < count; i++) {
      const t = out[i];
      const size = sizeOf(t);
      if (i === 0) {
        const gap = sign * (t.coord - (sign * size) / 2 - s);
        t.at = gap < 0 ? t.coord - gap * sign : t.coord;
      }
      if (isVisible(sign, t.at ?? t.coord, size, s, e)) { s = (t.at ?? t.coord) + sign * (size / 2 + minTickGap); t.show = true; }
    }
  }
  return out.filter((t) => t.show);
}

// --------------------------------------------------------------------------
// Bar layout
// --------------------------------------------------------------------------

/** Recharts' getBarPositions: each bar slot's offset into its band and its size. */
export function barPositions(bandSize: number, slots: Array<{ barSize?: number }>, barGap: number | string = 4, barCategoryGap: number | string = '10%', maxBarSize?: number): Array<{ offset: number; size: number }> {
  const len = slots.length;
  if (!len) return [];
  let gap = percent(barGap, bandSize, 0);
  if (slots[0].barSize != null) {
    let useFull = false;
    let full = bandSize / len;
    let sum = slots.reduce((s, x) => s + (x.barSize ?? 0), 0) + (len - 1) * gap;
    if (sum >= bandSize) { sum -= (len - 1) * gap; gap = 0; }
    if (sum >= bandSize && full > 0) { useFull = true; full *= 0.9; sum = len * full; }
    let prev = { offset: Math.trunc((bandSize - sum) / 2) - gap, size: 0 };
    return slots.map((x) => (prev = { offset: prev.offset + prev.size + gap, size: useFull ? full : x.barSize ?? 0 }));
  }
  const offset = percent(barCategoryGap, bandSize, 0);
  if (bandSize - 2 * offset - (len - 1) * gap <= 0) gap = 0;
  let original = (bandSize - 2 * offset - (len - 1) * gap) / len;
  if (original > 1) original = Math.trunc(original);
  const size = maxBarSize != null ? Math.min(original, maxBarSize) : original;
  return slots.map((_, i) => ({ offset: offset + (original + gap) * i + (original - size) / 2, size }));
}
