/**
 * Continuous gait phase.
 *
 * The 2D backend quantises the walk to four sprite frames; the 3D rig needs
 * the same cadence without the quantisation, so the phase is rebuilt from the
 * same authored `distancePerFrame`. A creature that took four frames to
 * complete a stride in 2D still takes exactly one stride over that distance
 * here, which keeps foot speed matched to travel speed and stops the limbs
 * skating.
 */

import {
  WALK_FRAME_COUNT,
  type WalkCycleTuning,
} from '../../Locomotion';

export interface GaitSample {
  /** Continuous cycle position in radians, always within [0, 2*PI). */
  readonly phase: number;
  readonly moving: boolean;
  /**
   * Stride amplitude in [0, 1]. Ramps in with speed so a creature easing into
   * a walk does not snap straight to a full-length step.
   */
  readonly amplitude: number;
}

const TAU = Math.PI * 2;

/** Speed at which the stride reaches full length, in world units per second. */
export const FULL_STRIDE_SPEED = 42;

const wrap = (value: number): number => {
  const wrapped = value % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
};

export function sampleGait(
  distance: number,
  speed: number,
  tuning: WalkCycleTuning,
  movementThreshold = 1,
): GaitSample {
  const moving = Number.isFinite(speed) && speed > movementThreshold;
  if (!moving || !Number.isFinite(distance) || distance < 0) {
    return Object.freeze({ phase: 0, moving: false, amplitude: 0 });
  }

  const strideDistance = Math.max(
    Number.EPSILON,
    tuning.distancePerFrame * WALK_FRAME_COUNT,
  );
  const amplitude = Math.min(1, speed / FULL_STRIDE_SPEED);

  return Object.freeze({
    phase: wrap((distance / strideDistance) * TAU),
    moving: true,
    amplitude,
  });
}

/**
 * Vertical body travel for a gait sample. The torso rides highest at
 * mid-stance, when a leg is straight beneath it, and lowest at the double
 * support on either side of it — so the bob runs at twice the stride rate.
 */
export function bodyBob(gait: GaitSample, bob: number): number {
  if (!gait.moving) {
    return 0;
  }
  return Math.abs(Math.sin(gait.phase)) * bob * gait.amplitude;
}
