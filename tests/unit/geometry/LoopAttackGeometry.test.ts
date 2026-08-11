import { describe, expect, it } from 'vitest';
import { classifyLoopAttackPoint } from '../../../src/game/loop/LoopAttackGeometry';
import type { LoopClosure } from '../../../src/game/loop/LoopPath';

const square = (
  left: number,
  top: number,
  size = 10,
): LoopClosure => ({
  points: [
    { x: left, y: top },
    { x: left + size, y: top },
    { x: left + size, y: top + size },
    { x: left, y: top + size },
  ],
  area: size * size,
  kind: 'direct',
  snapPoint: { x: left, y: top },
});

describe('classifyLoopAttackPoint', () => {
  it('returns the first projection containing the point', () => {
    const result = classifyLoopAttackPoint(
      [square(0, 0), square(2, 2)],
      { x: 5, y: 5 },
      4,
    );

    expect(result).toEqual({ projectionIndex: 0, source: 'interior' });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('prioritizes an interior in a later projection over every blade band', () => {
    const result = classifyLoopAttackPoint(
      [square(0, 0), square(10.5, 0)],
      { x: 11, y: 5 },
      2,
    );

    expect(result).toEqual({ projectionIndex: 1, source: 'interior' });
  });

  it('uses projection order to break ties between blade bands', () => {
    const result = classifyLoopAttackPoint(
      [square(0, 0), square(12, 0)],
      { x: 11, y: 11 },
      Math.SQRT2,
    );

    expect(result).toEqual({ projectionIndex: 0, source: 'blade-band' });
  });

  it('treats the blade band outer edge as inclusive', () => {
    expect(
      classifyLoopAttackPoint([square(0, 0)], { x: 12, y: 5 }, 2),
    ).toEqual({ projectionIndex: 0, source: 'blade-band' });
  });

  it('does not classify points beyond the blade band', () => {
    expect(
      classifyLoopAttackPoint([square(0, 0)], { x: 12.01, y: 5 }, 2),
    ).toBeNull();
  });

  it('disables the blade band at width zero', () => {
    expect(
      classifyLoopAttackPoint([square(0, 0)], { x: 10.001, y: 5 }, 0),
    ).toBeNull();
  });

  it.each([
    { x: 0, y: 5 },
    { x: 10, y: 10 },
  ])('classifies polygon boundary point %o as interior', (point) => {
    expect(classifyLoopAttackPoint([square(0, 0)], point, 0)).toEqual({
      projectionIndex: 0,
      source: 'interior',
    });
  });

  it('handles explicit closing points and adjacent duplicate vertices', () => {
    const closure: LoopClosure = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      area: 100,
      kind: 'anchor-snap',
      snapPoint: { x: 0, y: 0 },
    };

    expect(classifyLoopAttackPoint([closure], { x: 11, y: 5 }, 1)).toEqual({
      projectionIndex: 0,
      source: 'blade-band',
    });
  });

  it('measures a zero-length degenerate boundary without failing', () => {
    const closure: LoopClosure = {
      points: [
        { x: 3, y: 4 },
        { x: 3, y: 4 },
      ],
      area: 0,
      kind: 'direct',
      snapPoint: { x: 3, y: 4 },
    };

    expect(classifyLoopAttackPoint([closure], { x: 6, y: 4 }, 3)).toEqual({
      projectionIndex: 0,
      source: 'blade-band',
    });
  });

  it('returns null for no projections', () => {
    expect(classifyLoopAttackPoint([], { x: 0, y: 0 }, 10)).toBeNull();
  });

  it('does not mutate or freeze its inputs', () => {
    const projections = [square(0, 0), square(20, 20)];
    const point = { x: 11, y: 5 };
    const projectionsBefore = structuredClone(projections);
    const pointBefore = structuredClone(point);

    classifyLoopAttackPoint(projections, point, 2);

    expect(projections).toEqual(projectionsBefore);
    expect(point).toEqual(pointBefore);
    expect(Object.isFrozen(projections)).toBe(false);
    expect(Object.isFrozen(projections[0])).toBe(false);
    expect(Object.isFrozen(projections[0]!.points)).toBe(false);
    expect(Object.isFrozen(projections[0]!.points[0])).toBe(false);
    expect(Object.isFrozen(point)).toBe(false);
  });

  it.each([
    { x: Number.NaN, y: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY },
    { x: Number.NEGATIVE_INFINITY, y: 0 },
  ])('rejects a nonfinite attack point %o', (point) => {
    expect(() => classifyLoopAttackPoint([], point, 0)).toThrow(
      'attack point',
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid blade band width %s',
    (bladeBandWidth) => {
      expect(() =>
        classifyLoopAttackPoint([], { x: 0, y: 0 }, bladeBandWidth),
      ).toThrow('blade band width');
    },
  );

  it('validates every projection before resolving a hit', () => {
    const invalidVertex: LoopClosure = {
      ...square(20, 20),
      points: [
        { x: 20, y: 20 },
        { x: Number.NaN, y: 20 },
        { x: 30, y: 30 },
      ],
    };

    expect(() =>
      classifyLoopAttackPoint(
        [square(0, 0), invalidVertex],
        { x: 5, y: 5 },
        2,
      ),
    ).toThrow('projection 1 vertex 1');
  });

  it('rejects nonfinite closure area and snap coordinates', () => {
    const invalidArea = { ...square(0, 0), area: Number.NaN };
    const invalidSnap = {
      ...square(0, 0),
      snapPoint: { x: Number.POSITIVE_INFINITY, y: 0 },
    };

    expect(() =>
      classifyLoopAttackPoint([invalidArea], { x: 20, y: 20 }, 1),
    ).toThrow('area');
    expect(() =>
      classifyLoopAttackPoint([invalidSnap], { x: 20, y: 20 }, 1),
    ).toThrow('snap point');
  });
});
