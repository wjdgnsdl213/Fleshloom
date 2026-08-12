import {
  ENEMY_DEFINITIONS,
  getEnemyDefinition,
  type EnemyArchetype,
  type EnemyCaptureProfile,
  type EnemyDefinition,
} from '../../content/enemies';
import { ARMORED_DRIFTER_BALANCE } from '../../content/armoredDrifters';
import { resolveCircleColliders } from '../../core/geometry/collision';
import type { Obb } from '../../core/geometry/obb';
import type { Vec2 } from '../../core/geometry/vector';
import {
  ArmoredCaptureState,
  type ArmoredCaptureResult,
} from './ArmoredCaptureState';
import type { CaptureReward } from './LayeredCaptureState';

export const MAX_ENEMY_STEP_SECONDS = 0.1;

const EPSILON = 1e-9;
const NO_ACTIONS: readonly EnemyAction[] = Object.freeze([]);

interface MutableVec2 {
  x: number;
  y: number;
}

export interface EnemySpawn {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: Vec2;
  readonly phase: number;
  readonly captureProfile?: EnemyCaptureProfile;
}

export interface EnemyArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type EnemyBehaviorState =
  | 'approach'
  | 'charge'
  | 'chase'
  | 'cooldown'
  | 'dead'
  | 'locking'
  | 'positioning'
  | 'recover'
  | 'staggered'
  | 'telegraph';

export interface EnemySnapshot {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: Vec2;
  readonly phase: number;
  readonly radius: number;
  readonly contactDamage: number;
  readonly captureProfile: EnemyCaptureProfile;
  readonly armored: boolean;
  readonly staggerRemaining: number;
  readonly alive: boolean;
  readonly behaviorState: EnemyBehaviorState;
  /** Seconds remaining in the current timed state, or zero when untimed. */
  readonly behaviorTimer: number;
  readonly lockedTarget: Vec2 | null;
  readonly lockedDirection: Vec2 | null;
}

export interface EnemyProjectileSpawnAction {
  readonly type: 'projectile-spawn';
  readonly sourceId: string;
  readonly archetype: 'watcher';
  readonly origin: Vec2;
  readonly direction: Vec2;
  readonly target: Vec2;
}

export type EnemyAction = EnemyProjectileSpawnAction;

export type EnemyCaptureResult =
  | ArmoredCaptureResult
  | {
      readonly kind: 'killed';
      readonly reward: CaptureReward;
    };

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: EnemyArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: value.x, y: value.y });

const initialBehaviorState = (
  archetype: EnemyArchetype,
): EnemyBehaviorState => {
  switch (archetype) {
    case 'drifter':
      return 'chase';
    case 'rusher':
      return 'approach';
    case 'watcher':
      return 'positioning';
  }
};

export class EnemyModel {
  private readonly id: string;
  private readonly archetype: EnemyArchetype;
  private readonly phase: number;
  private readonly captureProfile: EnemyCaptureProfile;
  private readonly armoredCapture: ArmoredCaptureState | null;
  private readonly position: MutableVec2;
  private readonly velocity: MutableVec2 = { x: 0, y: 0 };
  private readonly facing: MutableVec2 = { x: 0, y: 1 };
  private alive = true;
  private behaviorState: EnemyBehaviorState;
  private behaviorTimer = 0;
  private lockedTarget: MutableVec2 | null = null;
  private lockedDirection: MutableVec2 | null = null;

  public constructor(spawn: EnemySpawn) {
    if (spawn.id.length === 0) {
      throw new RangeError('enemy id must not be empty');
    }

    if (!isFiniteVec2(spawn.position)) {
      throw new RangeError('enemy position must be finite');
    }

    if (!Number.isFinite(spawn.phase)) {
      throw new RangeError('enemy phase must be finite');
    }

    const captureProfile = spawn.captureProfile ?? 'ordinary';
    if (captureProfile === 'armored' && spawn.archetype !== 'drifter') {
      throw new RangeError('only Drifters support the armored capture profile');
    }

    this.id = spawn.id;
    this.archetype = spawn.archetype;
    this.phase = spawn.phase;
    this.captureProfile = captureProfile;
    this.armoredCapture =
      captureProfile === 'armored'
        ? new ArmoredCaptureState({
            staggerSeconds: ARMORED_DRIFTER_BALANCE.staggerSeconds,
            peelReward: ARMORED_DRIFTER_BALANCE.peelReward,
            finalReward: ARMORED_DRIFTER_BALANCE.finalReward,
          })
        : null;
    this.position = { x: spawn.position.x, y: spawn.position.y };
    this.behaviorState = initialBehaviorState(spawn.archetype);
  }

  public get definition(): EnemyDefinition {
    return getEnemyDefinition(this.archetype);
  }

