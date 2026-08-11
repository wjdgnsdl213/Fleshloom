import {
  ENEMY_DEFINITIONS,
  type EnemyArchetype,
} from '../../content/enemies';
import {
  M3_ENEMY_DEFINITIONS,
  type FullRunEnemyArchetype,
} from '../../content/fullRunEnemies';
import {
  FULL_RUN_PREBOSS_SECONDS,
  getM3WavePhase,
  M3_CHECKPOINT_SECONDS,
  type FullRunWavePhaseDefinition,
  type FullRunWavePhaseId,
} from '../../content/fullRunWaves';
import type { WavePhaseId } from '../../content/waves';
import type { Vec2 } from '../../core/geometry/vector';
import {
  WaveDirector,
  type WaveArenaBounds,
  type WaveRandom,
} from './WaveDirector';

const EPSILON = 1e-9;
const POSITION_ATTEMPTS = 16;
const EMPTY_REQUESTS: readonly FullRunEnemySpawnRequest[] = Object.freeze([]);

export type FullRunAliveCounts = Readonly<
  Record<FullRunEnemyArchetype, number>
>;

export interface FullRunWaveDirectorConfig {
  readonly random: WaveRandom;
  readonly idPrefix?: string;
}

export interface FullRunWaveStepContext {
  readonly playerPosition: Vec2;
  readonly bounds: WaveArenaBounds;
  readonly aliveCounts: FullRunAliveCounts;
}

export interface FullRunEnemySpawnRequest {
  readonly id: string;
  readonly archetype: FullRunEnemyArchetype;
  readonly position: Vec2;
  readonly phase: number;
  readonly scheduledAtSeconds: number;
}

export interface FullRunWaveDirectorSnapshot {
  readonly elapsedSeconds: number;
  readonly phaseId: WavePhaseId | FullRunWavePhaseId | 'complete';
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

const isValidAliveCounts = (counts: FullRunAliveCounts): boolean =>
  Number.isInteger(counts.drifter) &&
  counts.drifter >= 0 &&
  Number.isInteger(counts.rusher) &&
  counts.rusher >= 0 &&
  Number.isInteger(counts.watcher) &&
  counts.watcher >= 0 &&
  Number.isInteger(counts.cutter) &&
  counts.cutter >= 0 &&
  Number.isInteger(counts.mimic) &&
  counts.mimic >= 0 &&
  Number.isInteger(counts['elite-husk']) &&
  counts['elite-husk'] >= 0;

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: value.x, y: value.y });

const isM2Archetype = (
  archetype: FullRunEnemyArchetype,
): archetype is EnemyArchetype =>
  archetype === 'drifter' ||
  archetype === 'rusher' ||
  archetype === 'watcher';

const radiusForArchetype = (archetype: FullRunEnemyArchetype): number =>
  isM2Archetype(archetype)
    ? ENEMY_DEFINITIONS[archetype].radius
    : M3_ENEMY_DEFINITIONS[archetype].radius;

export class FullRunWaveDirector {
  private readonly random: WaveRandom;
  private readonly idPrefix: string;
  private readonly m2Director: WaveDirector;
  private elapsedSeconds = 0;
  private m3SpawnCooldownRemaining = 0;
  private m3SpawnRequests = 0;

  public constructor(config: FullRunWaveDirectorConfig) {
    this.m2Director = new WaveDirector(config);
    this.random = config.random;
    this.idPrefix = config.idPrefix ?? 'wave-enemy';
  }

  public get snapshot(): FullRunWaveDirectorSnapshot {
    if (this.elapsedSeconds < M3_CHECKPOINT_SECONDS) {
      const m2Snapshot = this.m2Director.snapshot;
      return Object.freeze({
        elapsedSeconds: m2Snapshot.elapsedSeconds,
        phaseId: m2Snapshot.phaseId as WavePhaseId,
        spawnCooldownRemaining: m2Snapshot.spawnCooldownRemaining,
        totalSpawnRequests: m2Snapshot.totalSpawnRequests,
        completed: false,
      });
    }

    const phase = getM3WavePhase(this.elapsedSeconds);
    return Object.freeze({
      elapsedSeconds: this.elapsedSeconds,
      phaseId: phase?.id ?? 'complete',
      spawnCooldownRemaining: this.m3SpawnCooldownRemaining,
      totalSpawnRequests:
        this.m2Director.snapshot.totalSpawnRequests + this.m3SpawnRequests,
      completed: this.elapsedSeconds >= FULL_RUN_PREBOSS_SECONDS,
    });
  }

