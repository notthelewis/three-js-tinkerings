import type { Config, ScreenWidth } from "./types";

export function getScreenWidth(w: number): ScreenWidth {
  return w <= 500 ? "S" : w <= 768 ? "M" : w <= 1024 ? "L" : "XL";
}

export function pointPxForScreen(sw: ScreenWidth): number {
  return sw === "S" ? 3 : sw === "M" ? 6 : sw === "L" ? 8 : 9;
}

export function makeConfig(sw: ScreenWidth): Config {
  const pointPx = pointPxForScreen(sw);

  return {
    viewHeight: 20,
    gutterWorld: 1,

    pointPx,
    capPxGreen: pointPx * 1.2,
    capPxBlue: pointPx * 1.4,

    orbRadius: 0.5,
    backwardFadeFraction: 0.4,

    green: 0x00ff00,
    blue: 0x0000ff,

    lineSegments: 2000,
    speed: 1,
    maxDeltaTime: 1 / 30,
    eps: 1e-4,
  };
}