  public get radius(): number {
    return this.captureProfile === 'armored'
      ? ARMORED_DRIFTER_BALANCE.radius
      : this.definition.radius;
  }

  public get contactDamage(): number {
    return this.captureProfile === 'armored'
      ? ARMORED_DRIFTER_BALANCE.contactDamage
      : this.definition.contactDamage;
  }

  public get snapshot(): EnemySnapshot {
    const armor = this.armoredCapture?.snapshot;
    return Object.freeze({
      id: this.id,
      archetype: this.archetype,
      position: frozenVec2(this.position),
      velocity: frozenVec2(this.velocity),
      facing: frozenVec2(this.facing),
      phase: this.phase,
      radius: this.radius,
      contactDamage: this.contactDamage,
      captureProfile: this.captureProfile,
      armored: armor?.armored ?? false,
      staggerRemaining: armor?.staggerRemaining ?? 0,
      alive: this.alive,
      behaviorState:
        this.alive && (armor?.staggerRemaining ?? 0) > 0
          ? 'staggered'
          : this.behaviorState,
      behaviorTimer: this.behaviorTimer,
      lockedTarget:
        this.lockedTarget === null ? null : frozenVec2(this.lockedTarget),
      lockedDirection:
        this.lockedDirection === null
          ? null
          : frozenVec2(this.lockedDirection),
    });
  }

  public step(
    deltaSeconds: number,
    playerPosition: Vec2,
    bounds: EnemyArenaBounds,
  ): readonly EnemyAction[] {
    if (
      !this.alive ||
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(playerPosition) ||
      !isValidBounds(bounds)
    ) {
      return NO_ACTIONS;
    }

    const cappedDelta = Math.min(deltaSeconds, MAX_ENEMY_STEP_SECONDS);
    this.clampToBounds(bounds);

    const wasStaggered =
      (this.armoredCapture?.snapshot.staggerRemaining ?? 0) > 0;
    this.armoredCapture?.update(cappedDelta);
    if (wasStaggered) {
      this.stop();
      return NO_ACTIONS;
    }

    let actions: EnemyAction[] | null = null;

    switch (this.archetype) {
      case 'drifter':
        this.stepDrifter(cappedDelta, playerPosition);
        break;
      case 'rusher':
        this.stepRusher(cappedDelta, playerPosition);
        break;
      case 'watcher':
        actions = this.stepWatcher(cappedDelta, playerPosition);
        break;
    }

    this.clampToBounds(bounds);
    return actions === null || actions.length === 0
      ? NO_ACTIONS
      : Object.freeze(actions);
  }

  public kill(): void {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.behaviorState = 'dead';
    this.behaviorTimer = 0;
    this.lockedTarget = null;
    this.lockedDirection = null;
    this.stop();
  }

  public capture(): EnemyCaptureResult {
    if (!this.alive) {
      return Object.freeze({ kind: 'ignored', reason: 'dead' });
    }

    if (this.armoredCapture !== null) {
      const result = this.armoredCapture.capture();
      if (result.kind === 'killed') {
        this.kill();
      }
      return result;
    }

    const reward = Object.freeze({
      xp: this.definition.xp,
      recovery: this.definition.captureRecovery,
    });
    this.kill();
    return Object.freeze({ kind: 'killed', reward });
  }

  private stepDrifter(deltaSeconds: number, playerPosition: Vec2): void {
    const speed =
      ENEMY_DEFINITIONS.drifter.baseSpeed *
      (this.captureProfile === 'armored'
        ? ARMORED_DRIFTER_BALANCE.speedFactor
        : 1);
    this.moveToward(playerPosition, speed, deltaSeconds);
  }

