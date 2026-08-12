import { resolveCircleColliders } from '../../core/geometry/collision';
import type { Obb } from '../../core/geometry/obb';
import type { Vec2 } from '../../core/geometry/vector';

export const MAX_CUTTER_STEP_SECONDS = 0.1;

export const CUTTER_BALANCE = Object.freeze({
  radius: 20,
  stalkSpeed: 55,
  contactDamage: 16,
  xp: 24,
  captureRecovery: 5,
  tetherDetectionRange: 260,
  telegraphSeconds: 0.65,
  dashSpeed: 320,
  dashSeconds: 0.35,
  recoverSeconds: 1.4,
  tetherHitRadius: 12,
});

const EPSILON = 1e-9;
const EMPTY_ACTIONS: readonly CutterAction[] = Object.freeze([]);

interface MutableVec2 {
  x: number;
  y: number;
}

export interface CutterSpawn {
  readonly id: string;
  readonly position: Vec2;
  readonly phase: number;
}

export interface CutterArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CutterStepContext {
  readonly playerPosition: Vec2;
  readonly bounds: CutterArenaBounds;
  readonly tetherSamples: readonly Vec2[];
}

export type CutterState =
  | 'stalk'
  | 'telegraph'
  | 'dash'
  | 'recover'
  | 'dead';

export interface CutterSnapshot {
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
  readonly state: CutterState;
  readonly stateTimer: number;
  readonly lockedSegmentIndex: number | null;
  readonly lockedMidpoint: Vec2 | null;
  readonly lockedNormal: Vec2 | null;
  readonly lockedDirection: Vec2 | null;
}

export interface LoopCutAction {
  readonly type: 'loop-cut';
  readonly sourceId: string;
  readonly segmentIndex: number;
  readonly position: Vec2;
}

export type CutterAction = LoopCutAction;

interface SegmentLock {
  readonly index: number;
  readonly midpoint: MutableVec2;
  readonly normal: MutableVec2;
  readonly direction: MutableVec2;
}

interface SweptTetherHit {
  readonly amount: number;
  readonly segmentIndex: number;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: CutterArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const areValidTetherSamples = (samples: readonly Vec2[]): boolean =>
  Array.isArray(samples) && samples.every(isFiniteVec2);

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({
    x: value.x === 0 ? 0 : value.x,
    y: value.y === 0 ? 0 : value.y,
  });

const pointAt = (start: Vec2, end: Vec2, amount: number): MutableVec2 => ({
  x: start.x + (end.x - start.x) * amount,
  y: start.y + (end.y - start.y) * amount,
});

const pointSegmentDistanceSquared = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
): number => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= EPSILON) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return dx * dx + dy * dy;
  }

  const amount = Math.min(
    1,
    Math.max(
      0,
      ((point.x - start.x) * segmentX +
        (point.y - start.y) * segmentY) /
        lengthSquared,
    ),
  );
  const closestX = start.x + segmentX * amount;
  const closestY = start.y + segmentY * amount;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy;
};

const segmentCircleEntryParameter = (
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
): number | null => {
  const relativeX = start.x - center.x;
  const relativeY = start.y - center.y;
  const radiusSquared = radius * radius;

  if (
    relativeX * relativeX + relativeY * relativeY <=
    radiusSquared + EPSILON
  ) {
    return 0;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const a = deltaX * deltaX + deltaY * deltaY;

  if (a <= EPSILON) {
    return null;
  }

  const b = 2 * (relativeX * deltaX + relativeY * deltaY);
  const c = relativeX * relativeX + relativeY * relativeY - radiusSquared;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < -EPSILON) {
    return null;
  }

  const root = Math.sqrt(Math.max(0, discriminant));
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);

  if (first >= 0 && first <= 1) {
    return first;
  }

  return second >= 0 && second <= 1 ? second : null;
};