  public step(
    deltaSeconds: number,
    context: FullRunWaveStepContext,
  ): readonly FullRunEnemySpawnRequest[] {
    if (
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(context.playerPosition) ||
      !isValidBounds(context.bounds) ||
      !isValidAliveCounts(context.aliveCounts) ||
      this.elapsedSeconds >= FULL_RUN_PREBOSS_SECONDS
    ) {
      return EMPTY_REQUESTS;
    }

    const projectedCounts: Record<FullRunEnemyArchetype, number> = {
      drifter: context.aliveCounts.drifter,
      rusher: context.aliveCounts.rusher,
      watcher: context.aliveCounts.watcher,
      cutter: context.aliveCounts.cutter,
      mimic: context.aliveCounts.mimic,
      'elite-husk': context.aliveCounts['elite-husk'],
    };
    const combinedRequests: FullRunEnemySpawnRequest[] = [];
    let remaining = Math.min(
      deltaSeconds,
      FULL_RUN_PREBOSS_SECONDS - this.elapsedSeconds,
    );

    if (this.elapsedSeconds < M3_CHECKPOINT_SECONDS) {
      const m2Delta = Math.min(
        remaining,
        M3_CHECKPOINT_SECONDS - this.elapsedSeconds,
      );
      const m2Requests: readonly FullRunEnemySpawnRequest[] =
        this.m2Director.step(m2Delta, {
          playerPosition: context.playerPosition,
          bounds: context.bounds,
          aliveCounts: {
            drifter: projectedCounts.drifter,
            rusher: projectedCounts.rusher,
            watcher: projectedCounts.watcher,
          },
        });

      this.elapsedSeconds = this.m2Director.snapshot.elapsedSeconds;
      remaining -= m2Delta;

      for (const request of m2Requests) {
        combinedRequests.push(request);
        projectedCounts[request.archetype] += 1;
      }

      if (this.elapsedSeconds >= M3_CHECKPOINT_SECONDS - EPSILON) {
        this.elapsedSeconds = M3_CHECKPOINT_SECONDS;
        this.m3SpawnCooldownRemaining = 0;
      }

      if (remaining <= EPSILON) {
        return m2Requests.length === 0 ? EMPTY_REQUESTS : m2Requests;
      }
    }

    const m3Requests = this.stepM3(
      remaining,
      context.playerPosition,
      context.bounds,
      projectedCounts,
    );

    if (combinedRequests.length === 0) {
      return m3Requests;
    }

    combinedRequests.push(...m3Requests);
    return Object.freeze(combinedRequests);
  }

  public reset(): void {
    this.m2Director.reset();
    this.elapsedSeconds = 0;
    this.m3SpawnCooldownRemaining = 0;
    this.m3SpawnRequests = 0;
  }

  private stepM3(
    deltaSeconds: number,
    playerPosition: Vec2,
    bounds: WaveArenaBounds,
    projectedCounts: Record<FullRunEnemyArchetype, number>,
  ): readonly FullRunEnemySpawnRequest[] {
    const requests: FullRunEnemySpawnRequest[] = [];
    let remaining = Math.min(
      deltaSeconds,
      FULL_RUN_PREBOSS_SECONDS - this.elapsedSeconds,
    );

    while (
      remaining > EPSILON &&
      this.elapsedSeconds < FULL_RUN_PREBOSS_SECONDS
    ) {
      const phase = getM3WavePhase(this.elapsedSeconds);

      if (phase === null) {
        this.elapsedSeconds = FULL_RUN_PREBOSS_SECONDS;
        this.m3SpawnCooldownRemaining = 0;
        break;
      }

      if (this.m3SpawnCooldownRemaining <= EPSILON) {
        const request = this.createM3SpawnRequest(
          phase,
          projectedCounts,
          playerPosition,
          bounds,
        );
        this.m3SpawnCooldownRemaining = phase.spawnCooldownSeconds;

        if (request !== null) {
          requests.push(request);
          projectedCounts[request.archetype] += 1;
        }
      }

      const secondsToPhaseEnd = phase.endSeconds - this.elapsedSeconds;
      const advance = Math.min(
        remaining,
        this.m3SpawnCooldownRemaining,
        secondsToPhaseEnd,
      );

      if (advance <= EPSILON) {
        this.elapsedSeconds = phase.endSeconds;
        this.m3SpawnCooldownRemaining = 0;
        continue;
      }

      this.elapsedSeconds += advance;
      this.m3SpawnCooldownRemaining = Math.max(
        0,
        this.m3SpawnCooldownRemaining - advance,
      );
      remaining -= advance;

      if (this.elapsedSeconds >= phase.endSeconds - EPSILON) {
        this.elapsedSeconds = phase.endSeconds;
        this.m3SpawnCooldownRemaining = 0;
      }
    }

    if (this.elapsedSeconds >= FULL_RUN_PREBOSS_SECONDS - EPSILON) {
      this.elapsedSeconds = FULL_RUN_PREBOSS_SECONDS;
      this.m3SpawnCooldownRemaining = 0;
    }

    return requests.length === 0
      ? EMPTY_REQUESTS
      : Object.freeze(requests);
  }

  private createM3SpawnRequest(
    phase: FullRunWavePhaseDefinition,
    counts: Readonly<Record<FullRunEnemyArchetype, number>>,
    playerPosition: Vec2,
    bounds: WaveArenaBounds,
  ): FullRunEnemySpawnRequest | null {
    const totalAlive =
      counts.drifter +
      counts.rusher +
      counts.watcher +
      counts.cutter +
      counts.mimic +
      counts['elite-husk'];

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
      this.m3SpawnRequests += 1;
      const sequence =
        this.m2Director.snapshot.totalSpawnRequests + this.m3SpawnRequests;

      return Object.freeze({
        id: `${this.idPrefix}-${sequence}`,
        archetype,
        position: frozenVec2(position),
        phase: animationPhase,
        scheduledAtSeconds: this.elapsedSeconds,
      });
    }

    return null;
  }

  private createSpawnPosition(
    archetype: FullRunEnemyArchetype,
    playerSafeRadius: number,
    playerPosition: Vec2,
    bounds: WaveArenaBounds,
  ): Vec2 | null {
    const radius = radiusForArchetype(archetype);
    const minX = bounds.minX + radius;
    const maxX = bounds.maxX - radius;
    const minY = bounds.minY + radius;
    const maxY = bounds.maxY - radius;

    if (minX > maxX || minY > maxY) {
      return null;
    }

    const minimumDistanceSquared = (playerSafeRadius + radius) ** 2;

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
