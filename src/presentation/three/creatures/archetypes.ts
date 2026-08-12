/**
 * Creature rigs, in collider radii.
 *
 * Wave one covers the hunter, the carrier, and the drifter; the remaining
 * archetypes fall back to the drifter rig until their own lands. Proportions
 * follow the 2D silhouettes: carriers are broad and armour-plated, drifters
 * are lean and long-limbed, and both walk hunched with back-bent legs.
 */

import { mirrorLimb, type CreatureRig, type LimbSpec } from './RigTypes';

const leg = (
  id: string,
  socketX: number,
  socketZ: number,
  upper: number,
  lower: number,
  thickness: number,
  stride: number,
  lift: number,
): LimbSpec =>
  Object.freeze({
    id,
    kind: 'leg' as const,
    side: 1 as const,
    socket: Object.freeze({ x: socketX, y: -0.1, z: socketZ }),
    upperLength: upper,
    lowerLength: lower,
    thickness,
    phaseOffset: 0,
    stride,
    lift,
  });

const arm = (
  id: string,
  socketX: number,
  socketY: number,
  upper: number,
  lower: number,
  thickness: number,
  stride: number,
): LimbSpec =>
  Object.freeze({
    id,
    kind: 'arm' as const,
    side: 1 as const,
    socket: Object.freeze({ x: socketX, y: socketY, z: 0.1 }),
    upperLength: upper,
    lowerLength: lower,
    thickness,
    // Half a cycle from the leg on the same side: the arm and the leg it
    // shares a side with swing in opposition, as they do when a body walks.
    phaseOffset: Math.PI,
    stride,
    lift: 0,
  });

// Leg spans are authored longer than the hip height they have to reach, so a
// standing creature rests with a bent knee and a full forward step never runs
// the limb out of length and leaves the foot hanging above the road.
const HUNTER_LEG = leg('leg-r', 0.42, 0, 1.3, 1.24, 0.24, 0.95, 0.42);
const HUNTER_ARM = arm('arm-r', 0.66, 0.62, 0.82, 0.78, 0.18, 0.72);

/**
 * Chosen so a standing creature occupies about the same screen height as its
 * 2D sprite once the camera tilt has foreshortened it.
 */
const VISUAL_SCALE = 1.85;

export const HUNTER_RIG: CreatureRig = Object.freeze({
  archetype: 'hunter',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.62,
  bodyLength: 1.15,
  bodyHeight: 2.35,
  // Hunched, with the head carried forward rather than stacked on top: under
  // a 55 degree camera a head directly above the torso simply hides it, and
  // the creature reads as a ball on legs.
  bodyPitch: 0.3,
  headRadius: 0.38,
  headOffset: Object.freeze({ x: 0, y: 0.74, z: 0.58 }),
  bob: 0.16,
  limbs: Object.freeze([
    HUNTER_LEG,
    mirrorLimb(HUNTER_LEG, 'leg-l'),
    HUNTER_ARM,
    mirrorLimb(HUNTER_ARM, 'arm-l'),
  ]),
});

const CARRIER_LEG = leg('leg-r', 0.54, 0, 1.21, 1.16, 0.3, 0.82, 0.36);
const CARRIER_ARM = arm('arm-r', 0.78, 0.5, 0.86, 0.9, 0.24, 0.62);

export const CARRIER_RIG: CreatureRig = Object.freeze({
  archetype: 'carrier',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.78,
  bodyLength: 1.3,
  bodyHeight: 2.2,
  bodyPitch: 0.34,
  headRadius: 0.4,
  headOffset: Object.freeze({ x: 0, y: 0.86, z: 0.52 }),
  bob: 0.13,
  limbs: Object.freeze([
    CARRIER_LEG,
    mirrorLimb(CARRIER_LEG, 'leg-l'),
    CARRIER_ARM,
    mirrorLimb(CARRIER_ARM, 'arm-l'),
  ]),
  plates: Object.freeze([
    Object.freeze({
      offset: Object.freeze({ x: 0, y: 0.62, z: -0.1 }),
      width: 1.62,
      height: 0.26,
      depth: 1.5,
      pitch: 0.34,
    }),
    Object.freeze({
      offset: Object.freeze({ x: 0, y: 0.3, z: 0.72 }),
      width: 1.2,
      height: 0.24,
      depth: 0.8,
      pitch: 0.62,
    }),
  ]),
});

const DRIFTER_LEG = leg('leg-r', 0.38, 0, 1.45, 1.38, 0.19, 1.05, 0.5);
const DRIFTER_ARM = arm('arm-r', 0.6, 0.72, 1.0, 0.96, 0.15, 0.88);

export const DRIFTER_RIG: CreatureRig = Object.freeze({
  archetype: 'drifter',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.5,
  bodyLength: 1.05,
  bodyHeight: 2.6,
  bodyPitch: 0.22,
  headRadius: 0.36,
  headOffset: Object.freeze({ x: 0, y: 0.96, z: 0.3 }),
  bob: 0.2,
  limbs: Object.freeze([
    DRIFTER_LEG,
    mirrorLimb(DRIFTER_LEG, 'leg-l'),
    DRIFTER_ARM,
    mirrorLimb(DRIFTER_ARM, 'arm-l'),
  ]),
});

const RIGS: Readonly<Record<string, CreatureRig>> = Object.freeze({
  hunter: HUNTER_RIG,
  carrier: CARRIER_RIG,
  drifter: DRIFTER_RIG,
});

/** Wave one ships three rigs; everything else walks on the drifter frame. */
export function rigFor(archetype: string): CreatureRig {
  return RIGS[archetype] ?? DRIFTER_RIG;
}
