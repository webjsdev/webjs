import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Points,
  RawShaderMaterial,
  Scene,
  type Texture,
} from "three";
import { BAKE_TEX_W, computeBakeTexHeight } from "./rest-baker.ts";

// ~7% of particles get gl_PointSize scaled in [SIZE_BOOST_MIN, SIZE_BOOST_MAX].
const SIZE_BOOST_FRACTION = 0.03;
const SIZE_BOOST_MIN = 1.32;
const SIZE_BOOST_MAX = 3.05;

// Built per-init() so the bake-texture height (which depends on particleCount)
// can be inlined as a literal — saves a uniform fetch per vertex and keeps the
// uv math constant-foldable by the GLSL compiler.
function buildVertexShader(bakeTexHeight: number): string {
  return /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 position;
in float aRandom;
in float aSizeBoost;

out vec3 vColor;
out float vAlpha;
out float vViewDist;
out float vIntro;
out float vPulse;
out float vCoc;

uniform float uPointSize;
uniform float uPixelRatio;
uniform float uIntroProgress;
uniform float uDofAmount;
uniform float uDofFocus;
uniform float uTime;
uniform float uBlend;
uniform float uSeparation;
uniform float uMorphT;
uniform float uColorMode;

// Rest-pose textures filled by the bake pass. Slot A is always read; slot B is
// read only when uBlend > eps (matches the cached skip-bake on the JS side).
uniform sampler2D uPosA;
uniform sampler2D uPosB;
uniform sampler2D uColA;
uniform sampler2D uColB;

// Per-particle displacement (offset from rest pose) produced by MouseSim.
// xyz = world-space offset; w unused. Zero means "use rest pose as-is".
uniform sampler2D uDispTex;

vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if      (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);
  return rgb + m;
}

vec3 brandGradient(float ratio, float t) {
  float hue = fract(ratio + t * 0.51);
  float sat = 0.8 + sin(t + ratio * 10.0) * 0.2;
  float lum = 0.55 + 0.35 * cos(t + ratio * 3.14159);
  return hsl2rgb(hue, clamp(sat, 0.5, 1.0), clamp(lum, 0.2, 0.85));
}

