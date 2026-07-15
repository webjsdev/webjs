import {
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

/**
 * Full-screen mesh-gradient background, rendered as the first pass of the
 * composer so the particle `RenderPass` can draw on top of it without needing
 * a CSS `mix-blend-mode` on the canvas shell.
 *
 * Design:
 * - Shepard-style Gaussian blend of N colour "blobs". Each blob has an
 *   anisotropic sigma so ellipses, not just circles, are expressible.
 * - Mixing happens in Oklab rather than linear RGB. This matters for the
 *   yellow → orange → red → blue transition we want: linear-RGB mixing
 *   passes through a muddy dark olive between saturated warms and blues;
 *   Oklab passes through the expected hue rotation.
 * - A low-amplitude 2-octave FBM domain warp gives the blobs an organic
 *   rim instead of a mathematically perfect ellipse.
 * - Warm-tinted film grain at the end. The reference this shader was built
 *   against has *visible* grain — it reads as part of the style, not noise.
 *
 * Perf: one full-screen fragment, ~7 gaussians + FBM + one oklab→rgb per
 * pixel. At 1440p that's <0.5 ms on any modern integrated GPU. The existing
 * `UnrealBloomPass` is still 10× more expensive.
 */

const NUM_BLOBS = 9;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  #define NUM_BLOBS ${NUM_BLOBS}

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec3  uBaseColor;          // Oklab
  uniform vec2  uBlobPos[NUM_BLOBS];
  uniform vec2  uBlobSigma[NUM_BLOBS];
  uniform vec3  uBlobColor[NUM_BLOBS]; // Oklab
  uniform float uBlobGain[NUM_BLOBS];
  uniform float uGrainStrength;
  uniform float uWarpAmount;
  uniform float uBrightness;
  uniform float uSaturation;

  /* ── hash + value-noise FBM for domain warp ────────────── */

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    return vnoise(p) * 0.60
         + vnoise(p * 2.07) * 0.30
         + vnoise(p * 4.13) * 0.10;
  }

  /* ── Oklab → linear sRGB ───────────────────────────────── */
  /* Reference: https://bottosson.github.io/posts/oklab/ */

  vec3 oklabToLinearRgb(vec3 ok) {
    float l_ = ok.x + 0.3963377774 * ok.y + 0.2158037573 * ok.z;
    float m_ = ok.x - 0.1055613458 * ok.y - 0.0638541728 * ok.z;
    float s_ = ok.x - 0.0894841775 * ok.y - 1.2914855480 * ok.z;
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    return vec3(
       4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
  }

  /* ── main ─────────────────────────────────────────────── */

  void main() {
    vec2 uv = vUv;

    // Domain warp: two independent FBM samples offset the sample point so
    // blobs wobble into organic silhouettes. Amplitude stays small so we
    // don't lose the composition to noise.
    vec2 warp = vec2(
      fbm(uv * 2.3 + uTime * 0.02),
      fbm(uv * 2.3 + vec2(17.3) - uTime * 0.025)
    ) - 0.5;
    vec2 p = uv + warp * uWarpAmount;

    // Weighted average of Oklab colours. Starting the accumulator at the
    // base weight of 1.0 means "pure black wins wherever no blob reaches",
    // which is exactly the behaviour the reference image has in its upper
    // right.
    vec3 okAccum = uBaseColor;
    float wTotal = 1.0;
    for (int i = 0; i < NUM_BLOBS; i++) {
      vec2 d = (p - uBlobPos[i]) / uBlobSigma[i];
      float w = exp(-dot(d, d)) * uBlobGain[i];
      okAccum += uBlobColor[i] * w;
      wTotal  += w;
    }
    vec3 ok = okAccum / wTotal;
    // Oklab's a/b are the chroma axes, so scaling them scales saturation
    // while leaving lightness untouched. Much cleaner than an HSV boost,
    // which tends to skew hues through ugly cyan/magenta territory.
    ok.yz *= uSaturation;
    vec3 rgb = max(oklabToLinearRgb(ok), 0.0) * uBrightness;

    // Chromatic film grain: three independent hashes per pixel, so each
    // channel gets its own noise value. That turns monochrome "speckle"
    // into RGB-shifted grain — closer to a digital sensor read or a
    // colour film stock than to black-and-white grain. Seeded from pixel
    // coordinates only, so the pattern is locked to the framebuffer.
    float gR = hash12(gl_FragCoord.xy)                  - 0.5;
    float gG = hash12(gl_FragCoord.xy + vec2(13.1, 7.3)) - 0.5;
    float gB = hash12(gl_FragCoord.xy + vec2(31.7, 19.5)) - 0.5;
    rgb += vec3(gR * 0.95, gG * 1.00, gB * 1.15) * uGrainStrength;

    // 8-bit ordered-ish dither to kill banding in the long tail into black.
    rgb += (hash12(gl_FragCoord.xy + 17.3) - 0.5) / 255.0;

    gl_FragColor = vec4(rgb, 1.0);
  }
`;

/* ── JS-side colour utilities ─────────────────────────── */

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToOklab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear(((n >> 16) & 0xff) / 255);
  const g = srgbToLinear(((n >> 8) & 0xff) / 255);
  const b = srgbToLinear((n & 0xff) / 255);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lc = Math.cbrt(l);
  const mc = Math.cbrt(m);
  const sc = Math.cbrt(s);
  return [
    0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc,
    1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc,
    0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc,
  ];
}

/* ── palette ──────────────────────────────────────────── */

/**
 * Each blob is an anisotropic Gaussian. Positions are in UV space
 * (0 = bottom-left, 1 = top-right), sigmas in the same space — a sigma of
 * 0.25 means the blob reaches roughly a quarter of the viewport before
 * falling off.
 *
 * The composition follows the astrophysics false-colour convention for the
 * cosmic web: a dense central NODE that has ignited warm (a near-white gold
 * core fading through amber, where matter has clumped enough to light up),
 * ringed by cool low-density FILAMENTS (magenta-violet into deep cobalt into
 * indigo, the diffuse gas and dark matter), with the far corner pushed toward
 * a dead-black VOID. Hot bright node, cold dark filaments, black void.
 */
interface BlobDef {
  pos: [number, number];
  sigma: [number, number];
  color: string; // sRGB hex
  gain: number; // relative weight multiplier
}

// Cosmic-web false colour: a warm ignited node (white-gold core, amber glow)
// where matter has clumped, surrounded by cool low-density filaments
// (magenta-violet, cobalt, indigo) and a dead-black void in the far corner.
const DEFAULT_BLOBS: BlobDef[] = [
  { pos: [0.45, 0.56], sigma: [0.075, 0.07], color: "#ffe6c8", gain: 0.55 }, // small warm highlight (dimmed)
  { pos: [0.45, 0.56], sigma: [0.2, 0.18], color: "#a8306a", gain: 0.95 }, // deep rose-magenta core glow
  { pos: [0.42, 0.58], sigma: [0.4, 0.36], color: "#5a1f83", gain: 0.9 }, // magenta-violet filament halo
  { pos: [0.74, 0.4], sigma: [0.32, 0.34], color: "#14336e", gain: 0.85 }, // deep cobalt gas band
  { pos: [0.84, 0.66], sigma: [0.24, 0.26], color: "#8a2f6f", gain: 0.42 }, // hot-pink pocket (H-alpha)
  { pos: [0.12, 0.28], sigma: [0.28, 0.3], color: "#2a1c66", gain: 0.62 }, // indigo lower-left filament
  { pos: [0.5, 0.05], sigma: [0.5, 0.16], color: "#04030f", gain: 0.7 }, // bottom rim falloff (deeper)
  { pos: [0.92, 0.94], sigma: [0.34, 0.3], color: "#000004", gain: 0.95 }, // pull top-right to dead-black void
  { pos: [0.08, 0.9], sigma: [0.3, 0.28], color: "#01000a", gain: 0.75 }, // top-left void deepening
];

const BASE_HEX = "#02010a";

export class BackgroundPass extends Pass {
  private material: ShaderMaterial;
  private fsQuad: FullScreenQuad;

  constructor() {
    super();

    const positions = DEFAULT_BLOBS.map((b) => new Vector2(b.pos[0], b.pos[1]));
    const sigmas = DEFAULT_BLOBS.map(
      (b) => new Vector2(b.sigma[0], b.sigma[1]),
    );
    const colors = DEFAULT_BLOBS.map((b) => {
      const [l, a, bb] = hexToOklab(b.color);
      return new Vector3(l, a, bb);
    });
    const gains = DEFAULT_BLOBS.map((b) => b.gain);
    const baseOk = hexToOklab(BASE_HEX);

    this.material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
        uBaseColor: {
          value: new Vector3(baseOk[0], baseOk[1], baseOk[2]),
        },
        uBlobPos: { value: positions },
        uBlobSigma: { value: sigmas },
        uBlobColor: { value: colors },
        uBlobGain: { value: gains },
        uGrainStrength: { value: 0.012 },
        uWarpAmount: { value: 0.055 },
        uBrightness: { value: 0.42 },
        uSaturation: { value: 1.95 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.fsQuad = new FullScreenQuad(this.material);

    // The pass writes opaque pixels into the composer's read buffer;
    // subsequent passes (RenderPass with `clear = false`, then particles)
    // draw on top. `needsSwap = false` keeps the buffer sequence stable.
    this.needsSwap = false;
  }

  setSize(width: number, height: number): void {
    this.material.uniforms["uResolution"].value.set(width, height);
  }

  setTime(time: number): void {
    this.material.uniforms["uTime"].value = time;
  }

  render(
    renderer: WebGLRenderer,
    _writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    const previousTarget = renderer.getRenderTarget();
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(readBuffer);
    }
    this.fsQuad.render(renderer);
    renderer.setRenderTarget(previousTarget);
  }

  dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
