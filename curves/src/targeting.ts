import * as THREE from "three";
import type { Config, CurveParams } from "./types";
import { worldUnitsPerPixelOrtho } from "./camera";

export type CornerOrigins = {
  bottomLeft: THREE.Vector2;
  topRight: THREE.Vector2;
};

// Visible bounds in world units, taking zoom into account
function getVisibleBounds(cam: THREE.OrthographicCamera) {
  const left = cam.left / cam.zoom;
  const right = cam.right / cam.zoom;
  const top = cam.top / cam.zoom;
  const bottom = cam.bottom / cam.zoom;
  return { left, right, top, bottom };
}

export function getCornerOrigins(
  cam: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  padPx: number
): CornerOrigins {
  const b = getVisibleBounds(cam);
  const padWorld = padPx * worldUnitsPerPixelOrtho(cam, renderer);

  return {
    bottomLeft: new THREE.Vector2(b.left + padWorld, b.bottom + padWorld),
    topRight: new THREE.Vector2(b.right - padWorld, b.top - padWorld),
  };
}

export function worldFromViewport(
  cam: THREE.OrthographicCamera,
  u: number, // 0..1 left->right
  v: number  // 0..1 bottom->top
): THREE.Vector2 {
  const b = getVisibleBounds(cam);
  return new THREE.Vector2(
    b.left + (b.right - b.left) * u,
    b.bottom + (b.top - b.bottom) * v
  );
}

/**
 * Build a cubic bezier from `start` towards `orb`,
 * with a “bend” and a small “spread” between green/blue lines.
 *
 * - `bendSign`: +1 or -1 to mirror left/right instance curvature
 * - `spreadWorld`: separation between green/blue in world units (perpendicular)
 * - `endInsetWorld`: stop slightly short of the orb (so cap doesn’t overlap)
 */
export function makeCornerToOrbCurves(
  cfg: Config,
  cam: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  start: THREE.Vector2,
  orb: THREE.Vector2,
  bendSign: 1 | -1,
  orbRadiusWorld: number,
  capPx: { green: number; blue: number }
): { green: CurveParams; blue: CurveParams } {
  const wpp = worldUnitsPerPixelOrtho(cam, renderer);

  // Convert cap sizes to world so we can inset the line ends nicely
  const capWorldGreen = capPx.green * wpp;
  const capWorldBlue = capPx.blue * wpp;

  const toOrb = new THREE.Vector2().subVectors(orb, start);
  const len = Math.max(1e-6, toOrb.length());
  const dir = toOrb.clone().multiplyScalar(1 / len);
  const perp = new THREE.Vector2(-dir.y, dir.x);

  // Spread lines apart consistently in px (converted to world)
  const spreadWorld = (cfg.pointPx * 1.6) * wpp;

  // End inset so caps “kiss” the orb rather than overlap it
  const endInsetGreen = orbRadiusWorld + capWorldGreen * 0.65;
  const endInsetBlue = orbRadiusWorld + capWorldBlue * 0.65;

  const endGreen = orb.clone().addScaledVector(dir, -endInsetGreen);
  const endBlue  = orb.clone().addScaledVector(dir, -endInsetBlue);

  // Controls: along the direction, plus a perpendicular bend
  const c1Along = len * 0.35;
  const c2Along = len * 0.75;

  const bend1 = bendSign * (len * 0.18);
  const bend2 = bendSign * (len * 0.06);

  // Offsets for parallel-ish curves (blue above green)
  const greenOff = perp.clone().multiplyScalar(-spreadWorld * 0.5);
  const blueOff  = perp.clone().multiplyScalar(+spreadWorld * 0.5);

  const greenStart = start.clone().add(greenOff);
  const blueStart  = start.clone().add(blueOff);

  const greenC1 = greenStart.clone()
    .addScaledVector(dir, c1Along)
    .addScaledVector(perp, bend1);

  const greenC2 = greenStart.clone()
    .addScaledVector(dir, c2Along)
    .addScaledVector(perp, bend2);

  const blueC1 = blueStart.clone()
    .addScaledVector(dir, c1Along)
    .addScaledVector(perp, bend1);

  const blueC2 = blueStart.clone()
    .addScaledVector(dir, c2Along)
    .addScaledVector(perp, bend2);

  return {
    green: [greenStart.x, greenStart.y, endGreen.x, endGreen.y, greenC1.x, greenC1.y, greenC2.x, greenC2.y],
    blue:  [blueStart.x,  blueStart.y,  endBlue.x,  endBlue.y,  blueC1.x,  blueC1.y,  blueC2.x,  blueC2.y],
  };
}

