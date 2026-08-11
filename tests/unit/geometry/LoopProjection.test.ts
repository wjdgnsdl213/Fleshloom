import { describe, expect, it } from 'vitest';
import {
  projectLoopClosure,
  type LoopProjectionCount,
} from '../../../src/game/loop/LoopProjection';
import type { LoopClosure } from '../../../src/game/loop/LoopPath';

const createClosure = (): LoopClosure => ({
  points: [
    { x: 10, y: 20 },
    { x: 14, y: 20 },
    { x: 14, y: 23 },
  ],
  area: 6,
  kind: 'anchor-snap',
  snapPoint: { x: 11, y: 22 },
});

describe('projectLoopClosure', () => {
  it('returns a deep-frozen copy of the original for count one', () => {
    const closure = createClosure();
    const projections = projectLoopClosure(closure, { x: 10, y: 20 }, 1);

    expect(projections).toEqual([closure]);
    expect(projections).not.toBe(closure);
    expect(projections[0]).not.toBe(closure);
    expect(projections[0]!.points).not.toBe(closure.points);
    expect(projections[0]!.points[0]).not.toBe(closure.points[0]);
    expect(projections[0]!.snapPoint).not.toBe(closure.snapPoint);
    expect(Object.isFrozen(projections)).toBe(true);
    expect(Object.isFrozen(projections[0])).toBe(true);
    expect(Object.isFrozen(projections[0]!.points)).toBe(true);
    expect(projections[0]!.points.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(projections[0]!.snapPoint)).toBe(true);
  });

  it('returns the original and a 180-degree projection for count two', () => {
    const closure = createClosure();
    const projections = projectLoopClosure(closure, { x: 10, y: 20 }, 2);

    expect(projections.map((projection) => projection.points)).toEqual([
      [
        { x: 10, y: 20 },
        { x: 14, y: 20 },
        { x: 14, y: 23 },
      ],
      [
        { x: 10, y: 20 },
        { x: 6, y: 20 },
        { x: 6, y: 17 },
      ],
    ]);
    expect(projections.map((projection) => projection.snapPoint)).toEqual([
      { x: 11, y: 22 },
      { x: 9, y: 18 },
    ]);
  });

  it('rotates points through 0, 90, 180, and 270 degrees for count four', () => {
    const closure: LoopClosure = {
      points: [{ x: 2, y: 1 }],
      area: 12,
      kind: 'self-intersection',
      snapPoint: { x: 3, y: -2 },
    };

    const projections = projectLoopClosure(closure, { x: 0, y: 0 }, 4);

    expect(projections.map((projection) => projection.points[0])).toEqual([
      { x: 2, y: 1 },
      { x: -1, y: 2 },
      { x: -2, y: -1 },
      { x: 1, y: -2 },
    ]);
    expect(projections.map((projection) => projection.snapPoint)).toEqual([
      { x: 3, y: -2 },
      { x: 2, y: 3 },
      { x: -3, y: 2 },
      { x: -2, y: -3 },
    ]);
  });

  it('preserves area and closure kind in every projection', () => {
    const closure = createClosure();
    const projections = projectLoopClosure(closure, { x: 10, y: 20 }, 4);

    expect(
      projections.every(
        (projection) =>
          projection.area === closure.area &&
          projection.kind === closure.kind,
      ),
    ).toBe(true);
  });

  it('does not mutate or freeze any part of the input closure', () => {
    const closure = createClosure();
    const before = structuredClone(closure);

    projectLoopClosure(closure, { x: 10, y: 20 }, 4);

    expect(closure).toEqual(before);
    expect(Object.isFrozen(closure)).toBe(false);
    expect(Object.isFrozen(closure.points)).toBe(false);
    expect(closure.points.every((point) => !Object.isFrozen(point))).toBe(true);
    expect(Object.isFrozen(closure.snapPoint)).toBe(false);
  });

  it('preserves adjacent duplicates and explicit closing points', () => {
    const closure: LoopClosure = {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 0 },
      ],
      area: 0,
      kind: 'direct',
      snapPoint: { x: 0, y: 0 },
    };

    const projections = projectLoopClosure(closure, { x: 0, y: 0 }, 4);

    for (const projection of projections) {
      expect(projection.points).toHaveLength(4);
      expect(projection.points[1]).toEqual(projection.points[2]);
      expect(projection.points[0]).toEqual(projection.points[3]);
      expect(projection.points[1]).not.toBe(projection.points[2]);
      expect(projection.points[0]).not.toBe(projection.points[3]);
    }
  });

  it.each([
    [{ x: Number.NaN, y: 0 }],
    [{ x: 0, y: Number.NaN }],
    [{ x: Number.POSITIVE_INFINITY, y: 0 }],
    [{ x: 0, y: Number.NEGATIVE_INFINITY }],
  ])('rejects a nonfinite projection origin %o', (origin) => {
    expect(() => projectLoopClosure(createClosure(), origin, 1)).toThrow(
      'projection origin',
    );
  });

  it.each([0, 3, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid projection count %s',
    (count) => {
      expect(() =>
        projectLoopClosure(
          createClosure(),
          { x: 0, y: 0 },
          count as LoopProjectionCount,
        ),
      ).toThrow('projection count');
    },
  );
});
