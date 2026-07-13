/*
 * Bridge between the <particle-bg> component and the ported Three.js engine.
 *
 * Placeholder for the first boot milestone: the engine files are ported under
 * ./engine, but wiring them (and vendoring Three.js into the importmap) is the
 * next step. Until then this throws so <particle-bg> degrades to a plain black
 * background and releases the loading screen.
 */
export async function startParticles(_canvas: HTMLCanvasElement): Promise<void> {
  throw new Error('particle engine not wired yet');
}
