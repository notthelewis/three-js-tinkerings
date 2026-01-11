import * as THREE from "three";
import type { Config } from "./types";

export function computeOrthoFrustum(viewHeight: number, aspect: number) {
  const halfH = viewHeight / 2;
  const halfW = (viewHeight * aspect) / 2;
  return { top: halfH, bottom: -halfH, left: -halfW, right: halfW };
}

export function applyOrthoFrustum(cam: THREE.OrthographicCamera, f: ReturnType<typeof computeOrthoFrustum>) {
  cam.top = f.top;
  cam.bottom = f.bottom;
  cam.left = f.left;
  cam.right = f.right;
  cam.updateProjectionMatrix();
}

export function updateOrthoCamera(cam: THREE.OrthographicCamera, cfg: Config, width: number, height: number) {
  const aspect = width / height;
  const f = computeOrthoFrustum(cfg.viewHeight, aspect);
  applyOrthoFrustum(cam, f);
}

export function getVisibleSize(cam: THREE.OrthographicCamera) {
  const width = (cam.right - cam.left) / cam.zoom;
  const height = (cam.top - cam.bottom) / cam.zoom;
  return { width, height };
}

export function worldUnitsPerPixelOrtho(cam: THREE.OrthographicCamera, renderer: THREE.WebGLRenderer) {
  // drawing-buffer height includes DPR
  const pxH = renderer.domElement.height;
  const visibleH = (cam.top - cam.bottom) / cam.zoom;
  return visibleH / pxH;
}

