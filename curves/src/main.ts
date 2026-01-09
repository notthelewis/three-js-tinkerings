import './style.css'

import * as THREE from "three";

const canvas = document.querySelector("#bg");
if (!canvas) { throw new Error("unable to get canvas!") }
const scene = new THREE.Scene(); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight , 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: "low-power", antialias: true });

const segments = 2000;
const pointSize = 0.18;

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.setSize(window.innerWidth, window.innerHeight);

document.addEventListener("keypress", (e)=> {
  if (e.key !== " ") return;
  console.log(running)
  if (running) {
    running = false;
    return;
  } 

  running = true;
  animate(0);
});

// ===================================================
// 2D Curve
// ===================================================

// Render
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

// Line caps to make the end look purrty
// const greenCap = makeTriangleCap(0x00ff00, pointSize + 0.03);
// const blueCap  = makeTriangleCap(0x0000ff, pointSize + 0.03);
const greenCap = makeTeardropCap(0x00ff00, pointSize + 0.1);
const blueCap = makeTeardropCap(0x0000ff, pointSize + 0.11);

scene.add(greenCap);
scene.add(blueCap);

// Animate: tEnd goes 1 -> 0 -> 1 ...
let tEnd = 1;
let dir = -1;

let lastTime: DOMHighResTimeStamp;
let running = false;

updateCap(greenCap, green.curve, tEnd);
// NOTE: set same position as green curve so there's no weird overlap on the triangle cap at initial render 
updateCap(blueCap, green.curve, tEnd);

renderer.render(scene, camera);

function animate(t: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);

  if (!running) {
    lastTime = t
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

  updateCap(greenCap, green.curve, tEnd);
  updateCap(blueCap, blue.curve, tEnd);

  renderer.render(scene, camera);
}


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

  const mat = new THREE.PointsMaterial({
    size: pointSize,
    color,
    // PERF: These three parameters should reduce overall rendering overhead 
    // (if my interpretation of docs is correct)
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
  return new THREE.CubicBezierCurve(vEnd, c2, c1, vStart);
}

export function makeTriangleCap(
  color: THREE.ColorRepresentation,
  size: number
) {
  // Unit triangle where the BASE is at x=0 and the TIP is at x=1.
  // That means when positioned at the curve end, the BASE touches the line,
  // and the triangle points "forward" (along +X) away from the line.
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        0,  0.45, 0,  // base top (at end point)
        0, -0.45, 0,  // base bottom (at end point)
        1,  0.00, 0,  // tip (points away)
      ]),
      3
    )
  );

  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);

  // Scale to match your points "visual weight"
  mesh.scale.setScalar(size);

  // Keep on top of the points
  mesh.renderOrder = 10;

  return mesh;
}

function updateCap(
  cap: THREE.Mesh,
  curve: THREE.Curve<THREE.Vector2>,
  tEnd: number,
) {
  // Place at curve end
  const p = curve.getPoint(tEnd);
  cap.position.set(p.x, p.y, cap.position.z);

  // Tangent can be weird at exactly 0/1 on some curves; sample slightly inside.
  const te = Math.min(0.9999, Math.max(0.0001, tEnd));
  const tan = curve.getTangent(te).normalize();

  // Rotate so +X aligns with tan
  const angle = Math.atan2(tan.y, tan.x);
  cap.rotation.set(0, 0, angle);
}

function makeTeardropCap(
  color: THREE.ColorRepresentation,
  size: number
) {
  // Teardrop points along +X.
  // Base is centered on x=0 (so it "touches" the line end), tip extends to +X.
  //
  // Unit-ish dimensions (we scale by `size` after):
  const tipX = 0.2;     // tip length
  const baseX = 0.0;    // base anchor (touch point)
  const r = 0.3         // roundness radius (controls width + base bulge)
  const pinchY = 0.01;  // how "pinched" the shoulders are (smaller => more drop-like)

  const shape = new THREE.Shape();

  // Start at base-top
  shape.moveTo(baseX, r);

  // Curve up toward the shoulder near the tip (top edge)
  shape.quadraticCurveTo(0.55, pinchY, tipX, 0.0);

  // Curve back to base-bottom (bottom edge)
  shape.quadraticCurveTo(0.55, -pinchY, baseX, -r);

  // Make a nicely rounded base back to base-top
  // (bulging slightly backwards makes it feel "pill/tear" rather than "leaf")
  shape.quadraticCurveTo(-0.25, 0.0, baseX, r);

  const geom = new THREE.ShapeGeometry(shape, 32); // segments controls smoothness

  // Centering: keep base at x=0 for correct anchoring.
  // ShapeGeometry ends up in the correct local space already, but we can ensure no Z drift:
  geom.translate(0, 0, 0);

  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);

  // Scale to match your points
  mesh.scale.setScalar(size);

  // Keep on top of points
  mesh.renderOrder = 10;

  return mesh;
}

