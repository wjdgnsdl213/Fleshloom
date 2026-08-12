import { describe, expect, it } from 'vitest';
import { ArmoredCaptureState } from '../../../src/game/enemies/ArmoredCaptureState';

const createState = (): ArmoredCaptureState =>
  new ArmoredCaptureState({
    staggerSeconds: 0.8,
    peelReward: { xp: 7, recovery: 2 },
    finalReward: { xp: 14, recovery: 4 },
  });

describe('ArmoredCaptureState', () => {
  it('pays the shell reward once and remains alive but permanently exposed', () => {
    const state = createState();

    expect(state.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 7, recovery: 2 },
      staggerSeconds: 0.8,
    });
    expect(state.snapshot).toEqual({
      alive: true,
      armored: false,
      staggerRemaining: 0.8,
    });

    state.update(10);

    expect(state.snapshot).toEqual({
      alive: true,
      armored: false,
      staggerRemaining: 0,
    });
  });

  it('kills and pays the separate final reward on the next capture', () => {
    const state = createState();
    state.capture();

    expect(state.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 14, recovery: 4 },
    });
    expect(state.snapshot).toEqual({
      alive: false,
      armored: false,
      staggerRemaining: 0,
    });
    expect(state.capture()).toEqual({ kind: 'ignored', reason: 'dead' });
  });

  it('rejects invalid balance values and ignores invalid updates', () => {
    expect(
      () =>
        new ArmoredCaptureState({
          staggerSeconds: 0,
          peelReward: { xp: 1, recovery: 1 },
          finalReward: { xp: 1, recovery: 1 },
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new ArmoredCaptureState({
          staggerSeconds: 1,
          peelReward: { xp: -1, recovery: 1 },
          finalReward: { xp: 1, recovery: 1 },
        }),
    ).toThrow(RangeError);

    const state = createState();
    state.capture();
    const before = state.snapshot;
    state.update(Number.NaN);
    state.update(-1);
    expect(state.snapshot).toEqual(before);
  });
});
