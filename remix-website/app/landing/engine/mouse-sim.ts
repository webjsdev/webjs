import {
  ClampToEdgeWrapping,
  Color,
  FloatType,
  GLSL3,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RawShaderMaterial,
  Scene,
  type Texture,
  type Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { BAKE_TEX_W, computeBakeTexHeight } from "./rest-baker.ts";

// Reused so the constructor's clear-pass doesn't allocate.
const _scratchClearColor = new Color();

// GPGPU mouse displacement. First-order exponential blend toward a **screen-space**
// push: falloff uses NDC distance (same basis as particle rendering), and the
// shove aligns with camera right/up so the hole tracks the cursor through
// scene morphs / camera rotates. Ping-pong MRT retained; textures[1] cleared.

const SIM_VS = /* glsl */ `
precision highp float;

in vec3 position;

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function buildSimFs(bakeTexHeight: number): string {
  return /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uPosA;
uniform sampler2D uPosB;
uniform sampler2D uDispPrev;

uniform float uMorphT;
uniform float uBlend;       // 0 = use posA only, >eps = mix into posB

uniform mat4 uViewProj;     // projection * view (world→clip); same pipe as Points draw
uniform vec2 uMouseNDC;    // xy NDC matching Three unproject (/clip.w)
uniform float uMouseNdcRadius; // falloff sigma in NDC (−1…1 spans); scene-invariant hole size

uniform vec3 uCamRight;    // world-space camera local X (+right on image)
uniform vec3 uCamUp;       // world-space camera local Y (+up on image)

uniform float uMouseStrength; // 0 → target displacement is 0
uniform float uPushGain;
uniform float uFollowTau; // smoothing rate (/s)
uniform float uDt;
uniform float uCount;

layout(location = 0) out vec4 oDisp;
layout(location = 1) out vec4 oVel;

void main() {
  float fi = floor(gl_FragCoord.y) * ${BAKE_TEX_W}.0 + floor(gl_FragCoord.x);
  if (int(fi) >= int(uCount)) {
    oDisp = vec4(0.0);
    oVel = vec4(0.0);
    return;
  }

  vec2 uv = vec2(
    (mod(fi, ${BAKE_TEX_W}.0) + 0.5) / ${BAKE_TEX_W}.0,
    (floor(fi / ${BAKE_TEX_W}.0) + 0.5) / ${bakeTexHeight}.0
  );

  vec3 restPos = texture(uPosA, uv).xyz;
  if (uBlend > 0.001) {
    restPos = mix(restPos, texture(uPosB, uv).xyz, uMorphT);
  }

  vec3 disp = texture(uDispPrev, uv).xyz;

  vec3 worldPos = restPos + disp;

  vec4 clip = uViewProj * vec4(worldPos, 1.0);
  float wOk = step(1e-3, clip.w);
  vec2 ndcP = clip.xy / max(clip.w, 1e-3);

  vec2 delta = ndcP - uMouseNDC;
  float ndcDist2 = dot(delta, delta);
  float rr = uMouseNdcRadius * uMouseNdcRadius;
  float falloff = wOk * exp(-ndcDist2 / max(rr, 1e-6));

  // Screen-plane radial axis in world (−/+ NDC aligns with −/+ axis on framebuffer).
  vec3 radial = uCamRight * delta.x + uCamUp * delta.y;
  float rl = length(radial);
  vec3 away = rl > 1e-4 ? radial / rl : uCamRight;

  vec3 desired = away * (uMouseStrength * falloff * uPushGain);

  // Exponential approach to desired → no second-order ringing.
  float a = clamp(1.0 - exp(-uFollowTau * uDt), 0.0, 1.0);
  disp = mix(disp, desired, a);

  oDisp = vec4(disp, 0.0);
  oVel = vec4(0.0);
}
`;
}

type SimSlot = {
  target: WebGLRenderTarget;
  disp: Texture;
  vel: Texture;
};

export class MouseSim {
  private renderer: WebGLRenderer;
  private slots: [SimSlot, SimSlot];
  private current: 0 | 1 = 0;
  private scene: Scene;
  private camera: OrthographicCamera;
  private material: RawShaderMaterial;
  private mesh: Mesh;
  readonly bakeTexHeight: number;

