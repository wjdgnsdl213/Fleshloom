import type { Vec2 } from '../../core/geometry/vector';
import {
  LayeredCaptureState,
  type LayeredCaptureResult,
} from './LayeredCaptureState';

export const MAX_ELITE_HUSK_STEP_SECONDS = 0.1;

export const ELITE_HUSK_BALANCE = Object.freeze({
  radius: 34,
  baseSpeed: 34,
  contactDamage: 24,
  exposureSeconds: 4,
  peelReward: Object.freeze({ xp: 25, recovery: 4 }),
  finalReward: Object.freeze({ xp: 60, recovery: 10 }),
});

export interface EliteHuskSpawn {
  readonly id: string;
  readonly position: Vec2;
  readonly phase: number;
}

export interface EliteHuskArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface EliteHuskSnapshot {
  readonly id: string;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: Vec2;
  readonly phase: number;
  readonly radius: number;
  readonly contactDamage: number;
  readonly alive: boolean;
  readonly exposed: boolean;
  readonly exposureRemaining: number;
  readonly peelRewardClaimed: boolean;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: EliteHuskArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: value.x, y: value.y });

export class EliteHuskModel {
  private readonly id: string;
  private readonly phase: number;
  private readonly layers = new LayeredCaptureState({
    exposureSeconds: ELITE_HUSK_BALANCE.exposureSeconds,
    peelReward: ELITE_HUSK_BALANCE.peelReward,
    finalReward: ELITE_HUSK_BALANCE.finalReward,
  });
  private position: Vec2;
  private velocity: Vec2 = { x: 0, y: 0 };
  private facing: Vec2 = { x: 0, y: 1 };

  public constructor(spawn: EliteHuskSpawn) {
    if (spawn.id.length === 0) {
      throw new RangeError('id must not be empty');
    }
    if (!isFiniteVec2(spawn.position) || !Number.isFinite(spawn.phase)) {
      throw new RangeError('spawn position and phase must be finite');
    }

    this.id = spawn.id;
    this.position = { x: spawn.position.x, y: spawn.position.y };
    this.phase = spawn.phase;
  }

  public get snapshot(): EliteHuskSnapshot {
    const layerSnapshot = this.layers.snapshot;
    return Object.freeze({
      id: this.id,
      position: frozenVec2(this.position),
      velocity: frozenVec2(this.velocity),
      facing: frozenVec2(this.facing),
      phase: this.phase,
      radius: ELITE_HUSK_BALANCE.radius,
      contactDamage: ELITE_HUSK_BALANCE.contactDamage,
      alive: layerSnapshot.alive,
      exposed: layerSnapshot.exposed,
      exposureRemaining: layerSnapshot.exposureRemaining,
      peelRewardClaimed: layerSnapshot.peelRewardClaimed,
    });
  }

  public step(
    deltaSeconds: number,
    playerPosition: Vec2,
    bounds: EliteHuskArenaBounds,
  ): void {
    if (
      !this.layers.snapshot.alive ||
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(playerPosition) ||
      !isValidBounds(bounds)
    ) {
      return;
    }

    const stepSeconds = Math.min(deltaSeconds, MAX_ELITE_HUSK_STEP_SECONDS);
    this.layers.update(stepSeconds);

    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const distance = Math.hypot(dx, dy);
    const direction =
      distance > 1e-9
        ? { x: dx / distance, y: dy / distance }
        : { x: this.facing.x, y: this.facing.y };
    this.facing = direction;
    this.velocity = {
      x: direction.x * ELITE_HUSK_BALANCE.baseSpeed,
      y: direction.y * ELITE_HUSK_BALANCE.baseSpeed,
    };

    const minX = bounds.minX + ELITE_HUSK_BALANCE.radius;
    const maxX = bounds.maxX - ELITE_HUSK_BALANCE.radius;
    const minY = bounds.minY + ELITE_HUSK_BALANCE.radius;
    const maxY = bounds.maxY - ELITE_HUSK_BALANCE.radius;
    if (minX > maxX || minY > maxY) {
      this.velocity = { x: 0, y: 0 };
      return;
    }

    const desiredX = this.position.x + this.velocity.x * stepSeconds;
    const desiredY = this.position.y + this.velocity.y * stepSeconds;
    const nextX = Math.max(minX, Math.min(maxX, desiredX));
    const nextY = Math.max(minY, Math.min(maxY, desiredY));
    this.velocity = {
      x: nextX === desiredX ? this.velocity.x : 0,
      y: nextY === desiredY ? this.velocity.y : 0,
    };
    this.position = { x: nextX, y: nextY };
  }

  public capture(): LayeredCaptureResult {
    return this.layers.capture();
  }
}

