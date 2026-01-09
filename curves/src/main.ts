import "./style.css";
import * as THREE from "three";

const canvas = document.querySelector("#bg");
if (!canvas) throw new Error("unable to get canvas!");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.setZ(10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  powerPreference: "low-power",
  antialias: true,
});

const segments = 2000;
const pointSize = 0.18;
const greenCapSize = pointSize + 0.1;
const blueCapSize  = pointSize + 0.11;

// Fixed gutter (world units at z=0). This becomes:
// - gap between left & right instances
// - plus half-gutter padding to each screen edge
const gutter = 0.1

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

let running = false;
document.addEventListener("keypress", (e) => {
  if (e.key !== " ") return;
  running = !running;
  animate(lastTime);
});

// ===================================================
// Build two instances (left & right)
// ===================================================

const leftInstance = createCurveInstance({
  //     start        end    control1       control2
  //    s[x,  y]  e[x,   y]  c1[x,   y]    c2[x,    y]
  green: [4,0.9,   -4,   0,   0.5,   2,   -1.35,   -2],
  blue:  [4,0.9,   -4, 0.5,   0.5, 1.5,   -1.35, -2.5],
});

const rightInstance = createCurveInstance({
  //         start        end     control1       control2
  //    s[   x,  y]  e[x,  y]  c1[x,    y]   c2[ x,    y]
  green: [-4.0, -0.3,   4,   0,   -1.35, -2,     0.5,  2],
  blue:  [-4.0, -0.3,   4, 0.5,   -1.35, -2.5,   0.5,  1.5],
});

// leftInstance.group.rotateY(180);

scene.add(leftInstance.group);
scene.add(rightInstance.group);


// Animation: tEnd goes 1 -> 0 -> 1 ...
let tEnd = 1;
let dir = -1;
let lastTime: DOMHighResTimeStamp = new Date().getTime();

// Layout once initially
layoutInstances();

renderer.render(scene, camera);

function animate(t: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);

  if (!running) {
    lastTime = t;
    return;
  }

  const d = (t - lastTime) / 1000;
  lastTime = t;

  // Move tEnd
  tEnd += dir * d * 0.5;
  if (tEnd <= 0) { tEnd = 0; dir = 1; }
  if (tEnd >= 1) { tEnd = 1; dir = -1; }

  // Update both instances
  updateCurveInstance(leftInstance,  tEnd);
  updateCurveInstance(rightInstance, tEnd);

  renderer.render(scene, camera);
}

// Keep layout correct on resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  layoutInstances();
  renderer.render(scene, camera);
});

// ===================================================
// Instance creation + layout
// ===================================================

type CurveObj = {
  obj: THREE.Points;
  geom: THREE.BufferGeometry;
  curve: THREE.Curve<THREE.Vector2>;
};

type Instance = {
  group: THREE.Group;
  green: CurveObj;
  blue: CurveObj;
  greenCap: THREE.Mesh;
  blueCap: THREE.Mesh;
  baseWidth: number; // unscaled width of the whole instance
  originOffset: THREE.Vector3;
};

type CurveParams = [
  sx: N, sy: N,
  ex: N, ey: N,
  c1x: N, c1y: N,
  c2x: N, c2y: N,
];

type CreateCurveInstanceParams = {
  green: CurveParams;
  // Blue curve
  blue: CurveParams;
}

function createCurveInstance(p: CreateCurveInstanceParams): Instance {
  const group = new THREE.Group();

  // Curves 
  const green = makeCurvePoints( create2DCurve(p.green), 0x00ff00 );
  const blue  = makeCurvePoints( create2DCurve(p.blue), 0x0000ff );

  group.add(green.obj);
  group.add(blue.obj);

  // Caps (teardrops)
  const greenCap = makeTeardropCap(0x00ff00, greenCapSize);
  const blueCap  = makeTeardropCap(0x0000ff, blueCapSize);

  group.add(greenCap);
  group.add(blueCap);

  // Normalize group origin to its own bounds center so positioning is easy
  const originOffset = normalizeGroupOrigin(group);

  // Put caps at initial end position (tEnd = 1)
  updateCap(greenCap, green.curve, 1, originOffset, greenCapSize, 0);
  updateCap(blueCap, blue.curve, 1, originOffset, blueCapSize, 0);

  // Compute unscaled width once (for later layout scaling)
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  const inst: Instance = {
    group,
    green,
    blue,
    greenCap,
    blueCap,
    baseWidth: size.x,
    originOffset, 
  };

  // Ensure initial draw state consistent
  updateCurveInstance(inst, 1);

  return inst;
}

