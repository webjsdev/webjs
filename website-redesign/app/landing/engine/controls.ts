import type { ControlDef, InfoState, Preset } from "./types.ts";

export class ControlManager {
  controls = new Map<string, ControlDef>();
  info: InfoState = { title: "", description: "" };
  dirty = false;

  loadPreset(preset: Preset) {
    this.controls.clear();
    const allControls = [...preset.controls, ...(preset.cameraControls ?? [])];
    for (const c of allControls) {
      this.controls.set(c.id, {
        id: c.id,
        label: c.label,
        min: c.min,
        max: c.max,
        value: c.initial,
        initial: c.initial,
      });
    }
    if (preset.labels) {
      for (const lbl of preset.labels) {
        const axes: [string, number][] = [
          ["X", lbl.anchor[0]],
          ["Y", lbl.anchor[1]],
          ["Z", lbl.anchor[2]],
        ];
        for (const [axis, val] of axes) {
          const id = `label_${lbl.id}_${axis}`;
          this.controls.set(id, {
            id,
            label: `${lbl.text} ${axis}`,
            min: -2,
            max: 2,
            value: val,
            initial: val,
          });
        }
      }
    }
    this.info = { ...preset.info };
    this.dirty = true;
  }

  setControlValue(id: string, value: number) {
    const ctrl = this.controls.get(id);
    if (ctrl) ctrl.value = value;
  }

  getControlValues(preset: Preset): number[] {
    return preset.controls.map((c) => {
      const ctrl = this.controls.get(c.id);
      return ctrl ? ctrl.value : c.initial;
    });
  }

  reset() {
    this.controls.clear();
    this.info = { title: "", description: "" };
    this.dirty = true;
  }
}
