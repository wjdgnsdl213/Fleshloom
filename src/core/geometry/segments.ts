import type { Vec2 } from './vector';

const SEGMENT_EPSILON = 1e-6;

export interface SegmentProjection {
  readonly point: Vec2;
  readonly t: number;
  readonly distanceSquared: number;
}

export interface SegmentIntersection {
  readonly point: Vec2;
  readonly firstT: number;
  readonly secondT: number;
}

export function closestPointOnSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
): SegmentProjection {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= SEGMENT_EPSILON) {
    return {
      point: { x: start.x, y: start.y },
      t: 0,
      distanceSquared:
        (point.x - start.x) ** 2 + (point.y - start.y) ** 2,
    };
  }

  const unclampedT =
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
    lengthSquared;
  const t = Math.max(0, Math.min(1, unclampedT));
  const projected = {
    x: start.x + segmentX * t,
    y: start.y + segmentY * t,
  };

  return {
    point: projected,
    t,
    distanceSquared:
      (point.x - projected.x) ** 2 + (point.y - projected.y) ** 2,
  };
}

export function segmentIntersection(
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2,
): SegmentIntersection | null {
  const firstDirection = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y,
  };
  const secondDirection = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  };
  const denominator = cross(firstDirection, secondDirection);

  if (Math.abs(denominator) <= SEGMENT_EPSILON) {
    return null;
  }

  const betweenStarts = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y,
  };
  const firstT = cross(betweenStarts, secondDirection) / denominator;
  const secondT = cross(betweenStarts, firstDirection) / denominator;

  if (
    firstT < -SEGMENT_EPSILON ||
    firstT > 1 + SEGMENT_EPSILON ||
    secondT < -SEGMENT_EPSILON ||
    secondT > 1 + SEGMENT_EPSILON
  ) {
    return null;
  }

  const clampedFirstT = Math.max(0, Math.min(1, firstT));
  return {
    point: {
      x: firstStart.x + firstDirection.x * clampedFirstT,
      y: firstStart.y + firstDirection.y * clampedFirstT,
    },
    firstT: clampedFirstT,
    secondT: Math.max(0, Math.min(1, secondT)),
  };
}

function cross(first: Vec2, second: Vec2): number {
  return first.x * second.y - first.y * second.x;
}

