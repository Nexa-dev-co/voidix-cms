import * as THREE from "three";

import { createAccretionMark } from "@/lib/content/siteWorksField/transitions/accretionTransition";
import type { PreparedMark } from "@/lib/content/siteWorksField/transitions/markTransition";
import { SLATE_400, SLATE_800 } from "@/lib/coolPalette";

/**
 * The mark, grown into stone, in a box the size of a dialog.
 *
 * ── ⚠ WHAT IS THE SITE'S AND WHAT IS OURS ───────────────────────────────────────────────────────
 * The BODY is the site's, exactly: `createAccretionMark` is vendored verbatim under
 * `siteWorksField/` and cuts the same stones, seeds them off the same core and overgrows them with
 * the same geode. Nothing in this file touches it beyond handing it a mark and asking for the
 * resting frame.
 *
 * The RIG is ours, and has to be — the site's is 3,472 lines of scroll choreography, adaptive
 * resolution and a two-stage composer feeding a chamber reveal, none of which a still object in a
 * dialog has any use for. What it is NOT free to do is light the mark differently: stone lit by a
 * warm key stops being the thing an editor is checking. So every look constant below is copied from
 * `useWorksField.ts` with its source named, and those are the numbers to re-check if a preview ever
 * stops matching the section while every vendored file still hashes clean.
 *
 * ── ⚠ THE ORDER OF THE PASSES IS THE ONE THING THAT CANNOT BE SIMPLIFIED ────────────────────────
 * Bloom must bleed on LINEAR HDR values, before the tone curve compresses them, and the tone curve
 * must be applied exactly once. That is why the composer's target is `HalfFloatType` and why
 * `OutputPass` — which is what applies the renderer's tone mapping and colour space — is last.
 * Render straight to the canvas with bloom bolted on and the geode's amber goes flat, which is
 * precisely the channel the preview exists to show.
 */

// ── Framing ────────────────────────────────────────────────────────────
/** `CAMERA_FOV` in useWorksField.ts. */
const CAMERA_FOV = 38;
/** `markTargetSize` / `markDepth` in worksTuning.ts — the mark's world size on the site. */
const MARK_TARGET_SIZE = 2.6;
const MARK_DEPTH = 0.7;
/** Air around the mark, as a multiple of its size. Enough that a crystal spike never touches an edge. */
const FRAMING_PADDING = 1.35;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

// ── Lighting, copied from useWorksField.ts ─────────────────────────────
/** The coldest key on the site, so the stone reads blue-grey and the geode reads as heat. */
const KEY_LIGHT_COLOR = SLATE_800;
const KEY_LIGHT_INTENSITY = 2.1;
const KEY_LIGHT_POSITION = new THREE.Vector3(5, 8, 6);
const FILL_LIGHT_COLOR = SLATE_400;
const FILL_LIGHT_INTENSITY = 0.6;
const FILL_LIGHT_POSITION = new THREE.Vector3(-6, -2, 3);
const AMBIENT_INTENSITY = 0.18;
const TONE_MAPPING_EXPOSURE = 1.15;
/** Roughness handed to `PMREMGenerator.fromScene`; the site's cool image-based lighting. */
const ENVIRONMENT_BLUR = 0.04;

// ── Bloom, copied from useWorksField.ts ────────────────────────────────
const BLOOM_STRENGTH = 0.48;
const BLOOM_RADIUS = 0.55;
const BLOOM_THRESHOLD = 0.6;

// ── Motion ─────────────────────────────────────────────────────────────
/**
 * How far the idle turn swings either side of face-on, in radians.
 *
 * A full spin was the obvious choice and it is the wrong one. The mark is a slab `markDepth` thick,
 * and past roughly 35° the site's own camera notes say it stops reading as a logo and becomes a bar
 * — so a preview that spends half its time there would spend half its time showing something the
 * section never shows. This oscillates inside that arc, which is the range a visitor actually sees.
 * Dragging is not clamped the same way: an editor asking to look at the edge has asked for the edge.
 */
const IDLE_SWING = 0.42;
const IDLE_SECONDS_PER_CYCLE = 14;
/** A slight lift, so the top faces catch the key light rather than presenting a flat front. */
const IDLE_PITCH = -0.12;

const DRAG_RADIANS_PER_PIXEL = 0.008;
/** Past this the mark is edge-on and there is nothing left to see. */
const MAX_DRAG_PITCH = Math.PI / 2.4;

/** Doubling the pixel ratio for a still object is spending someone's battery on nothing. */
const MAX_PIXEL_RATIO = 2;

export interface MarkPreviewScene {
  /** Stops the loop and frees the GPU. Safe to call twice, and safe to call mid-build. */
  dispose(): void;
}

export interface MarkPreviewOptions {
  canvas: HTMLCanvasElement;
  mark: PreparedMark;
  /** Reports the cut as finished, so the caller can take its loading state down. */
  onReady?: () => void;
}

/**
 * Distance at which the mark fills the frame in BOTH axes.
 *
 * The vertical field of view is the given one; the horizontal follows from the aspect. A portrait
 * canvas — which is what a dialog on a phone is — is tighter horizontally, so fitting only to the
 * vertical would push the mark's ends off the sides.
 */