const sweptPointSegmentHitParameter = (
  movementStart: Vec2,
  movementEnd: Vec2,
  segmentStart: Vec2,
  segmentEnd: Vec2,
  radius: number,
): number | null => {
  if (
    pointSegmentDistanceSquared(movementStart, segmentStart, segmentEnd) <=
    radius * radius + EPSILON
  ) {
    return 0;
  }

  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const segmentLength = Math.hypot(segmentX, segmentY);

  if (segmentLength <= EPSILON) {
    return segmentCircleEntryParameter(
      movementStart,
      movementEnd,
      segmentStart,
      radius,
    );
  }

  const tangentX = segmentX / segmentLength;
  const tangentY = segmentY / segmentLength;
  const normalX = -tangentY;
  const normalY = tangentX;
  const movementX = movementEnd.x - movementStart.x;
  const movementY = movementEnd.y - movementStart.y;
  const signedStart =
    (movementStart.x - segmentStart.x) * normalX +
    (movementStart.y - segmentStart.y) * normalY;
  const signedDelta = movementX * normalX + movementY * normalY;
  let earliest: number | null = null;

  if (Math.abs(signedDelta) > EPSILON) {
    for (const boundary of [-radius, radius]) {
      const amount = (boundary - signedStart) / signedDelta;

      if (amount < 0 || amount > 1) {
        continue;
      }

      const point = pointAt(movementStart, movementEnd, amount);
      const along =
        (point.x - segmentStart.x) * tangentX +
        (point.y - segmentStart.y) * tangentY;

      if (
        along >= -EPSILON &&
        along <= segmentLength + EPSILON &&
        (earliest === null || amount < earliest)
      ) {
        earliest = amount;
      }
    }
  }

  const startCap = segmentCircleEntryParameter(
    movementStart,
    movementEnd,
    segmentStart,
    radius,
  );
  const endCap = segmentCircleEntryParameter(
    movementStart,
    movementEnd,
    segmentEnd,
    radius,
  );

  for (const capHit of [startCap, endCap]) {
    if (capHit !== null && (earliest === null || capHit < earliest)) {
      earliest = capHit;
    }
  }

  return earliest;
};

export class CutterModel {
  private readonly id: string;
  private readonly phase: number;
  private readonly position: MutableVec2;
  private readonly velocity: MutableVec2 = { x: 0, y: 0 };
  private readonly facing: MutableVec2 = { x: 0, y: 1 };
  private alive = true;
  private state: CutterState = 'stalk';
  private stateTimer = 0;
  private lockedSegmentIndex: number | null = null;
  private lockedMidpoint: MutableVec2 | null = null;
  private lockedNormal: MutableVec2 | null = null;
  private lockedDirection: MutableVec2 | null = null;

  public constructor(spawn: CutterSpawn) {
    if (spawn.id.length === 0) {
      throw new RangeError('Cutter id must not be empty');
    }

    if (!isFiniteVec2(spawn.position)) {
      throw new RangeError('Cutter position must be finite');
    }

    if (!Number.isFinite(spawn.phase)) {
      throw new RangeError('Cutter phase must be finite');
    }

    this.id = spawn.id;
    this.phase = spawn.phase;
    this.position = { x: spawn.position.x, y: spawn.position.y };
  }

  public get snapshot(): CutterSnapshot {
    return Object.freeze({
      id: this.id,
      position: frozenVec2(this.position),
      velocity: frozenVec2(this.velocity),
      facing: frozenVec2(this.facing),
      phase: this.phase,
      radius: CUTTER_BALANCE.radius,
      contactDamage: CUTTER_BALANCE.contactDamage,
      xp: CUTTER_BALANCE.xp,
      captureRecovery: CUTTER_BALANCE.captureRecovery,
      alive: this.alive,
      state: this.state,
      stateTimer: this.stateTimer,
      lockedSegmentIndex: this.lockedSegmentIndex,
      lockedMidpoint:
        this.lockedMidpoint === null ? null : frozenVec2(this.lockedMidpoint),
      lockedNormal:
        this.lockedNormal === null ? null : frozenVec2(this.lockedNormal),
      lockedDirection:
        this.lockedDirection === null
          ? null
          : frozenVec2(this.lockedDirection),
    });
  }

