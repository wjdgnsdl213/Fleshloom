import {
  ENEMY_DEFINITIONS,
  type EnemyArchetype,
} from '../../content/enemies';
import {
  getWavePhase,
  M2_RUN_DURATION_SECONDS,
  type WavePhaseDefinition,
  type WavePhaseId,
} from '../../content/waves';
import type { Vec2 } from '../../core/geometry/vector';

const EPSILON = 1e-9;
const POSITION_ATTEMPTS = 16;
const EMPTY_REQUESTS: readonly EnemySpawnRequest[] = Object.freeze([]);

export type WaveRandom = () => number;
export type WaveAliveCounts = Readonly<Record<EnemyArchetype, number>>;

export interface WaveDirectorConfig {
  readonly random: WaveRandom;
  readonly idPrefix?: string;
}

export interface WaveArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface WaveStepContext {
  readonly playerPosition: Vec2;
  readonly bounds: WaveArenaBounds;
  readonly aliveCounts: WaveAliveCounts;
}

export interface EnemySpawnRequest {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: Vec2;
  readonly phase: number;
  readonly scheduledAtSeconds: number;
}

export interface WaveDirectorSnapshot {
  readonly elapsedSeconds: number;
  readonly phaseId: WavePhaseId | 'complete';
  readonly spawnCooldownRemaining: number;
  readonly totalSpawnRequests: number;
  readonly completed: boolean;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: Vec2): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y);

const isValidBounds = (bounds: WaveArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const isValidAliveCounts = (counts: WaveAliveCounts): boolean =>
  Number.isInteger(counts.drifter) &&
  counts.drifter >= 0 &&
  Number.isInteger(counts.rusher) &&
  counts.rusher >= 0 &&
  Number.isInteger(counts.watcher) &&
  counts.watcher >= 0;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: value.x, y: value.y });

export class WaveDirector {
  private readonly random: WaveRandom;
  private readonly idPrefix: string;
  private elapsedSeconds = 0;
  private spawnCooldownRemaining = 0;
  private totalSpawnRequests = 0;

  public constructor(config: WaveDirectorConfig) {
    if (typeof config.random !== 'function') {
      throw new TypeError('random must be a function');
    }

    if (config.idPrefix !== undefined && config.idPrefix.length === 0) {
      throw new RangeError('idPrefix must not be empty');
    }

    this.random = config.random;
    this.idPrefix = config.idPrefix ?? 'wave-enemy';
  }

  public get snapshot(): WaveDirectorSnapshot {
    const phase = getWavePhase(this.elapsedSeconds);
    return Object.freeze({
      elapsedSeconds: this.elapsedSeconds,
      phaseId: phase?.id ?? 'complete',
      spawnCooldownRemaining: this.spawnCooldownRemaining,
      totalSpawnRequests: this.totalSpawnRequests,
      completed: this.elapsedSeconds >= M2_RUN_DURATION_SECONDS,
    });
  }

  public step(
    deltaSeconds: number,
    context: WaveStepContext,
  ): readonly EnemySpawnRequest[] {
    if (
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(context.playerPosition) ||
      !isValidBounds(context.bounds) ||
      !isValidAliveCounts(context.aliveCounts) ||
      this.elapsedSeconds >= M2_RUN_DURATION_SECONDS
    ) {
      return EMPTY_REQUESTS;
    }

    const projectedCounts: Record<EnemyArchetype, number> = {
      drifter: context.aliveCounts.drifter,
      rusher: context.aliveCounts.rusher,
      watcher: context.aliveCounts.watcher,
    };
    const requests: EnemySpawnRequest[] = [];
    let remaining = Math.min(
      deltaSeconds,
      M2_RUN_DURATION_SECONDS - this.elapsedSeconds,
    );

    while (
      remaining > EPSILON &&
      this.elapsedSeconds < M2_RUN_DURATION_SECONDS
    ) {
      const phase = getWavePhase(this.elapsedSeconds);

      if (phase === null) {
        this.elapsedSeconds = M2_RUN_DURATION_SECONDS;
        this.spawnCooldownRemaining = 0;
        break;
      }

      if (this.spawnCooldownRemaining <= EPSILON) {
        const request = this.createSpawnRequest(
          phase,
          projectedCounts,
          context.playerPosition,
          context.bounds,
        );
        this.spawnCooldownRemaining = phase.spawnCooldownSeconds;

        if (request !== null) {
          requests.push(request);
          projectedCounts[request.archetype] += 1;
        }
      }

      const secondsToPhaseEnd = phase.endSeconds - this.elapsedSeconds;
      const advance = Math.min(
        remaining,
        this.spawnCooldownRemaining,
        secondsToPhaseEnd,
      );

      if (advance <= EPSILON) {
        this.elapsedSeconds = phase.endSeconds;
        this.spawnCooldownRemaining = 0;
        continue;
      }

      this.elapsedSeconds += advance;
      this.spawnCooldownRemaining = Math.max(
        0,
        this.spawnCooldownRemaining - advance,
      );
      remaining -= advance;

      if (this.elapsedSeconds >= phase.endSeconds - EPSILON) {
        this.elapsedSeconds = phase.endSeconds;
        this.spawnCooldownRemaining = 0;
      }
    }

    if (this.elapsedSeconds >= M2_RUN_DURATION_SECONDS - EPSILON) {
      this.elapsedSeconds = M2_RUN_DURATION_SECONDS;
      this.spawnCooldownRemaining = 0;
    }

    return requests.length === 0
      ? EMPTY_REQUESTS
      : Object.freeze(requests);
  }

