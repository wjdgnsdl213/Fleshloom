import { resolveCircleColliders } from '../../core/geometry/collision';
import type { Obb } from '../../core/geometry/obb';
import type { Vec2 } from '../../core/geometry/vector';

export const MAX_MIMIC_STEP_SECONDS = 0.1;

export const MIMIC_BALANCE = Object.freeze({
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

const EPSILON = 1e-9;
const PLAYER_VELOCITY_EPSILON = 1e-4;

interface MutableVec2 {
  x: number;
  y: number;
}

export interface MimicSpawn {
  readonly id: string;
  readonly position: Vec2;
  readonly phase: number;
}

export interface MimicArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface MimicStepContext {
  readonly playerPosition: Vec2;
  readonly playerVelocity: Vec2;
  readonly bounds: MimicArenaBounds;
}

export type MimicBehaviorState =
  | 'correcting-in'
  | 'correcting-out'
  | 'mirroring'
  | 'orbiting'
  | 'dead';

export interface MimicSnapshot {
  readonly id: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: Vec2;
  readonly phase: number;
  readonly radius: number;
  readonly contactDamage: number;
  readonly xp: number;
  readonly captureRecovery: number;
  readonly alive: boolean;
  readonly behaviorState: MimicBehaviorState;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: MimicArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({
    x: value.x === 0 ? 0 : value.x,
    y: value.y === 0 ? 0 : value.y,
  });

export class MimicModel {
  private readonly id: string;
  private readonly phase: number;
  private readonly position: MutableVec2;
  private readonly velocity: MutableVec2 = { x: 0, y: 0 };
  private readonly facing: MutableVec2 = { x: 0, y: 1 };
  private alive = true;
  private behaviorState: MimicBehaviorState = 'orbiting';

  public constructor(spawn: MimicSpawn) {
    if (spawn.id.length === 0) {
      throw new RangeError('Mimic id must not be empty');
    }

    if (!isFiniteVec2(spawn.position)) {
      throw new RangeError('Mimic position must be finite');
    }

    if (!Number.isFinite(spawn.phase)) {
      throw new RangeError('Mimic phase must be finite');
    }

    this.id = spawn.id;
    this.phase = spawn.phase;
    this.position = { x: spawn.position.x, y: spawn.position.y };
  }

  public get snapshot(): MimicSnapshot {
    return Object.freeze({
      id: this.id,
      position: frozenVec2(this.position),
      velocity: frozenVec2(this.velocity),
      facing: frozenVec2(this.facing),
      phase: this.phase,
      radius: MIMIC_BALANCE.radius,
      contactDamage: MIMIC_BALANCE.contactDamage,
      xp: MIMIC_BALANCE.xp,
      captureRecovery: MIMIC_BALANCE.captureRecovery,
      alive: this.alive,
      behaviorState: this.behaviorState,
    });
  }

  public step(deltaSeconds: number, context: MimicStepContext): void {
    if (
      !this.alive ||
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(context.playerPosition) ||
      !isFiniteVec2(context.playerVelocity) ||
      !isValidBounds(context.bounds)
    ) {
      return;
    }

    this.clampToBounds(context.bounds);
    const cappedDelta = Math.min(deltaSeconds, MAX_MIMIC_STEP_SECONDS);
    const radialX = this.position.x - context.playerPosition.x;
    const radialY = this.position.y - context.playerPosition.y;
    const distance = Math.hypot(radialX, radialY);
    let direction: MutableVec2;

    if (distance > MIMIC_BALANCE.maximumDistance) {
      this.behaviorState = 'correcting-in';
      direction = this.directionToward(context.playerPosition);
    } else if (distance < MIMIC_BALANCE.minimumDistance) {
      this.behaviorState = 'correcting-out';
      direction = this.directionAway(context.playerPosition);
    } else {
      const playerSpeed = Math.hypot(
        context.playerVelocity.x,
        context.playerVelocity.y,
      );
      const radial =
        distance <= EPSILON
          ? { x: this.facing.x, y: this.facing.y }
          : { x: radialX / distance, y: radialY / distance };
      const clockwiseTangent = { x: radial.y, y: -radial.x };

      if (playerSpeed <= PLAYER_VELOCITY_EPSILON) {
        this.behaviorState = 'orbiting';
        direction = clockwiseTangent;
      } else {
        this.behaviorState = 'mirroring';
        const reflected = {
          x: -context.playerVelocity.x / playerSpeed,
          y: -context.playerVelocity.y / playerSpeed,
        };
        direction = this.normalizedDirection({
          x:
            reflected.x * MIMIC_BALANCE.reflectedWeight +
            clockwiseTangent.x * MIMIC_BALANCE.orbitWeight,
          y:
            reflected.y * MIMIC_BALANCE.reflectedWeight +
            clockwiseTangent.y * MIMIC_BALANCE.orbitWeight,
        });
      }
    }

    this.setFacing(direction);
    this.velocity.x = direction.x * MIMIC_BALANCE.speed;
    this.velocity.y = direction.y * MIMIC_BALANCE.speed;
    const unboundedPosition = {
      x: this.position.x + this.velocity.x * cappedDelta,
      y: this.position.y + this.velocity.y * cappedDelta,
    };
    const clampedPosition = this.clampedPosition(
      unboundedPosition,
      context.bounds,
    );
    this.zeroBlockedVelocity(unboundedPosition, clampedPosition);
    this.position.x = clampedPosition.x;
    this.position.y = clampedPosition.y;
  }

  public kill(): void {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.behaviorState = 'dead';
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  private directionToward(target: Vec2): MutableVec2 {
    return this.normalizedDirection({
      x: target.x - this.position.x,
      y: target.y - this.position.y,
    });
  }

  private directionAway(target: Vec2): MutableVec2 {
    const toward = this.directionToward(target);
    return {
      x: toward.x === 0 ? 0 : -toward.x,
      y: toward.y === 0 ? 0 : -toward.y,
    };
  }

  private normalizedDirection(direction: Vec2): MutableVec2 {
    const length = Math.hypot(direction.x, direction.y);

    if (length <= EPSILON) {
      return { x: this.facing.x, y: this.facing.y };
    }

    return { x: direction.x / length, y: direction.y / length };
  }

  private setFacing(direction: Vec2): void {
    const normalized = this.normalizedDirection(direction);
    this.facing.x = normalized.x;
    this.facing.y = normalized.y;
  }

  /** Pushes the body out of static street structures after each step. */
  public applyStaticColliders(colliders: readonly Obb[]): void {
    if (!this.alive || colliders.length === 0) {
      return;
    }

    const resolved = resolveCircleColliders(
      this.position,
      MIMIC_BALANCE.radius,
      colliders,
    );
    if (resolved !== this.position) {
      this.position.x = resolved.x;
      this.position.y = resolved.y;
    }
  }

  private clampToBounds(bounds: MimicArenaBounds): void {
    const clamped = this.clampedPosition(this.position, bounds);
    this.zeroBlockedVelocity(this.position, clamped);
    this.position.x = clamped.x;
    this.position.y = clamped.y;
  }

  private clampedPosition(
    position: Vec2,
    bounds: MimicArenaBounds,
  ): MutableVec2 {
    const minX = bounds.minX + MIMIC_BALANCE.radius;
    const maxX = bounds.maxX - MIMIC_BALANCE.radius;
    const minY = bounds.minY + MIMIC_BALANCE.radius;
    const maxY = bounds.maxY - MIMIC_BALANCE.radius;

    return {
      x:
        minX <= maxX
          ? Math.min(maxX, Math.max(minX, position.x))
          : (bounds.minX + bounds.maxX) / 2,
      y:
        minY <= maxY
          ? Math.min(maxY, Math.max(minY, position.y))
          : (bounds.minY + bounds.maxY) / 2,
    };
  }

  private zeroBlockedVelocity(unbounded: Vec2, clamped: Vec2): void {
    if (unbounded.x !== clamped.x) {
      this.velocity.x = 0;
    }

    if (unbounded.y !== clamped.y) {
      this.velocity.y = 0;
    }
  }
}
