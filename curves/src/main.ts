import './style.css'

import * as THREE from "three";

const canvas = document.querySelector("#bg");
if (!canvas) { throw new Error("unable to get canvas!") }
const scene = new THREE.Scene(); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight , 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: "low-power", antialias: true, precision: "highp"});

const segments = 2000;

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);

document.addEventListener("keypress", (e)=> {
  if (e.key == " ") {
    if (!running) {
      running = true;
    } else {
      running = false;
    }
  }
})


// ===================================================
// 2D Curve
// ===================================================

// Render
// camera.position.set(-8, 5, 8);
camera.position.setZ(10);

// Build once
const green = makeCurvePoints(
  create2DCurve(  -4, 0,  4, 0,  0.5, 2,  -1.35, -2  ),
  0x00ff00
);
scene.add(green.obj);

const blue = makeCurvePoints(
  create2DCurve(  -4, 0,  4, .5,  0.5, 1.5,  -1.35, -2.5  ),
  0x0000ff
);
scene.add(blue.obj);

// Animate: tEnd goes 1 -> 0 -> 1 ...
let tEnd = 0;
let dir = 1;

let lastTime: DOMHighResTimeStamp;
let running = true;

function animate(t: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);
  if (!running) {
    return;
  }

  if (!lastTime) lastTime = t;
  const d = (t - lastTime) / 1000;
  lastTime = t;

  // Move tEnd
  tEnd += dir * d * 0.5
  if (tEnd <= 0) { tEnd = 0; dir = 1; }
  if (tEnd >= 1) { tEnd = 1; dir = -1; }

  // Convert tEnd to number of vertices to draw
  const count = Math.max(2, Math.floor(tEnd * segments) + 1);

  green.geom.setDrawRange(0, count);
  blue.geom.setDrawRange(0, count);

  setExactEndPoint(green.curve, green.geom, tEnd, count);
  setExactEndPoint(blue.curve, blue.geom, tEnd, count);

  renderer.render(scene, camera);
}

animate(0);


// ===================================================
// Helper methods
// ===================================================

function makeCurvePoints(curve: THREE.Curve<THREE.Vector2>, color: THREE.ColorRepresentation) {
  // Precompute points (full curve)
  const pts = curve.getPoints(segments);

  // Geometry with 3D positions (z = 0)
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i < pts.length; i++) {
    positions[i * 3 + 0] = pts[i].x;
    positions[i * 3 + 1] = pts[i].y;
    positions[i * 3 + 2] = 0;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setDrawRange(0, segments + 1);

  const mat = new THREE.PointsMaterial({ size: 0.15, color });
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

type N = number;


// Abstraction over THREE.CubicBezierCurve3
function createCurve(
  sx:N,  sy:N,  sz:N,
  ex:N,  ey:N,  ez:N,
  c1x:N, c1y:N, c1z:N,
  c2x:N, c2y:N, c2z:N
) {
  const vStart = new THREE.Vector3(sx,sy,sz);
  const vEnd = new THREE.Vector3(ex,ey,ez);
  const c1 = new THREE.Vector3(c1x,c1y,c1z);
  const c2 = new THREE.Vector3(c2x,c2y,c2z);

  return new THREE.CubicBezierCurve3(vStart, c1, c2, vEnd);
}

// create single control point for both
export function createCurveSC(
  sx:N,  sy:N,  sz:N,
  ex:N,  ey:N,  ez:N,
  c1x:N, c1y:N, c1z:N,
) {
  return createCurve(sx,sy,sz, ex,ey,ez, c1x,c1y,c1z, c1x,c1y,c1z);
}

function create2DCurve(
  sx:N,   sy:N,
  ex:N,   ey:N,
  c1x:N,  c1y:N,
  c2x:N,  c2y:N,
) {
  const vStart = new THREE.Vector2(sx,sy);
  const vEnd = new THREE.Vector2(ex,ey);
  const c1 = new THREE.Vector2(c1x, c1y);
  const c2 = new THREE.Vector2(c2x, c2y);
  return new THREE.CubicBezierCurve(vStart, c1, c2, vEnd);
}