  public step(
    deltaSeconds: number,
    context: CutterStepContext,
  ): readonly CutterAction[] {
    if (
      !this.alive ||
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(context.playerPosition) ||
      !isValidBounds(context.bounds) ||
      !areValidTetherSamples(context.tetherSamples)
    ) {
      return EMPTY_ACTIONS;
    }

    this.clampToBounds(context.bounds);
    let remaining = Math.min(deltaSeconds, MAX_CUTTER_STEP_SECONDS);
    let transitions = 0;
    let action: CutterAction | null = null;

    while (remaining > EPSILON && transitions < 6) {
      switch (this.state) {
        case 'stalk': {
          const lock = this.findSegmentLock(context.tetherSamples);

          if (lock !== null) {
            this.enterTelegraph(lock);
            transitions += 1;
            continue;
          }

          this.moveTowardPlayer(
            context.playerPosition,
            remaining,
            context.bounds,
          );
          remaining = 0;
          break;
        }
        case 'telegraph': {
          this.stop();
          const elapsed = Math.min(remaining, this.stateTimer);
          this.stateTimer = Math.max(0, this.stateTimer - elapsed);
          remaining -= elapsed;

          if (this.stateTimer <= EPSILON) {
            this.state = 'dash';
            this.stateTimer = CUTTER_BALANCE.dashSeconds;
            transitions += 1;
            continue;
          }

          break;
        }
        case 'dash': {
          const elapsed = Math.min(remaining, this.stateTimer);
          const direction = this.lockedDirection ?? this.facing;
          this.setFacing(direction);
          this.velocity.x = direction.x * CUTTER_BALANCE.dashSpeed;
          this.velocity.y = direction.y * CUTTER_BALANCE.dashSpeed;
          const start = { x: this.position.x, y: this.position.y };
          const unboundedEnd = {
            x: start.x + this.velocity.x * elapsed,
            y: start.y + this.velocity.y * elapsed,
          };
          const end = this.clampedPosition(unboundedEnd, context.bounds);
          const hit = this.firstSweptTetherHit(
            start,
            end,
            context.tetherSamples,
          );

          if (hit !== null) {
            const hitPosition = pointAt(start, end, hit.amount);
            this.position.x = hitPosition.x;
            this.position.y = hitPosition.y;
            action = Object.freeze({
              type: 'loop-cut',
              sourceId: this.id,
              segmentIndex: hit.segmentIndex,
              position: frozenVec2(hitPosition),
            });
            const consumed = elapsed * hit.amount;
            remaining -= consumed;
            this.enterRecover();
            transitions += 1;
            continue;
          }

          this.position.x = end.x;
          this.position.y = end.y;
          this.zeroBlockedVelocity(unboundedEnd, end);
          this.stateTimer = Math.max(0, this.stateTimer - elapsed);
          remaining -= elapsed;

          if (this.stateTimer <= EPSILON) {
            this.enterRecover();
            transitions += 1;
            continue;
          }

          break;
        }
        case 'recover': {
          this.stop();
          const elapsed = Math.min(remaining, this.stateTimer);
          this.stateTimer = Math.max(0, this.stateTimer - elapsed);
          remaining -= elapsed;

          if (this.stateTimer <= EPSILON) {
            this.state = 'stalk';
            this.stateTimer = 0;
            transitions += 1;
            continue;
          }

          break;
        }
        case 'dead':
          remaining = 0;
          break;
      }
    }

    this.clampToBounds(context.bounds);
    return action === null ? EMPTY_ACTIONS : Object.freeze([action]);
  }

  public kill(): void {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.state = 'dead';
    this.stateTimer = 0;
    this.clearLock();
    this.stop();
  }

  private findSegmentLock(samples: readonly Vec2[]): SegmentLock | null {
    if (samples.length < 2) {
      return null;
    }

    const maximumDistanceSquared = CUTTER_BALANCE.tetherDetectionRange ** 2;
    let selectedIndex = -1;
    let selectedDistanceSquared = Number.POSITIVE_INFINITY;

    for (let index = 0; index < samples.length - 1; index += 1) {
      const distanceSquared = pointSegmentDistanceSquared(
        this.position,
        samples[index]!,
        samples[index + 1]!,
      );

      if (
        distanceSquared <= maximumDistanceSquared &&
        distanceSquared < selectedDistanceSquared - EPSILON
      ) {
        selectedIndex = index;
        selectedDistanceSquared = distanceSquared;
      }
    }

    if (selectedIndex < 0) {
      return null;
    }

    const start = samples[selectedIndex]!;
    const end = samples[selectedIndex + 1]!;
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLength = Math.hypot(segmentX, segmentY);
    let normal =
      segmentLength <= EPSILON
        ? { x: this.facing.x, y: this.facing.y }
        : { x: -segmentY / segmentLength, y: segmentX / segmentLength };
    const toMidpoint = {
      x: midpoint.x - this.position.x,
      y: midpoint.y - this.position.y,
    };

    if (normal.x * toMidpoint.x + normal.y * toMidpoint.y < 0) {
      normal = { x: -normal.x, y: -normal.y };
    }

    const midpointDistance = Math.hypot(toMidpoint.x, toMidpoint.y);
    const direction =
      midpointDistance <= EPSILON
        ? { x: normal.x, y: normal.y }
        : {
            x: toMidpoint.x / midpointDistance,
            y: toMidpoint.y / midpointDistance,
          };

    return {
      index: selectedIndex,
      midpoint,
      normal,
      direction,
    };
  }

