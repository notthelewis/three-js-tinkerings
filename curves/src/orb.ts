import * as THREE from "three";
import type { Config, Orb, OrbState } from "./types";
import { clamp, lerp, easeInCubic, easeOutCubic } from "./math";

export function makeSolidAlphaTexture(): THREE.Texture {
  const data = new Uint8Array([255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makePlayIcon(opts: {
  size: number;
  color: THREE.ColorRepresentation;
  alphaMap: THREE.Texture;
}) {
  const { size, color, alphaMap } = opts;

  const shape = new THREE.Shape();
  shape.moveTo(-0.60, 0.75);
  shape.lineTo(-0.60, -0.75);
  shape.lineTo(0.85, 0.00);
  shape.closePath();

  const geom = new THREE.ShapeGeometry(shape, 1);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    alphaMap,
    alphaTest: 0,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.scale.setScalar(size);
  return mesh;
}

export function createOrb(cfg: Config, cameraZ: number): Orb {
  const alphaTex = makeSolidAlphaTexture();

  const group = new THREE.Group();
  group.visible = false;
  group.position.set(0, 0, cameraZ + 2); // behind camera for drop-in

  const circleGeometry = new THREE.CircleGeometry(cfg.orbRadius, 125);
  const circleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    alphaMap: alphaTex,
  });

  const circle = new THREE.Mesh(circleGeometry, circleMaterial);
  circle.renderOrder = 100;

  const icon = makePlayIcon({
    size: cfg.orbRadius * 0.55,
    color: 0x120e08,
    alphaMap: alphaTex,
  });

  icon.position.z = 0.01;
  icon.renderOrder = 101;

  group.add(circle);
  group.add(icon);

  return { group, circle, icon, alphaTex };
}

export function setOrbOpacity(orb: Orb, alpha: number) {
  (orb.circle.material as THREE.MeshBasicMaterial).opacity = alpha;
  (orb.icon.material as THREE.MeshBasicMaterial).opacity = alpha;
}

export function setOrbVisible(orb: Orb, v: boolean) {
  orb.group.visible = v;
}

export function setOrbZ(orb: Orb, z: number) {
  orb.group.position.z = z;
}

export function setOrbScale(orb: Orb, s: number) {
  orb.group.scale.setScalar(s);
}

export function setOrbRotationZ(orb: Orb, rz: number) {
  orb.group.rotation.z = rz;
}

// Pure: compute forward “drop-in” transform values from tEnd
export function computeOrbForward(
  tEnd: number,
  forwardStartT: number,
  cameraZ: number
) {
  const p = clamp((tEnd - forwardStartT) / Math.max(1e-6, 1 - forwardStartT), 0, 1);
  const e = easeOutCubic(p);

  return {
    visible: true,
    state: (p >= 1 ? "visible" : "entering") as OrbState,
    z: lerp(cameraZ + 2, 0, e),
    opacity: e,
    scale: lerp(0.92, 1.0, e),
    rotZ: lerp(0.08, 0, e),
  };
}

// Pure: compute backward “fade out” over a fraction of backward run
export function computeOrbBackward(tEnd: number, backwardFraction: number) {
  const backProgress = clamp((1 - tEnd) / backwardFraction, 0, 1);
  const e = easeInCubic(backProgress);

  return {
    state: (backProgress >= 1 ? "gone" : "exiting") as OrbState,
    visible: backProgress < 1,
    opacity: 1 - e,
    scale: lerp(1.0, 0.92, e),
    rotZ: lerp(0, -0.12, e),
  };
}

export function applyOrbForward(orb: Orb, v: ReturnType<typeof computeOrbForward>) {
  setOrbVisible(orb, v.visible);
  setOrbZ(orb, v.z);
  setOrbOpacity(orb, v.opacity);
  setOrbScale(orb, v.scale);
  setOrbRotationZ(orb, v.rotZ);
}

export function applyOrbBackward(orb: Orb, v: ReturnType<typeof computeOrbBackward>) {
  setOrbVisible(orb, v.visible);
  // Keep z at center while fading
  setOrbOpacity(orb, v.opacity);
  setOrbScale(orb, v.scale);
  setOrbRotationZ(orb, v.rotZ);
}

