import { describe, expect, it } from 'vitest';
import { PlayerVitals } from '../../../src/game/player/PlayerVitals';

const createVitals = (): PlayerVitals =>
  new PlayerVitals({
    maxHp: 100,
    contactInvulnerabilitySeconds: 1,
  });

describe('PlayerVitals', () => {
  it('starts at full health with an immutable value snapshot', () => {
    const vitals = createVitals();
    const initialSnapshot = vitals.snapshot;

    expect(initialSnapshot).toEqual({
      hp: 100,
      maxHp: 100,
      invulnerabilityRemaining: 0,
      dead: false,
    });
    expect(Object.isFrozen(initialSnapshot)).toBe(true);

    vitals.damage(20, 'drifter-1');

    expect(initialSnapshot.hp).toBe(100);
    expect(vitals.snapshot.hp).toBe(80);
  });

  it.each([
    [{ maxHp: 0, contactInvulnerabilitySeconds: 1 }, 'maxHp'],
    [{ maxHp: -1, contactInvulnerabilitySeconds: 1 }, 'maxHp'],
    [{ maxHp: Number.NaN, contactInvulnerabilitySeconds: 1 }, 'maxHp'],
    [{ maxHp: Number.POSITIVE_INFINITY, contactInvulnerabilitySeconds: 1 }, 'maxHp'],
    [{ maxHp: 100, contactInvulnerabilitySeconds: -1 }, 'contactInvulnerabilitySeconds'],
    [{ maxHp: 100, contactInvulnerabilitySeconds: Number.NaN }, 'contactInvulnerabilitySeconds'],
    [
      {
        maxHp: 100,
        contactInvulnerabilitySeconds: Number.POSITIVE_INFINITY,
      },
      'contactInvulnerabilitySeconds',
    ],
  ])('rejects invalid constructor config %o', (config, expectedField) => {
    expect(() => new PlayerVitals(config)).toThrow(expectedField);
  });

  it('applies damage and starts contact invulnerability', () => {
    const vitals = createVitals();

    expect(vitals.damage(25, 'drifter-1')).toEqual({
      kind: 'applied',
      sourceId: 'drifter-1',
      amount: 25,
      hp: 75,
    });
    expect(vitals.snapshot).toEqual({
      hp: 75,
      maxHp: 100,
      invulnerabilityRemaining: 1,
      dead: false,
    });
  });

  it('ignores damage during i-frames without refreshing their duration', () => {
    const vitals = createVitals();
    vitals.damage(10, 'drifter-1');
    vitals.update(0.6);

    expect(vitals.damage(50, 'drifter-2')).toEqual({
      kind: 'ignored',
      sourceId: 'drifter-2',
      amount: 0,
      hp: 90,
      reason: 'invulnerable',
    });
    expect(vitals.snapshot.invulnerabilityRemaining).toBeCloseTo(0.4);

    vitals.update(0.4);

    expect(vitals.damage(20, 'drifter-2').kind).toBe('applied');
    expect(vitals.snapshot.hp).toBe(70);
  });

  it('reports lethal damage, clamps health, and blocks later damage or healing', () => {
    const vitals = createVitals();

    expect(vitals.damage(150, 'rusher-1')).toEqual({
      kind: 'death',
      sourceId: 'rusher-1',
      amount: 100,
      hp: 0,
    });
    expect(vitals.snapshot).toEqual({
      hp: 0,
      maxHp: 100,
      invulnerabilityRemaining: 1,
      dead: true,
    });
    expect(vitals.damage(10, 'drifter-1')).toEqual({
      kind: 'ignored',
      sourceId: 'drifter-1',
      amount: 0,
      hp: 0,
      reason: 'dead',
    });
    expect(vitals.heal(100)).toBe(0);
    expect(vitals.snapshot.hp).toBe(0);
  });

  it('heals only the missing health and returns the actual recovery', () => {
    const vitals = createVitals();
    vitals.damage(40, 'drifter-1');

    expect(vitals.heal(15)).toBe(15);
    expect(vitals.snapshot.hp).toBe(75);
    expect(vitals.heal(50)).toBe(25);
    expect(vitals.snapshot.hp).toBe(100);
    expect(vitals.heal(10)).toBe(0);
  });

  it('can increase maximum and current HP for a run mutation', () => {
    const vitals = createVitals();
    vitals.damage(30, 'drifter-1');

    expect(vitals.increaseMaximum(20, 20)).toBe(true);
    expect(vitals.snapshot).toMatchObject({ hp: 90, maxHp: 120 });
    expect(vitals.increaseMaximum(Number.NaN)).toBe(false);

    vitals.reset();
    expect(vitals.snapshot).toMatchObject({ hp: 100, maxHp: 100 });
  });

  it('safely ignores invalid runtime amounts and deltas', () => {
    const vitals = createVitals();

    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(vitals.damage(amount, 'invalid')).toEqual({
        kind: 'ignored',
        sourceId: 'invalid',
        amount: 0,
        hp: 100,
        reason: 'invalid-amount',
      });
      expect(vitals.heal(amount)).toBe(0);
    }

    expect(vitals.snapshot.invulnerabilityRemaining).toBe(0);

    vitals.damage(10, 'drifter-1');
    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      vitals.update(delta);
    }

    expect(vitals.snapshot.invulnerabilityRemaining).toBe(1);
    expect(vitals.snapshot.hp).toBe(90);
  });

  it('clamps i-frames to zero after a large finite update', () => {
    const vitals = createVitals();
    vitals.damage(10, 'drifter-1');

    vitals.update(10_000);

    expect(vitals.snapshot.invulnerabilityRemaining).toBe(0);
    expect(vitals.damage(10, 'drifter-1').kind).toBe('applied');
  });

  it('supports zero-duration i-frames', () => {
    const vitals = new PlayerVitals({
      maxHp: 30,
      contactInvulnerabilitySeconds: 0,
    });

    expect(vitals.damage(10, 'drifter-1').kind).toBe('applied');
    expect(vitals.damage(10, 'drifter-2').kind).toBe('applied');
    expect(vitals.snapshot.hp).toBe(10);
  });

  it('reset restores full health and clears death and i-frames', () => {
    const vitals = createVitals();
    vitals.damage(100, 'rusher-1');

    vitals.reset();

    expect(vitals.snapshot).toEqual({
      hp: 100,
      maxHp: 100,
      invulnerabilityRemaining: 0,
      dead: false,
    });
    expect(vitals.damage(10, 'drifter-1').kind).toBe('applied');
  });
});
