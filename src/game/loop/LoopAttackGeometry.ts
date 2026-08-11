import { pointInPolygon } from '../../core/geometry/polygon';
import { closestPointOnSegment } from '../../core/geometry/segments';
import type { Vec2 } from '../../core/geometry/vector';
import type { LoopClosure } from './LoopPath';

export type LoopAttackSource = 'interior' | 'blade-band';

export interface LoopAttackPointResult {
  readonly projectionIndex: number;
  readonly source: LoopAttackSource;
}

const isFiniteVec2 = (value: unknown): value is Vec2 => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { readonly x?: unknown; readonly y?: unknown };
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
};

const validateInputs = (
  projections: readonly LoopClosure[],
  point: Vec2,
  bladeBandWidth: number,
): void => {
  if (!isFiniteVec2(point)) {
    throw new RangeError('attack point must contain finite coordinates');
  }

  if (!Number.isFinite(bladeBandWidth) || bladeBandWidth < 0) {
    throw new RangeError('blade band width must be a finite nonnegative number');
  }

  projections.forEach((projection, projectionIndex) => {
    if (!Number.isFinite(projection.area)) {
      throw new RangeError(
        `projection ${projectionIndex} area must be finite`,
      );
    }

    if (!isFiniteVec2(projection.snapPoint)) {
      throw new RangeError(
        `projection ${projectionIndex} snap point must be finite`,
      );
    }

    projection.points.forEach((vertex, vertexIndex) => {
      if (!isFiniteVec2(vertex)) {
        throw new RangeError(
          `projection ${projectionIndex} vertex ${vertexIndex} must be finite`,
        );
      }
    });
  });
};

const frozenResult = (
  projectionIndex: number,
  source: LoopAttackSource,
): LoopAttackPointResult => Object.freeze({ projectionIndex, source });

const isWithinBoundaryBand = (
  point: Vec2,
  polygon: readonly Vec2[],
  bandWidthSquared: number,
): boolean => {
  if (polygon.length === 0) {
    return false;
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;

    if (
      closestPointOnSegment(point, start, end).distanceSquared <=
      bandWidthSquared
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Classifies one point against projected loop closures.
 *
 * Polygon interiors (including their boundary) are checked across every
 * projection before any Blade band. Within each pass, projection order is the
 * stable tie-break. A point therefore produces at most one result.
 */
export const classifyLoopAttackPoint = (
  projections: readonly LoopClosure[],
  point: Vec2,
  bladeBandWidth: number,
): LoopAttackPointResult | null => {
  validateInputs(projections, point, bladeBandWidth);

  for (
    let projectionIndex = 0;
    projectionIndex < projections.length;
    projectionIndex += 1
  ) {
    if (pointInPolygon(point, projections[projectionIndex]!.points)) {
      return frozenResult(projectionIndex, 'interior');
    }
  }

  if (bladeBandWidth === 0) {
    return null;
  }

  const bandWidthSquared = bladeBandWidth * bladeBandWidth;

  for (
    let projectionIndex = 0;
    projectionIndex < projections.length;
    projectionIndex += 1
  ) {
    if (
      isWithinBoundaryBand(
        point,
        projections[projectionIndex]!.points,
        bandWidthSquared,
      )
    ) {
      return frozenResult(projectionIndex, 'blade-band');
    }
  }

  return null;
};
