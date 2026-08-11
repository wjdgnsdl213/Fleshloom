import { describe, expect, it } from 'vitest';
import { LoopPath } from '../../../src/game/loop/LoopPath';

const createLoop = (): LoopPath =>
  new LoopPath({
    minSampleDistance: 5,
    minimumArea: 50,
    maxSamples: 16,
    anchorSnapRadius: 5,
    trailSnapRadius: 4,
  });

describe('LoopPath', () => {
  it('samples only after the configured travel distance', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });

    expect(loop.sample({ x: 3, y: 0 })).toBe(false);
    expect(loop.sample({ x: 5, y: 0 })).toBe(true);
    expect(loop.samples).toHaveLength(2);
  });

  it('closes a valid route back to its anchor', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });
    loop.sample({ x: 10, y: 0 });
    loop.sample({ x: 10, y: 10 });

    const closure = loop.complete({ x: 0, y: 10 });

    expect(closure?.area).toBe(100);
    expect(closure?.points).toHaveLength(4);
    expect(closure?.kind).toBe('direct');
    expect(loop.active).toBe(false);
  });

  it('snaps a near return to its anchor', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });
    loop.sample({ x: 20, y: 0 });
    loop.sample({ x: 20, y: 20 });

    const closure = loop.complete({ x: 2, y: 2 });

    expect(closure?.kind).toBe('anchor-snap');
    expect(closure?.snapPoint).toEqual({ x: 0, y: 0 });
  });

  it('snaps the head to an earlier trail segment', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });
    loop.sample({ x: 30, y: 0 });
    loop.sample({ x: 30, y: 30 });
    loop.sample({ x: 10, y: 30 });

    const preview = loop.preview({ x: 10, y: 2 });

    expect(preview?.kind).toBe('trail-snap');
    expect(preview?.snapPoint).toEqual({ x: 10, y: 0 });
    expect(preview?.valid).toBe(true);
    expect(loop.active).toBe(true);
  });

  it('extracts the latest clear polygon after self-intersection', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });
    loop.sample({ x: 30, y: 0 });
    loop.sample({ x: 30, y: 30 });
    loop.sample({ x: 0, y: 30 });

    const closure = loop.complete({ x: 15, y: -10 });

    expect(closure?.kind).toBe('self-intersection');
    expect(closure?.snapPoint.x).toBeCloseTo(11.25);
    expect(closure?.snapPoint.y).toBeCloseTo(0);
    expect(closure?.area).toBeGreaterThan(50);
  });

  it('rejects a tiny or incomplete route without staying active', () => {
    const loop = createLoop();
    loop.begin({ x: 0, y: 0 });
    loop.sample({ x: 10, y: 0 });

    expect(loop.complete({ x: 20, y: 0 })).toBeNull();
    expect(loop.active).toBe(false);
  });

  it('caps samples to prevent an unbounded trail', () => {
    const loop = new LoopPath({
      minSampleDistance: 1,
      minimumArea: 1,
      maxSamples: 3,
      anchorSnapRadius: 2,
      trailSnapRadius: 2,
    });
    loop.begin({ x: 0, y: 0 });

    expect(loop.sample({ x: 2, y: 0 })).toBe(true);
    expect(loop.sample({ x: 4, y: 0 })).toBe(true);
    expect(loop.sample({ x: 6, y: 0 })).toBe(false);
    expect(loop.samples).toHaveLength(3);
  });
});
