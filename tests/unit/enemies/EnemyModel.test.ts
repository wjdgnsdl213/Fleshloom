import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../../src/content/enemies';
import {
  EnemyModel,
  MAX_ENEMY_STEP_SECONDS,
  type EnemyAction,
  type EnemyArenaBounds,
} from '../../../src/game/enemies/EnemyModel';
import type { Vec2 } from '../../../src/core/geometry/vector';

const wideBounds: EnemyArenaBounds = {
  minX: -1_000,
  minY: -1_000,
  maxX: 1_000,
  maxY: 1_000,
};

const createEnemy = (
  archetype: 'drifter' | 'rusher' | 'watcher',
  position: Vec2 = { x: 0, y: 0 },
): EnemyModel =>
  new EnemyModel({
    id: `${archetype}-1`,
    archetype,
    position,
    phase: 0.25,
  });

const stepFor = (
  enemy: EnemyModel,
  totalSeconds: number,
  playerPosition: Vec2,
  bounds: EnemyArenaBounds = wideBounds,
): EnemyAction[] => {
  const actions: EnemyAction[] = [];
  let remaining = totalSeconds;

  while (remaining > 1e-9) {
    const delta = Math.min(MAX_ENEMY_STEP_SECONDS, remaining);
    actions.push(...enemy.step(delta, playerPosition, bounds));
    remaining -= delta;
  }

  return actions;
};

