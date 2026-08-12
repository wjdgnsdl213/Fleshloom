const DIRECTION_COUNT = 8;
const DIRECTION_STEP = (Math.PI * 2) / DIRECTION_COUNT;

export interface AtlasCell {
  readonly column: number;
  readonly row: number;
}

/**
 * Atlas order is N, NE, E, SE / S, SW, W, NW. World coordinates use the
 * screen convention where +x points right and +y points down.
 */
export function directionalFrameIndexForAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 4;
  }

  const fromNorth = Math.round((angle + Math.PI * 0.5) / DIRECTION_STEP);
  return ((fromNorth % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT;
}

export function directionalFrameIndexForVector(
  x: number,
  y: number,
  fallbackIndex = 4,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.0001) {
    return Math.min(DIRECTION_COUNT - 1, Math.max(0, Math.trunc(fallbackIndex)));
  }

  return directionalFrameIndexForAngle(Math.atan2(y, x));
}

export function directionalAtlasCell(frameIndex: number): AtlasCell {
  const safeIndex =
    ((Math.trunc(frameIndex) % DIRECTION_COUNT) + DIRECTION_COUNT) %
    DIRECTION_COUNT;
  return {
    column: safeIndex % 4,
    row: Math.floor(safeIndex / 4),
  };
}

