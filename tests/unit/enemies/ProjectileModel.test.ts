import { describe, expect, it } from 'vitest';
import type { EnemyProjectileSpawnAction } from '../../../src/game/enemies/EnemyModel';
import {
  MAX_PROJECTILE_STEP_SECONDS,
  ProjectileModel,
  WATCHER_PROJECTILE_TUNING,
  type ProjectileBounds,
  type ProjectilePlayerCircle,
} from '../../../src/game/enemies/ProjectileModel';

const wideBounds: ProjectileBounds = {
  minX: -1_000,
  minY: -1_000,
  maxX: 1_000,
  maxY: 1_000,
};

const distantPlayer: ProjectilePlayerCircle = {
  center: { x: -900, y: -900 },
  radius: 12,
};

const createAction = (
  overrides: Partial<EnemyProjectileSpawnAction> = {},
): EnemyProjectileSpawnAction => ({
  type: 'projectile-spawn',
  sourceId: 'watcher-1',
  archetype: 'watcher',
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  target: { x: 200, y: 0 },
  ...overrides,
});

const createProjectile = (
  action: EnemyProjectileSpawnAction = createAction(),
): ProjectileModel =>
  new ProjectileModel({
    id: 'projectile-1',
    action,
  });

describe('ProjectileModel', () => {
  it('creates a frozen snapshot from a Watcher action and normalizes direction', () => {
    const projectile = createProjectile(
      createAction({ direction: { x: 3, y: 4 } }),
    );
    const snapshot = projectile.snapshot;

    expect(snapshot).toEqual({
      id: 'projectile-1',
      sourceId: 'watcher-1',
      position: { x: 0, y: 0 },
      velocity: { x: 132, y: 176 },
      radius: 5,
      damage: 14,
      lifetimeRemaining: 3.2,
      alive: true,
    });
    expect(WATCHER_PROJECTILE_TUNING).toEqual({
      speed: 220,
      radius: 5,
      damage: 14,
      lifetimeSeconds: 3.2,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.position)).toBe(true);
    expect(Object.isFrozen(WATCHER_PROJECTILE_TUNING)).toBe(true);
  });

  it.each([
    [{ id: '', action: createAction() }],
    [
      {
        id: 'projectile-1',
        action: createAction({ sourceId: '' }),
      },
    ],
    [
      {
        id: 'projectile-1',
        action: createAction({ origin: { x: Number.NaN, y: 0 } }),
      },
    ],
    [
      {
        id: 'projectile-1',
        action: createAction({ direction: { x: 0, y: 0 } }),
      },
    ],
    [
      {
        id: 'projectile-1',
        action: createAction({
          direction: { x: Number.POSITIVE_INFINITY, y: 0 },
        }),
      },
    ],
  ])('rejects invalid spawn data', (spawn) => {
    expect(() => new ProjectileModel(spawn)).toThrow(RangeError);
  });

  it('moves in a straight line and decreases lifetime', () => {
    const projectile = createProjectile();

    expect(projectile.step(0.05, wideBounds, distantPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot.position).toEqual({ x: 11, y: 0 });
    expect(projectile.snapshot.velocity).toEqual({ x: 220, y: 0 });
    expect(projectile.snapshot.lifetimeRemaining).toBeCloseTo(3.15);
    expect(projectile.snapshot.alive).toBe(true);
  });

  it('caps a large finite delta to the public maximum step', () => {
    const largeStepProjectile = createProjectile();
    const cappedStepProjectile = createProjectile();

    expect(largeStepProjectile.step(10, wideBounds, distantPlayer)).toEqual(
      cappedStepProjectile.step(
        MAX_PROJECTILE_STEP_SECONDS,
        wideBounds,
        distantPlayer,
      ),
    );
    expect(largeStepProjectile.snapshot).toEqual(cappedStepProjectile.snapshot);
  });

  it('uses a swept collision test so a fast projectile cannot tunnel', () => {
    const projectile = createProjectile();
    const player: ProjectilePlayerCircle = {
      center: { x: 12, y: 0 },
      radius: 2,
    };

    expect(projectile.step(0.1, wideBounds, player)).toEqual({
      kind: 'hit',
      projectileId: 'projectile-1',
      sourceId: 'watcher-1',
      damage: 14,
    });
    expect(projectile.snapshot.position.x).toBeCloseTo(5);
    expect(projectile.snapshot.position.y).toBe(0);
    expect(projectile.snapshot.alive).toBe(false);

    const terminalSnapshot = projectile.snapshot;
    expect(projectile.step(0.1, wideBounds, player)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot).toEqual(terminalSnapshot);
  });

  it('does not report a near miss as a hit', () => {
    const projectile = createProjectile();
    const player: ProjectilePlayerCircle = {
      center: { x: 11, y: 8 },
      radius: 2,
    };

    expect(projectile.step(0.1, wideBounds, player)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot.position).toEqual({ x: 22, y: 0 });
    expect(projectile.snapshot.alive).toBe(true);
  });

  it('expires once at the configured lifetime', () => {
    const projectile = createProjectile();

    for (let index = 0; index < 31; index += 1) {
      expect(projectile.step(0.1, wideBounds, distantPlayer).kind).toBe(
        'active',
      );
    }

    expect(projectile.snapshot.lifetimeRemaining).toBeCloseTo(0.1);
    expect(projectile.step(0.1, wideBounds, distantPlayer)).toEqual({
      kind: 'expired',
      projectileId: 'projectile-1',
    });
    expect(projectile.snapshot.lifetimeRemaining).toBe(0);
    expect(projectile.snapshot.alive).toBe(false);

    const terminalSnapshot = projectile.snapshot;
    expect(projectile.step(0.1, wideBounds, distantPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot).toEqual(terminalSnapshot);
  });

  it('stops at the arena edge and reports out-of-bounds only once', () => {
    const projectile = createProjectile();
    const bounds: ProjectileBounds = {
      minX: -30,
      minY: -30,
      maxX: 30,
      maxY: 30,
    };

    expect(projectile.step(0.1, bounds, distantPlayer).kind).toBe('active');
    expect(projectile.step(0.1, bounds, distantPlayer)).toEqual({
      kind: 'out-of-bounds',
      projectileId: 'projectile-1',
    });
    expect(projectile.snapshot.position).toEqual({ x: 30, y: 0 });
    expect(projectile.snapshot.alive).toBe(false);

    const terminalSnapshot = projectile.snapshot;
    expect(projectile.step(0.1, bounds, distantPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot).toEqual(terminalSnapshot);
  });

  it('treats invalid delta, player, and bounds data as complete no-ops', () => {
    const projectile = createProjectile();
    const initial = projectile.snapshot;
    const invalidBounds: ProjectileBounds = {
      minX: 10,
      minY: 0,
      maxX: -10,
      maxY: 100,
    };
    const invalidPlayer: ProjectilePlayerCircle = {
      center: { x: Number.NaN, y: 0 },
      radius: 10,
    };
    const invalidRadiusPlayer: ProjectilePlayerCircle = {
      center: { x: 0, y: 0 },
      radius: -1,
    };

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(projectile.step(delta, wideBounds, distantPlayer)).toEqual({
        kind: 'active',
      });
    }

    expect(projectile.step(0.1, invalidBounds, distantPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.step(0.1, wideBounds, invalidPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.step(0.1, wideBounds, invalidRadiusPlayer)).toEqual({
      kind: 'active',
    });
    expect(projectile.snapshot).toEqual(initial);
  });

  it('is deterministic for matching spawn data and input frames', () => {
    const first = createProjectile();
    const second = createProjectile();
    const frames = [0.03, 0.1, 0.07, 10, 0.04];

    for (const delta of frames) {
      expect(first.step(delta, wideBounds, distantPlayer)).toEqual(
        second.step(delta, wideBounds, distantPlayer),
      );
      expect(first.snapshot).toEqual(second.snapshot);
    }
  });
});
