import type { ProjectedLabel } from './engine/label-projection.ts';

/*
 * Shared browser-only singleton bridging the particle boot loop (which
 * projects the 3D label anchors to screen space each frame) and the
 * <label-overlay> component (which renders the DOM labels + connector lines).
 * Only a `import type` reaches the engine here, so this module is SSR-safe and
 * never pulls in three at strip time.
 */
export const labelState: { labels: ProjectedLabel[]; opacity: number } = {
  labels: [],
  opacity: 0,
};
