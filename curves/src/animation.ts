import type { AnimState, Config, Direction, TickResult } from "./types";
import { clamp } from "./math";

export function startRun(cfg: Config, s: AnimState): AnimState {
  const next: AnimState = {
    ...s,
    running: true,
    runId: s.runId + 1,
    lastTime: undefined,
    hasStartedLifecycle: true,
  };

  // Nudge off endpoints so the first tick isn’t immediately clamped into completion.
  if (next.direction === "forward") {
    if (next.tEnd <= cfg.eps) next.tEnd = cfg.eps;
  } else {
    if (next.tEnd >= 1 - cfg.eps) next.tEnd = 1 - cfg.eps;
  }

  return next;
}

export function stopRun(s: AnimState): AnimState {
  return { ...s, running: false, runId: s.runId + 1, lastTime: undefined };
}

export function chooseDirection(s: AnimState): Direction {
  return s.hasCompletedForwardRun ? "backward" : "forward";
}

export function tickStep(cfg: Config, s: AnimState, now: number): TickResult {
  if (!s.running) {
    return { state: s, didStop: true, didCompleteForward: false, didCompleteLifecycle: false };
  }

  const last = s.lastTime ?? now;
  const dt = Math.min(cfg.maxDeltaTime, (now - last) / 1000);

  const sign = s.direction === "forward" ? 1 : -1;
  const tEnd = clamp(s.tEnd + sign * dt * cfg.speed, 0, 1);

  let next: AnimState = { ...s, tEnd, lastTime: now };

  // Forward complete
  if (next.direction === "forward" && next.tEnd >= 1 - cfg.eps) {
    next = {
      ...next,
      tEnd: 1,
      running: false,
      runId: next.runId + 1,
      lastTime: undefined,
      hasCompletedForwardRun: true,
    };
    return { state: next, didStop: true, didCompleteForward: true, didCompleteLifecycle: false };
  }

  // Backward complete -> lifecycle complete
  if (next.direction === "backward" && next.tEnd <= cfg.eps) {
    next = {
      ...next,
      tEnd: 0,
      running: false,
      runId: next.runId + 1,
      lastTime: undefined,
      lifecycleCompleted: true,
    };
    return { state: next, didStop: true, didCompleteForward: false, didCompleteLifecycle: true };
  }

  return { state: next, didStop: false, didCompleteForward: false, didCompleteLifecycle: false };
}

