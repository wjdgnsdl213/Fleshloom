import type { EnemyArchetype } from './enemies';

export const M2_RUN_DURATION_SECONDS = 180;

export type WavePhaseId =
  | 'safe-drifters'
  | 'drifter-retry'
  | 'rusher-introduction'
  | 'watcher-introduction'
  | 'mixed-pressure';

export type WaveArchetypeTargets = Readonly<Record<EnemyArchetype, number>>;

export interface WavePhaseDefinition {
  readonly id: WavePhaseId;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly maxAlive: number;
  readonly spawnCooldownSeconds: number;
  /** Minimum clearance from the player to the spawned enemy's nearest edge. */
  readonly playerSafeRadius: number;
  readonly targets: WaveArchetypeTargets;
  readonly spawnOrder: readonly EnemyArchetype[];
}

const definePhase = (
  phase: WavePhaseDefinition,
): WavePhaseDefinition =>
  Object.freeze({
    ...phase,
    targets: Object.freeze({ ...phase.targets }),
    spawnOrder: Object.freeze([...phase.spawnOrder]),
  });

export const M2_WAVE_SCHEDULE: readonly WavePhaseDefinition[] = Object.freeze([
  definePhase({
    id: 'safe-drifters',
    startSeconds: 0,
    endSeconds: 15,
    maxAlive: 2,
    spawnCooldownSeconds: 3,
    playerSafeRadius: 220,
    targets: { drifter: 2, rusher: 0, watcher: 0 },
    spawnOrder: ['drifter', 'rusher', 'watcher'],
  }),
  definePhase({
    id: 'drifter-retry',
    startSeconds: 15,
    endSeconds: 40,
    maxAlive: 5,
    spawnCooldownSeconds: 2.2,
    playerSafeRadius: 210,
    targets: { drifter: 5, rusher: 0, watcher: 0 },
    spawnOrder: ['drifter', 'rusher', 'watcher'],
  }),
  definePhase({
    id: 'rusher-introduction',
    startSeconds: 40,
    endSeconds: 75,
    maxAlive: 8,
    spawnCooldownSeconds: 1.8,
    playerSafeRadius: 200,
    targets: { drifter: 6, rusher: 2, watcher: 0 },
    spawnOrder: ['rusher', 'drifter', 'watcher'],
  }),
  definePhase({
    id: 'watcher-introduction',
    startSeconds: 75,
    endSeconds: 120,
    maxAlive: 13,
    spawnCooldownSeconds: 1.45,
    playerSafeRadius: 190,
    targets: { drifter: 8, rusher: 3, watcher: 2 },
    spawnOrder: ['watcher', 'rusher', 'drifter'],
  }),
  definePhase({
    id: 'mixed-pressure',
    startSeconds: 120,
    endSeconds: M2_RUN_DURATION_SECONDS,
    maxAlive: 21,
    spawnCooldownSeconds: 1.05,
    playerSafeRadius: 180,
    targets: { drifter: 12, rusher: 5, watcher: 4 },
    spawnOrder: ['rusher', 'watcher', 'drifter'],
  }),
]);

export const getWavePhase = (
  elapsedSeconds: number,
): WavePhaseDefinition | null => {
  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0 ||
    elapsedSeconds >= M2_RUN_DURATION_SECONDS
  ) {
    return null;
  }

  return (
    M2_WAVE_SCHEDULE.find(
      (phase) =>
        elapsedSeconds >= phase.startSeconds &&
        elapsedSeconds < phase.endSeconds,
    ) ?? null
  );
};
