import * as THREE from "three";

export type ScreenWidth = "S" | "M" | "L" | "XL";
export type Direction = "forward" | "backward";
export type OrbState = "hidden" | "entering" | "visible" | "exiting" | "gone";

export type N = number;

export type CurveParams = [
  sx: N, sy: N,
  ex: N, ey: N,
  c1x: N, c1y: N,
  c2x: N, c2y: N,
];

export type CreateCurveInstanceParams = {
  green: CurveParams;
  blue: CurveParams;
};

export type CurveObj = {
  obj: THREE.Points;
  geom: THREE.BufferGeometry;
  curve: THREE.Curve<THREE.Vector2>;
};

export type Instance = {
  group: THREE.Group;
  green: CurveObj;
  blue: CurveObj;
  greenCap: THREE.Mesh;
  blueCap: THREE.Mesh;
  baseWidth: number;
  originOffset: THREE.Vector3;
};

export type Orb = {
  group: THREE.Group;
  circle: THREE.Mesh;
  icon: THREE.Mesh;
  alphaTex: THREE.Texture;
};

export type Config = {
  viewHeight: number;
  gutterWorld: number;

  pointPx: number;
  capPxGreen: number;
  capPxBlue: number;

  orbRadius: number;
  backwardFadeFraction: number;

  green: number;
  blue: number;

  lineSegments: number;
  speed: number;
  maxDeltaTime: number;
  eps: number;
};

export type Runtime = {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;

  left: Instance;
  right: Instance;
  orb: Orb;
};

export type AnimState = {
  running: boolean;
  direction: Direction;
  orbState: OrbState;

  tEnd: number;
  lastTime?: number;
  runId: number;

  forwardStartT: number;
  hasStartedLifecycle: boolean;
  hasCompletedForwardRun: boolean;
  lifecycleCompleted: boolean;
};

export type Layout = {
  targetWidth: number;
  xCenter: number;
  scaleLeft: number;
  scaleRight: number;
};

export type TickResult = {
  // updated animation state
  state: AnimState;

  // lifecycle events (for side effects)
  didStop: boolean;
  didCompleteForward: boolean;
  didCompleteLifecycle: boolean;
};

export type Handlers = {
  onKeyDown: (e: KeyboardEvent) => void;
  onResize: () => void;
};

