/*
 * Bridge between the <particle-bg> component and the ported Three.js engine.
 *
 * This is a framework-free port of the Remix landing WebGL orchestration:
 * the `maybeInit()` + `animate()` loop from `particle-canvas.tsx` and the
 * scroll -> morphValue mapping + model loading from `landing-enhancements.tsx`,
 * collapsed into a single `startParticles(canvas)` entry point. Everything
 * (particle morph, camera lerp + parallax, bloom, afterimage trail, fog, mouse
 * sim, and the floating text labels) is ported faithfully. Per-frame label
 * projection writes into the shared `labelState` bus, which the separate
 * <label-overlay> component reads to render the DOM labels + connector lines.
 */
import { Matrix4, Vector3 } from 'three';
import { Engine } from './engine/engine.ts';
import { ParticleSystem } from './engine/particles.ts';
import { RestBaker } from './engine/rest-baker.ts';
import { MouseSim } from './engine/mouse-sim.ts';
import { presets } from './engine/presets.ts';
import { ControlManager } from './engine/controls.ts';
import { projectLabelsInto } from './engine/label-projection.ts';
import { labelState } from './label-bus.ts';
import { loadModelPoints, type ModelData } from './engine/model-loader.ts';
import { createModelTexture } from './engine/model-texture.ts';
import { getMorphBlend, type MorphBlend } from './engine/morph.ts';
import {
  DEFAULT_SETTINGS,
  type Preset,
  type ShaderId,
  type SystemSettings,
} from './engine/types.ts';
import { clamp, clamp01, lerp } from './utils/math.ts';
import { initReducedMotion, reducedMotion } from './utils/reduced-motion.ts';

// --- Constants ported from particle-canvas.tsx -----------------------------

// Must match `LOADING_SCREEN_MIN_MS` in the loading screen (1s).
const PARTICLE_INTRO_DELAY_S = 1;
const DEFAULT_CAM_POS: [number, number, number] = [0, 30, 80];
const DEFAULT_CAM_TARGET: [number, number, number] = [0, 0, 0];
const CAM_LERP_SPEED = 0.025;

/**
 * Maps each `ShaderId` to the integer expected by the `computePreset` switch
 * in the particle shader. Single source of truth coupling JS to GLSL.
 */
const SHADER_ID_TO_INT: Record<ShaderId, number> = {
  racetrack: 0,
  racecar: 1,
  runner: 2,
  remixLogo: 3,
  racetrackCar: 4,
};

const MOUSE_RANGE = 1;
const MOUSE_LERP = 0.04;
const CAR_LANE_LERP = 0.06;
const ACTIVITY_DECAY = 0.97;
const ACTIVITY_GAIN = 20.0;
const RACETRACK_MOUSE_STRAFE_ATTENUATION = 0.4;
const RACETRACK_MOUSE_STRAFE_OF_TRACKW = 0.18;

const MOUSE_SIM_STRENGTH_SCALE = 3900;
const MOUSE_SIM_REPULSION_REF = 0.2;
const MOUSE_SIM_PEAK_DISP = 17.0;
const MOUSE_SIM_FOLLOW_TAU = 10;
const MOUSE_SIM_NDC_RADIUS = 0.154;
const MOUSE_SIM_VEL_SMOOTH_TAU = 22;
const MOUSE_SIM_VEL_GATE = 0.14;
const MOUSE_SIM_VEL_FULL = 5.5;
const MOUSE_SIM_BRUSH_SMOOTH_TAU = 14;
const MOUSE_SIM_PUSH_GAIN =
  MOUSE_SIM_PEAK_DISP / (MOUSE_SIM_STRENGTH_SCALE * MOUSE_SIM_REPULSION_REF);

// --- Scroll -> morph constants ported from landing-enhancements.tsx --------

const SCROLL_MORPH_PLATEAU = 0.34;

// Preset model URLs point at `/landing/models/*.pts`; in this app they are
// served under `/public`, so every fetch is prefixed here.
const PUBLIC_PREFIX = '/public';

// --- Preset runtime data ---------------------------------------------------

interface PresetRuntimeData {
  presets: Preset[];
  controls: number[][];
  shaderInts: number[];
  racetrackIndex: number;
  driveIndex: number;
  driveCarPosY: number;
}

function resolveShaderInt(preset: Preset): number {
  return SHADER_ID_TO_INT[preset.shaderId];
}

