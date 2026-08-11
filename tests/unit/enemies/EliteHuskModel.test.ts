import { describe, expect, it } from 'vitest';
import {
  ELITE_HUSK_BALANCE,
  EliteHuskModel,
} from '../../../src/game/enemies/EliteHuskModel';

const bounds = { minX: 0, minY: 0, maxX: 500, maxY: 400 };

const createHusk = (): EliteHuskModel =>
  new EliteHuskModel({
    id: 'elite-1',
    position: { x: 100, y: 100 },
    phase: 0.4,
  });

describe('EliteHuskModel', () => {
  it('publishes the locked M3 balance in a frozen snapshot', () => {
    const snapshot = createHusk().snapshot;

    expect(snapshot).toMatchObject({
      id: 'elite-1',
      radius: 34,
      contactDamage: 24,
      alive: true,
      exposed: false,
      exposureRemaining: 0,
    });
    expect(ELITE_HUSK_BALANCE.baseSpeed).toBe(34);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.position)).toBe(true);
  });

  it('chases the player with a capped deterministic step', () => {
    const large = createHusk();
    const capped = createHusk();

    large.step(1, { x: 300, y: 100 }, bounds);
    capped.step(0.1, { x: 300, y: 100 }, bounds);

    expect(large.snapshot).toEqual(capped.snapshot);
    expect(large.snapshot.position.x).toBeCloseTo(103.4);
    expect(large.snapshot.velocity).toEqual({ x: 34, y: 0 });
    expect(large.snapshot.facing).toEqual({ x: 1, y: 0 });
  });

  it('requires two captures during the four-second exposure', () => {
    const husk = createHusk();

    expect(husk.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 25, recovery: 4 },
      exposureSeconds: 4,
    });
    expect(husk.snapshot).toMatchObject({ alive: true, exposed: true });
    expect(husk.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 60, recovery: 10 },
    });
    expect(husk.snapshot.alive).toBe(false);
  });

  it('reforms after exposure without paying the peel twice', () => {
    const husk = createHusk();
    husk.capture();

    for (let index = 0; index < 40; index += 1) {
      husk.step(0.1, { x: 300, y: 100 }, bounds);
    }

    expect(husk.snapshot.exposed).toBe(false);
    expect(husk.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 0, recovery: 0 },
      exposureSeconds: 4,
    });
  });

  it('clamps to radius-aware bounds and ignores invalid updates', () => {
    const husk = createHusk();
    const before = husk.snapshot;
    husk.step(Number.NaN, { x: 300, y: 100 }, bounds);
    husk.step(0.1, { x: Number.NaN, y: 100 }, bounds);
    expect(husk.snapshot).toEqual(before);

    const edge = new EliteHuskModel({
      id: 'elite-edge',
      position: { x: 466, y: 200 },
      phase: 0,
    });
    edge.step(0.1, { x: 600, y: 200 }, bounds);
    expect(edge.snapshot.position.x).toBe(466);
    expect(edge.snapshot.velocity.x).toBe(0);
  });

  it('does not move or pay rewards after death', () => {
    const husk = createHusk();
    husk.capture();
    husk.capture();
    const dead = husk.snapshot;

    husk.step(0.1, { x: 300, y: 100 }, bounds);
    expect(husk.snapshot).toEqual(dead);
    expect(husk.capture()).toEqual({ kind: 'ignored', reason: 'dead' });
  });
});

