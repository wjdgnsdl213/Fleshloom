export const WALK_FRAME_COUNT = 4;

export interface WalkCycleTuning {
  readonly distancePerFrame: number;
  readonly idleFrame: number;
}

export interface WalkCycleSample {
  readonly frame: number;
  readonly phase: number;
  readonly contact: number;
  readonly passing: number;
  readonly moving: boolean;
}

export const WALK_CYCLE_TUNING = Object.freeze({
  carrier: Object.freeze({ distancePerFrame: 10, idleFrame: 1 }),
  drifter: Object.freeze({ distancePerFrame: 9, idleFrame: 1 }),
  rusher: Object.freeze({ distancePerFrame: 16, idleFrame: 1 }),
  watcher: Object.freeze({ distancePerFrame: 12, idleFrame: 3 }),
  cutter: Object.freeze({ distancePerFrame: 13, idleFrame: 1 }),
  mimic: Object.freeze({ distancePerFrame: 14, idleFrame: 1 }),
  'elite-husk': Object.freeze({ distancePerFrame: 8, idleFrame: 1 }),
} as const satisfies Readonly<Record<string, WalkCycleTuning>>);

export function walkFrameForDistance(
  distance: number,
  tuning: WalkCycleTuning,
  moving: boolean,
): number {
  if (!moving || !Number.isFinite(distance) || distance < 0) {
    return tuning.idleFrame;
  }

  return (
    Math.floor(distance / Math.max(Number.EPSILON, tuning.distancePerFrame)) %
    WALK_FRAME_COUNT
  );
}

export function sampleWalkCycle(
  distance: number,
  speed: number,
  tuning: WalkCycleTuning,
  movementThreshold = 1,
): WalkCycleSample {
  const moving = Number.isFinite(speed) && speed > movementThreshold;
  const frame = walkFrameForDistance(distance, tuning, moving);
  const phase = (frame / WALK_FRAME_COUNT) * Math.PI * 2;

  return Object.freeze({
    frame,
    phase,
    contact: Math.cos(phase),
    passing: Math.sin(phase),
    moving,
  });
}

export function advanceWalkDistance(
  distance: number,
  speed: number,
  deltaSeconds: number,
  movementThreshold = 1,
): number {
  if (
    !Number.isFinite(distance) ||
    !Number.isFinite(speed) ||
    !Number.isFinite(deltaSeconds) ||
    speed <= movementThreshold ||
    deltaSeconds <= 0
  ) {
    return Math.max(0, Number.isFinite(distance) ? distance : 0);
  }

  return distance + speed * deltaSeconds;
}
