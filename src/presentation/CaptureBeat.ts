/**
 * The capture beat, as a pure function of echo age.
 *
 * A closed loop plays one 0.82 second phrase: the ring seals, contracts onto
 * what it caught, the catch comes apart, and the hunter draws it in. The 2D
 * backend already plays that phrase; this puts the shape of it in one place so
 * the 3D backend plays the same one rather than an approximation of it.
 *
 * Backend-agnostic on purpose — no Pixi, no three. It reads the authored
 * duration and returns numbers.
 */

import { PLAYGROUND_TUNING } from '../config/graphics';

export type CaptureBeatPhase =
  | 'closure'
  | 'contraction'
  | 'decomposition'
  | 'intake'
  | 'spent';

export interface CaptureBeat {
  readonly phase: CaptureBeatPhase;
  /** Position through the whole phrase, 0..1. */
  readonly progress: number;
  /** Position within the current phase, 0..1. */
  readonly phaseProgress: number;
  /** Loop ring radius as a fraction of the closure it was drawn at. */
  readonly ringScale: number;
  /** Captured body size as a fraction of its living size. */
  readonly bodyScale: number;
  /** How far a captured body has travelled to the hunter, 0..1. */
  readonly intake: number;
  /** Flash intensity, already scaled for the reduced-flash setting. */
  readonly flash: number;
}

/**
 * Phase boundaries as fractions of the phrase. The seal has to land before
 * the eye can follow anything else, so it is the shortest; the draw-in is the
 * longest because it is the part that reads as reward.
 */
export const BEAT_BOUNDARIES = Object.freeze({
  closure: 0.18,
  contraction: 0.45,
  decomposition: 0.72,
});

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, value));

/**
 * NaN is the only age with no sensible reading, so it starts the phrase. A
 * negative age has not begun and an infinite one is long over, which clamping
 * already gets right.
 */
const beatProgress = (age: number, duration: number): number =>
  Number.isNaN(age) ? 0 : clamp01(age / duration);

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const inverseLerp = (from: number, to: number, value: number): number =>
  to <= from ? 1 : clamp01((value - from) / (to - from));

export function sampleCaptureBeat(
  age: number,
  reducedFlash = false,
): CaptureBeat {
  const duration = PLAYGROUND_TUNING.closureDurationSeconds;
  const progress = beatProgress(age, duration);
  const flashScale = reducedFlash ? 0.42 : 1;

  if (progress >= 1) {
    return Object.freeze({
      phase: 'spent',
      progress: 1,
      phaseProgress: 1,
      ringScale: 0,
      bodyScale: 0,
      intake: 1,
      flash: 0,
    });
  }

  if (progress < BEAT_BOUNDARIES.closure) {
    const phaseProgress = inverseLerp(0, BEAT_BOUNDARIES.closure, progress);
    return Object.freeze({
      phase: 'closure',
      progress,
      phaseProgress,
      // Overshoots past the drawn loop for a beat, so the seal snaps rather
      // than simply appearing.
      ringScale: 1 + Math.sin(phaseProgress * Math.PI) * 0.08,
      bodyScale: 1,
      intake: 0,
      flash: (1 - phaseProgress) * flashScale,
    });
  }

  if (progress < BEAT_BOUNDARIES.contraction) {
    const phaseProgress = inverseLerp(
      BEAT_BOUNDARIES.closure,
      BEAT_BOUNDARIES.contraction,
      progress,
    );
    const eased = easeOutCubic(phaseProgress);
    return Object.freeze({
      phase: 'contraction',
      progress,
      phaseProgress,
      ringScale: 1 - eased * 0.62,
      bodyScale: 1 - eased * 0.18,
      intake: 0,
      flash: 0.25 * (1 - phaseProgress) * flashScale,
    });
  }

  if (progress < BEAT_BOUNDARIES.decomposition) {
    const phaseProgress = inverseLerp(
      BEAT_BOUNDARIES.contraction,
      BEAT_BOUNDARIES.decomposition,
      progress,
    );
    return Object.freeze({
      phase: 'decomposition',
      progress,
      phaseProgress,
      ringScale: 0.38 * (1 - phaseProgress * 0.5),
      bodyScale: 0.82 - phaseProgress * 0.42,
      intake: phaseProgress * 0.25,
      flash: 0.45 * Math.sin(phaseProgress * Math.PI) * flashScale,
    });
  }

  const phaseProgress = inverseLerp(BEAT_BOUNDARIES.decomposition, 1, progress);
  const eased = easeOutCubic(phaseProgress);
  return Object.freeze({
    phase: 'intake',
    progress,
    phaseProgress,
    ringScale: 0.19 * (1 - eased),
    bodyScale: 0.4 * (1 - eased),
    intake: 0.25 + eased * 0.75,
    flash: 0.3 * (1 - phaseProgress) * flashScale,
  });
}

/**
 * A missed loop gets no phrase — it just fades. Kept here so both backends
 * agree on how long a miss lingers.
 */
export function sampleMissEcho(age: number): number {
  return (
    1 - beatProgress(age, PLAYGROUND_TUNING.closureDurationSeconds)
  );
}
