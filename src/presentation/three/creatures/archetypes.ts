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

// A sprinter: long legs, deep forward lean, arms tucked back out of the way.
const RUSHER_LEG = leg('leg-r', 0.34, 0, 1.52, 1.46, 0.2, 1.34, 0.56);
const RUSHER_ARM = arm('arm-r', 0.56, 0.58, 0.68, 0.72, 0.14, 0.5);

export const RUSHER_RIG: CreatureRig = Object.freeze({
  archetype: 'rusher',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.44,
  bodyLength: 1.24,
  bodyHeight: 2.45,
  bodyPitch: 0.62,
  headRadius: 0.32,
  headOffset: Object.freeze({ x: 0, y: 0.6, z: 0.86 }),
  bob: 0.24,
  limbs: Object.freeze([
    RUSHER_LEG,
    mirrorLimb(RUSHER_LEG, 'leg-l'),
    RUSHER_ARM,
    mirrorLimb(RUSHER_ARM, 'arm-l'),
  ]),
});

// A sentry: upright, stilt-legged, head held high. It positions rather than
// charges, so it takes short steps and barely leans.
const WATCHER_LEG = leg('leg-r', 0.3, 0, 1.72, 1.66, 0.14, 0.7, 0.3);
const WATCHER_ARM = arm('arm-r', 0.44, 0.86, 1.06, 1.02, 0.11, 0.42);

export const WATCHER_RIG: CreatureRig = Object.freeze({
  archetype: 'watcher',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.38,
  bodyLength: 1.16,
  bodyHeight: 3.15,
  bodyPitch: 0.05,
  headRadius: 0.34,
  headOffset: Object.freeze({ x: 0, y: 1.02, z: 0.16 }),
  bob: 0.1,
  limbs: Object.freeze([
    WATCHER_LEG,
    mirrorLimb(WATCHER_LEG, 'leg-l'),
    WATCHER_ARM,
    mirrorLimb(WATCHER_ARM, 'arm-l'),
  ]),
  plates: Object.freeze([
    Object.freeze({
      offset: Object.freeze({ x: 0, y: 0.72, z: 0.1 }),
      width: 0.96,
      height: 0.2,
      depth: 0.72,
      pitch: 0.1,
    }),
  ]),
});

// Blades for forearms: the lower arm bone is long, thin, and swings wide.
const CUTTER_LEG = leg('leg-r', 0.36, 0, 1.36, 1.3, 0.18, 1.0, 0.44);
const CUTTER_ARM = arm('arm-r', 0.62, 0.7, 0.82, 1.34, 0.12, 1.06);

export const CUTTER_RIG: CreatureRig = Object.freeze({
  archetype: 'cutter',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.46,
  bodyLength: 1.1,
  bodyHeight: 2.55,
  bodyPitch: 0.36,
  headRadius: 0.3,
  headOffset: Object.freeze({ x: 0, y: 0.7, z: 0.66 }),
  bob: 0.18,
  limbs: Object.freeze([
    CUTTER_LEG,
    mirrorLimb(CUTTER_LEG, 'leg-l'),
    CUTTER_ARM,
    mirrorLimb(CUTTER_ARM, 'arm-l'),
  ]),
});

// Wears the hunter's proportions on purpose — that is the whole threat — but
// walks with a longer, looser stride, which is the tell.
const MIMIC_LEG = leg('leg-r', 0.42, 0, 1.34, 1.28, 0.23, 1.12, 0.46);
const MIMIC_ARM = arm('arm-r', 0.66, 0.62, 0.84, 0.8, 0.17, 0.86);

export const MIMIC_RIG: CreatureRig = Object.freeze({
  archetype: 'mimic',
  visualScale: VISUAL_SCALE,
  bodyRadius: 0.6,
  bodyLength: 1.15,
  bodyHeight: 2.38,
  bodyPitch: 0.26,
  headRadius: 0.38,
  headOffset: Object.freeze({ x: 0, y: 0.74, z: 0.56 }),
  bob: 0.19,
  limbs: Object.freeze([
    MIMIC_LEG,
    mirrorLimb(MIMIC_LEG, 'leg-l'),
    MIMIC_ARM,
    mirrorLimb(MIMIC_ARM, 'arm-l'),
  ]),
});

// Slow, broad, and plated. The plates are what the loop has to peel off, so
// they are the loudest thing in the silhouette.
const HUSK_LEG = leg('leg-r', 0.66, 0, 1.22, 1.16, 0.38, 0.66, 0.26);
const HUSK_ARM = arm('arm-r', 0.92, 0.42, 0.94, 0.98, 0.3, 0.5);

export const ELITE_HUSK_RIG: CreatureRig = Object.freeze({
  archetype: 'elite-husk',
  // The husk already carries the largest collision radius in the game, so the
  // shared visual multiplier stacks on top of a body that is big to begin
  // with and it swamps the frame. It should read as the heaviest thing on
  // screen, not as three of everything else.
  visualScale: 1.32,
  bodyRadius: 0.86,
  bodyLength: 1.4,
  bodyHeight: 2.1,
  bodyPitch: 0.4,
  headRadius: 0.36,
  headOffset: Object.freeze({ x: 0, y: 0.66, z: 0.76 }),
  bob: 0.09,
  limbs: Object.freeze([
    HUSK_LEG,
    mirrorLimb(HUSK_LEG, 'leg-l'),
    HUSK_ARM,
    mirrorLimb(HUSK_ARM, 'arm-l'),
  ]),
  // Plates hug the back rather than jutting past the silhouette; a slab wider
  // than the body it sits on reads as a signboard, not a carapace.
  plates: Object.freeze([
    Object.freeze({
      offset: Object.freeze({ x: 0, y: 0.6, z: -0.12 }),
      width: 1.38,
      height: 0.26,
      depth: 1.24,
      pitch: 0.4,
    }),
    Object.freeze({
      offset: Object.freeze({ x: 0, y: 0.3, z: 0.72 }),
      width: 1.02,
      height: 0.24,
      depth: 0.62,
      pitch: 0.72,
    }),
    Object.freeze({
      offset: Object.freeze({ x: 0, y: -0.32, z: 0.42 }),
      width: 1.16,
      height: 0.2,
      depth: 0.7,
      pitch: 0.2,
    }),
  ]),
});

const RIGS: Readonly<Record<string, CreatureRig>> = Object.freeze({
  hunter: HUNTER_RIG,
  carrier: CARRIER_RIG,
  drifter: DRIFTER_RIG,
  rusher: RUSHER_RIG,
  watcher: WATCHER_RIG,
  cutter: CUTTER_RIG,
  mimic: MIMIC_RIG,
  'elite-husk': ELITE_HUSK_RIG,
});

/** Every archetype now has its own frame; the drifter is the last resort. */
export function rigFor(archetype: string): CreatureRig {
  return RIGS[archetype] ?? DRIFTER_RIG;
}

export const ALL_RIGS: readonly CreatureRig[] = Object.freeze(
  Object.values(RIGS),
);