function updateCurveInstance(inst: Instance, tEnd: number) {
  const count = Math.max(2, Math.floor(tEnd * segments) + 1);

  inst.green.geom.setDrawRange(0, count);
  inst.blue.geom.setDrawRange(0, count);

  setExactEndPoint(inst.green.curve, inst.green.geom, tEnd, count);
  setExactEndPoint(inst.blue.curve, inst.blue.geom, tEnd, count);

  // Uniform scaling, both groups are identical
  const s = inst.group.scale.x;

  updateCap(inst.greenCap, inst.green.curve, tEnd, inst.originOffset, greenCapSize, s);
  updateCap(inst.blueCap,  inst.blue.curve,  tEnd, inst.originOffset, blueCapSize,  s);
}

function layoutInstances() {
  // Visible width at z=0 plane (where your points are)
  const v = getVisibleSizeAtZ0(camera);

  // Each instance should take up 50% of the visible width minus a fixed gutter
  const targetWidth = Math.max(0.001, v.width * 0.5 - gutter);

  // Scale both instances to that target width (based on their unscaled bounds)
  const sLeft  = targetWidth / leftInstance.baseWidth;
  const sRight = targetWidth / rightInstance.baseWidth;

  leftInstance.group.scale.setScalar(sLeft);
  rightInstance.group.scale.setScalar(sRight);

  // Place them left/right, centered vertically (y=0)
  // Gap between them will be `gutter`
  const xCenter = gutter * 0.5 + targetWidth * 0.5;

  leftInstance.group.position.set(-xCenter, 0, 0);
  rightInstance.group.position.set(+xCenter, 0, 0);

  updateCurveInstance(leftInstance, tEnd);
  updateCurveInstance(rightInstance, tEnd);
}

function getVisibleSizeAtZ0(cam: THREE.PerspectiveCamera) {
  // camera looks down -Z; our geometry is on z=0; camera at z=cam.position.z
  const dist = cam.position.z; // assumes z=0 plane
  const vFov = THREE.MathUtils.degToRad(cam.fov);
  const height = 2 * Math.tan(vFov * 0.5) * dist;
  const width = height * cam.aspect;
  return { width, height };
}

function normalizeGroupOrigin(group: THREE.Group): THREE.Vector3 {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Shift children so the group's local origin is at its bounds center
  for (const child of group.children) {
    child.position.sub(center);
  }

  return center; 
}

// ===================================================
// HELPERS
// ===================================================

function makeCurvePoints(curve: THREE.Curve<THREE.Vector2>, color: THREE.ColorRepresentation) {
  const pts = curve.getPoints(segments);

  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3 + 0] = pts[i].x;
    positions[i * 3 + 1] = pts[i].y;
    positions[i * 3 + 2] = 0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, segments + 1);

  const mat = new THREE.PointsMaterial({
    size: pointSize,
    color,
    forceSinglePass: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });

  const obj = new THREE.Points(geom, mat);
  return { obj, geom, curve };
}

function setExactEndPoint(
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

function updateCap(
  cap: THREE.Mesh,
  curve: THREE.Curve<THREE.Vector2>,
  tEnd: number,
  originOffset: THREE.Vector3,
  desiredSize: number,
  groupScale: number,
) {
  // Position at the curve end BUT in the group's central, local space. 
  const p = curve.getPoint(tEnd);
  cap.position.set(p.x - originOffset.x, p.y - originOffset.y, 0);

  // Rotate to ensure that +X aligns with the tangent
  const te = Math.min(0.9999, Math.max(0.0001, tEnd));
  const tan = curve.getTangent(te).normalize();
  const angle = Math.atan2(tan.y, tan.x);
  cap.rotation.set(0, 0, angle);

  // Counter-scale the mesh to ensure it doesn't grow when the group itself scales
  const inverse = groupScale !== 0 ? 1 / groupScale : 1; 
  cap.scale.setScalar(desiredSize * inverse);
}

function makeTeardropCap(color: THREE.ColorRepresentation, _size: number) {
  // Teardrop points along +X. Base anchored at x=0 so it "touches" the curve end.
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
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;

  return mesh;
}

type N = number;

function create2DCurve([sx, sy, ex, ey, c1x, c1y, c2x, c2y]: CurveParams) {
  const vStart = new THREE.Vector2(sx, sy);
  const vEnd = new THREE.Vector2(ex, ey);
  const c1 = new THREE.Vector2(c1x, c1y);
  const c2 = new THREE.Vector2(c2x, c2y);
  return new THREE.CubicBezierCurve(vEnd, c2, c1, vStart);
}

