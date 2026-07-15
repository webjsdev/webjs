export interface ControlDef {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  initial: number;
}

export interface InfoState {
  title: string;
  description: string;
}

export interface PresetControlDef {
  id: string;
  label: string;
  min: number;
  max: number;
  initial: number;
}

export interface PresetLabelDef {
  id: string;
  text: string;
  anchor: [number, number, number];
  offset: [number, number];
}

/**
 * Names the GLSL shader function that draws a preset. Decouples preset order
 * in the `presets` array from the shader dispatch table, so reordering panels
 * on the landing page never requires editing shader code.
 *
 * Add a new value here, map it to an integer in `SHADER_ID_TO_INT`
 * (`ParticleCanvas`), and add a matching branch to `computePreset` in the
 * particle shader.
 */
export type ShaderId =
  | "racetrack"
  | "racecar"
  | "runner"
  | "remixLogo"
  | "racetrackCar";

export interface Preset {
  name: string;
  shaderId: ShaderId;
  modelUrl?: string;
  modelSlot?: number;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  glowColor?: [number, number, number];
  controls: PresetControlDef[];
  cameraControls?: PresetControlDef[];
  labels?: PresetLabelDef[];
  labelColor?: string;
  separation: number;
  info: InfoState;
  systemOverrides?: Partial<SystemSettings>;
  /** Preload this preset's model as soon as the app boots. */
  preloadEager?: boolean;
}

export interface SystemSettings {
  particleCount: number;
  pointSize: number;
  backgroundColor: string;
  bloomStrength: number;
  bloomThreshold: number;
  dofAmount: number;
  dofFocus: number;
  cameraFov: number;
  hdrIntensity: number;
  cursorRepulsion: number;
  morphEase: number;
  colorMode: number;
  trailIntensity: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  particleCount: 160000,
  pointSize: 0.25,
  backgroundColor: "#000000",
  bloomStrength: 0.8,
  bloomThreshold: 0,
  dofAmount: 0,
  dofFocus: 80,
  cameraFov: 60,
  hdrIntensity: 1.0,
  cursorRepulsion: 0.2,
  morphEase: 2.3,
  colorMode: 0,
  trailIntensity: 0.23,
};
