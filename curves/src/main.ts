import './style.css'

import * as THREE from "three";

const canvas = document.querySelector("#bg");
if (!canvas) { throw new Error("unable to get canvas!") }
const scene = new THREE.Scene(); 
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight , 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });

renderer.setPixelRatio(window.devicePixelRatio); 
renderer.setSize(window.innerWidth, window.innerHeight);

const curve = new THREE.CurvePath<THREE.Vector3>();
// curve.add( createCurveSC( -4, 0,-5,   0, 0, 3,  -4, 0, 3    ));
curve.add( createCurve(   -5, 0, 0,   5, 0, 3,   0, 0, 3,   3, 0, -6));

scene.add(new THREE.GridHelper(10, 10));


const material = new THREE.PointsMaterial({ size: 0.15, color: new THREE.Color(0,1,0)  });
const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(10));
const points = new THREE.Points(geometry, material);
scene.add(points);

camera.position.set(-8, 5, 8);
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


