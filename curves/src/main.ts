import './style.css'

import * as THREE from "three";

const canvas = document.querySelector("#bg");
if (!canvas) { throw new Error("unable to get canvas!") }
const scene = new THREE.Scene(); 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight , 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });

renderer.setPixelRatio(window.devicePixelRatio); 
renderer.setSize(window.innerWidth, window.innerHeight);


// ===================================================
// 2D Curve
// ===================================================

const curve2d = new THREE.CurvePath<THREE.Vector2>();

// START_X,START_Y,  END_X,END_Y,  C1_X,C1_Y, C2_X,C2_Y
//
curve2d.add(create2DCurve( -10,0,  10,0,  2.5,10,  -2.5,-10));

const geometry2d = new THREE.BufferGeometry().setFromPoints(curve2d.getPoints(100));
const material = new THREE.PointsMaterial({ size: 0.15, color: new THREE.Color(0,1,0)  });
const points2d = new THREE.Points(geometry2d, material);

scene.add(points2d);


// Render
// camera.position.set(-8, 5, 8);
camera.position.setZ(10);
camera.lookAt(0,0,0);
renderer.render(scene, camera);


// ===================================================
// Helper methods
// ===================================================

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

