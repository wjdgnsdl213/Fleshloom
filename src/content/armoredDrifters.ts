import type { EnemyCaptureProfile } from './enemies';

export interface ArmoredDrifterWaveBand {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly everyNthDrifter: number;
}

export const ARMORED_DRIFTER_BALANCE = Object.freeze({
  radius: 23,
  contactDamage: 16,
  speedFactor: 0.78,
  staggerSeconds: 0.8,
  peelReward: Object.freeze({ xp: 7, recovery: 2 }),
  finalReward: Object.freeze({ xp: 14, recovery: 4 }),
});

/**
 * The first three minutes remain the proven one-capture onboarding. The
 * armored share then rises without consuming wave RNG or changing spawn caps.
 */
export const ARMORED_DRIFTER_WAVE_BANDS: readonly ArmoredDrifterWaveBand[] =
  Object.freeze([
    Object.freeze({
      startSeconds: 180,
      endSeconds: 300,
      everyNthDrifter: 4,
    }),
    Object.freeze({
      startSeconds: 300,
      endSeconds: 420,
      everyNthDrifter: 3,
    }),
    Object.freeze({
      startSeconds: 420,
      endSeconds: 540,
      everyNthDrifter: 2,
    }),
  ]);

export const captureProfileForDrifterSpawn = (
  scheduledAtSeconds: number,
  postCheckpointDrifterSequence: number,
): EnemyCaptureProfile => {
  if (
    !Number.isFinite(scheduledAtSeconds) ||
    !Number.isInteger(postCheckpointDrifterSequence) ||
    postCheckpointDrifterSequence <= 0
  ) {
    return 'ordinary';
  }

  const band = ARMORED_DRIFTER_WAVE_BANDS.find(
    (candidate) =>
      scheduledAtSeconds >= candidate.startSeconds &&
      scheduledAtSeconds < candidate.endSeconds,
  );

  return band !== undefined &&
    postCheckpointDrifterSequence % band.everyNthDrifter === 0
    ? 'armored'
    : 'ordinary';
};
