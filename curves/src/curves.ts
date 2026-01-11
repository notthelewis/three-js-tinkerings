import * as THREE from "three";
import type { Config, CurveParams, CreateCurveInstanceParams, Instance } from "./types";
import { getVisibleSize, worldUnitsPerPixelOrtho } from "./camera";

export function create2DCurve([sx, sy, ex, ey, c1x, c1y, c2x, c2y]: CurveParams) {
  const vStart = new THREE.Vector2(sx, sy);
  const vEnd = new THREE.Vector2(ex, ey);
  const c1 = new THREE.Vector2(c1x, c1y);
  const c2 = new THREE.Vector2(c2x, c2y);
  return new THREE.CubicBezierCurve(vEnd, c2, c1, vStart);
}

export function makeCurvePoints(cfg: Config, curve: THREE.Curve<THREE.Vector2>, color: THREE.ColorRepresentation) {
  const pts = curve.getPoints(cfg.lineSegments);

  const positions = new Float32Array((cfg.lineSegments + 1) * 3);
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3 + 0] = pts[i].x;
    positions[i * 3 + 1] = pts[i].y;
    positions[i * 3 + 2] = 0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, cfg.lineSegments + 1);

  const mat = new THREE.PointsMaterial({
    size: cfg.pointPx,
    sizeAttenuation: false,
    color,
    forceSinglePass: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const obj = new THREE.Points(geom, mat);
  return { obj, geom, curve };
}

export function makeTeardropCap(color: THREE.ColorRepresentation) {
  const tipX = 0.2;
  const baseX = 0.0;
  const r = 0.30;
  const pinchY = 0.01;

  const shape = new THREE.Shape();
  shape.moveTo(baseX, r);
  shape.quadraticCurveTo(0.55, pinchY, tipX, 0.0);
  shape.quadraticCurveTo(0.55, -pinchY, baseX, -r);
  shape.quadraticCurveTo(-0.25, 0.0, baseX, r);

  const geom = new THREE.ShapeGeometry(shape, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;
  return mesh;
}

export function normalizeGroupOrigin(group: THREE.Group): THREE.Vector3 {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  for (const child of group.children) child.position.sub(center);
  return center;
}

export function setObjectZ(obj: THREE.Object3D, z: number) {
  obj.position.z = z;
}

export function setInstanceVisible(inst: Instance, v: boolean) {
  inst.group.visible = v;
}

export function setExactEndPoint(
  curve: THREE.Curve<THREE.Vector2>,
  geom: THREE.BufferGeometry,
  tEnd: number,
  count: number
) {
  const p = curve.getPoint(tEnd);
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const last = count - 1;
  pos.setXYZ(last, p.x, p.y, 0);
  pos.needsUpdate = true;
}

export function updateCap(
  cap: THREE.Mesh,
  curve: THREE.Curve<THREE.Vector2>,
  tEnd: number,
  originOffset: THREE.Vector3,
  desiredPx: number,
  groupScale: number,
  wpp: number
) {
  const p = curve.getPoint(tEnd);
  cap.position.set(p.x - originOffset.x, p.y - originOffset.y, 0);

  const te = Math.min(0.9999, Math.max(0.0001, tEnd));
  const tan = curve.getTangent(te).normalize();
  const angle = Math.atan2(tan.y, tan.x);
  cap.rotation.set(0, 0, angle);

  const desiredWorld = desiredPx * wpp;
  const inverse = groupScale !== 0 ? 1 / groupScale : 1;
  cap.scale.setScalar(desiredWorld * inverse);
}

export function createCurveInstance(cfg: Config, p: CreateCurveInstanceParams): Instance {
  const group = new THREE.Group();

  const green = makeCurvePoints(cfg, create2DCurve(p.green), cfg.green);
  const blue = makeCurvePoints(cfg, create2DCurve(p.blue), cfg.blue);
  group.add(green.obj);
  group.add(blue.obj);

  const greenCap = makeTeardropCap(cfg.green);
  const blueCap = makeTeardropCap(cfg.blue);

  green.obj.renderOrder = 1;
  blue.obj.renderOrder = 2;
  greenCap.renderOrder = 10;
  blueCap.renderOrder = 11;

  setObjectZ(green.obj, 1);
  setObjectZ(blue.obj, 2);
  setObjectZ(greenCap, 3);
  setObjectZ(blueCap, 4);

  group.add(greenCap);
  group.add(blueCap);

  const originOffset = normalizeGroupOrigin(group);

  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  return {
    group,
    green,
    blue,
    greenCap,
    blueCap,
    baseWidth: size.x,
    originOffset,
  };
}

export function updateCurveInstance(
  cfg: Config,
  cam: THREE.OrthographicCamera,
  renderer: THREE.WebGLRenderer,
  inst: Instance,
  tEnd: number
) {
  const count = Math.max(2, Math.floor(tEnd * cfg.lineSegments) + 1);

  inst.green.geom.setDrawRange(0, count);
  inst.blue.geom.setDrawRange(0, count);

  setExactEndPoint(inst.green.curve, inst.green.geom, tEnd, count);
  setExactEndPoint(inst.blue.curve, inst.blue.geom, tEnd, count);

  const wpp = worldUnitsPerPixelOrtho(cam, renderer);
  const s = inst.group.scale.x;

  updateCap(inst.greenCap, inst.green.curve, tEnd, inst.originOffset, cfg.capPxGreen, s, wpp);
  updateCap(inst.blueCap, inst.blue.curve, tEnd, inst.originOffset, cfg.capPxBlue, s, wpp);
}

export function computeLayout(
  cam: THREE.OrthographicCamera,
  cfg: Config,
  leftBaseWidth: number,
  rightBaseWidth: number
) {
  const v = getVisibleSize(cam);
  const targetWidth = Math.max(0.001, v.width * 0.5 - cfg.gutterWorld);

  const scaleLeft = targetWidth / leftBaseWidth;
  const scaleRight = targetWidth / rightBaseWidth;

  const xCenter = cfg.gutterWorld * 0.5 + targetWidth * 0.5;

  return { targetWidth, xCenter, scaleLeft, scaleRight };
}

export function applyLayout(left: Instance, right: Instance, layout: ReturnType<typeof computeLayout>) {
  left.group.scale.setScalar(layout.scaleLeft);
  right.group.scale.setScalar(layout.scaleRight);

  left.group.position.set(-layout.xCenter, 0, 0);
  right.group.position.set(+layout.xCenter, 0, 0);
}

