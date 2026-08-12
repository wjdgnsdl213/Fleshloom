export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const QUARANTINE_WORLD_BOUNDS: WorldBounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 3_200,
  maxY: 1_800,
});

export const QUARANTINE_WORLD_START = Object.freeze({
  x: (QUARANTINE_WORLD_BOUNDS.minX + QUARANTINE_WORLD_BOUNDS.maxX) / 2,
  y: (QUARANTINE_WORLD_BOUNDS.minY + QUARANTINE_WORLD_BOUNDS.maxY) / 2,
});

export const WORLD_TUNING = Object.freeze({
  cameraDeadZoneRatioX: 0.34,
  cameraDeadZoneRatioY: 0.28,
  cameraFollowSharpness: 9,
  playerBoundaryPadding: 48,
  spawnCameraMargin: 120,
  spawnBandDepth: 260,
  spawnFlankPadding: 180,
  spawnMinimumDepth: 96,
  spawnMinimumSpan: 220,
  wardenArenaMinimumWidth: 960,
  wardenArenaMinimumHeight: 640,
  wardenArenaViewportPadding: 120,
});
