import type { Vec2 } from '../../core/geometry/vector';
import type { EnemyProjectileSpawnAction } from './EnemyModel';

export const MAX_PROJECTILE_STEP_SECONDS = 0.1;

export const WATCHER_PROJECTILE_TUNING = Object.freeze({
  speed: 220,
  radius: 5,
  damage: 14,
  lifetimeSeconds: 3.2,
});

const EPSILON = 1e-9;
const ACTIVE_RESULT: ProjectileStepResult = Object.freeze({ kind: 'active' });

interface MutableVec2 {
  x: number;
  y: number;
}

export interface ProjectileSpawn {
  readonly id: string;
  readonly action: EnemyProjectileSpawnAction;
}

export interface ProjectileBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface ProjectilePlayerCircle {
  readonly center: Vec2;
  readonly radius: number;
}

export interface ProjectileSnapshot {
  readonly id: string;
  readonly sourceId: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly radius: number;
  readonly damage: number;
  readonly lifetimeRemaining: number;
  readonly alive: boolean;
}

export type ProjectileStepResult =
  | { readonly kind: 'active' }
  | {
      readonly kind: 'hit';
      readonly projectileId: string;
      readonly sourceId: string;
      readonly damage: number;
    }
  | {
      readonly kind: 'expired';
      readonly projectileId: string;
    }
  | {
      readonly kind: 'out-of-bounds';
      readonly projectileId: string;
    };

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: ProjectileBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: value.x, y: value.y });

const pointAt = (start: Vec2, end: Vec2, amount: number): MutableVec2 => ({
  x: start.x + (end.x - start.x) * amount,
  y: start.y + (end.y - start.y) * amount,
});

const segmentCircleHitParameter = (
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): number | null => {
  const startX = start.x - center.x;
  const startY = start.y - center.y;
  const radiusSquared = radius * radius;

  if (startX * startX + startY * startY <= radiusSquared) {
    return 0;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const a = deltaX * deltaX + deltaY * deltaY;

  if (a <= EPSILON) {
    return null;
  }

  const b = 2 * (startX * deltaX + startY * deltaY);
  const c = startX * startX + startY * startY - radiusSquared;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);

  if (first >= 0 && first <= 1) {
    return first;
  }

  return second >= 0 && second <= 1 ? second : null;
};

