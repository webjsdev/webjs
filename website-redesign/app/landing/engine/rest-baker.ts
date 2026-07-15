import {
  ClampToEdgeWrapping,
  type DataTexture,
  FloatType,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  type Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { PRESET_GLSL, PRESET_UNIFORMS_GLSL } from "./preset-glsl.ts";

// MRT bake of "rest" particle state (position + color) into RGBA32F textures.
// One slot per morph endpoint (A, B). Each slot owns a render target with
// `count: 2` color attachments: textures[0] = pos.xyz, textures[1] = col.xyz.
//
// One texel per particle. Width stays at 512 so the `(fi mod 512, fi / 512)`
// mapping is cheap, and height is sized just big enough for the current
// particleCount (rounded to a multiple of 16 for clean alignment). Keeps the
// bake pass from running fragments outside the active range.
//
// FloatType (not HalfFloatType): half-float gives ~10 bits of mantissa, which
// quantizes positions to a step proportional to magnitude (~0.1 at ±100 units).
// That's visible as "chunky" clumps on far-from-origin presets like the
// racetrack hills. WebGL2 needs EXT_color_buffer_float for this; Three enables
// it automatically.

export const BAKE_TEX_W = 512;

/**
 * Smallest bake-target height (in texels) that fits `count` particles in a
 * 512-wide grid, rounded up to a multiple of 16. Shared between RestBaker
 * (allocates the targets, runs the bake pass) and ParticleSystem (samples
 * them from the draw VS) so the layout always matches.
 */
export function computeBakeTexHeight(count: number): number {
  const rows = Math.ceil(Math.max(count, 1) / BAKE_TEX_W);
  return Math.max(16, Math.ceil(rows / 16) * 16);
}

const BAKE_VS = /* glsl */ `
precision highp float;

in vec3 position;

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BAKE_FS = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

// Float uniforms (cast to int locally) for parity with the original draw VS,
// which used uniform float + int(...) everywhere. Avoids any int-uniform
// binding surprises with RawShaderMaterial + GLSL3.
uniform float uTime;
uniform float uPresetId;
uniform float uCount;
uniform float uCtrl[8];
${PRESET_UNIFORMS_GLSL}
${PRESET_GLSL}

layout(location = 0) out vec4 oPos;
layout(location = 1) out vec4 oCol;

void main() {
  float fi = floor(gl_FragCoord.y) * ${BAKE_TEX_W}.0 + floor(gl_FragCoord.x);
  int cnt = int(uCount);
  if (int(fi) >= cnt) {
    oPos = vec4(0.0);
    oCol = vec4(0.0);
    return;
  }
  vec3 pos, col;
  computePreset(int(uPresetId), fi, cnt, uTime,
    uCtrl[0], uCtrl[1], uCtrl[2], uCtrl[3],
    uCtrl[4], uCtrl[5], uCtrl[6], uCtrl[7],
    pos, col);
  oPos = vec4(pos, 0.0);
  oCol = vec4(col, 0.0);
}
`;

export type Slot = 0 | 1;

type SlotCache = {
  presetId: number;
  time: number;
  ctrl: Float32Array;
  carLaneOffset: number;
  carLaneActivity: number;
  carPosY: number;
};

const initCache = (): SlotCache => ({
  presetId: -1,
  time: NaN,
  ctrl: new Float32Array(8).fill(NaN),
  carLaneOffset: NaN,
  carLaneActivity: NaN,
  carPosY: NaN,
});

export class RestBaker {
  private renderer: WebGLRenderer;
  private slotA: WebGLRenderTarget;
  private slotB: WebGLRenderTarget;
  private scene: Scene;
  private camera: OrthographicCamera;
  private material: RawShaderMaterial;
  private mesh: Mesh;
  private cacheA = initCache();
  private cacheB = initCache();
  readonly bakeTexHeight: number;

  constructor(renderer: WebGLRenderer, count: number) {
    this.renderer = renderer;
    this.bakeTexHeight = computeBakeTexHeight(count);

    const targetOptions = {
      count: 2,
      type: FloatType,
      format: RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
    } as const;
    this.slotA = new WebGLRenderTarget(
      BAKE_TEX_W,
      this.bakeTexHeight,
      targetOptions,
    );
    this.slotB = new WebGLRenderTarget(
      BAKE_TEX_W,
      this.bakeTexHeight,
      targetOptions,
    );

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: BAKE_VS,
      fragmentShader: BAKE_FS,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uPresetId: { value: 0 },
        uCount: { value: 0 },
        uCtrl: { value: Array.from({ length: 8 }, () => 0) },
        uCarLaneOffset: { value: 0 },
        uCarLaneActivity: { value: 0 },
        uCarPosY: { value: 0 },
        uModelCount0: { value: 0 },
        uModelCount1: { value: 0 },
        uModelCount2: { value: 0 },
        uModelCount3: { value: 0 },
        uModelTex0: { value: null as DataTexture | null },
        uModelTex1: { value: null as DataTexture | null },
        uModelTex2: { value: null as DataTexture | null },
        uModelTex3: { value: null as DataTexture | null },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setCount(count: number) {
    if (this.material.uniforms.uCount.value === count) return;
    this.material.uniforms.uCount.value = count;
    this.invalidate();
  }

  setModelTexture(slot: number, texture: DataTexture, pointCount: number) {
    const u = this.material.uniforms;
    if (slot === 0) {
      u.uModelTex0.value = texture;
      u.uModelCount0.value = pointCount;
    } else if (slot === 1) {
      u.uModelTex1.value = texture;
      u.uModelCount1.value = pointCount;
    } else if (slot === 2) {
      u.uModelTex2.value = texture;
      u.uModelCount2.value = pointCount;
    } else {
      u.uModelTex3.value = texture;
      u.uModelCount3.value = pointCount;
    }
    this.invalidate();
  }

  setCarUniforms(laneOffset: number, laneActivity: number, posY: number) {
    const u = this.material.uniforms;
    u.uCarLaneOffset.value = laneOffset;
    u.uCarLaneActivity.value = laneActivity;
    u.uCarPosY.value = posY;
    // Cache check happens per-bake() call so we don't need to invalidate here.
  }

  /**
   * Bakes the rest pose for a slot. Returns true if the GPU pass actually ran,
   * false if all inputs match the previous bake (cache hit). Caller should
   * skip calling for the inactive endpoint when `blend < eps` to save a pass.
   */
  bake(slot: Slot, presetId: number, ctrl: number[], time: number): boolean {
    const u = this.material.uniforms;
    const cache = slot === 0 ? this.cacheA : this.cacheB;
    const carLO = u.uCarLaneOffset.value as number;
    const carLA = u.uCarLaneActivity.value as number;
    const carPY = u.uCarPosY.value as number;

    if (
      cache.presetId === presetId &&
      cache.time === time &&
      cache.carLaneOffset === carLO &&
      cache.carLaneActivity === carLA &&
      cache.carPosY === carPY &&
      ctrlMatches(cache.ctrl, ctrl)
    ) {
      return false;
    }

    u.uPresetId.value = presetId;
    u.uTime.value = time;
    const arr = u.uCtrl.value as number[];
    for (let i = 0; i < 8; i++) arr[i] = ctrl[i] ?? 0;

    const target = slot === 0 ? this.slotA : this.slotB;
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);

    cache.presetId = presetId;
    cache.time = time;
    cache.carLaneOffset = carLO;
    cache.carLaneActivity = carLA;
    cache.carPosY = carPY;
    for (let i = 0; i < 8; i++) cache.ctrl[i] = ctrl[i] ?? 0;
    return true;
  }

  /** Force re-bake on next call. Use after model-texture swap or count change. */
  invalidate() {
    this.cacheA = initCache();
    this.cacheB = initCache();
  }

  getPosTexture(slot: Slot): Texture {
    return slot === 0 ? this.slotA.textures[0] : this.slotB.textures[0];
  }

  getColTexture(slot: Slot): Texture {
    return slot === 0 ? this.slotA.textures[1] : this.slotB.textures[1];
  }

  dispose() {
    this.slotA.dispose();
    this.slotB.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

function ctrlMatches(cached: Float32Array, next: number[]): boolean {
  for (let i = 0; i < 8; i++) {
    if (cached[i] !== (next[i] ?? 0)) return false;
  }
  return true;
}
