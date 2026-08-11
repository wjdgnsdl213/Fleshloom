import type { FullRunEnemyArchetype } from './fullRunEnemies';

export const M3_CHECKPOINT_SECONDS = 180;
export const FULL_RUN_PREBOSS_SECONDS = 540;

export type FullRunWavePhaseId =
  | 'cutter-introduction'
  | 'cutter-pressure'
  | 'mimic-introduction'
  | 'lineage-contrast'
  | 'five-species-mix'
  | 'elite-introduction'
  | 'elite-retry'
  | 'preboss-escalation';

export type FullRunWaveTargets = Readonly<
  Record<FullRunEnemyArchetype, number>
>;

export interface FullRunWavePhaseDefinition {
  readonly id: FullRunWavePhaseId;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly maxAlive: number;
  readonly spawnCooldownSeconds: number;
  readonly playerSafeRadius: number;
  readonly targets: FullRunWaveTargets;
  readonly spawnOrder: readonly FullRunEnemyArchetype[];
}

const definePhase = (
  phase: FullRunWavePhaseDefinition,
): FullRunWavePhaseDefinition =>
  Object.freeze({
    ...phase,
    targets: Object.freeze({ ...phase.targets }),
    spawnOrder: Object.freeze([...phase.spawnOrder]),
  });

export const M3_WAVE_SCHEDULE: readonly FullRunWavePhaseDefinition[] =
  Object.freeze([
    definePhase({
      id: 'cutter-introduction',
      startSeconds: 180,
      endSeconds: 200,
      maxAlive: 22,
      spawnCooldownSeconds: 1.25,
      playerSafeRadius: 180,
      targets: {
        drifter: 9,
        rusher: 4,
        watcher: 3,
        cutter: 1,
        mimic: 0,
        'elite-husk': 0,
      },
      spawnOrder: ['cutter', 'drifter', 'rusher', 'watcher', 'mimic', 'elite-husk'],
    }),
    definePhase({
      id: 'cutter-pressure',
      startSeconds: 200,
      endSeconds: 240,
      maxAlive: 23,
      spawnCooldownSeconds: 1.15,
      playerSafeRadius: 175,
      targets: {
        drifter: 10,
        rusher: 4,
        watcher: 3,
        cutter: 2,
        mimic: 0,
        'elite-husk': 0,
      },
      spawnOrder: ['cutter', 'rusher', 'watcher', 'drifter', 'mimic', 'elite-husk'],
    }),
    definePhase({
      id: 'mimic-introduction',
      startSeconds: 240,
      endSeconds: 270,
      maxAlive: 25,
      spawnCooldownSeconds: 1.1,
      playerSafeRadius: 175,
      targets: {
        drifter: 9,
        rusher: 4,
        watcher: 3,
        cutter: 1,
        mimic: 2,
        'elite-husk': 0,
      },
      spawnOrder: ['mimic', 'cutter', 'drifter', 'rusher', 'watcher', 'elite-husk'],
    }),
    definePhase({
      id: 'lineage-contrast',
      startSeconds: 270,
      endSeconds: 330,
      maxAlive: 26,
      spawnCooldownSeconds: 1,
      playerSafeRadius: 170,
      targets: {
        drifter: 10,
        rusher: 4,
        watcher: 3,
        cutter: 2,
        mimic: 3,
        'elite-husk': 0,
      },
      spawnOrder: ['mimic', 'cutter', 'rusher', 'watcher', 'drifter', 'elite-husk'],
    }),
    definePhase({
      id: 'five-species-mix',
      startSeconds: 330,
      endSeconds: 420,
      maxAlive: 27,
      spawnCooldownSeconds: 0.9,
      playerSafeRadius: 165,
      targets: {
        drifter: 11,
        rusher: 5,
        watcher: 4,
        cutter: 2,
        mimic: 4,
        'elite-husk': 0,
      },
      spawnOrder: ['cutter', 'mimic', 'rusher', 'watcher', 'drifter', 'elite-husk'],
    }),
    definePhase({
      id: 'elite-introduction',
      startSeconds: 420,
      endSeconds: 450,
      maxAlive: 28,
      spawnCooldownSeconds: 1.2,
      playerSafeRadius: 190,
      targets: {
        drifter: 7,
        rusher: 3,
        watcher: 2,
        cutter: 1,
        mimic: 2,
        'elite-husk': 1,
      },
      spawnOrder: ['elite-husk', 'drifter', 'mimic', 'cutter', 'rusher', 'watcher'],
    }),
    definePhase({
      id: 'elite-retry',
      startSeconds: 450,
      endSeconds: 480,
      maxAlive: 28,
      spawnCooldownSeconds: 1,
      playerSafeRadius: 175,
      targets: {
        drifter: 9,
        rusher: 4,
        watcher: 3,
        cutter: 1,
        mimic: 3,
        'elite-husk': 1,
      },
      spawnOrder: ['elite-husk', 'mimic', 'cutter', 'rusher', 'watcher', 'drifter'],
    }),
    definePhase({
      id: 'preboss-escalation',
      startSeconds: 480,
      endSeconds: FULL_RUN_PREBOSS_SECONDS,
      maxAlive: 30,
      spawnCooldownSeconds: 0.82,
      playerSafeRadius: 160,
      targets: {
        drifter: 12,
        rusher: 5,
        watcher: 4,
        cutter: 2,
        mimic: 4,
        'elite-husk': 1,
      },
      spawnOrder: ['elite-husk', 'cutter', 'mimic', 'rusher', 'watcher', 'drifter'],
    }),
  ]);

export const getM3WavePhase = (
  elapsedSeconds: number,
): FullRunWavePhaseDefinition | null => {
  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < M3_CHECKPOINT_SECONDS ||
    elapsedSeconds >= FULL_RUN_PREBOSS_SECONDS
  ) {
    return null;
  }

  return (
    M3_WAVE_SCHEDULE.find(
      (phase) =>
        elapsedSeconds >= phase.startSeconds &&
        elapsedSeconds < phase.endSeconds,
    ) ?? null
  );
};
