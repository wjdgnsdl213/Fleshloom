import { describe, expect, it } from 'vitest';
import {
  actorDepthKey,
  blockDepthKey,
  blockFootpointY,
} from '../../../src/presentation/DepthOrder';

describe('presentation depth order', () => {
  it('sorts actors directly from their ground contact y', () => {
    expect(actorDepthKey(240)).toBe(240);
    expect(actorDepthKey(360)).toBeGreaterThan(actorDepthKey(240));
  });

  it('uses the nearest edge of an unrotated block as its depth key', () => {
    expect(blockFootpointY(200, 100, 60, 0)).toBeCloseTo(230, 6);
    expect(blockDepthKey(200, 100, 60, 0)).toBeCloseTo(230, 6);
  });

  it('accounts for block rotation when finding its ground footpoint', () => {
    expect(blockFootpointY(200, 100, 60, Math.PI / 2)).toBeCloseTo(250, 6);
  });

  it('puts an actor above a block behind it and an actor below it in front', () => {
    const block = blockDepthKey(200, 100, 60, 0);

    expect(actorDepthKey(220)).toBeLessThan(block);
    expect(actorDepthKey(240)).toBeGreaterThan(block);
  });

  it('normalizes malformed values to deterministic finite keys', () => {
    expect(actorDepthKey(Number.NaN)).toBe(0);
    expect(blockDepthKey(Number.NaN, Number.NaN, 60, Number.NaN)).toBe(30);
  });
});