function fittingDistance(aspect: number): number {
  const halfExtent = (MARK_TARGET_SIZE / 2) * FRAMING_PADDING;
  const verticalHalfAngle = THREE.MathUtils.degToRad(CAMERA_FOV) / 2;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * aspect);

  return Math.max(
    halfExtent / Math.tan(verticalHalfAngle),
    halfExtent / Math.tan(horizontalHalfAngle),
    // The slab has thickness, and the camera is looking at the middle of it.
    MARK_DEPTH,
  );
}

export async function createMarkPreviewScene({
  canvas,
  mark,
  onReady,
}: MarkPreviewOptions): Promise<MarkPreviewScene> {
  // `alpha: true` because the dialog paints the site's own `--bg` behind the canvas rather than the
  // renderer clearing to it — one background, and it stays put while the canvas is still empty.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const { RoomEnvironment } = await import(
    "three/examples/jsm/environments/RoomEnvironment.js"
  );
  const environmentTexture = pmremGenerator.fromScene(new RoomEnvironment(), ENVIRONMENT_BLUR)
    .texture;
  scene.environment = environmentTexture;
  pmremGenerator.dispose();

  const keyLight = new THREE.DirectionalLight(KEY_LIGHT_COLOR, KEY_LIGHT_INTENSITY);
  keyLight.position.copy(KEY_LIGHT_POSITION);
  const fillLight = new THREE.DirectionalLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
  fillLight.position.copy(FILL_LIGHT_POSITION);
  scene.add(keyLight, fillLight, new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));

  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
    await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js"),
    ]);

  // HDR all the way to the OutputPass — see the header. `samples` gives the composer's target MSAA,
  // which is the antialiasing that counts once nothing draws to the default framebuffer.
  const composerTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, composerTarget);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD),
  );
  composer.addPass(new OutputPass());

  // ⚠ Cutting one mark is the longest block here, and the dialog can be closed while it runs. There
  // is no handle to dispose yet at that point, so the caller cannot cancel it — it awaits the
  // promise and disposes what it resolves to. That is why `dispose` below has to be safe to call on
  // a scene nobody ever saw a frame of.
  const strategy = await createAccretionMark([mark], {
    targetSize: MARK_TARGET_SIZE,
    depth: MARK_DEPTH,
    // Nothing in the accretion body reads this; the mark is cut at one fidelity either way.
    performanceTier: "high",
  });

  let disposed = false;

  scene.add(strategy.object);
  // From and to the same mark is "sit still on this one" — `ACCRETION_MODE.settled`, which is the
  // fully formed body with its geode grown. The progress is ignored in that mode; 1 is written
  // rather than 0 only because it reads as "finished" to anyone stepping through this.
  strategy.setTransition(0, 0, 1);
  onReady?.();

  // ── Looking around ──
  const orientation = { yaw: 0, pitch: IDLE_PITCH };
  let dragPointerId: number | null = null;
  let lastPointer = { x: 0, y: 0 };
  /** Set on the first drag and never cleared: once an editor has aimed it, it stays where they put it. */
  let hasBeenDragged = false;

  const handlePointerDown = (event: PointerEvent) => {
    dragPointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== dragPointerId) return;
    hasBeenDragged = true;
    orientation.yaw += (event.clientX - lastPointer.x) * DRAG_RADIANS_PER_PIXEL;
    orientation.pitch = THREE.MathUtils.clamp(
      orientation.pitch + (event.clientY - lastPointer.y) * DRAG_RADIANS_PER_PIXEL,
      -MAX_DRAG_PITCH,
      MAX_DRAG_PITCH,
    );
    lastPointer = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== dragPointerId) return;
    dragPointerId = null;
    canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);

  // ── Size ──
  const applySize = () => {
    // The canvas is laid out by CSS; `clientWidth` is the only honest source for how big it ended up.
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);

    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(0, 0, fittingDistance(camera.aspect));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(applySize);
  resizeObserver.observe(canvas);
  applySize();

  // ── The loop ──
  const clock = new THREE.Clock();
  let frameHandle = 0;

  const renderFrame = () => {
    frameHandle = requestAnimationFrame(renderFrame);
    const elapsed = clock.getElapsedTime();

    if (!hasBeenDragged) {
      orientation.yaw = Math.sin((elapsed / IDLE_SECONDS_PER_CYCLE) * Math.PI * 2) * IDLE_SWING;
    }

    strategy.object.rotation.set(orientation.pitch, orientation.yaw, 0);
    // The strategy's own `update` is a no-op by design — on the site the rig owns the spin, and this
    // is the rig. Called anyway so a future idle motion added there is not silently dropped here.
    strategy.update(elapsed);
    composer.render();
  };

  renderFrame();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;

      cancelAnimationFrame(frameHandle);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);

      strategy.dispose();
      composer.dispose();
      composerTarget.dispose();
      environmentTexture.dispose();
      // Frees the WebGL context itself. Without it a browser drops the OLDEST context once a handful
      // of previews have been opened — so the fifth one would render a blank box.
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
