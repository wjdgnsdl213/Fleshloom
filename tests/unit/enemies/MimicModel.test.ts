import { describe, expect, it } from 'vitest';
import {
  MAX_MIMIC_STEP_SECONDS,
  MIMIC_BALANCE,
  MimicModel,
  type MimicArenaBounds,
} from '../../../src/game/enemies/MimicModel';

const bounds: MimicArenaBounds = {
  minX: -1_000,
  minY: -1_000,
  maxX: 1_000,
  maxY: 1_000,
};

const createMimic = (position = { x: 150, y: 0 }): MimicModel =>
  new MimicModel({
    id: 'mimic-1',
    position,
    phase: 0.4,
  });

describe('MimicModel', () => {
  it('exposes the locked balance and a frozen initial snapshot', () => {
    const mimic = createMimic();
    const snapshot = mimic.snapshot;

    expect(MIMIC_BALANCE).toEqual({
      radius: 18,
      speed: 70,
      contactDamage: 15,
      xp: 22,
      captureRecovery: 4,
      minimumDistance: 110,
      maximumDistance: 190,
      reflectedWeight: 0.7,
      orbitWeight: 0.3,
    });
    expect(snapshot).toEqual({
      id: 'mimic-1',
      position: { x: 150, y: 0 },
      velocity: { x: 0, y: 0 },
      facing: { x: 0, y: 1 },
      phase: 0.4,
      radius: 18,
      contactDamage: 15,
      xp: 22,
      captureRecovery: 4,
      alive: true,
      behaviorState: 'orbiting',
    });
    expect(Object.isFrozen(MIMIC_BALANCE)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.position)).toBe(true);
    expect(Object.isFrozen(snapshot.velocity)).toBe(true);
    expect(Object.isFrozen(snapshot.facing)).toBe(true);
  });

  it('corrects toward the player when farther than 190 px', () => {
    const mimic = createMimic({ x: 300, y: 0 });

    mimic.step(0.1, {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      bounds,
    });

    expect(mimic.snapshot.position).toEqual({ x: 293, y: 0 });
    expect(mimic.snapshot.velocity).toEqual({ x: -70, y: 0 });
    expect(mimic.snapshot.facing).toEqual({ x: -1, y: 0 });
    expect(mimic.snapshot.behaviorState).toBe('correcting-in');
  });

  it('corrects away from the player when closer than 110 px', () => {
    const mimic = createMimic({ x: 50, y: 0 });

    mimic.step(0.1, {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 0, y: 0 },
      bounds,
    });

    expect(mimic.snapshot.position).toEqual({ x: 57, y: 0 });
    expect(mimic.snapshot.velocity).toEqual({ x: 70, y: 0 });
    expect(mimic.snapshot.facing).toEqual({ x: 1, y: 0 });
    expect(mimic.snapshot.behaviorState).toBe('correcting-out');
  });

  it('blends 70% reflected player direction with 30% clockwise orbit', () => {
    const mimic = createMimic({ x: 150, y: 0 });
    const blendLength = Math.hypot(0.7, 0.3);
    const expectedX = (-0.7 / blendLength) * 70;
    const expectedY = (-0.3 / blendLength) * 70;

    mimic.step(0.1, {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 100, y: 0 },
      bounds,
    });

    expect(mimic.snapshot.velocity.x).toBeCloseTo(expectedX);
    expect(mimic.snapshot.velocity.y).toBeCloseTo(expectedY);
    expect(mimic.snapshot.velocity.x).toBeLessThan(0);
    expect(mimic.snapshot.behaviorState).toBe('mirroring');
    expect(Math.hypot(mimic.snapshot.velocity.x, mimic.snapshot.velocity.y)).toBeCloseTo(
      70,
    );
  });

  it('orbits clockwise deterministically when player velocity is near zero', () => {
    const first = createMimic({ x: 150, y: 0 });
    const second = createMimic({ x: 150, y: 0 });
    const context = {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 1e-8, y: 0 },
      bounds,
    };

    first.step(0.1, context);
    second.step(0.1, context);

    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.snapshot.position).toEqual({ x: 150, y: -7 });
    expect(first.snapshot.velocity).toEqual({ x: 0, y: -70 });
    expect(first.snapshot.behaviorState).toBe('orbiting');
  });

  it.each([
    [{ x: 300, y: 0 }, { x: 0, y: 0 }],
    [{ x: 50, y: 0 }, { x: 0, y: 0 }],
    [{ x: 150, y: 0 }, { x: 10_000, y: -8_000 }],
  ])('never exceeds its 70 px/s speed cap', (position, playerVelocity) => {
    const mimic = createMimic(position);

    mimic.step(0.1, {
      playerPosition: { x: 0, y: 0 },
      playerVelocity,
      bounds,
    });

    expect(Math.hypot(mimic.snapshot.velocity.x, mimic.snapshot.velocity.y)).toBeLessThanOrEqual(
      70 + 1e-9,
    );
  });

  it('keeps its radius inside arena bounds', () => {
    const mimic = createMimic({ x: 95, y: -5 });
    const smallBounds: MimicArenaBounds = {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    };

    mimic.step(0.1, {
      playerPosition: { x: 500, y: 18 },
      playerVelocity: { x: 0, y: 0 },
      bounds: smallBounds,
    });

    expect(mimic.snapshot.position).toEqual({ x: 82, y: 18 });
    expect(mimic.snapshot.velocity).toEqual({ x: 0, y: 0 });
  });

  it('caps a large finite delta to the public maximum step', () => {
    const largeStepMimic = createMimic();
    const cappedStepMimic = createMimic();
    const context = {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 100, y: 20 },
      bounds,
    };

    largeStepMimic.step(100, context);
    cappedStepMimic.step(MAX_MIMIC_STEP_SECONDS, context);

    expect(largeStepMimic.snapshot).toEqual(cappedStepMimic.snapshot);
  });

  it('treats invalid dt, player data, or bounds as complete no-ops', () => {
    const mimic = createMimic();
    const initial = mimic.snapshot;
    const validContext = {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 10, y: 0 },
      bounds,
    };

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      mimic.step(delta, validContext);
    }
    mimic.step(0.1, {
      ...validContext,
      playerPosition: { x: Number.NaN, y: 0 },
    });
    mimic.step(0.1, {
      ...validContext,
      playerVelocity: { x: 0, y: Number.POSITIVE_INFINITY },
    });
    mimic.step(0.1, {
      ...validContext,
      bounds: { ...bounds, minX: Number.NaN },
    });

    expect(mimic.snapshot).toEqual(initial);
  });

  it('kill freezes movement and permanently stops simulation', () => {
    const mimic = createMimic();
    mimic.step(0.1, {
      playerPosition: { x: 0, y: 0 },
      playerVelocity: { x: 100, y: 0 },
      bounds,
    });

    mimic.kill();
    const dead = mimic.snapshot;

    expect(dead).toMatchObject({
      alive: false,
      behaviorState: 'dead',
      velocity: { x: 0, y: 0 },
    });
    mimic.step(0.1, {
      playerPosition: { x: 500, y: 0 },
      playerVelocity: { x: 500, y: 0 },
      bounds,
    });
    expect(mimic.snapshot).toEqual(dead);
  });

  it.each([
    [{ id: '', position: { x: 0, y: 0 }, phase: 0 }],
    [
      {
        id: 'mimic-1',
        position: { x: Number.NaN, y: 0 },
        phase: 0,
      },
    ],
    [
      {
        id: 'mimic-1',
        position: { x: 0, y: 0 },
        phase: Number.POSITIVE_INFINITY,
      },
    ],
  ])('rejects invalid spawn data', (spawn) => {
    expect(() => new MimicModel(spawn)).toThrow(RangeError);
  });
});
