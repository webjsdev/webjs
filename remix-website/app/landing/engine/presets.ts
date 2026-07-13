import type { Preset } from "./types.ts";

const websiteMockups: Preset = {
  name: "Website Mockups",
  shaderId: "remixLogo",
  modelUrl: "/landing/models/mockup-websites.pts",
  modelSlot: 0,
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 80, initial: 55 },
    { id: "rotX", label: "Rotate X", min: -180, max: 180, initial: 18 },
    { id: "rotY", label: "Rotate Y", min: -180, max: 180, initial: 0 },
    { id: "rotZ", label: "Rotate Z", min: -180, max: 180, initial: -14.4 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0.23 },
  ],
  info: {
    title: "Website Mockups",
    description: "5 website mockups spinning as a particle cloud",
  },
};

const racecar: Preset = {
  name: "Racecar",
  shaderId: "racecar",
  preloadEager: true,
  modelUrl: "/landing/models/racecar.pts",
  modelSlot: 1,
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 150, initial: 48 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0.23 },
    { id: "shimmer", label: "Shimmer", min: 0, max: 2, initial: 0.6 },
    { id: "rotZ", label: "Rotate Z", min: -180, max: 180, initial: 15 },
  ],
  labels: [
    {
      id: "frontend",
      text: "FRONTEND",
      anchor: [0, 0.08, 0.5],
      offset: [-90, -58],
    },
    {
      id: "between",
      text: "EVERYTHING IN BETWEEN",
      anchor: [0.0, 0.04, -0.04],
      offset: [-110, -72],
    },
    {
      id: "backend",
      text: "BACKEND",
      anchor: [0, 0.18, -0.25],
      offset: [-160, -104],
    },
  ],
  labelColor: "#BFC7E2",
  info: {
    title: "Racecar",
    description: "Race car rendered as a particle cloud",
  },
};

const racetrack: Preset = {
  name: "Racetrack",
  shaderId: "racetrack",
  cameraPosition: [-0.8, -18.6, 81.4],
  cameraTarget: [0, -4.2, -30],
  glowColor: [0.15, 0.25, 0.08],
  separation: 0,
  controls: [
    { id: "speed", label: "Speed", min: 0.1, max: 10, initial: 0.1 },
    { id: "trackW", label: "Track Width", min: 5, max: 60, initial: 40 },
    { id: "curveAmp", label: "Curve Intensity", min: 0, max: 25, initial: 10 },
    { id: "hillH", label: "Hill Height", min: 5, max: 40, initial: 7.8 },
    { id: "_fogMode", label: "Fog: Color / Scene", min: 0, max: 1, initial: 1 },
    {
      id: "starDensity",
      label: "Star Density",
      min: 0,
      max: 0.3,
      initial: 0.005,
    },
    { id: "curveSway", label: "Curve Sway Speed", min: 0, max: 2, initial: 0 },
  ],
  cameraControls: [
    { id: "_camPosX", label: "Camera X", min: -80, max: 80, initial: -0.8 },
    { id: "_camPosY", label: "Camera Y", min: -60, max: 60, initial: -18.6 },
    { id: "_camPosZ", label: "Camera Z", min: 10, max: 150, initial: 81.4 },
    { id: "_camTgtX", label: "Look-at X", min: -80, max: 80, initial: 0 },
    { id: "_camTgtY", label: "Look-at Y", min: -60, max: 60, initial: -4.2 },
    { id: "_camTgtZ", label: "Look-at Z", min: -120, max: 60, initial: -30 },
  ],
  info: {
    title: "Racetrack",
    description: "A mountain circuit streaming past at speed",
  },
};

const runner: Preset = {
  name: "Model Kit Runner",
  shaderId: "runner",
  modelUrl: "/landing/models/model-kit-runner.pts",
  modelSlot: 2,
  cameraPosition: [-5, 30, 80],
  cameraTarget: [0, 0, 0],
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 150, initial: 58 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0.23 },
    { id: "shimmer", label: "Shimmer", min: 0, max: 2, initial: 0.5 },
    { id: "rotZ", label: "Rotate Z", min: -180, max: 180, initial: 15 },
  ],
  labels: [
    {
      id: "humans",
      text: "EASY FOR HUMANS AND MODELS",
      anchor: [0.28, 0.5, -0.04],
      offset: [-130, -84],
    },
    {
      id: "parts",
      text: "ALL THE PARTS YOU NEED",
      anchor: [0.36, -0.2, -0.06],
      offset: [-110, -72],
    },
  ],
  labelColor: "#BFC7E2",
  info: {
    title: "Model Kit Runner",
    description: "Runner figure rendered as a particle cloud",
  },
};

const underTheHood: Preset = {
  name: "Under The Hood",
  shaderId: "racecar",
  modelUrl: "/landing/models/racecar.pts",
  modelSlot: 1,
  cameraPosition: [0, 12, -55],
  cameraTarget: [0, -2, 0],
  glowColor: [0.3, 0.35, 0.55],
  separation: 0,
  controls: [
    { id: "scale", label: "Scale", min: 5, max: 200, initial: 90 },
    { id: "spin", label: "Spin Speed", min: 0, max: 1, initial: 0 },
    { id: "shimmer", label: "Shimmer", min: 0, max: 2, initial: 0.6 },
    { id: "rotZ", label: "Rotate Z", min: -180, max: 180, initial: 0 },
  ],
  info: {
    title: "Under The Hood",
    description: "Race car viewed from the rear",
  },
};

const drive: Preset = {
  name: "Drive",
  shaderId: "racetrackCar",
  modelUrl: "/landing/models/racecar-drive.pts",
  modelSlot: 3,
  cameraPosition: [-0.8, -18.6, 81.4],
  cameraTarget: [0, -4.2, -30],
  glowColor: [0.15, 0.25, 0.08],
  separation: 0,
  controls: [
    { id: "speed", label: "Speed", min: 0.1, max: 10, initial: 2.3 },
    { id: "trackW", label: "Track Width", min: 5, max: 60, initial: 40 },
    { id: "curveAmp", label: "Curve Intensity", min: 0, max: 25, initial: 0 },
    {
      id: "wheelThick",
      label: "Wheel Thickness",
      min: 0.02,
      max: 0.5,
      initial: 0.18,
    },
    {
      id: "wheelbase",
      label: "Wheelbase (F/R)",
      min: 0.2,
      max: 2.0,
      initial: 1.14,
    },
    {
      id: "wheelTrack",
      label: "Wheel Track (L/R)",
      min: 0.2,
      max: 2.0,
      initial: 0.68,
    },
    {
      id: "wheelY",
      label: "Wheel Y Position",
      min: -1.0,
      max: 0.5,
      initial: -0.13,
    },
    {
      id: "wheelZ",
      label: "Wheel Z Offset",
      min: -0.5,
      max: 0.5,
      initial: -0.11,
    },
    {
      id: "_carPosY",
      label: "Car Y Position",
      min: -15,
      max: 15,
      initial: -3.15,
    },
  ],
  systemOverrides: { trailIntensity: 0.5, cursorRepulsion: 0 },
  info: {
    title: "Drive",
    description: "Race car driving on a straight mountain circuit",
  },
};

export const presets: Preset[] = [
  racetrack,
  racecar,
  runner,
  underTheHood,
  websiteMockups,
  drive,
];
