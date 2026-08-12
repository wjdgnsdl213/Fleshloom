import { describe, expect, it } from 'vitest';
import {
  findFreePosition,
  isCircleFree,
  resolveCircleColliders,
  resolveCircleObb,
} from '../../../src/core/geometry/collision';
import {
  createObb,
  fromObbLocal,
  obbCorners,
  orientedQuadCorners,
  toObbLocal,
} from '../../../src/core/geometry/obb';

const axisBox = createObb({ x: 0, y: 0 }, 200, 100, 0);
const bounds = { minX: -1_000, minY: -1_000, maxX: 1_000, maxY: 1_000 };

describe('oriented bounding boxes', () => {
  it('precomputes orthonormal axes', () => {
    const box = createObb({ x: 5, y: 5 }, 100, 40, Math.PI / 4);

    expect(Math.hypot(box.axisX.x, box.axisX.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(box.axisY.x, box.axisY.y)).toBeCloseTo(1, 6);
    expect(
      box.axisX.x * box.axisY.x + box.axisX.y * box.axisY.y,
    ).toBeCloseTo(0, 6);
  });

  it('round-trips points through the local frame', () => {
    const box = createObb({ x: 30, y: -12 }, 80, 30, 0.7);
    const point = { x: 55, y: 4 };
    const roundTrip = fromObbLocal(box, toObbLocal(box, point));

    expect(roundTrip.x).toBeCloseTo(point.x, 6);
    expect(roundTrip.y).toBeCloseTo(point.y, 6);
  });

  it('keeps the moved corner helper identical to the presentation original', () => {
    const corners = orientedQuadCorners({ x: 0, y: 0 }, 100, 60, 0);

    expect(corners).toHaveLength(4);
    expect(corners[0]!.x).toBeCloseTo(-50, 6);
    expect(corners[0]!.y).toBeCloseTo(-30, 6);
    expect(corners[2]!.x).toBeCloseTo(50, 6);
    expect(corners[2]!.y).toBeCloseTo(30, 6);
  });

  it('derives corners from a built OBB', () => {
    const corners = obbCorners(axisBox);

    expect(corners[0]!.x).toBeCloseTo(-100, 6);
    expect(corners[2]!.y).toBeCloseTo(50, 6);
  });
});

describe('circle-versus-OBB resolution', () => {
  it('returns the same reference when there is no overlap', () => {
    const position = { x: 200, y: 0 };

    expect(resolveCircleObb(position, 17, axisBox)).toBe(position);
    expect(isCircleFree(position, 17, [axisBox])).toBe(true);
  });

  it('pushes a face overlap straight out along the face normal', () => {
    const resolved = resolveCircleObb({ x: 110, y: 0 }, 17, axisBox);

    expect(resolved.x).toBeCloseTo(117, 4);
    expect(resolved.y).toBeCloseTo(0, 4);
  });

  it('resolves rotated boxes in their own frame', () => {
    const rotated = createObb({ x: 0, y: 0 }, 200, 100, Math.PI / 2);
    // The length axis now runs vertically, so x is limited by halfWidth = 50.
    const resolved = resolveCircleObb({ x: 60, y: 0 }, 17, rotated);

    expect(resolved.x).toBeCloseTo(67, 4);
    expect(resolved.y).toBeCloseTo(0, 4);
  });

  it('pushes corner overlaps along the corner diagonal', () => {
    const resolved = resolveCircleObb({ x: 108, y: 58 }, 17, axisBox);
    const cornerDistance = Math.hypot(resolved.x - 100, resolved.y - 50);

    expect(cornerDistance).toBeCloseTo(17, 4);
    expect(resolved.x).toBeGreaterThan(100);
    expect(resolved.y).toBeGreaterThan(50);
  });

  it('exits a deeply-contained centre through the nearest face', () => {
    const resolved = resolveCircleObb({ x: 0, y: 40 }, 17, axisBox);

    expect(resolved.y).toBeCloseTo(50 + 17, 4);
    expect(resolved.x).toBeCloseTo(0, 4);
  });

  it('preserves tangential motion when sliding along a wall', () => {
    // Walk parallel to the +y face while pressed into it.
    const start = resolveCircleObb({ x: -40, y: 60 }, 17, axisBox);
    const end = resolveCircleObb({ x: 40, y: 60 }, 17, axisBox);

    expect(end.x - start.x).toBeCloseTo(80, 4);
    expect(start.y).toBeCloseTo(end.y, 4);
  });

  it('settles corner pockets formed by two colliders without oscillating', () => {
    const wallA = createObb({ x: 0, y: 60 }, 300, 20, 0);
    const wallB = createObb({ x: 60, y: 0 }, 20, 300, 0);
    const resolved = resolveCircleColliders({ x: 45, y: 45 }, 17, [
      wallA,
      wallB,
    ]);

    expect(isCircleFree(resolved, 16.9, [wallA, wallB])).toBe(true);
    expect(Number.isFinite(resolved.x)).toBe(true);
    expect(Number.isFinite(resolved.y)).toBe(true);
  });

  it('stays finite for degenerate input', () => {
    const degenerate = createObb(
      { x: Number.NaN, y: 0 },
      Number.NaN,
      -5,
      Number.POSITIVE_INFINITY,
    );
    const resolved = resolveCircleObb({ x: 0, y: 0 }, Number.NaN, degenerate);

    expect(Number.isFinite(resolved.x)).toBe(true);
    expect(Number.isFinite(resolved.y)).toBe(true);
  });
});

describe('free-position search', () => {
  it('returns the preferred point when it is already free', () => {
    const free = findFreePosition({ x: 400, y: 400 }, 17, [axisBox], bounds);

    expect(free.x).toBeCloseTo(400, 6);
    expect(free.y).toBeCloseTo(400, 6);
  });

  it('finds a nearby free point when the preferred point is blocked', () => {
    const free = findFreePosition({ x: 0, y: 0 }, 17, [axisBox], bounds);

    expect(isCircleFree(free, 17, [axisBox])).toBe(true);
    expect(Math.hypot(free.x, free.y)).toBeLessThan(600);
  });

  it('respects world bounds with the body radius', () => {
    const free = findFreePosition(
      { x: -2_000, y: -2_000 },
      17,
      [],
      bounds,
    );

    expect(free.x).toBeCloseTo(bounds.minX + 17, 6);
    expect(free.y).toBeCloseTo(bounds.minY + 17, 6);
  });
});