void main() {
  float fi = float(gl_VertexID);

  // 1:1 with the bake render target: one texel per particle, same row-major
  // layout the bake FS writes via gl_FragCoord.
  vec2 uv = vec2(
    (mod(fi, ${BAKE_TEX_W}.0) + 0.5) / ${BAKE_TEX_W}.0,
    (floor(fi / ${BAKE_TEX_W}.0) + 0.5) / ${bakeTexHeight}.0
  );

  vec3 posA = texture(uPosA, uv).xyz;
  vec3 colA = texture(uColA, uv).xyz;

  vec3 finalPos, finalCol;
  if (uBlend > 0.001) {
    vec3 posB = texture(uPosB, uv).xyz;
    vec3 colB = texture(uColB, uv).xyz;
    finalPos = mix(posA, posB, uMorphT);
    finalCol = mix(colA, colB, uMorphT);
  } else {
    finalPos = posA;
    finalCol = colA;
  }

  float h = fi * 2.3999;
  finalPos.x += sin(h) * uSeparation;
  finalPos.y += cos(h * 1.731) * uSeparation;
  finalPos.z += sin(h * 2.419) * uSeparation;
  // Unused position attribute is kept so the linker keeps it active
  // (rest pose comes from textures); scale avoids affecting the scene.
  finalPos.xy += position.xy * 1e-7;

  // GPGPU-driven cursor distortion: the sim writes a world-space offset into
  // uDispTex each frame (spring-back to rest + cursor push + damping). When
  // the strength is zero the disp settles to ~0 and this becomes a no-op.
  finalPos += texture(uDispTex, uv).xyz;

  if (uColorMode > 1.5) {
    float spatialRatio = fract(dot(finalPos, vec3(0.018, 0.014, 0.012)));
    vec3 gradCol = brandGradient(spatialRatio, uTime * 0.25);
    float origBright = dot(finalCol, vec3(0.299, 0.587, 0.114));
    finalCol = gradCol * (0.5 + origBright * 1.5);
  } else if (uColorMode > 0.5) {
    float height = clamp((finalPos.y + 30.0) / 60.0, 0.0, 1.0);
    float pulse = 1.0 + 0.1 * sin(uTime * 2.5 + fi * 0.02);
    float lum = (0.3 + 0.5 * height) * pulse;
    finalCol = hsl2rgb(0.55 + 0.1 * height, 0.6, lum);
  }

  vColor = finalCol;

  float delay = aRandom * 0.7;
  float fallDuration = 0.5;
  float local = clamp((uIntroProgress - delay) / fallDuration, 0.0, 1.0);
  float inv = 1.0 - local;
  float easedLocal = 1.0 - inv * inv * inv;
  float landTime = delay + fallDuration;
  float sinceL = max(uIntroProgress - landTime, 0.0);
  vPulse = (local >= 1.0) ? exp(-sinceL * 8.0) : 0.0;

  float landed = step(1.0, local);
  float opacityRamp = 1.0 - exp(-sinceL * 3.0);
  vIntro = mix(easedLocal * 0.5, 0.5 + 0.5 * opacityRamp, landed);

  float introOffset = (1.0 - easedLocal) * (50.0 + aRandom * 30.0);
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  mvPosition.z -= introOffset;
  float dist = -mvPosition.z;
  vViewDist = dist;

  float baseSize = uPointSize * uPixelRatio * (300.0 / dist);
  float coc = uDofAmount > 0.0
    ? abs(dist - uDofFocus) * uDofAmount * 0.01
    : 0.0;
  vCoc = clamp(coc, 0.0, 1.0);

  gl_PointSize = clamp((baseSize + coc * 12.0) * aSizeBoost, 1.0, 128.0);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = smoothstep(500.0, 50.0, dist);
}
`;
}

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
precision highp int;

in vec3 vColor;
in float vAlpha;
in float vViewDist;
in float vIntro;
in float vPulse;
in float vCoc;

uniform float uFogEnabled;
uniform float uFogNear;
uniform float uFogFar;
uniform float uHdrIntensity;

out vec4 fragColor;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;

  float sharpness = mix(10.0, 2.0, vCoc);
  float glow = exp(-d * sharpness);
  float core = smoothstep(0.5, 0.08 + vCoc * 0.3, d);
  float alpha = (glow * 0.2 + core * 0.8) * vAlpha * vIntro;
  alpha *= mix(1.0, 0.35, vCoc);

  vec3 col = vColor * (0.8 + core * 0.4) * (1.0 + vPulse * 9.0);

  if (uFogEnabled > 0.0) {
    float fogFactor = smoothstep(uFogNear, uFogFar, vViewDist) * uFogEnabled;
    col *= 1.0 - fogFactor;
    alpha *= 1.0 - fogFactor;
  }

  col *= uHdrIntensity;

  fragColor = vec4(col, alpha);
}
`;

export class ParticleSystem {
  private points: Points | null = null;
  private geometry: BufferGeometry | null = null;
  private material: RawShaderMaterial | null = null;
  private count = 0;
  // Per-frame setter caches. NaN sentinels guarantee the first call after
  // init() always writes, since `NaN !== anything` is always true.
  private lastPointSize = NaN;
  private lastIntroProgress = NaN;
  private lastHdrIntensity = NaN;
  private lastDofAmount = NaN;
  private lastDofFocus = NaN;
  private lastSeparation = NaN;
  private lastColorMode = NaN;
  private lastMorphT = NaN;
  private lastFogIntensity = NaN;
  private lastFogNear = NaN;
  private lastFogFar = NaN;
  private lastBlend = NaN;

  private resetSetterCaches() {
    this.lastPointSize = NaN;
    this.lastIntroProgress = NaN;
    this.lastHdrIntensity = NaN;
    this.lastDofAmount = NaN;
    this.lastDofFocus = NaN;
    this.lastSeparation = NaN;
    this.lastColorMode = NaN;
    this.lastMorphT = NaN;
    this.lastFogIntensity = NaN;
    this.lastFogNear = NaN;
    this.lastFogFar = NaN;
    this.lastBlend = NaN;
  }

