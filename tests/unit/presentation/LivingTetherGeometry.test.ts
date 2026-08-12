import { describe, expect, it } from 'vitest';
import {
  polylineLength,
  samplePolylineAtDistance,
  samplesAtSpacing,
  wovenStrandPoints,
} from '../../../src/presentation/LivingTetherGeometry';

const path = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 40 },
] as const;

describe('living tether distance geometry', () => {
  it('measures open and closed paths in world units', () => {
    expect(polylineLength(path)).toBe(70);
    expect(polylineLength(path, true)).toBe(120);
  });

  it('samples a stable tangent and normal across segment boundaries', () => {
    expect(samplePolylineAtDistance(path, 20)).toMatchObject({
      position: { x: 20, y: 0 },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
    });
    expect(samplePolylineAtDistance(path, 50)).toMatchObject({
      position: { x: 30, y: 20 },
      tangent: { x: 0, y: 1 },
      normal: { x: -1, y: 0 },
    });
  });

  it('places hook markers at world-distance spacing instead of sample indices', () => {
    expect(samplesAtSpacing(path, 16, false, 8).map((sample) => sample.distance)).toEqual([
      8, 24, 40, 56,
    ]);
  });

  it('keeps world-space samples stable when the input path is densified', () => {
    const densifiedPath = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 30, y: 40 },
    ] as const;
    const simplify = (sample: ReturnType<typeof samplesAtSpacing>[number]) => ({
      position: sample.position,
      tangent: sample.tangent,
      distance: sample.distance,
    });

    expect(samplesAtSpacing(densifiedPath, 16, false, 8).map(simplify)).toEqual(
      samplesAtSpacing(path, 16, false, 8).map(simplify),
    );
  });

  it('samples the maximum gameplay path size without dropping the tail', () => {
    const maximumPath = Array.from({ length: 256 }, (_, index) => ({
      x: index * 9,
      y: index % 2 === 0 ? 0 : 9,
    }));
    const total = polylineLength(maximumPath);
    const samples = samplesAtSpacing(maximumPath, 7);

    expect(samples.length).toBeGreaterThan(400);
    expect(samples.at(-1)!.distance).toBeLessThan(total);
    expect(total - samples.at(-1)!.distance).toBeLessThanOrEqual(7);
  });

  it('creates two opposite-phase woven strands around the same centerline', () => {
    const first = wovenStrandPoints(path, 10, 3, 20, 0);
    const opposite = wovenStrandPoints(path, 10, 3, 20, Math.PI);

    expect(first).toHaveLength(opposite.length);
    expect(first[1]!.y).toBeCloseTo(-opposite[1]!.y);
    expect(first[1]!.x).toBeCloseTo(opposite[1]!.x);
  });
});
