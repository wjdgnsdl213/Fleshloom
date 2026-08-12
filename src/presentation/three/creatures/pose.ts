/**
 * Two-bone limb posing.
 *
 * Each limb is solved analytically with the law of cosines rather than by an
 * iterative IK solver: the tip trajectory is known in closed form, so the
 * joint angles are too. The joint bulges away from the direction of travel,
 * which gives the creatures the back-bent, digitigrade legs the 2D silhouettes
 * already read as.
 *
 * Angles are measured in the limb's sagittal plane, from straight down, with
 * positive rotating the limb forward (toward +z in body space).
 */

import type { LimbSpec } from './RigTypes';
import type { GaitSample } from './gait';

export interface TwoBoneSolution {
  /** Angle of the upper bone from straight down. */
  readonly upperAngle: number;
  /** Joint bend, always >= 0; 0 is a fully extended limb. */
  readonly bend: number;
}

export interface LimbPose extends TwoBoneSolution {
  /** Tip travel fore-and-aft from the socket, in collider radii. */
  readonly tipForward: number;
  /** Tip clearance above its resting height, in collider radii. */
  readonly tipLift: number;
  /** True while the tip is at rest height — for a leg, planted. */
  readonly grounded: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Solves the two bones needed to put a tip `reach` away from the socket along
 * a chord at `chordAngle` from straight down.
 */
export function solveTwoBone(
  reach: number,
  upper: number,
  lower: number,
  chordAngle: number,
): TwoBoneSolution {
  const span = upper + lower;
  const gap = Math.abs(upper - lower);
  // Never let the chord reach the exact limits: at full extension the cosines
  // are still well defined, but the derivative blows up and the limb snaps.
  const clamped = clamp(reach, gap + 1e-4, span - 1e-4);

  const kneeCosine = clamp(
    (upper * upper + lower * lower - clamped * clamped) /
      (2 * upper * lower),
    -1,
    1,
  );
  const bend = Math.PI - Math.acos(kneeCosine);

  const rootCosine = clamp(
    (upper * upper + clamped * clamped - lower * lower) /
      (2 * upper * clamped),
    -1,
    1,
  );
  const rootOffset = Math.acos(rootCosine);

  return Object.freeze({
    upperAngle: chordAngle - rootOffset,
    bend,
  });
}

/** Forward kinematics for a solved limb; the inverse of `solveTwoBone`. */
export function limbTip(
  solution: TwoBoneSolution,
  upper: number,
  lower: number,
): { readonly forward: number; readonly drop: number } {
  const upperAngle = solution.upperAngle;
  const lowerAngle = upperAngle + solution.bend;
  return Object.freeze({
    forward: upper * Math.sin(upperAngle) + lower * Math.sin(lowerAngle),
    drop: upper * Math.cos(upperAngle) + lower * Math.cos(lowerAngle),
  });
}

/**
 * Poses one limb for a gait sample.
 *
 * `restDrop` is how far below the socket the tip sits at rest: for a leg that
 * is the ground, for an arm it is the natural hang. Because the tip trajectory
 * is driven by the same distance the creature actually travelled, planted feet
 * track the ground instead of skating over it.
 */
export function poseLimb(
  limb: LimbSpec,
  gait: GaitSample,
  restDrop: number,
): LimbPose {
  const phase = gait.phase + limb.phaseOffset;
  const swing = gait.moving ? gait.amplitude : 0;

  const tipForward = limb.stride * swing * Math.cos(phase);
  // The tip only leaves the ground on the half of the cycle where it travels
  // forward; on the other half it is planted and driving the body along.
  const tipLift = limb.lift * swing * Math.max(0, -Math.sin(phase));

  const drop = restDrop - tipLift;
  const reach = Math.hypot(tipForward, drop);
  const chordAngle = Math.atan2(tipForward, drop);

  return Object.freeze({
    ...solveTwoBone(reach, limb.upperLength, limb.lowerLength, chordAngle),
    tipForward,
    tipLift,
    grounded: tipLift <= 0,
  });
}