  private stepRusher(deltaSeconds: number, playerPosition: Vec2): void {
    const definition = ENEMY_DEFINITIONS.rusher;
    let remaining = deltaSeconds;
    let transitions = 0;

    while (remaining > EPSILON && transitions < 6) {
      switch (this.behaviorState) {
        case 'approach': {
          const dx = playerPosition.x - this.position.x;
          const dy = playerPosition.y - this.position.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= definition.rushTriggerDistance + EPSILON) {
            this.enterRusherTelegraph(playerPosition);
            transitions += 1;
            continue;
          }

          const direction = { x: dx / distance, y: dy / distance };
          const secondsToTrigger =
            (distance - definition.rushTriggerDistance) /
            definition.baseSpeed;
          const elapsed = Math.min(remaining, secondsToTrigger);
          this.move(direction, definition.baseSpeed, elapsed);
          remaining -= elapsed;

          if (elapsed + EPSILON >= secondsToTrigger) {
            this.enterRusherTelegraph(playerPosition);
            transitions += 1;
            continue;
          }

          return;
        }
        case 'telegraph': {
          this.stop();
          const elapsed = this.consumeTimer(remaining);
          remaining -= elapsed;

          if (this.behaviorTimer <= EPSILON) {
            this.behaviorState = 'charge';
            this.behaviorTimer = definition.chargeSeconds;
            transitions += 1;
            continue;
          }

          return;
        }
        case 'charge': {
          const elapsed = Math.min(remaining, this.behaviorTimer);
          const direction = this.lockedDirection ?? this.facing;
          this.move(direction, definition.chargeSpeed, elapsed);
          this.behaviorTimer = Math.max(0, this.behaviorTimer - elapsed);
          remaining -= elapsed;

          if (this.behaviorTimer <= EPSILON) {
            this.behaviorState = 'recover';
            this.behaviorTimer = definition.recoverSeconds;
            this.lockedTarget = null;
            this.lockedDirection = null;
            this.stop();
            transitions += 1;
            continue;
          }

          return;
        }
        case 'recover': {
          this.stop();
          const elapsed = this.consumeTimer(remaining);
          remaining -= elapsed;

          if (this.behaviorTimer <= EPSILON) {
            this.behaviorState = 'approach';
            this.behaviorTimer = 0;
            transitions += 1;
            continue;
          }

          return;
        }
        default:
          return;
      }
    }
  }

  private stepWatcher(
    deltaSeconds: number,
    playerPosition: Vec2,
  ): EnemyAction[] | null {
    const definition = ENEMY_DEFINITIONS.watcher;
    const actions: EnemyAction[] = [];
    let remaining = deltaSeconds;
    let transitions = 0;

    while (remaining > EPSILON && transitions < 6) {
      switch (this.behaviorState) {
        case 'positioning': {
          const dx = playerPosition.x - this.position.x;
          const dy = playerPosition.y - this.position.y;
          const distance = Math.hypot(dx, dy);

          if (
            distance >= definition.standoffMinDistance - EPSILON &&
            distance <= definition.standoffMaxDistance + EPSILON
          ) {
            this.enterWatcherLock(playerPosition);
            transitions += 1;
            continue;
          }

          const movingToward = distance > definition.standoffMaxDistance;
          const distanceToBand = movingToward
            ? distance - definition.standoffMaxDistance
            : definition.standoffMinDistance - distance;
          const secondsToBand = distanceToBand / definition.baseSpeed;
          const elapsed = Math.min(remaining, secondsToBand);
          const direction = movingToward
            ? this.directionToward(playerPosition)
            : this.directionAway(playerPosition);
          this.move(direction, definition.baseSpeed, elapsed);
          remaining -= elapsed;

          if (elapsed + EPSILON >= secondsToBand) {
            this.enterWatcherLock(playerPosition);
            transitions += 1;
            continue;
          }

          return actions;
        }
        case 'locking': {
          this.stop();
          const elapsed = this.consumeTimer(remaining);
          remaining -= elapsed;

          if (this.behaviorTimer <= EPSILON) {
            actions.push(this.createWatcherProjectileAction());
            this.behaviorState = 'cooldown';
            this.behaviorTimer = definition.cooldownSeconds;
            this.lockedTarget = null;
            this.lockedDirection = null;
            transitions += 1;
            continue;
          }

          return actions;
        }
        case 'cooldown': {
          const elapsed = Math.min(remaining, this.behaviorTimer);
          this.moveWatcherTowardBand(playerPosition, elapsed);
          this.behaviorTimer = Math.max(0, this.behaviorTimer - elapsed);
          remaining -= elapsed;

          if (this.behaviorTimer <= EPSILON) {
            this.behaviorState = 'positioning';
            this.behaviorTimer = 0;
            transitions += 1;
            continue;
          }

          return actions;
        }
        default:
          return actions;
      }
    }

    return actions;
  }

  private enterRusherTelegraph(playerPosition: Vec2): void {
    const direction = this.directionToward(playerPosition);
    this.behaviorState = 'telegraph';
    this.behaviorTimer = ENEMY_DEFINITIONS.rusher.telegraphSeconds;
    this.lockedTarget = { x: playerPosition.x, y: playerPosition.y };
    this.lockedDirection = direction;
    this.setFacing(direction);
    this.stop();
  }

  private enterWatcherLock(playerPosition: Vec2): void {
    const direction = this.directionToward(playerPosition);
    this.behaviorState = 'locking';
    this.behaviorTimer = ENEMY_DEFINITIONS.watcher.lockSeconds;
    this.lockedTarget = { x: playerPosition.x, y: playerPosition.y };
    this.lockedDirection = direction;
    this.setFacing(direction);
    this.stop();
  }

  private createWatcherProjectileAction(): EnemyProjectileSpawnAction {
    const direction = this.lockedDirection ?? this.facing;
    const target = this.lockedTarget ?? {
      x: this.position.x + direction.x,
      y: this.position.y + direction.y,
    };

    return Object.freeze({
      type: 'projectile-spawn',
      sourceId: this.id,
      archetype: 'watcher',
      origin: frozenVec2(this.position),
      direction: frozenVec2(direction),
      target: frozenVec2(target),
    });
  }

  private moveWatcherTowardBand(
    playerPosition: Vec2,
    deltaSeconds: number,
  ): void {
    const definition = ENEMY_DEFINITIONS.watcher;
    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance > definition.standoffMaxDistance) {
      const distanceToBand = distance - definition.standoffMaxDistance;
      const travel = Math.min(
        definition.baseSpeed * deltaSeconds,
        distanceToBand,
      );
      this.moveDistance(this.directionToward(playerPosition), travel, deltaSeconds);
      return;
    }

    if (distance < definition.standoffMinDistance) {
      const distanceToBand = definition.standoffMinDistance - distance;
      const travel = Math.min(
        definition.baseSpeed * deltaSeconds,
        distanceToBand,
      );
      this.moveDistance(this.directionAway(playerPosition), travel, deltaSeconds);
      return;
    }

    this.stop();
  }

  private moveToward(
    target: Vec2,
    speed: number,
    deltaSeconds: number,
  ): void {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= EPSILON) {
      this.stop();
      return;
    }

    const direction = { x: dx / distance, y: dy / distance };
    const travel = Math.min(speed * deltaSeconds, distance);
    this.moveDistance(direction, travel, deltaSeconds);
  }

  private moveDistance(
    direction: Vec2,
    distance: number,
    deltaSeconds: number,
  ): void {
    if (deltaSeconds <= EPSILON || distance <= EPSILON) {
      this.stop();
      return;
    }

    this.setFacing(direction);
    this.velocity.x = (direction.x * distance) / deltaSeconds;
    this.velocity.y = (direction.y * distance) / deltaSeconds;
    this.position.x += direction.x * distance;
    this.position.y += direction.y * distance;
  }

  private move(direction: Vec2, speed: number, deltaSeconds: number): void {
    this.setFacing(direction);
    this.velocity.x = direction.x * speed;
    this.velocity.y = direction.y * speed;
    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;
  }

  private stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  private setFacing(direction: Vec2): void {
    const length = Math.hypot(direction.x, direction.y);

    if (length <= EPSILON) {
      return;
    }

    this.facing.x = direction.x / length;
    this.facing.y = direction.y / length;
  }

  private directionToward(target: Vec2): MutableVec2 {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const length = Math.hypot(dx, dy);

    if (length <= EPSILON) {
      return { x: this.facing.x, y: this.facing.y };
    }

    return { x: dx / length, y: dy / length };
  }

  private directionAway(target: Vec2): MutableVec2 {
    const toward = this.directionToward(target);
    return {
      x: toward.x === 0 ? 0 : -toward.x,
      y: toward.y === 0 ? 0 : -toward.y,
    };
  }

  private consumeTimer(availableSeconds: number): number {
    const elapsed = Math.min(availableSeconds, this.behaviorTimer);
    this.behaviorTimer = Math.max(0, this.behaviorTimer - elapsed);
    return elapsed;
  }

  /**
   * Pushes the body out of static street structures. Called by the run loop
   * after `step`; sliding along walls is preserved because only the
   * penetrating component of motion is removed each tick.
   */
  public applyStaticColliders(colliders: readonly Obb[]): void {
    if (!this.alive || colliders.length === 0) {
      return;
    }

    const resolved = resolveCircleColliders(
      this.position,
      this.radius,
      colliders,
    );
    if (resolved !== this.position) {
      this.position.x = resolved.x;
      this.position.y = resolved.y;
    }
  }

  private clampToBounds(bounds: EnemyArenaBounds): void {
    const radius = this.radius;
    const minX = bounds.minX + radius;
    const maxX = bounds.maxX - radius;
    const minY = bounds.minY + radius;
    const maxY = bounds.maxY - radius;
    const clampedX =
      minX <= maxX
        ? Math.min(maxX, Math.max(minX, this.position.x))
        : (bounds.minX + bounds.maxX) / 2;
    const clampedY =
      minY <= maxY
        ? Math.min(maxY, Math.max(minY, this.position.y))
        : (bounds.minY + bounds.maxY) / 2;

    if (clampedX !== this.position.x) {
      this.position.x = clampedX;
      this.velocity.x = 0;
    }

    if (clampedY !== this.position.y) {
      this.position.y = clampedY;
      this.velocity.y = 0;
    }
  }
}