  init(scene: Scene, count: number, pointSize: number) {
    this.dispose(scene);
    this.count = count;
    this.resetSetterCaches();

    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const sizeBoost = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      randoms[i] = Math.random();
      sizeBoost[i] =
        Math.random() < SIZE_BOOST_FRACTION
          ? SIZE_BOOST_MIN + Math.random() * (SIZE_BOOST_MAX - SIZE_BOOST_MIN)
          : 1.0;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.geometry.setAttribute("aRandom", new BufferAttribute(randoms, 1));
    this.geometry.setAttribute("aSizeBoost", new BufferAttribute(sizeBoost, 1));

    this.material = new RawShaderMaterial({
      // Draw-only material: rest pose comes from textures filled by the bake
      // pass (see RestBaker). No preset code, no model-texture sampling, no
      // car/control uniforms — just sample two MRT textures and mix.
      glslVersion: GLSL3,
      vertexShader: buildVertexShader(computeBakeTexHeight(count)),
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPointSize: { value: pointSize },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIntroProgress: { value: 0.0 },
        uFogEnabled: { value: 0.0 },
        uFogNear: { value: 10.0 },
        uFogFar: { value: 180.0 },
        uHdrIntensity: { value: 1.0 },
        uDofAmount: { value: 0.0 },
        uDofFocus: { value: 80.0 },
        uTime: { value: 0.0 },
        uBlend: { value: 0.0 },
        uSeparation: { value: 0.0 },
        uColorMode: { value: 0.0 },
        uMorphT: { value: 0 },
        uPosA: { value: null as Texture | null },
        uPosB: { value: null as Texture | null },
        uColA: { value: null as Texture | null },
        uColB: { value: null as Texture | null },
        uDispTex: { value: null as Texture | null },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setPointSize(size: number) {
    if (!this.material || size === this.lastPointSize) return;
    this.lastPointSize = size;
    this.material.uniforms.uPointSize.value = size;
  }

  setIntroProgress(value: number) {
    if (!this.material || value === this.lastIntroProgress) return;
    this.lastIntroProgress = value;
    this.material.uniforms.uIntroProgress.value = value;
  }

  setFog(intensity: number, near: number, far: number) {
    if (!this.material) return;
    if (
      intensity === this.lastFogIntensity &&
      near === this.lastFogNear &&
      far === this.lastFogFar
    ) {
      return;
    }
    this.lastFogIntensity = intensity;
    this.lastFogNear = near;
    this.lastFogFar = far;
    this.material.uniforms.uFogEnabled.value = intensity;
    this.material.uniforms.uFogNear.value = near;
    this.material.uniforms.uFogFar.value = far;
  }

  setHdrIntensity(value: number) {
    if (!this.material || value === this.lastHdrIntensity) return;
    this.lastHdrIntensity = value;
    this.material.uniforms.uHdrIntensity.value = value;
  }

  setDof(amount: number, focus: number) {
    if (!this.material) return;
    if (amount === this.lastDofAmount && focus === this.lastDofFocus) return;
    this.lastDofAmount = amount;
    this.lastDofFocus = focus;
    this.material.uniforms.uDofAmount.value = amount;
    this.material.uniforms.uDofFocus.value = focus;
  }

  setBlend(blend: number) {
    if (!this.material || blend === this.lastBlend) return;
    this.lastBlend = blend;
    this.material.uniforms.uBlend.value = blend;
  }

  setRestTextures(posA: Texture, colA: Texture, posB: Texture, colB: Texture) {
    if (!this.material) return;
    this.material.uniforms.uPosA.value = posA;
    this.material.uniforms.uColA.value = colA;
    this.material.uniforms.uPosB.value = posB;
    this.material.uniforms.uColB.value = colB;
  }

  setTime(time: number) {
    if (this.material) this.material.uniforms.uTime.value = time;
  }

  setSeparation(value: number) {
    if (!this.material || value === this.lastSeparation) return;
    this.lastSeparation = value;
    this.material.uniforms.uSeparation.value = value;
  }

  /**
   * Bind the displacement texture from MouseSim. The sim ping-pongs between
   * two textures, so this must be called every frame with the latest one;
   * Three updates the sampler binding lazily on the next draw.
   */
  setDispTexture(disp: Texture) {
    if (!this.material) return;
    this.material.uniforms.uDispTex.value = disp;
  }

  setColorMode(value: number) {
    if (!this.material || value === this.lastColorMode) return;
    this.lastColorMode = value;
    this.material.uniforms.uColorMode.value = value;
  }

  setMorphT(value: number) {
    if (!this.material || value === this.lastMorphT) return;
    this.lastMorphT = value;
    this.material.uniforms.uMorphT.value = value;
  }

  dispose(scene?: Scene) {
    if (this.points && scene) scene.remove(this.points);
    this.geometry?.dispose();
    this.material?.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
  }
}