  public reset(): void {
    this.elapsedSeconds = 0;
    this.spawnCooldownRemaining = 0;
    this.totalSpawnRequests = 0;
  }

  private createSpawnRequest(
    phase: WavePhaseDefinition,
    counts: Readonly<Record<EnemyArchetype, number>>,
    playerPosition: Vec2,
    bounds: WaveArenaBounds,
  ): EnemySpawnRequest | null {
    const totalAlive = counts.drifter + counts.rusher + counts.watcher;

    if (totalAlive >= phase.maxAlive) {
      return null;
    }

    for (const archetype of phase.spawnOrder) {
      if (counts[archetype] >= phase.targets[archetype]) {
        continue;
      }

      const position = this.createSpawnPosition(
        archetype,
        phase.playerSafeRadius,
        playerPosition,
        bounds,
      );

      if (position === null) {
        continue;
      }

      const animationPhase = this.nextRandom() * Math.PI * 2;
      this.totalSpawnRequests += 1;

      return Object.freeze({
        id: `${this.idPrefix}-${this.totalSpawnRequests}`,
        archetype,
        position: frozenVec2(position),
        phase: animationPhase,
        scheduledAtSeconds: this.elapsedSeconds,
      });
    }

    return null;
  }

  private createSpawnPosition(
    archetype: EnemyArchetype,
    playerSafeRadius: number,
    playerPosition: Vec2,
    bounds: WaveArenaBounds,
  ): Vec2 | null {
    const radius = ENEMY_DEFINITIONS[archetype].radius;
    const minX = bounds.minX + radius;
    const maxX = bounds.maxX - radius;
    const minY = bounds.minY + radius;
    const maxY = bounds.maxY - radius;

    if (minX > maxX || minY > maxY) {
      return null;
    }

    const minimumCenterDistance = playerSafeRadius + radius;
    const minimumDistanceSquared = minimumCenterDistance ** 2;

    for (let attempt = 0; attempt < POSITION_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: minX + this.nextRandom() * (maxX - minX),
        y: minY + this.nextRandom() * (maxY - minY),
      };

      if (
        this.distanceSquared(candidate, playerPosition) >=
        minimumDistanceSquared
      ) {
        return candidate;
      }
    }

    const fallbackCandidates: readonly Vec2[] = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      { x: (minX + maxX) / 2, y: minY },
      { x: maxX, y: (minY + maxY) / 2 },
      { x: (minX + maxX) / 2, y: maxY },
      { x: minX, y: (minY + maxY) / 2 },
    ];
    let farthest: Vec2 | null = null;
    let farthestDistanceSquared = -1;

    for (const candidate of fallbackCandidates) {
      const candidateDistanceSquared = this.distanceSquared(
        candidate,
        playerPosition,
      );

      if (candidateDistanceSquared > farthestDistanceSquared) {
        farthest = candidate;
        farthestDistanceSquared = candidateDistanceSquared;
      }
    }

    return farthest !== null &&
      farthestDistanceSquared >= minimumDistanceSquared
      ? farthest
      : null;
  }

  private nextRandom(): number {
    const value = this.random();

    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('random must return a finite value in [0, 1)');
    }

    return value;
  }

  private distanceSquared(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }
}
