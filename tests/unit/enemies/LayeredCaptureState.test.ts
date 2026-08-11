import { describe, expect, it } from 'vitest';
import { LayeredCaptureState } from '../../../src/game/enemies/LayeredCaptureState';

const createState = (): LayeredCaptureState =>
  new LayeredCaptureState({
    exposureSeconds: 4,
    peelReward: { xp: 25, recovery: 4 },
    finalReward: { xp: 60, recovery: 10 },
  });

describe('LayeredCaptureState', () => {
  it('peels first, then kills during the exposure window', () => {
    const state = createState();

    expect(state.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 25, recovery: 4 },
      exposureSeconds: 4,
    });
    expect(state.snapshot).toMatchObject({
      alive: true,
      exposed: true,
      exposureRemaining: 4,
    });

    state.update(1.5);
    expect(state.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 60, recovery: 10 },
    });
    expect(state.snapshot).toMatchObject({
      alive: false,
      exposed: false,
      exposureRemaining: 0,
    });
  });

  it('reforms after exposure without allowing peel reward farming', () => {
    const state = createState();
    state.capture();
    state.update(4);

    expect(state.snapshot).toMatchObject({ exposed: false, alive: true });
    expect(state.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 0, recovery: 0 },
      exposureSeconds: 4,
    });
  });

  it('ignores invalid time and captures after death', () => {
    const state = createState();
    state.capture();

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      state.update(delta);
    }
    expect(state.snapshot.exposureRemaining).toBe(4);

    state.capture();
    expect(state.capture()).toEqual({ kind: 'ignored', reason: 'dead' });
  });

  it('resets all lifetime state', () => {
    const state = createState();
    state.capture();
    state.capture();

    state.reset();

    expect(state.snapshot).toEqual({
      alive: true,
      exposed: false,
      exposureRemaining: 0,
      peelRewardClaimed: false,
    });
    expect(state.capture()).toMatchObject({
      kind: 'peeled',
      reward: { xp: 25, recovery: 4 },
    });
  });

  it.each([
    { exposureSeconds: 0, peelReward: { xp: 1, recovery: 1 }, finalReward: { xp: 1, recovery: 1 } },
    { exposureSeconds: 1, peelReward: { xp: -1, recovery: 1 }, finalReward: { xp: 1, recovery: 1 } },
    { exposureSeconds: 1, peelReward: { xp: 1, recovery: 1 }, finalReward: { xp: 1, recovery: Number.NaN } },
  ])('rejects invalid config %#', (config) => {
    expect(() => new LayeredCaptureState(config)).toThrow();
  });

  it('returns frozen snapshots, results, and rewards', () => {
    const state = createState();
    const snapshot = state.snapshot;
    const result = state.capture();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.kind === 'peeled' ? result.reward : null)).toBe(
      true,
    );
  });
});
