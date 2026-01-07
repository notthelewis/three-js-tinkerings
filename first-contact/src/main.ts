import './style.css'

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/Addons.js';

// Scene is a CONTAINER 
const scene = new THREE.Scene();

// Multiple camera types: ArrayCamera, Camera, CubeCamera, OrthographicCamera, PerspectiveCamera, StereoCamera
//
// PerspectiveCamera is the most common type, and mimics what human eyes would see
//
// OrthographicCamera _might_ actually be useful for the project I'm learning this for
// 
// ARGS = FOV, Aspect Ratio, View Frustum 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer
const canvas = document.querySelector('#bg');
if (!canvas) { throw new Error("cannot get canvas"); }

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Camera starts in the middle of the screen, move it
camera.position.setZ(30);

renderer.render(scene, camera);

const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
const material = new THREE.MeshStandardMaterial({ color: 0xC00C00 });
const torus = new THREE.Mesh(geometry, material);

scene.add(torus);

// Focused light on torus
const pointLight = new THREE.PointLight(0xffffff, 0xFD);
pointLight.position.set(5, 1, 5);
scene.add(pointLight)

// Ambient light on bg
const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(ambientLight);

// Helpers
const lightHelper = new THREE.PointLightHelper(pointLight);
scene.add(lightHelper);
const gridHelper = new THREE.GridHelper(200, 50);
scene.add(gridHelper);

const controls = new OrbitControls(camera, renderer.domElement);

var lastTime = 0; 
function animate(time: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);
  if (lastTime === 0) lastTime = time;
  const delta = (time - lastTime) / 1000;
  lastTime = time; 

  // torus.rotation.x += 0.1 * delta;
  torus.rotation.y += 1 * delta;
  // torus.rotation.z += 0.1 * delta;

  controls.update();

  renderer.render(scene, camera);
}

self.requestAnimationFrame(animate);
