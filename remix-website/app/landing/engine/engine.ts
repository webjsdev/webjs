import {
  Color,
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { BackgroundPass } from "./background-pass.ts";
import type { SystemSettings } from "./types.ts";

function screenScale(width: number): number {
  const ref = 1440;
  return Math.min(width / ref, 1);
}

// Stand-in for `three/addons/controls/OrbitControls`. We only need the
// look-at target and an enabled flag; the real addon pulled in pointer/touch/
// wheel gesture handlers and damping logic that the landing never used.
class CameraTargetControls {
  target = new Vector3();
  enabled = true;
  private camera: PerspectiveCamera;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
  }

  update() {
    this.camera.lookAt(this.target);
  }

  dispose() {}
}

export class Engine {
  renderer!: WebGLRenderer;
  scene!: Scene;
  camera!: PerspectiveCamera;
  controls!: CameraTargetControls;
  composer!: EffectComposer;
  afterImagePass!: AfterimagePass;
  bloomPass!: UnrealBloomPass;
  backgroundPass!: BackgroundPass;

  private resizeObserver: ResizeObserver | null = null;
  private containerWidth = 1440;
  private lastAppliedSettings: SystemSettings | null = null;
  private lastAppliedWidth = -1;
  private clearColor = new Color();

  init(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    settings: SystemSettings,
  ) {
    this.scene = new Scene();

    this.camera = new PerspectiveCamera(
      settings.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );
    this.camera.position.set(0, 30, 80);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      // The composer pipeline is fully alpha-blended with `depthWrite: false`
      // and never reads/writes the stencil buffer, so we can drop both
      // attachments to save bandwidth on the default framebuffer.
      depth: false,
      stencil: false,
      // Hint dual-GPU laptops to use the discrete GPU.
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.clearColor.set(settings.backgroundColor);
    this.renderer.setClearColor(this.clearColor);

    this.controls = new CameraTargetControls(this.camera);

    // Match Three's default render-target type (HalfFloat) so tone reproduction
    // through bloom/afterimage stays identical, but drop depth/stencil since
    // no pass uses them.
    const composerTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.composer = new EffectComposer(this.renderer, composerTarget);

    // Background pass draws the mesh gradient into the composer's read
    // buffer first. RenderPass then runs with `clear = false` so particles
    // composite on top of the gradient instead of wiping it to black.
    this.backgroundPass = new BackgroundPass();
    this.backgroundPass.setSize(container.clientWidth, container.clientHeight);
    this.composer.addPass(this.backgroundPass);

    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clear = false;
    this.composer.addPass(renderPass);

    this.afterImagePass = new AfterimagePass(settings.trailIntensity);
    this.composer.addPass(this.afterImagePass);

    this.containerWidth = container.clientWidth;
    const s = screenScale(this.containerWidth);
    const bloomSize = new Vector2(
      container.clientWidth,
      container.clientHeight,
    );
    this.bloomPass = new UnrealBloomPass(
      bloomSize,
      settings.bloomStrength * s,
      0.4,
      settings.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);

    this.resizeObserver = new ResizeObserver(() =>
      this.handleResize(container),
    );
    this.resizeObserver.observe(container);
  }

  private handleResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.containerWidth = w;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.backgroundPass.setSize(w, h);
  }

  getScreenScale(): number {
    return screenScale(this.containerWidth);
  }

  updateSettings(settings: SystemSettings) {
    // Called every frame from the animate loop. Most frames see the same
    // settings reference and the same container width, so guard the body to
    // skip a per-frame Color allocation, a `setClearColor` round-trip and a
    // few uniform writes. The afterimage `damp` uniform is intentionally not
    // touched here: the animate loop overrides it every frame with a value
    // that blends in trail boost and reduce-motion, so any value written here
    // would be immediately clobbered.
    if (
      settings === this.lastAppliedSettings &&
      this.containerWidth === this.lastAppliedWidth
    ) {
      return;
    }
    this.lastAppliedSettings = settings;
    this.lastAppliedWidth = this.containerWidth;

    const s = screenScale(this.containerWidth);
    this.clearColor.set(settings.backgroundColor);
    this.renderer.setClearColor(this.clearColor);
    this.bloomPass.strength = settings.bloomStrength * s;
    this.bloomPass.threshold = settings.bloomThreshold;

    if (this.camera.fov !== settings.cameraFov) {
      this.camera.fov = settings.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  render(time: number) {
    this.controls.update();
    this.backgroundPass.setTime(time);
    this.composer.render();
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.composer?.dispose();
    this.backgroundPass?.dispose();
  }
}
