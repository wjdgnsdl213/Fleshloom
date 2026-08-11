import { describe, expect, it } from 'vitest';
import { ImprintState } from '../../../src/game/progression/ImprintState';

describe('ImprintState', () => {
  it('starts without an active imprint or pending offer', () => {
    expect(new ImprintState(25).snapshot).toEqual({
      active: null,
      candidates: [],
    });
  });

  it('deduplicates and caps a loop offer at two candidates', () => {
    const state = new ImprintState(25);

    expect(state.offer(['spike', 'spike', 'nerve'])).toEqual({
      kind: 'offered',
      candidates: ['spike', 'nerve'],
    });
    expect(state.snapshot.candidates).toEqual(['spike', 'nerve']);
  });

  it('never overwrites the active imprint when a new offer appears', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.update(7);

    state.offer(['nerve']);

    expect(state.snapshot.active).toEqual({
      kind: 'spike',
      remainingSeconds: 18,
    });
    expect(state.snapshot.candidates).toEqual(['nerve']);
  });

  it('keep preserves both active type and remaining duration', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.update(4);
    state.offer(['nerve']);

    expect(state.keep()).toEqual({
      kind: 'kept',
      active: { kind: 'spike', remainingSeconds: 21 },
    });
    expect(state.snapshot).toEqual({
      active: { kind: 'spike', remainingSeconds: 21 },
      candidates: [],
    });
  });

  it('explicit replacement starts a full new duration', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.update(20);
    state.offer(['nerve']);

    expect(state.replace('nerve')).toEqual({
      kind: 'replaced',
      active: { kind: 'nerve', remainingSeconds: 25 },
    });
  });

  it('tracks every activated family for apex eligibility', () => {
    const state = new ImprintState(25);
    for (const kind of ['spike', 'nerve', 'blade', 'symmetry'] as const) {
      state.offer([kind]);
      state.replace(kind);
    }

    expect(state.activatedKinds).toEqual([
      'spike',
      'nerve',
      'blade',
      'symmetry',
    ]);
    expect(Object.isFrozen(state.activatedKinds)).toBe(true);

    state.reset();
    expect(state.activatedKinds).toEqual([]);
  });

  it('explicitly choosing the same candidate refreshes it', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.update(20);
    state.offer(['spike']);

    expect(state.replace('spike')).toMatchObject({
      kind: 'replaced',
      active: { kind: 'spike', remainingSeconds: 25 },
    });
  });

  it('extends active and future imprint duration for a run mutation', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.update(5);

    expect(state.increaseDuration(8)).toBe(true);
    expect(state.snapshot.active?.remainingSeconds).toBe(28);

    state.offer(['nerve']);
    state.replace('nerve');
    expect(state.snapshot.active?.remainingSeconds).toBe(33);

    state.reset();
    state.offer(['spike']);
    state.replace('spike');
    expect(state.snapshot.active?.remainingSeconds).toBe(25);
  });

  it('rejects choices outside the current offer without clearing it', () => {
    const state = new ImprintState(25);
    state.offer(['nerve']);

    expect(state.replace('spike')).toEqual({
      kind: 'ignored',
      reason: 'not-candidate',
    });
    expect(state.snapshot.candidates).toEqual(['nerve']);
  });

  it('does not replace an unresolved offer with a later capture', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);

    expect(state.offer(['nerve'])).toEqual({
      kind: 'ignored',
      reason: 'pending-choice',
    });
    expect(state.snapshot.candidates).toEqual(['spike']);
  });

  it('expires only on valid simulation time', () => {
    const state = new ImprintState(25);
    state.offer(['nerve']);
    state.replace('nerve');

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      state.update(delta);
    }
    expect(state.snapshot.active?.remainingSeconds).toBe(25);

    state.update(30);
    expect(state.snapshot.active).toBeNull();
  });

  it('reset clears active and pending state', () => {
    const state = new ImprintState(25);
    state.offer(['spike']);
    state.replace('spike');
    state.offer(['nerve']);

    state.reset();

    expect(state.snapshot).toEqual({ active: null, candidates: [] });
    expect(state.keep()).toEqual({ kind: 'ignored', reason: 'no-offer' });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid duration %s',
    (duration) => {
      expect(() => new ImprintState(duration)).toThrow('durationSeconds');
    },
  );
});
