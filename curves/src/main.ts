import "./style.css";
import * as THREE from "three";

import type { AnimState, Config, Runtime, Handlers, CreateCurveInstanceParams } from "./types";
import { getScreenWidth, makeConfig } from "./config";
import { updateOrthoCamera } from "./camera";

import {
  createCurveInstance,
  updateCurveInstance,
  setInstanceVisible,
  retargetInstance,
} from "./curves";

import {
  createOrb,
  setOrbOpacity,
  setOrbVisible,
  setOrbZ,
  computeOrbForward,
  computeOrbBackward,
  applyOrbForward,
  applyOrbBackward,
} from "./orb";

import { chooseDirection, startRun, tickStep } from "./animation";
import { cleanup } from "./lifecycle";

import {
  worldFromViewport,
  getCornerOrigins,
  makeCornerToOrbCurves,
} from "./targeting";

// ------------ init runtime ------------

function requireCanvas(sel: string): HTMLCanvasElement {
  const el = document.querySelector(sel);
  if (!el) throw new Error("unable to get canvas!");
  return el as HTMLCanvasElement;
}

function makeRuntime(cfg: Config): Runtime {
  const canvas = requireCanvas("#bg");
  const scene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  updateOrthoCamera(camera, cfg, window.innerWidth, window.innerHeight);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    powerPreference: "low-power",
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // NOTE:
  // These initial params are now just placeholders to create the geometry buffers/materials.
  // We will *retarget* the actual curves to point at the orb after we decide orb position.
  const startX = cfg.pointPx <= 3 ? 2 : cfg.pointPx <= 6 ? 3 : 4;

  const leftParams: CreateCurveInstanceParams = {
    green: [startX, 0.4, -4, 0.1, 0.5, 2, -1.35, -2],
    blue: [startX, 0.4, -4, 0.5, 0.5, 1.5, -1.35, -2.5],
  };

  const rightParams: CreateCurveInstanceParams = {
    green: [-startX, -0.54, 4, 0.1, -1.35, -2, 0.5, 2],
    blue: [-startX, -0.54, 4, 0.5, -1.35, -2.5, 0.5, 1.5],
  };

  const left = createCurveInstance(cfg, leftParams);
  const right = createCurveInstance(cfg, rightParams);

  // IMPORTANT:
  // We no longer use "50% width layout scaling". The curve points are in world-space.
  // Keep groups unscaled and centered at origin; only retarget curves.
  left.group.position.set(0, 0, 0);
  right.group.position.set(0, 0, 0);
  left.group.scale.setScalar(1);
  right.group.scale.setScalar(1);

  scene.add(left.group);
  scene.add(right.group);

  // Orb
  const orb = createOrb(cfg, camera.position.z);
  scene.add(orb.group);

  return { canvas, scene, camera, renderer, left, right, orb };
}

function makeInitialState(): AnimState {
  return {
    running: false,
    direction: "forward",
    orbState: "hidden",

    tEnd: 0,
    lastTime: undefined,
    runId: 0,

    forwardStartT: 0,
    hasStartedLifecycle: false,
    hasCompletedForwardRun: false,
    lifecycleCompleted: false,
  };
}

// ------------ dynamic targeting (curves -> orb) ------------

// If you want to move the orb later, store these in state/config and recompute on demand.
const ORB_ANCHOR = { u: 0.5, v: 0.5 }; // viewport coords (0..1)

function computeOrbWorld(rt: Runtime): THREE.Vector2 {
  return worldFromViewport(rt.camera, ORB_ANCHOR.u, ORB_ANCHOR.v);
}

/**
 * Retarget both instances so they originate from:
 * - leftInstance: bottom-left corner
 * - rightInstance: top-right corner
 * and both "point at" the orb's world xy.
 *
 * NOTE: This is intentionally *not* called per-frame.
 * Call it on init, on resize, and any time you change orb x/y.
 */
function retargetInstancesToOrb(
  cfg: Config,
  rt: Runtime,
  tEnd: number,
  orbWorld: THREE.Vector2
) {
  // Corner origins with padding so points don't clip
  const origins = getCornerOrigins(rt.camera, rt.renderer, cfg.pointPx * 3);

  // Compute new bezier params to aim at orb
  const leftCurves = makeCornerToOrbCurves(
    cfg,
    rt.camera,
    rt.renderer,
    origins.bottomLeft,
    orbWorld,
    +1, // bend direction
    cfg.orbRadius,
    { green: cfg.capPxGreen, blue: cfg.capPxBlue }
  );

  const rightCurves = makeCornerToOrbCurves(
    cfg,
    rt.camera,
    rt.renderer,
    origins.topRight,
    orbWorld,
    -1, // mirrored bend
    cfg.orbRadius,
    { green: cfg.capPxGreen, blue: cfg.capPxBlue }
  );

  // Apply into existing geometry buffers
  retargetInstance(cfg, rt.left, leftCurves);
  retargetInstance(cfg, rt.right, rightCurves);

  // Re-apply current animation state (drawRange + exact end point + cap placement)
  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.left, tEnd);
  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.right, tEnd);
}

