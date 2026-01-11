import "./style.css";
import * as THREE from "three";
import type { AnimState, Config, Runtime, Handlers, CreateCurveInstanceParams } from "./types";
import { getScreenWidth, makeConfig } from "./config";
import { updateOrthoCamera } from "./camera";
import { createCurveInstance, computeLayout, applyLayout, updateCurveInstance, setInstanceVisible } from "./curves";
import { createOrb, setOrbOpacity, setOrbVisible, setOrbZ, computeOrbForward, computeOrbBackward, applyOrbForward, applyOrbBackward } from "./orb";
import { chooseDirection, startRun, tickStep } from "./animation";
import { cleanup } from "./lifecycle";

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

  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: "low-power", antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

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

// ------------ app ------------

const sw = getScreenWidth(window.innerWidth);
const cfg = makeConfig(sw);
const rt = makeRuntime(cfg);
let state = makeInitialState();

// Initially hidden
setInstanceVisible(rt.left, false);
setInstanceVisible(rt.right, false);
setOrbVisible(rt.orb, false);
setOrbOpacity(rt.orb, 0);

// Initial layout + render
layoutAndRender();

// RAF token
let raf: number | null = null;

const handlers: Handlers = {
  onKeyDown,
  onResize,
};

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
    setOrbZ(rt.orb, rt.camera.position.z + 2);
    setOrbOpacity(rt.orb, 0);
  }
  if (state.direction === "backward") {
    state = { ...state, orbState: "exiting" };
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
    // Hide instances immediately (optional)
    setInstanceVisible(rt.left, false);
    setInstanceVisible(rt.right, false);
    setOrbVisible(rt.orb, false);

    rt.renderer.render(rt.scene, rt.camera);

    // Cleanup (dispose/unmount)
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

  // Orb animation
  if (!state.lifecycleCompleted) {
    if (state.direction === "forward" && !state.hasCompletedForwardRun) {
      const v = computeOrbForward(state.tEnd, state.forwardStartT, rt.camera.position.z);
      state = { ...state, orbState: v.state };
      applyOrbForward(rt.orb, v);
    } else if (state.direction === "backward") {
      const v = computeOrbBackward(state.tEnd, cfg.backwardFadeFraction);
      state = { ...state, orbState: v.state };
      applyOrbBackward(rt.orb, v);
      // keep it at center during fade
      setOrbZ(rt.orb, 0);
    }
  }

  rt.renderer.render(rt.scene, rt.camera);
}

function onResize() {
  rt.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rt.renderer.setSize(window.innerWidth, window.innerHeight);

  updateOrthoCamera(rt.camera, cfg, window.innerWidth, window.innerHeight);
  layoutAndRender();
}

function layoutAndRender() {
  const layout = computeLayout(rt.camera, cfg, rt.left.baseWidth, rt.right.baseWidth);
  applyLayout(rt.left, rt.right, layout);

  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.left, state.tEnd);
  updateCurveInstance(cfg, rt.camera, rt.renderer, rt.right, state.tEnd);

  rt.renderer.render(rt.scene, rt.camera);
}