describe('enemy definitions', () => {
  it('contains the locked M2 rewards, damage, speed, and imprint values', () => {
    expect(ENEMY_DEFINITIONS.drifter).toMatchObject({
      radius: 18,
      contactDamage: 12,
      xp: 10,
      captureRecovery: 3,
      baseSpeed: 42,
    });
    expect(ENEMY_DEFINITIONS.drifter.imprintKind).toBeUndefined();

    expect(ENEMY_DEFINITIONS.rusher).toMatchObject({
      radius: 20,
      contactDamage: 18,
      xp: 16,
      captureRecovery: 4,
      baseSpeed: 58,
      imprintKind: 'spike',
      telegraphSeconds: 0.8,
      chargeSpeed: 280,
      chargeSeconds: 0.42,
      recoverSeconds: 1.1,
    });

    expect(ENEMY_DEFINITIONS.watcher).toMatchObject({
      radius: 19,
      contactDamage: 14,
      xp: 18,
      captureRecovery: 4,
      baseSpeed: 48,
      imprintKind: 'nerve',
      standoffMinDistance: 170,
      standoffMaxDistance: 250,
      lockSeconds: 0.9,
      cooldownSeconds: 2.1,
    });

    expect(Object.isFrozen(ENEMY_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(ENEMY_DEFINITIONS.rusher)).toBe(true);
  });
});

describe('EnemyModel', () => {
  it('copies injected state and exposes a frozen snapshot with a stable identity', () => {
    const position = { x: 12, y: 34 };
    const enemy = new EnemyModel({
      id: 'drifter-stable',
      archetype: 'drifter',
      position,
      phase: 0.75,
    });
    const initial = enemy.snapshot;
    position.x = 999;

    expect(initial).toMatchObject({
      id: 'drifter-stable',
      archetype: 'drifter',
      position: { x: 12, y: 34 },
      velocity: { x: 0, y: 0 },
      facing: { x: 0, y: 1 },
      phase: 0.75,
      alive: true,
      behaviorState: 'chase',
      behaviorTimer: 0,
      lockedTarget: null,
      lockedDirection: null,
    });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.position)).toBe(true);

    enemy.step(0.1, { x: 100, y: 34 }, wideBounds);

    expect(initial.position).toEqual({ x: 12, y: 34 });
    expect(enemy.snapshot.id).toBe('drifter-stable');
    expect(enemy.snapshot.phase).toBe(0.75);
  });

  it.each([
    [{ id: '', archetype: 'drifter' as const, position: { x: 0, y: 0 }, phase: 0 }],
    [
      {
        id: 'bad-position',
        archetype: 'drifter' as const,
        position: { x: Number.NaN, y: 0 },
        phase: 0,
      },
    ],
    [
      {
        id: 'bad-phase',
        archetype: 'drifter' as const,
        position: { x: 0, y: 0 },
        phase: Number.POSITIVE_INFINITY,
      },
    ],
  ])('rejects invalid spawn data', (spawn) => {
    expect(() => new EnemyModel(spawn)).toThrow(RangeError);
  });

  it('moves a Drifter steadily toward the player', () => {
    const enemy = createEnemy('drifter');

    expect(enemy.step(0.1, { x: 100, y: 0 }, wideBounds)).toEqual([]);

    expect(enemy.snapshot.position.x).toBeCloseTo(4.2);
    expect(enemy.snapshot.position.y).toBe(0);
    expect(enemy.snapshot.velocity).toEqual({ x: 42, y: 0 });
    expect(enemy.snapshot.facing).toEqual({ x: 1, y: 0 });
    expect(enemy.snapshot.behaviorState).toBe('chase');
  });

  it('requires two separate captures for an armored Drifter', () => {
    const enemy = new EnemyModel({
      id: 'armored-drifter',
      archetype: 'drifter',
      position: { x: 0, y: 0 },
      phase: 0.25,
      captureProfile: 'armored',
    });

    expect(enemy.snapshot).toMatchObject({
      radius: 23,
      contactDamage: 16,
      captureProfile: 'armored',
      armored: true,
      staggerRemaining: 0,
      alive: true,
    });
    expect(enemy.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 7, recovery: 2 },
      staggerSeconds: 0.8,
    });
    expect(enemy.snapshot).toMatchObject({
      armored: false,
      alive: true,
      behaviorState: 'staggered',
      staggerRemaining: 0.8,
    });

    enemy.step(0.1, { x: 100, y: 0 }, wideBounds);
    expect(enemy.snapshot.position).toEqual({ x: 0, y: 0 });
    expect(enemy.snapshot.velocity).toEqual({ x: 0, y: 0 });
    stepFor(enemy, 0.7, { x: 100, y: 0 });
    expect(enemy.snapshot.staggerRemaining).toBeCloseTo(0);
    enemy.step(0.1, { x: 100, y: 0 }, wideBounds);
    expect(enemy.snapshot.position.x).toBeCloseTo(3.276);

    expect(enemy.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 14, recovery: 4 },
    });
    expect(enemy.snapshot).toMatchObject({
      alive: false,
      behaviorState: 'dead',
    });
    expect(enemy.capture()).toEqual({ kind: 'ignored', reason: 'dead' });
  });

  it('keeps ordinary enemies on their existing one-capture contract', () => {
    const enemy = createEnemy('rusher');

    expect(enemy.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 16, recovery: 4 },
    });
    expect(enemy.snapshot.alive).toBe(false);
  });

  it('rejects armored profiles on non-Drifter archetypes', () => {
    expect(
      () =>
        new EnemyModel({
          id: 'armored-rusher',
          archetype: 'rusher',
          position: { x: 0, y: 0 },
          phase: 0,
          captureProfile: 'armored',
        }),
    ).toThrow(RangeError);
  });

  it('treats invalid delta values as complete no-ops', () => {
    const enemy = createEnemy('rusher');
    const before = enemy.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(enemy.step(delta, { x: 100, y: 0 }, wideBounds)).toEqual([]);
      expect(enemy.snapshot).toEqual(before);
    }
  });

  it('caps a large finite delta to the public maximum step', () => {
    const largeStepEnemy = createEnemy('drifter');
    const cappedStepEnemy = createEnemy('drifter');

    largeStepEnemy.step(100, { x: 100, y: 0 }, wideBounds);
    cappedStepEnemy.step(
      MAX_ENEMY_STEP_SECONDS,
      { x: 100, y: 0 },
      wideBounds,
    );

    expect(largeStepEnemy.snapshot).toEqual(cappedStepEnemy.snapshot);
  });

  it('keeps an enemy radius inside arena bounds', () => {
    const enemy = createEnemy('drifter', { x: 95, y: -20 });
    const bounds: EnemyArenaBounds = {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    };

    enemy.step(0.1, { x: 200, y: -20 }, bounds);

    expect(enemy.snapshot.position).toEqual({ x: 82, y: 18 });
    expect(enemy.snapshot.velocity).toEqual({ x: 0, y: 0 });
  });

  it('locks a Rusher direction through telegraph and charge, then recovers', () => {
    const enemy = createEnemy('rusher');

    enemy.step(0.1, { x: 100, y: 0 }, wideBounds);

    expect(enemy.snapshot.behaviorState).toBe('telegraph');
    expect(enemy.snapshot.behaviorTimer).toBeCloseTo(0.7);
    expect(enemy.snapshot.lockedTarget).toEqual({ x: 100, y: 0 });
    expect(enemy.snapshot.lockedDirection).toEqual({ x: 1, y: 0 });
    expect(enemy.snapshot.velocity).toEqual({ x: 0, y: 0 });

    stepFor(enemy, 0.7, { x: 0, y: 100 });

    expect(enemy.snapshot.behaviorState).toBe('charge');
    expect(enemy.snapshot.behaviorTimer).toBeCloseTo(0.42);
    expect(enemy.snapshot.lockedDirection).toEqual({ x: 1, y: 0 });

    enemy.step(0.1, { x: 0, y: 100 }, wideBounds);

    expect(enemy.snapshot.position).toEqual({ x: 28, y: 0 });
    expect(enemy.snapshot.velocity).toEqual({ x: 280, y: 0 });
    expect(enemy.snapshot.behaviorState).toBe('charge');

    stepFor(enemy, 0.32, { x: 0, y: 100 });

    expect(enemy.snapshot.position.x).toBeCloseTo(117.6);
    expect(enemy.snapshot.position.y).toBe(0);
    expect(enemy.snapshot.behaviorState).toBe('recover');
    expect(enemy.snapshot.behaviorTimer).toBeCloseTo(1.1);
    expect(enemy.snapshot.lockedTarget).toBeNull();
    expect(enemy.snapshot.lockedDirection).toBeNull();
    expect(enemy.snapshot.velocity).toEqual({ x: 0, y: 0 });

    stepFor(enemy, 1.1, { x: 0, y: 100 });

    expect(enemy.snapshot.behaviorState).toBe('approach');
    expect(enemy.snapshot.behaviorTimer).toBe(0);
  });

  it('moves a Watcher into its standoff band from either side', () => {
    const farEnemy = createEnemy('watcher');
    const nearEnemy = createEnemy('watcher');

    farEnemy.step(0.1, { x: 300, y: 0 }, wideBounds);
    nearEnemy.step(0.1, { x: 50, y: 0 }, wideBounds);

    expect(farEnemy.snapshot.position.x).toBeCloseTo(4.8);
    expect(farEnemy.snapshot.position.y).toBe(0);
    expect(farEnemy.snapshot.velocity).toEqual({ x: 48, y: 0 });
    expect(farEnemy.snapshot.behaviorState).toBe('positioning');
    expect(nearEnemy.snapshot.position.x).toBeCloseTo(-4.8);
    expect(nearEnemy.snapshot.position.y).toBe(0);
    expect(nearEnemy.snapshot.velocity).toEqual({ x: -48, y: 0 });
    expect(nearEnemy.snapshot.behaviorState).toBe('positioning');
  });

  it('emits one locked Watcher projectile action per firing cycle', () => {
    const enemy = createEnemy('watcher');

    expect(enemy.step(0.1, { x: 200, y: 0 }, wideBounds)).toEqual([]);
    expect(enemy.snapshot.behaviorState).toBe('locking');
    expect(enemy.snapshot.behaviorTimer).toBeCloseTo(0.8);
    expect(enemy.snapshot.lockedTarget).toEqual({ x: 200, y: 0 });
    expect(enemy.snapshot.lockedDirection).toEqual({ x: 1, y: 0 });

    const firstCycleActions = stepFor(
      enemy,
      0.8,
      { x: 0, y: 200 },
    );

    expect(firstCycleActions).toEqual([
      {
        type: 'projectile-spawn',
        sourceId: 'watcher-1',
        archetype: 'watcher',
        origin: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
        target: { x: 200, y: 0 },
      },
    ]);
    expect(enemy.snapshot.behaviorState).toBe('cooldown');
    expect(enemy.snapshot.behaviorTimer).toBeCloseTo(2.1);
    expect(enemy.snapshot.lockedTarget).toBeNull();
    expect(enemy.snapshot.lockedDirection).toBeNull();
    expect(enemy.step(0.1, { x: 0, y: 200 }, wideBounds)).toEqual([]);

    const cooldownActions = stepFor(
      enemy,
      2,
      { x: 0, y: 200 },
    );
    expect(cooldownActions).toEqual([]);
    expect(enemy.snapshot.behaviorState).toBe('positioning');

    expect(enemy.step(0.1, { x: 0, y: 200 }, wideBounds)).toEqual([]);
    const secondCycleActions = stepFor(
      enemy,
      0.8,
      { x: 0, y: 200 },
    );

    expect(secondCycleActions).toHaveLength(1);
    expect(secondCycleActions[0]?.direction).toEqual({ x: 0, y: 1 });
  });

  it('is deterministic for identical spawn data and input sequences', () => {
    const first = createEnemy('rusher');
    const second = createEnemy('rusher');
    const frames = [
      { delta: 0.1, player: { x: 150, y: 20 } },
      { delta: 0.04, player: { x: -100, y: 80 } },
      { delta: 0.1, player: { x: -100, y: 80 } },
      { delta: 0.07, player: { x: 30, y: -200 } },
      { delta: 0.1, player: { x: 30, y: -200 } },
    ];

    for (const frame of frames) {
      expect(first.step(frame.delta, frame.player, wideBounds)).toEqual(
        second.step(frame.delta, frame.player, wideBounds),
      );
      expect(first.snapshot).toEqual(second.snapshot);
    }
  });

  it('stops simulation permanently after kill', () => {
    const enemy = createEnemy('watcher');
    enemy.step(0.1, { x: 200, y: 0 }, wideBounds);

    enemy.kill();
    const deadSnapshot = enemy.snapshot;

    expect(deadSnapshot.alive).toBe(false);
    expect(deadSnapshot.behaviorState).toBe('dead');
    expect(deadSnapshot.behaviorTimer).toBe(0);
    expect(deadSnapshot.lockedTarget).toBeNull();
    expect(deadSnapshot.lockedDirection).toBeNull();
    expect(enemy.step(1, { x: 200, y: 0 }, wideBounds)).toEqual([]);
    expect(enemy.snapshot).toEqual(deadSnapshot);
  });
});
