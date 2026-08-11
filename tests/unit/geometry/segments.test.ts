import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment,
  segmentIntersection,
} from '../../../src/core/geometry/segments';

describe('segment geometry', () => {
  it('projects a point onto a segment and clamps to its endpoints', () => {
    expect(
      closestPointOnSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toEqual({ point: { x: 5, y: 0 }, t: 0.5, distanceSquared: 16 });
    expect(
      closestPointOnSegment({ x: 15, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toEqual({ point: { x: 10, y: 0 }, t: 1, distanceSquared: 25 });
  });

  it('finds a crossing point with parameters on both segments', () => {
    const intersection = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );

    expect(intersection).toEqual({
      point: { x: 5, y: 5 },
      firstT: 0.5,
      secondT: 0.5,
    });
  });

  it('rejects parallel or non-overlapping segments', () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 2 },
        { x: 10, y: 2 },
      ),
    ).toBeNull();
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: -1 },
        { x: 5, y: 1 },
      ),
    ).toBeNull();
  });
});

