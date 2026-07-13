import { PerspectiveCamera, Vector3 } from "three";
import type { Preset } from "./types.ts";
import type { ControlManager } from "./controls.ts";

export interface ProjectedLabel {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  visible: boolean;
  color?: string;
}

const DEG2RAD = Math.PI / 180;
const _v = new Vector3();

type LabelTransform = (
  x: number,
  y: number,
  z: number,
  ctrls: number[],
  time: number,
) => Vector3;

function transformSlot0(
  x: number,
  y: number,
  z: number,
  ctrls: number[],
  time: number,
): Vector3 {
  const scale = ctrls[0] ?? 55;
  const rX = (ctrls[1] ?? 0) * DEG2RAD;
  const rY = (ctrls[2] ?? 0) * DEG2RAD - time * (ctrls[4] ?? 0);
  const rZ = (ctrls[3] ?? 0) * DEG2RAD;

  let px = x * scale;
  let py = y * scale;
  let pz = z * scale;

  const cx = Math.cos(rX),
    sx = Math.sin(rX);
  const t1y = py * cx - pz * sx;
  const t1z = py * sx + pz * cx;
  py = t1y;
  pz = t1z;

  const cy = Math.cos(rY),
    sy = Math.sin(rY);
  const t2x = px * cy + pz * sy;
  const t2z = -px * sy + pz * cy;
  px = t2x;
  pz = t2z;

  const cz = Math.cos(rZ),
    sz = Math.sin(rZ);
  const t3x = px * cz - py * sz;
  const t3y = px * sz + py * cz;
  px = t3x;
  py = t3y;

  return _v.set(px, py, pz);
}

function transformSpinY(
  x: number,
  y: number,
  z: number,
  ctrls: number[],
  time: number,
): Vector3 {
  const scale = ctrls[0] ?? 48;
  const spin = ctrls[1] ?? 0.23;
  const angle = time * spin;
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle);

  const mx = x * scale;
  const my = y * scale;
  const mz = z * scale;

  let px = mx * cosA - mz * sinA;
  let py = my;
  const pz = mx * sinA + mz * cosA;

  const rotZ = (ctrls[3] ?? 0) * DEG2RAD;
  const cz = Math.cos(rotZ),
    sz = Math.sin(rotZ);
  const qx = px * cz - py * sz;
  const qy = px * sz + py * cz;

  return _v.set(qx, qy, pz);
}

function getTransform(preset: Preset): LabelTransform | null {
  const slot = preset.modelSlot;
  if (slot === 0) return transformSlot0;
  if (slot === 1 || slot === 2) return transformSpinY;
  return null;
}

export function projectLabelsInto(
  results: ProjectedLabel[],
  preset: Preset,
  controlMgr: ControlManager,
  ctrls: number[],
  time: number,
  camera: PerspectiveCamera,
  width: number,
  height: number,
): ProjectedLabel[] {
  const labels = preset.labels;
  if (!labels || labels.length === 0) {
    results.length = 0;
    return results;
  }

  const transform = getTransform(preset);
  if (!transform) {
    results.length = 0;
    return results;
  }

  for (let index = 0; index < labels.length; index++) {
    const lbl = labels[index]!;
    const ax =
      controlMgr.controls.get(`label_${lbl.id}_X`)?.value ?? lbl.anchor[0];
    const ay =
      controlMgr.controls.get(`label_${lbl.id}_Y`)?.value ?? lbl.anchor[1];
    const az =
      controlMgr.controls.get(`label_${lbl.id}_Z`)?.value ?? lbl.anchor[2];

    const projected = transform(ax, ay, az, ctrls, time).project(camera);
    const visible = projected.z >= -1 && projected.z <= 1;

    const screenX = (projected.x * 0.5 + 0.5) * width;
    const screenY = (-projected.y * 0.5 + 0.5) * height;

    const result =
      results[index] ??
      (results[index] = {
        id: lbl.id,
        text: lbl.text,
        anchorX: screenX,
        anchorY: screenY,
        labelX: screenX + lbl.offset[0],
        labelY: screenY + lbl.offset[1],
        visible,
        color: preset.labelColor,
      });
    result.id = lbl.id;
    result.text = lbl.text;
    result.anchorX = screenX;
    result.anchorY = screenY;
    result.labelX = screenX + lbl.offset[0];
    result.labelY = screenY + lbl.offset[1];
    result.visible = visible;
    result.color = preset.labelColor;
  }

  results.length = labels.length;
  return results;
}