function buildInitialControls(preset: Preset): number[] {
  const controls = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(preset.controls.length, 8); i++) {
    controls[i] = preset.controls[i].initial;
  }
  return controls;
}

function getControlInitial(preset: Preset, id: string, fallback = 0): number {
  return preset.controls.find((control) => control.id === id)?.initial ?? fallback;
}

function buildPresetRuntimeData(presetList: Preset[]): PresetRuntimeData {
  const driveIndex = presetList.findIndex((preset) => preset.name === 'Drive');
  return {
    presets: presetList,
    controls: presetList.map(buildInitialControls),
    shaderInts: presetList.map(resolveShaderInt),
    racetrackIndex: presetList.findIndex((preset) => preset.name === 'Racetrack'),
    driveIndex,
    driveCarPosY:
      driveIndex >= 0 ? getControlInitial(presetList[driveIndex], '_carPosY', 0) : 0,
  };
}

function copyControlsInto(source: number[], target: number[]) {
  for (let i = 0; i < 8; i++) {
    target[i] = source[i] ?? 0;
  }
}

function copyManagedControlsInto(
  preset: Preset,
  controlMgr: ControlManager,
  target: number[],
) {
  for (let i = 0; i < 8; i++) {
    const control = preset.controls[i];
    target[i] = control
      ? (controlMgr.controls.get(control.id)?.value ?? control.initial)
      : 0;
  }
}

