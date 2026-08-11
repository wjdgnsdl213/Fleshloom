import type { Vec2 } from '../../core/geometry/vector';
import type { LoopClosure } from './LoopPath';

export type LoopProjectionCount = 1 | 2 | 4;

type QuarterTurns = 0 | 1 | 2 | 3;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const quarterTurnsForCount = (
  count: LoopProjectionCount,
): readonly QuarterTurns[] => {
  switch (count) {
    case 1:
      return [0];
    case 2:
      return [0, 2];
    case 4:
      return [0, 1, 2, 3];
    default:
      throw new RangeError('projection count must be 1, 2, or 4');
  }
};

const rotateAndFreeze = (
  point: Vec2,
  origin: Vec2,
  quarterTurns: QuarterTurns,
): Vec2 => {
  const relativeX = point.x - origin.x;
  const relativeY = point.y - origin.y;
  let rotatedX: number;
  let rotatedY: number;

  switch (quarterTurns) {
    case 0:
      rotatedX = relativeX;
      rotatedY = relativeY;
      break;
    case 1:
      rotatedX = -relativeY;
      rotatedY = relativeX;
      break;
    case 2:
      rotatedX = -relativeX;
      rotatedY = -relativeY;
      break;
    case 3:
      rotatedX = relativeY;
      rotatedY = -relativeX;
      break;
  }

  return Object.freeze({
    x: origin.x + rotatedX,
    y: origin.y + rotatedY,
  });
};

export const projectLoopClosure = (
  closure: LoopClosure,
  origin: Vec2,
  count: LoopProjectionCount,
): readonly LoopClosure[] => {
  if (!isFiniteVec2(origin)) {
    throw new RangeError('projection origin must contain finite coordinates');
  }

  const projections = quarterTurnsForCount(count).map((quarterTurns) => {
    const points = Object.freeze(
      closure.points.map((point) =>
        rotateAndFreeze(point, origin, quarterTurns),
      ),
    );

    return Object.freeze({
      points,
      area: closure.area,
      kind: closure.kind,
      snapPoint: rotateAndFreeze(
        closure.snapPoint,
        origin,
        quarterTurns,
      ),
    });
  });

  return Object.freeze(projections);
};