const segmentBoundsExitParameter = (
  start: Vec2,
  end: Vec2,
  bounds: ProjectileBounds,
): number | null => {
  if (
    start.x < bounds.minX ||
    start.x > bounds.maxX ||
    start.y < bounds.minY ||
    start.y > bounds.maxY
  ) {
    return 0;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let exitParameter = Number.POSITIVE_INFINITY;

  if (end.x < bounds.minX) {
    exitParameter = Math.min(
      exitParameter,
      (bounds.minX - start.x) / deltaX,
    );
  } else if (end.x > bounds.maxX) {
    exitParameter = Math.min(
      exitParameter,
      (bounds.maxX - start.x) / deltaX,
    );
  }

  if (end.y < bounds.minY) {
    exitParameter = Math.min(
      exitParameter,
      (bounds.minY - start.y) / deltaY,
    );
  } else if (end.y > bounds.maxY) {
    exitParameter = Math.min(
      exitParameter,
      (bounds.maxY - start.y) / deltaY,
    );
  }

  return Number.isFinite(exitParameter)
    ? Math.min(1, Math.max(0, exitParameter))
    : null;
};

export class ProjectileModel {
  private readonly id: string;
  private readonly sourceId: string;
  private readonly position: MutableVec2;
  private readonly velocity: MutableVec2;
  private readonly radius = WATCHER_PROJECTILE_TUNING.radius;
  private readonly damage = WATCHER_PROJECTILE_TUNING.damage;
  private lifetimeRemaining: number =
    WATCHER_PROJECTILE_TUNING.lifetimeSeconds;
  private alive = true;

  public constructor(spawn: ProjectileSpawn) {
    const { action } = spawn;

    if (spawn.id.length === 0) {
      throw new RangeError('projectile id must not be empty');
    }

    if (action.sourceId.length === 0 || !isFiniteVec2(action.origin)) {
      throw new RangeError('projectile spawn must contain a valid source and origin');
    }

    if (!isFiniteVec2(action.direction)) {
      throw new RangeError('projectile direction must be finite');
    }

    const directionLength = Math.hypot(
      action.direction.x,
      action.direction.y,
    );

    if (directionLength <= EPSILON) {
      throw new RangeError('projectile direction must not be zero');
    }

    this.id = spawn.id;
    this.sourceId = action.sourceId;
    this.position = { x: action.origin.x, y: action.origin.y };
    this.velocity = {
      x:
        (action.direction.x / directionLength) *
        WATCHER_PROJECTILE_TUNING.speed,
      y:
        (action.direction.y / directionLength) *
        WATCHER_PROJECTILE_TUNING.speed,
    };
  }

  public get snapshot(): ProjectileSnapshot {
    return Object.freeze({
      id: this.id,
      sourceId: this.sourceId,
      position: frozenVec2(this.position),
      velocity: frozenVec2(this.velocity),
      radius: this.radius,
      damage: this.damage,
      lifetimeRemaining: this.lifetimeRemaining,
      alive: this.alive,
    });
  }

  public step(
    deltaSeconds: number,
    bounds: ProjectileBounds,
    playerCircle: ProjectilePlayerCircle,
  ): ProjectileStepResult {
    if (
      !this.alive ||
      !isFinitePositive(deltaSeconds) ||
      !isValidBounds(bounds) ||
      !isFiniteVec2(playerCircle.center) ||
      !isFiniteNonNegative(playerCircle.radius)
    ) {
      return ACTIVE_RESULT;
    }

    const cappedDelta = Math.min(deltaSeconds, MAX_PROJECTILE_STEP_SECONDS);
    const travelSeconds = Math.min(cappedDelta, this.lifetimeRemaining);
    const start = { x: this.position.x, y: this.position.y };
    const end = {
      x: start.x + this.velocity.x * travelSeconds,
      y: start.y + this.velocity.y * travelSeconds,
    };
    const hitParameter = segmentCircleHitParameter(
      start,
      end,
      playerCircle.center,
      this.radius + playerCircle.radius,
    );
    const boundsExitParameter = segmentBoundsExitParameter(start, end, bounds);

    if (
      hitParameter !== null &&
      (boundsExitParameter === null ||
        hitParameter <= boundsExitParameter + EPSILON)
    ) {
      this.advanceTo(start, end, hitParameter, travelSeconds);
      this.alive = false;
      return Object.freeze({
        kind: 'hit',
        projectileId: this.id,
        sourceId: this.sourceId,
        damage: this.damage,
      });
    }

    if (boundsExitParameter !== null) {
      this.advanceTo(start, end, boundsExitParameter, travelSeconds);
      this.alive = false;
      return Object.freeze({
        kind: 'out-of-bounds',
        projectileId: this.id,
      });
    }

    this.position.x = end.x;
    this.position.y = end.y;
    this.lifetimeRemaining = Math.max(
      0,
      this.lifetimeRemaining - travelSeconds,
    );

    if (this.lifetimeRemaining <= EPSILON) {
      this.lifetimeRemaining = 0;
      this.alive = false;
      return Object.freeze({
        kind: 'expired',
        projectileId: this.id,
      });
    }

    return ACTIVE_RESULT;
  }

  private advanceTo(
    start: Vec2,
    end: Vec2,
    amount: number,
    travelSeconds: number,
  ): void {
    const terminalPosition = pointAt(start, end, amount);
    this.position.x = terminalPosition.x;
    this.position.y = terminalPosition.y;
    this.lifetimeRemaining = Math.max(
      0,
      this.lifetimeRemaining - travelSeconds * amount,
    );
  }
}