function setDesiredCameraInto(
  presetList: Preset[],
  morphValue: number,
  outPos: Vector3,
  outTarget: Vector3,
) {
  const maxIdx = presetList.length - 1;
  const clamped = clamp(morphValue, 0, maxIdx);
  const fromIdx = Math.min(Math.floor(clamped), maxIdx);
  const toIdx = Math.min(fromIdx + 1, maxIdx);
  const blend = clamped - fromIdx;

  const fromPos = presetList[fromIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const fromTarget = presetList[fromIdx].cameraTarget ?? DEFAULT_CAM_TARGET;
  const toPos = presetList[toIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const toTarget = presetList[toIdx].cameraTarget ?? DEFAULT_CAM_TARGET;

  outPos.set(
    lerp(fromPos[0], toPos[0], blend),
    lerp(fromPos[1], toPos[1], blend),
    lerp(fromPos[2], toPos[2], blend),
  );
  outTarget.set(
    lerp(fromTarget[0], toTarget[0], blend),
    lerp(fromTarget[1], toTarget[1], blend),
    lerp(fromTarget[2], toTarget[2], blend),
  );
}

// --- Scroll -> morph plateau easing (ported from landing-enhancements) -----

function morphPlateauWithinUnitSpan(t: number, plateau: number): number {
  if (plateau <= 1e-6) return t;
  const lo = plateau * 0.5;
  const hi = 1 - lo;
  if (t <= lo) return 0;
  if (t >= hi) return 1;
  return (t - lo) / (hi - lo);
}

function scrollMorphPlateauForSegment(
  segmentIndex: number,
  maxMorph: number,
  plateau: number,
): number {
  if (plateau <= 1e-6 || segmentIndex === 0 || segmentIndex === maxMorph - 1) {
    return 0;
  }
  return plateau;
}

function morphPlateauAcrossIndices(
  linearMorph: number,
  maxValue: number,
  plateau: number,
): number {
  const clamped = clamp(linearMorph, 0, maxValue);
  if (maxValue < 1) return clamped;
  const base = Math.floor(clamped);
  if (base >= maxValue) return maxValue;
  const frac = clamped - base;
  const p = scrollMorphPlateauForSegment(base, maxValue, plateau);
  return base + morphPlateauWithinUnitSpan(frac, p);
}

// ---------------------------------------------------------------------------

export async function startParticles(canvas: HTMLCanvasElement): Promise<void> {
  const container: HTMLElement = canvas.parentElement ?? canvas;
  const settings: SystemSettings = DEFAULT_SETTINGS;

  // Section elements drive the morph stops: each preset maps to one <section>
  // inside #main-content (index-aligned). If they cannot be resolved we fall
  // back to a linear scroll map below.
  const sectionEls = Array.from(
    document.querySelectorAll<HTMLElement>('#main-content section'),
  );

  const morphValueRef = { current: 0 };
  const scroll = { morphValue: 0, frame: 0, sectionStops: null as number[] | null };
  const modelData: (ModelData | undefined)[] = presets.map(() => undefined);
  const modelLoads = {
    pendingUrls: new Set<string>(),
    failedUrls: new Set<string>(),
  };
  const eagerModelIndexes = presets
    .map((preset, index) => (preset.preloadEager ? index : -1))
    .filter((index) => index >= 0);

  // --- Scroll -> morph -----------------------------------------------------

  function getScrollRange() {
    return Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  }

  function clampScrollY(scrollY: number) {
    return clamp(scrollY, 0, getScrollRange());
  }

  function getSectionScrollStop(index: number): number | undefined {
    if (index === 0) return 0;
    const el = sectionEls[index];
    if (!el) return undefined;
    if (el.offsetHeight > window.innerHeight) {
      return clampScrollY(el.offsetTop);
    }
    const sectionCenter = el.offsetTop + el.offsetHeight / 2;
    return clampScrollY(sectionCenter - window.innerHeight / 2);
  }

  function getSectionScrollStops(): number[] | undefined {
    if (scroll.sectionStops) return scroll.sectionStops;
    const stops: number[] = [];
    for (let index = 0; index < presets.length; index++) {
      const stop = getSectionScrollStop(index);
      if (stop === undefined) return undefined;
      stops.push(stop);
    }
    scroll.sectionStops = stops;
    return stops;
  }

  function getMorphValueForScroll(scrollY: number) {
    const maxValue = presets.length - 1;
    const stops = getSectionScrollStops();
    if (!stops) {
      const linearMorph = (clampScrollY(scrollY) / getScrollRange()) * maxValue;
      return morphPlateauAcrossIndices(linearMorph, maxValue, SCROLL_MORPH_PLATEAU);
    }

    const clampedScrollY = clampScrollY(scrollY);
    if (clampedScrollY <= stops[0]) return 0;

    for (let index = 0; index < maxValue; index++) {
      const from = stops[index];
      const to = stops[index + 1];
      if (clampedScrollY > to) continue;
      const span = to - from;
      if (span <= 1) return index + 1;
      const t = (clampedScrollY - from) / span;
      const plateau = scrollMorphPlateauForSegment(index, maxValue, SCROLL_MORPH_PLATEAU);
      return index + morphPlateauWithinUnitSpan(t, plateau);
    }

    return maxValue;
  }

  function syncMorphToScroll() {
    const rawMorphValue = getMorphValueForScroll(window.scrollY);
    const activeIndex = Math.round(clamp(rawMorphValue, 0, presets.length - 1));
    scroll.morphValue = reducedMotion.current ? activeIndex : rawMorphValue;
    morphValueRef.current = scroll.morphValue;
    requestNearbyModels();
  }

  function scheduleMorphSync() {
    if (scroll.frame) return;
    scroll.frame = window.requestAnimationFrame(() => {
      scroll.frame = 0;
      syncMorphToScroll();
    });
  }

  // --- Model loading -------------------------------------------------------

  function assignModelData(rawUrl: string, data: ModelData) {
    presets.forEach((preset, index) => {
      if (preset.modelUrl === rawUrl) modelData[index] = data;
    });
    syncModelTextures();
  }

  async function requestModel(index: number) {
    const preset = presets[index];
    const rawUrl = preset?.modelUrl;
    if (
      !rawUrl ||
      modelData[index] !== undefined ||
      modelLoads.pendingUrls.has(rawUrl) ||
      modelLoads.failedUrls.has(rawUrl)
    ) {
      return;
    }

    modelLoads.pendingUrls.add(rawUrl);
    try {
      const data = await loadModelPoints(PUBLIC_PREFIX + rawUrl);
      assignModelData(rawUrl, data);
    } catch (error) {
      modelLoads.failedUrls.add(rawUrl);
      console.error(error);
    } finally {
      modelLoads.pendingUrls.delete(rawUrl);
    }
  }

  function requestNearbyModels() {
    for (const index of eagerModelIndexes) {
      void requestModel(index);
    }
    presets.forEach((preset, index) => {
      if (!preset.modelUrl) return;
      if (Math.abs(scroll.morphValue - index) < 1.1) {
        void requestModel(index);
      }
    });
  }

  // Eager presets first, then every remaining model so all textures land even
  // if the section never scrolls into range.
  async function loadAllModels() {
    for (const index of eagerModelIndexes) {
      void requestModel(index);
    }
    for (let index = 0; index < presets.length; index++) {
      if (!eagerModelIndexes.includes(index)) void requestModel(index);
    }
  }

  // --- Engine state --------------------------------------------------------

  let engine: Engine | null = null;
  let particles: ParticleSystem | null = null;
  let restBaker: RestBaker | null = null;
  let mouseSim: MouseSim | null = null;
  const appliedModelSlots = new Set<number>();

  let frameId = 0;
  let startTime = 0;
  let frozenTime: number | null = null;
  let hasReportedReady = false;
  let lastFrameNow = 0;

  const desiredCameraPos = new Vector3();
  const desiredCameraTarget = new Vector3();
  const scratchViewProj = new Matrix4();
  const scratchCamRight = new Vector3();
  const scratchCamUp = new Vector3();
  const scratchControlsA = [0, 0, 0, 0, 0, 0, 0, 0];
  const scratchControlsB = [0, 0, 0, 0, 0, 0, 0, 0];
  const morphBlend: MorphBlend = { fromIndex: 0, toIndex: 0, blend: 0 };
  const presetRuntimeData = buildPresetRuntimeData(presets);

  // Label projection state (ported from particle-canvas.tsx). Results are
  // written into the shared `labelState` bus, which <label-overlay> renders.
  const labelControlMgr = new ControlManager();
  let previousNearest = -1;
  const scratchLabelControls = [0, 0, 0, 0, 0, 0, 0, 0];

  // --- Pointer parallax ----------------------------------------------------

  let mouseNormX = 0;
  let mouseNormY = 0;
  let prevMouseNormX = 0;
  let prevMouseNormY = 0;
  let mouseVelPrimed = false;
  let mouseNdcSpeedSmoothed = 0;
  let mouseBrushSmoothed = 0;
  let smoothMouseOffsetX = 0;
  let smoothCarLane = 0;
  let prevCarLane = 0;
  let laneActivity = 0;

  function setMousePosition(clientX: number, clientY: number) {
    const rect = container.getBoundingClientRect();
    const rw = rect.width > 1e-4 ? rect.width : window.innerWidth;
    const rh = rect.height > 1e-4 ? rect.height : window.innerHeight;
    mouseNormX = ((clientX - rect.left) / rw) * 2 - 1;
    mouseNormY = ((clientY - rect.top) / rh) * 2 - 1;
  }

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    setMousePosition(event.clientX, event.clientY);
  });
  window.addEventListener('mousemove', (event) => {
    if (window.PointerEvent) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setMousePosition(event.clientX, event.clientY);
  });

  window.addEventListener('scroll', () => scheduleMorphSync(), { passive: true });
  window.addEventListener('resize', () => {
    scroll.sectionStops = null;
    scheduleMorphSync();
  });

  // --- Init ----------------------------------------------------------------

  function syncModelTextures() {
    if (!restBaker) return;
    for (const preset of presets) {
      if (
        preset.modelUrl == null ||
        preset.modelSlot == null ||
        appliedModelSlots.has(preset.modelSlot)
      ) {
        continue;
      }
      const model = modelData[presets.indexOf(preset)];
      if (!model) continue;
      restBaker.setModelTexture(
        preset.modelSlot,
        createModelTexture(model),
        model.positions.length / 3,
      );
      appliedModelSlots.add(preset.modelSlot);
    }
  }

  // Reduced motion: mirror the source (freeze the intro time, kill parallax).
  initReducedMotion(new AbortController().signal, () => {
    syncMorphToScroll();
  });

  syncMorphToScroll();
  void loadAllModels();

  engine = new Engine();
  engine.init(canvas, container, settings);

  restBaker = new RestBaker(engine.renderer, settings.particleCount);
  restBaker.setCount(settings.particleCount);

  particles = new ParticleSystem();
  particles.init(engine.scene, settings.particleCount, settings.pointSize);
  // Bind the baker's MRT texture refs to the draw material once; subsequent
  // bake() calls update the GL backing in place.
  particles.setRestTextures(
    restBaker.getPosTexture(0),
    restBaker.getColTexture(0),
    restBaker.getPosTexture(1),
    restBaker.getColTexture(1),
  );
  syncModelTextures();

  mouseSim = new MouseSim(engine.renderer, settings.particleCount);
  mouseSim.setRestTextures(restBaker.getPosTexture(0), restBaker.getPosTexture(1));
  mouseSim.setPushGain(MOUSE_SIM_PUSH_GAIN);
  mouseSim.setFollowTau(MOUSE_SIM_FOLLOW_TAU);
  particles.setDispTexture(mouseSim.getDispTexture());

  startTime = performance.now() / 1000;
  setDesiredCameraInto(presets, morphValueRef.current, desiredCameraPos, desiredCameraTarget);
  engine.camera.position.copy(desiredCameraPos);
  engine.controls.target.copy(desiredCameraTarget);

  // Pre-bake slot A with the starting preset so the first render samples
  // populated rest textures, and force the baker's material to compile now.
  const initialIndex = Math.min(
    Math.max(0, Math.floor(morphValueRef.current)),
    presets.length - 1,
  );
  copyControlsInto(presetRuntimeData.controls[initialIndex], scratchControlsA);
  restBaker.bake(0, presetRuntimeData.shaderInts[initialIndex], scratchControlsA, 0);
  engine.renderer.compile(engine.scene, engine.camera);

  // --- Animate loop (ported from particle-canvas.tsx) ----------------------

  const animate = () => {
    if (!engine || !particles || !restBaker || !mouseSim) return;

    const now = performance.now();
    const time = now / 1000 - startTime;
    const dtSeconds = lastFrameNow === 0 ? 1 / 60 : (now - lastFrameNow) / 1000;
    lastFrameNow = now;

    const presetData = presetRuntimeData;
    const morphValue = morphValueRef.current;
    const reduceMotion = reducedMotion.current;

    if (reduceMotion) {
      frozenTime ??= Math.max(time, PARTICLE_INTRO_DELAY_S + 3.5);
    } else {
      frozenTime = null;
    }
    const visualTime = frozenTime ?? time;

    engine.updateSettings(settings);

    const screenScale = engine.getScreenScale();
    particles.setPointSize(settings.pointSize);
    particles.setHdrIntensity(settings.hdrIntensity * screenScale);
    const effectiveMouseNormX = reduceMotion ? 0 : mouseNormX;
    const effectiveMouseNormY = reduceMotion ? 0 : mouseNormY;

    let mouseBrushFactor = 0;
    const dtClamp = Math.max(dtSeconds, 1e-4);
    if (reduceMotion) {
      mouseVelPrimed = false;
      mouseNdcSpeedSmoothed = 0;
      mouseBrushSmoothed = 0;
    } else {
      if (!mouseVelPrimed) {
        prevMouseNormX = effectiveMouseNormX;
        prevMouseNormY = effectiveMouseNormY;
        mouseVelPrimed = true;
      } else {
        const speed = Math.hypot(
          (effectiveMouseNormX - prevMouseNormX) / dtClamp,
          (effectiveMouseNormY - prevMouseNormY) / dtClamp,
        );
        const kVel = 1 - Math.exp(-MOUSE_SIM_VEL_SMOOTH_TAU * dtClamp);
        mouseNdcSpeedSmoothed += (speed - mouseNdcSpeedSmoothed) * kVel;
      }
      prevMouseNormX = effectiveMouseNormX;
      prevMouseNormY = effectiveMouseNormY;
      const span = Math.max(MOUSE_SIM_VEL_FULL - MOUSE_SIM_VEL_GATE, 1e-4);
      const linear = clamp01((mouseNdcSpeedSmoothed - MOUSE_SIM_VEL_GATE) / span);
      const brushTarget = linear * linear * (3 - 2 * linear);
      const kBrush = 1 - Math.exp(-MOUSE_SIM_BRUSH_SMOOTH_TAU * dtClamp);
      mouseBrushSmoothed += (brushTarget - mouseBrushSmoothed) * kBrush;
      mouseBrushFactor = mouseBrushSmoothed;
    }

    particles.setColorMode(settings.colorMode);
    particles.setDof(settings.dofAmount, settings.dofFocus);
    const introTime = Math.max(0, visualTime - PARTICLE_INTRO_DELAY_S);
    particles.setIntroProgress(reduceMotion ? 1.5 : Math.min(introTime / 3.5, 1.5));
    particles.setTime(visualTime);

    const maxValue = presets.length - 1;
    getMorphBlend(morphValue, maxValue, morphBlend);
    const { fromIndex, toIndex, blend } = morphBlend;

    let separation: number;
    if (blend < 0.001) {
      copyControlsInto(presetData.controls[fromIndex], scratchControlsA);
      copyControlsInto(presetData.controls[fromIndex], scratchControlsB);
      separation = presets[fromIndex].separation;
    } else {
      copyControlsInto(presetData.controls[fromIndex], scratchControlsA);
      copyControlsInto(presetData.controls[toIndex], scratchControlsB);
      const easedBlendSep = blend * blend * (3 - 2 * blend);
      separation =
        presets[fromIndex].separation * (1 - easedBlendSep) +
        presets[toIndex].separation * easedBlendSep;
    }

    const racetrackIndex = presetData.racetrackIndex;
    const racetrackDist =
      racetrackIndex >= 0 ? Math.abs(morphValue - racetrackIndex) : 0;
    const departingRacetrack =
      !reduceMotion && racetrackDist > 0.01 && racetrackDist < 1.0;

    if (departingRacetrack) {
      const surge = racetrackDist * racetrackDist * 32;
      if (blend < 0.001) {
        if (fromIndex === racetrackIndex || toIndex === racetrackIndex) {
          scratchControlsA[7] = surge;
          scratchControlsB[7] = surge;
        }
      } else {
        if (fromIndex === racetrackIndex) scratchControlsA[7] = surge;
        if (toIndex === racetrackIndex) scratchControlsB[7] = surge;
      }
    }

    // Hoist the per-frame-constant morph t off the vertex shader.
    let morphT = 0;
    if (blend > 0.001) {
      const ease = settings.morphEase;
      const tk = Math.pow(blend, ease);
      morphT = tk / (tk + Math.pow(1 - blend, ease));
    }
    particles.setBlend(blend);
    particles.setMorphT(morphT);
    particles.setSeparation(separation);

    const overridesA = presets[fromIndex].systemOverrides;
    const overridesB = presets[toIndex].systemOverrides;
    const easedBlend = blend * blend * (3 - 2 * blend);
    const effectiveTrail =
      (1 - easedBlend) * (overridesA?.trailIntensity ?? settings.trailIntensity) +
      easedBlend * (overridesB?.trailIntensity ?? settings.trailIntensity);
    const effectiveRepulsion =
      (1 - easedBlend) * (overridesA?.cursorRepulsion ?? settings.cursorRepulsion) +
      easedBlend * (overridesB?.cursorRepulsion ?? settings.cursorRepulsion);
    const trailBoost = departingRacetrack
      ? Math.sin(racetrackDist * Math.PI) * 0.75
      : 0;
    engine.afterImagePass.uniforms.damp.value = reduceMotion
      ? 0
      : Math.min(effectiveTrail + trailBoost, 0.97);

    const driveIndex = presetData.driveIndex;
    const racetrackFogDist =
      racetrackIndex >= 0 ? Math.abs(morphValue - racetrackIndex) : Infinity;
    const driveFogDist =
      driveIndex >= 0 ? Math.abs(morphValue - driveIndex) : Infinity;
    const fogProximity = Math.max(0, 1 - Math.min(racetrackFogDist, driveFogDist));
    particles.setFog(fogProximity, 10, 180);

    const driveProximity =
      driveIndex >= 0 ? clamp01(1 - Math.abs(morphValue - driveIndex)) : 0;
    const racetrackRoadLock =
      racetrackIndex >= 0
        ? clamp01(1 - racetrackDist) * (1 - driveProximity)
        : 0;
    if (!reduceMotion && driveProximity > 0) {
      smoothCarLane += (effectiveMouseNormX - smoothCarLane) * CAR_LANE_LERP;
    } else {
      smoothCarLane += (0 - smoothCarLane) * CAR_LANE_LERP;
    }

    const laneDelta = Math.abs(smoothCarLane - prevCarLane);
    laneActivity = Math.max(
      laneActivity * ACTIVITY_DECAY,
      clamp01(laneDelta * ACTIVITY_GAIN),
    );
    prevCarLane = smoothCarLane;

    const carLaneOffset = smoothCarLane * driveProximity;
    const carLaneActivity = laneActivity * driveProximity;
    const carPosY = driveIndex >= 0 ? presetData.driveCarPosY * driveProximity : 0;
    restBaker.setCarUniforms(carLaneOffset, carLaneActivity, carPosY);

    // Bake the active endpoint(s). Slot B is skipped when the draw shader
    // would ignore it (matches the `if (uBlend > 0.001)` gate in the VS).
    restBaker.bake(0, presetData.shaderInts[fromIndex], scratchControlsA, visualTime);
    if (blend > 0.001) {
      restBaker.bake(1, presetData.shaderInts[toIndex], scratchControlsB, visualTime);
    }

    engine.controls.enabled = !reduceMotion && driveProximity < 0.5;

    setDesiredCameraInto(presets, morphValue, desiredCameraPos, desiredCameraTarget);
    if (reduceMotion) {
      engine.camera.position.copy(desiredCameraPos);
      engine.controls.target.copy(desiredCameraTarget);
    } else {
      engine.camera.position.lerp(desiredCameraPos, CAM_LERP_SPEED);
      engine.controls.target.lerp(desiredCameraTarget, CAM_LERP_SPEED);
    }

    const parallaxScale = 1 - driveProximity;
    smoothMouseOffsetX +=
      (effectiveMouseNormX * MOUSE_RANGE - smoothMouseOffsetX) * MOUSE_LERP;
    if (!reduceMotion) {
      const parallaxUncapped = smoothMouseOffsetX * parallaxScale;
      let parallaxX = parallaxUncapped;
      if (racetrackIndex >= 0 && racetrackRoadLock > 0) {
        const trackW = presetData.controls[racetrackIndex][1] ?? 40;
        const strafeCap = trackW * RACETRACK_MOUSE_STRAFE_OF_TRACKW;
        const parallaxRacetrack = clamp(
          parallaxUncapped * RACETRACK_MOUSE_STRAFE_ATTENUATION,
          -strafeCap,
          strafeCap,
        );
        parallaxX = lerp(parallaxUncapped, parallaxRacetrack, racetrackRoadLock);
      }
      engine.camera.position.x += parallaxX;
    }

    // Run look-at once before reading view/proj so MouseSim matrices match
    // this frame's render.
    engine.controls.update();
    scratchViewProj.multiplyMatrices(
      engine.camera.projectionMatrix,
      engine.camera.matrixWorldInverse,
    );
    const ew = engine.camera.matrixWorld.elements;
    scratchCamRight.set(ew[0], ew[1], ew[2]).normalize();
    scratchCamUp.set(ew[4], ew[5], ew[6]).normalize();
    mouseSim.setViewProj(scratchViewProj);
    mouseSim.setCamBasis(scratchCamRight, scratchCamUp);
    mouseSim.setMouseNDC(effectiveMouseNormX, -effectiveMouseNormY);
    mouseSim.setBlend(blend);
    mouseSim.setMorphT(morphT);
    mouseSim.setMouseNdcRadius(MOUSE_SIM_NDC_RADIUS * mouseBrushFactor);
    mouseSim.setMouseStrength(
      reduceMotion
        ? 0
        : effectiveRepulsion * MOUSE_SIM_STRENGTH_SCALE * mouseBrushFactor,
    );
    mouseSim.step(dtSeconds);
    particles.setDispTexture(mouseSim.getDispTexture());

    // --- Label projection (ported from particle-canvas.tsx) --------------
    // Project the nearest preset's 3D label anchors to screen space and hand
    // the result to <label-overlay> via the shared `labelState` bus.
    const nearest = Math.round(clamp(morphValue, 0, maxValue));
    if (nearest !== previousNearest) {
      previousNearest = nearest;
      labelControlMgr.loadPreset(presets[nearest]);
    }

    const nearestPreset = presets[nearest];
    if (nearestPreset?.labels && nearestPreset.labels.length > 0 && container) {
      let activeCtrls = presetData.controls[nearest];
      if (blend < 0.001) {
        copyManagedControlsInto(nearestPreset, labelControlMgr, scratchLabelControls);
        activeCtrls = scratchLabelControls;
      }

      projectLabelsInto(
        labelState.labels,
        nearestPreset,
        labelControlMgr,
        activeCtrls,
        visualTime,
        engine.camera,
        container.clientWidth,
        container.clientHeight,
      );

      const distFromNearest = Math.abs(morphValue - nearest);
      labelState.opacity = Math.max(0, 1 - distFromNearest * 4);
    } else {
      labelState.labels.length = 0;
      labelState.opacity = 0;
    }

    engine.render(time);
    if (!hasReportedReady) {
      hasReportedReady = true;
      // The loading screen listens for this to dismiss.
      window.dispatchEvent(new Event('particle-ready'));
    }
    frameId = requestAnimationFrame(animate);
  };

  frameId = requestAnimationFrame(animate);
  void frameId;
}
