import { describe, expect, it } from 'vitest';
import {
  ARMORED_DRIFTER_BALANCE,
  ARMORED_DRIFTER_WAVE_BANDS,
  captureProfileForDrifterSpawn,
} from '../../../src/content/armoredDrifters';

describe('armored Drifter content', () => {
  it('preserves ordinary one-capture onboarding through the first three minutes', () => {
    for (const time of [0, 60, 179.999]) {
      expect(captureProfileForDrifterSpawn(time, 4)).toBe('ordinary');
    }
  });

  it('raises the deterministic armored share across the post-checkpoint bands', () => {
    expect(
      Array.from({ length: 12 }, (_, index) =>
        captureProfileForDrifterSpawn(180, index + 1),
      ).filter((profile) => profile === 'armored'),
    ).toHaveLength(3);
    expect(
      Array.from({ length: 12 }, (_, index) =>
        captureProfileForDrifterSpawn(300, index + 1),
      ).filter((profile) => profile === 'armored'),
    ).toHaveLength(4);
    expect(
      Array.from({ length: 12 }, (_, index) =>
        captureProfileForDrifterSpawn(420, index + 1),
      ).filter((profile) => profile === 'armored'),
    ).toHaveLength(6);
  });

  it('keeps balance and schedule data immutable and rejects bad sequences safely', () => {
    expect(captureProfileForDrifterSpawn(Number.NaN, 2)).toBe('ordinary');
    expect(captureProfileForDrifterSpawn(420, 0)).toBe('ordinary');
    expect(captureProfileForDrifterSpawn(420, 1.5)).toBe('ordinary');
    expect(captureProfileForDrifterSpawn(540, 2)).toBe('ordinary');
    expect(Object.isFrozen(ARMORED_DRIFTER_BALANCE)).toBe(true);
    expect(Object.isFrozen(ARMORED_DRIFTER_BALANCE.peelReward)).toBe(true);
    expect(Object.isFrozen(ARMORED_DRIFTER_WAVE_BANDS)).toBe(true);
    expect(ARMORED_DRIFTER_WAVE_BANDS.every(Object.isFrozen)).toBe(true);
  });
});