  constructor(renderer: WebGLRenderer, count: number) {
    this.renderer = renderer;
    this.bakeTexHeight = computeBakeTexHeight(count);

    // FloatType to match RestBaker (the GPU/driver combo in this app is
    // already known-good with float MRT). HalfFloat would save ~1.5MB but
    // some Mac/Intel drivers silently zero MRT half-float writes, and the
    // savings aren't worth the debug surface.
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

    const makeSlot = (): SimSlot => {
      const target = new WebGLRenderTarget(
        BAKE_TEX_W,
        this.bakeTexHeight,
        targetOptions,
      );
      return {
        target,
        disp: target.textures[0],
        vel: target.textures[1],
      };
    };
    this.slots = [makeSlot(), makeSlot()];

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: SIM_VS,
      fragmentShader: buildSimFs(this.bakeTexHeight),
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uPosA: { value: null as Texture | null },
        uPosB: { value: null as Texture | null },
        uDispPrev: { value: null as Texture | null },
        uMorphT: { value: 0 },
        uBlend: { value: 0 },
        uViewProj: { value: new Matrix4() },
        uMouseNDC: { value: [0, 0] as number[] },
        uMouseNdcRadius: { value: 0.154 },
        uCamRight: { value: [1, 0, 0] as number[] },
        uCamUp: { value: [0, 1, 0] as number[] },
        uMouseStrength: { value: 0 },
        uPushGain: { value: 0.00285 },
        uFollowTau: { value: 36 },
        uDt: { value: 1 / 60 },
        uCount: { value: count },
      },
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // Zero out both ping-pong slots so the first step() reads (0, 0, 0) for
    // disp and vel rather than uninitialized GPU memory. WebGL2 doesn't
    // guarantee zeroed render targets across all drivers, especially with MRT.
    const prev = renderer.getRenderTarget();
    const prevClearColor = renderer.getClearColor(_scratchClearColor).getHex();
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.slots[0].target);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(this.slots[1].target);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(prev);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
  }

  /** Bind the rest-pose textures from the RestBaker. Call once after init. */
  setRestTextures(posA: Texture, posB: Texture) {
    this.material.uniforms.uPosA.value = posA;
    this.material.uniforms.uPosB.value = posB;
  }

  setBlend(blend: number) {
    this.material.uniforms.uBlend.value = blend;
  }

  setMorphT(value: number) {
    this.material.uniforms.uMorphT.value = value;
  }

  setViewProj(m: Matrix4) {
    (this.material.uniforms.uViewProj.value as Matrix4).copy(m);
  }

  /** NDC coords matching `Vector3.set(x, y, z).unproject(camera)` normalization. */
  setMouseNDC(ndcX: number, ndcY: number) {
    const v = this.material.uniforms.uMouseNDC.value as number[];
    v[0] = ndcX;
    v[1] = ndcY;
  }

  /** Gaussian sigma in normalized device coords (fraction of viewport). */
  setMouseNdcRadius(radius: number) {
    this.material.uniforms.uMouseNdcRadius.value = radius;
  }

  setCamBasis(right: Vector3, up: Vector3) {
    const r = this.material.uniforms.uCamRight.value as number[];
    const u = this.material.uniforms.uCamUp.value as number[];
    r[0] = right.x;
    r[1] = right.y;
    r[2] = right.z;
    u[0] = up.x;
    u[1] = up.y;
    u[2] = up.z;
  }

  /**
   * Cursor influence; 0 ⇒ target displacement 0 ⇒ cloud glides straight back.
   */
  setMouseStrength(value: number) {
    this.material.uniforms.uMouseStrength.value = value;
  }

  /**
   * Max displacement magnitude at falloff=1 scales as `gain * mouseStrength`;
   * set from JS so amplitude matches `cursorRepulsion × strengthScale`.
   */
  setPushGain(gain: number) {
    this.material.uniforms.uPushGain.value = gain;
  }

  /**
   * Exponential smoothing rate (1/s): higher ⇒ faster approach to disturbance
   * and faster return straight to zero when the mouse leaves → no oscillator wobble.
   */
  setFollowTau(tau: number) {
    this.material.uniforms.uFollowTau.value = tau;
  }

  setCount(count: number) {
    this.material.uniforms.uCount.value = count;
  }

  /**
   * Step the simulation by `dt` seconds. Reads the previous disp slot and
   * writes the next; swaps. `dt` is clamped for tab-switch stability.
   */
  step(dt: number) {
    const u = this.material.uniforms;
    const clampedDt = Math.min(Math.max(dt, 0), 1 / 30);
    u.uDt.value = clampedDt;

    const prev = this.slots[this.current];
    const next = this.slots[1 - this.current];
    u.uDispPrev.value = prev.disp;

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(next.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);

    this.current = (1 - this.current) as 0 | 1;
  }

  /** Latest displacement texture; bind once on the draw material. */
  getDispTexture(): Texture {
    return this.slots[this.current].disp;
  }

  dispose() {
    this.slots[0].target.dispose();
    this.slots[1].target.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