// ------------ app ------------

const sw = getScreenWidth(window.innerWidth);
const cfg = makeConfig(sw);
const rt = makeRuntime(cfg);
let state = makeInitialState();

// Initial orb world position
let orbWorld = computeOrbWorld(rt);

// Initial visibility state
setInstanceVisible(rt.left, false);
setInstanceVisible(rt.right, false);
setOrbVisible(rt.orb, false);
setOrbOpacity(rt.orb, 0);

// Place orb at target xy
rt.orb.group.position.x = orbWorld.x;
rt.orb.group.position.y = orbWorld.y;

// Retarget curves to this orb
retargetInstancesToOrb(cfg, rt, state.tEnd, orbWorld);

// Initial render
rt.renderer.render(rt.scene, rt.camera);

// RAF token
let raf: number | null = null;

const handlers: Handlers = { onKeyDown, onResize };

document.addEventListener("keydown", handlers.onKeyDown);
window.addEventListener("resize", handlers.onResize);

function onKeyDown(e: KeyboardEvent) {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (state.running) return;
  if (state.lifecycleCompleted) return;

  // Choose direction based on lifecycle progress
  state = { ...state, direction: chooseDirection(state) };

  // Show instances at first start
  if (!state.hasStartedLifecycle) {
    setInstanceVisible(rt.left, true);
    setInstanceVisible(rt.right, true);
  }

  // Orb setup for phase
  if (state.direction === "forward" && !state.hasCompletedForwardRun) {
    state = { ...state, forwardStartT: state.tEnd, orbState: "entering" };
    setOrbVisible(rt.orb, true);

    // Drop-in starts behind camera; keep xy pinned to orbWorld
    rt.orb.group.position.x = orbWorld.x;
    rt.orb.group.position.y = orbWorld.y;

    setOrbZ(rt.orb, rt.camera.position.z + 2);
    setOrbOpacity(rt.orb, 0);
  }

  if (state.direction === "backward") {
    state = { ...state, orbState: "exiting" };

    // Keep orb centered; fade/dissolve logic happens in applyFrame
    rt.orb.group.position.x = orbWorld.x;
    rt.orb.group.position.y = orbWorld.y;

    setOrbZ(rt.orb, 0);
    setOrbOpacity(rt.orb, 1);
  }

  // Start run (pure)
  state = startRun(cfg, state);

  // Kick raf
  if (raf !== null) cancelAnimationFrame(raf);
  const myRun = state.runId;
  raf = requestAnimationFrame((now) => tick(now, myRun));
}

function tick(now: number, myRun: number) {
  // Ignore old queued frames
  if (myRun !== state.runId) return;

  const res = tickStep(cfg, state, now);
  state = res.state;

  // Apply visual updates (impure)
  applyFrame();

  if (res.didCompleteLifecycle) {
    // Hide immediately (optional)
    setInstanceVisible(rt.left, false);
    setInstanceVisible(rt.right, false);
    setOrbVisible(rt.orb, false);

    rt.renderer.render(rt.scene, rt.camera);

    // Dispose/unmount
    cleanup(rt, handlers);
    return;
  }

  if (!res.didStop) {
    raf = requestAnimationFrame((t) => tick(t, myRun));
  }
}

function applyFrame() {
  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.left, state.tEnd);
  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.right, state.tEnd);

  // Orb animation (orb xy stays pinned; z/opacity/scale/rotation updated)
  if (!state.lifecycleCompleted) {
    if (state.direction === "forward" && !state.hasCompletedForwardRun) {
      const v = computeOrbForward(state.tEnd, state.forwardStartT, rt.camera.position.z);
      state = { ...state, orbState: v.state };

      // keep orb centered in xy while it drops in z
      rt.orb.group.position.x = orbWorld.x;
      rt.orb.group.position.y = orbWorld.y;

      applyOrbForward(rt.orb, v);
    } else if (state.direction === "backward") {
      const v = computeOrbBackward(state.tEnd, cfg.backwardFadeFraction);
      state = { ...state, orbState: v.state };

      rt.orb.group.position.x = orbWorld.x;
      rt.orb.group.position.y = orbWorld.y;

      applyOrbBackward(rt.orb, v);
      setOrbZ(rt.orb, 0);
    }
  }

  rt.renderer.render(rt.scene, rt.camera);
}

function onResize() {
  rt.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rt.renderer.setSize(window.innerWidth, window.innerHeight);

  updateOrthoCamera(rt.camera, cfg, window.innerWidth, window.innerHeight);

  // Recompute orb position in world-space from the same viewport anchor
  orbWorld = computeOrbWorld(rt);
  rt.orb.group.position.x = orbWorld.x;
  rt.orb.group.position.y = orbWorld.y;

  // Retarget curves so they continue to point at orb + originate from corners
  retargetInstancesToOrb(cfg, rt, state.tEnd, orbWorld);

  rt.renderer.render(rt.scene, rt.camera);
}
1
