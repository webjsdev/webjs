import { signal } from '@webjsdev/core';
import type { ProjectedLabel } from './engine/label-projection.ts';

/*
 * Module-scope signal shared by the imperative particle boot loop (which
 * projects the 3D label anchors to screen space each frame) and the
 * <label-overlay> component (which renders the DOM labels + connector lines).
 * A module-scope signal is the framework's cross-module shared-state primitive:
 * every module that imports this one gets the same instance.
 *
 * The held object is mutated IN PLACE every animation frame (its `labels`
 * array and `opacity`), so we deliberately never call `.set()` per frame: a
 * per-frame notification would drive re-render machinery the overlay does not
 * use (it reads the value inside its own rAF, outside any reactive context, so
 * no subscription is created). The signal is the shared, discoverable holder.
 *
 * Only an `import type` reaches the engine, so this module is SSR-safe and
 * never pulls in three at strip time.
 */
export interface LabelState {
  labels: ProjectedLabel[];
  opacity: number;
}

export const labelState = signal<LabelState>({ labels: [], opacity: 0 });
