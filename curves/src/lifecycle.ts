import * as THREE from "three";
import type { Instance, Orb, Runtime, Handlers } from "./types";

export function disposePoints(p: THREE.Points) {
  p.geometry?.dispose();
  const m = p.material;
  if (Array.isArray(m)) {
    for (let i = 0; i < m.length; i++) {
      m[i].dispose();
    }
  } 
  else m.dispose();
}

export function disposeMesh(m: THREE.Mesh) {
  m.geometry?.dispose();
  const mat = m.material;
  if (Array.isArray(mat)) {
    for (let i = 0; i < mat.length; i++) {
      mat[i].dispose();
    }
  } 
  else mat.dispose();
}

export function disposeInstance(scene: THREE.Scene, i: Instance) {
  scene.remove(i.group);

  disposePoints(i.green.obj);
  disposePoints(i.blue.obj);

  disposeMesh(i.greenCap);
  disposeMesh(i.blueCap);

  i.group.clear();
}

export function disposeOrb(scene: THREE.Scene, o: Orb) {
  scene.remove(o.group);
  disposeMesh(o.circle);
  disposeMesh(o.icon);
  o.alphaTex.dispose();
  o.group.clear();
}

export function cleanup(runtime: Runtime, handlers: Handlers, disposeRenderer?: boolean) {
  // Remove listeners
  window.removeEventListener("resize", handlers.onResize);
  document.removeEventListener("keydown", handlers.onKeyDown);

  disposeInstance(runtime.scene, runtime.left);
  disposeInstance(runtime.scene, runtime.right);
  disposeOrb(runtime.scene, runtime.orb);

  // Optionally dispose renderer if you're unmounting the canvas
  if (disposeRenderer) runtime.renderer.dispose();
}
