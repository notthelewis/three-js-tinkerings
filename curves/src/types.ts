import * as THREE from "three";

export type ScreenWidth = "S" | "M" | "L" | "XL"

export type Direction = "forward" | "backward";
export type OrbState = "hidden" | "entering" | "visible" | "exiting" | "gone";

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
  baseWidth: number; // unscaled width of the whole instance
  originOffset: THREE.Vector3;
};

type N = number; 
export type CurveParams = [
  sx:  N, sy:  N,
  ex:  N, ey:  N,
  c1x: N, c1y: N,
  c2x: N, c2y: N,
];

export type CreateCurveInstanceParams = {
  green: CurveParams;
  blue: CurveParams;
}

