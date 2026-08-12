import { describe, expect, it } from 'vitest';
import {
  filledIntegrityPipCount,
  HUD_INTEGRITY_PIP_COUNT,
} from '../../../src/presentation/HudPresentation';

describe('filledIntegrityPipCount', () => {
  it('maps health to the eight styleframe-inspired integrity pips', () => {
    expect(HUD_INTEGRITY_PIP_COUNT).toBe(8);
    expect(filledIntegrityPipCount(100, 100)).toBe(8);
    expect(filledIntegrityPipCount(50, 100)).toBe(4);
    expect(filledIntegrityPipCount(1, 100)).toBe(1);
    expect(filledIntegrityPipCount(0, 100)).toBe(0);
  });

  it('clamps overflow and safely rejects invalid display inputs', () => {
    expect(filledIntegrityPipCount(200, 100)).toBe(8);
    expect(filledIntegrityPipCount(-1, 100)).toBe(0);
    expect(filledIntegrityPipCount(10, 0)).toBe(0);
    expect(filledIntegrityPipCount(Number.NaN, 100)).toBe(0);
    expect(filledIntegrityPipCount(50, 100, 0)).toBe(0);
  });
});