  private enterTelegraph(lock: SegmentLock): void {
    this.state = 'telegraph';
    this.stateTimer = CUTTER_BALANCE.telegraphSeconds;
    this.lockedSegmentIndex = lock.index;
    this.lockedMidpoint = lock.midpoint;
    this.lockedNormal = lock.normal;
    this.lockedDirection = lock.direction;
    this.setFacing(lock.direction);
    this.stop();
  }

  private enterRecover(): void {
    this.state = 'recover';
    this.stateTimer = CUTTER_BALANCE.recoverSeconds;
    this.clearLock();
    this.stop();
  }

  private clearLock(): void {
    this.lockedSegmentIndex = null;
    this.lockedMidpoint = null;
    this.lockedNormal = null;
    this.lockedDirection = null;
  }

  private firstSweptTetherHit(
    movementStart: Vec2,
    movementEnd: Vec2,
    samples: readonly Vec2[],
  ): SweptTetherHit | null {
    if (samples.length < 2) {
      return null;
    }

    let earliest: SweptTetherHit | null = null;

    for (let index = 0; index < samples.length - 1; index += 1) {
      const amount = sweptPointSegmentHitParameter(
        movementStart,
        movementEnd,
        samples[index]!,
        samples[index + 1]!,
        CUTTER_BALANCE.tetherHitRadius,
      );

      if (
        amount !== null &&
        (earliest === null || amount < earliest.amount - EPSILON)
      ) {
        earliest = { amount, segmentIndex: index };
      }
    }

    return earliest;
  }

  private moveTowardPlayer(
    playerPosition: Vec2,
    deltaSeconds: number,
    bounds: CutterArenaBounds,
  ): void {
    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= EPSILON) {
      this.stop();
      return;
    }

    const direction = { x: dx / distance, y: dy / distance };
    const travel = Math.min(
      CUTTER_BALANCE.stalkSpeed * deltaSeconds,
      distance,
    );
    this.setFacing(direction);
    this.velocity.x = (direction.x * travel) / deltaSeconds;
    this.velocity.y = (direction.y * travel) / deltaSeconds;
    const unboundedEnd = {
      x: this.position.x + direction.x * travel,
      y: this.position.y + direction.y * travel,
    };
    const end = this.clampedPosition(unboundedEnd, bounds);
    this.position.x = end.x;
    this.position.y = end.y;
    this.zeroBlockedVelocity(unboundedEnd, end);
  }

  private setFacing(direction: Vec2): void {
    const length = Math.hypot(direction.x, direction.y);

    if (length <= EPSILON) {
      return;
    }

    this.facing.x = direction.x / length;
    this.facing.y = direction.y / length;
  }

  private stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  /** Pushes the body out of static street structures after each step. */
  public applyStaticColliders(colliders: readonly Obb[]): void {
    if (!this.alive || colliders.length === 0) {
      return;
    }

    const resolved = resolveCircleColliders(
      this.position,
      CUTTER_BALANCE.radius,
      colliders,
    );
    if (resolved !== this.position) {
      this.position.x = resolved.x;
      this.position.y = resolved.y;
    }
  }

  private clampToBounds(bounds: CutterArenaBounds): void {
    const clamped = this.clampedPosition(this.position, bounds);
    this.zeroBlockedVelocity(this.position, clamped);
    this.position.x = clamped.x;
    this.position.y = clamped.y;
  }

  private clampedPosition(
    position: Vec2,
    bounds: CutterArenaBounds,
  ): MutableVec2 {
    const minX = bounds.minX + CUTTER_BALANCE.radius;
    const maxX = bounds.maxX - CUTTER_BALANCE.radius;
    const minY = bounds.minY + CUTTER_BALANCE.radius;
    const maxY = bounds.maxY - CUTTER_BALANCE.radius;

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
