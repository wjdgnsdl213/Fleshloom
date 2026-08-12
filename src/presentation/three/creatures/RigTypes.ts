/**
 * Creature rig description.
 *
 * A rig is plain data: a body, a head, and a list of two-bone limbs with the
 * socket they hang from. There is no skinning and no imported skeleton — the
 * limbs are separate capsules parented in a chain, which at gameplay scale
 * reads as articulation and costs nothing to author.
 *
 * Everything here is in COLLIDER RADII, not world units, so one rig serves
 * every instance of an archetype regardless of its authored radius.
 */

export type LimbKind = 'leg' | 'arm';

/** Which side of the body a limb hangs from; also drives the gait phase. */
export type LimbSide = -1 | 1;

export interface LimbSpec {
  readonly id: string;
  readonly kind: LimbKind;
  readonly side: LimbSide;
  /** Socket position in body space: x is lateral, y is up, z is forward. */
  readonly socket: { readonly x: number; readonly y: number; readonly z: number };
  readonly upperLength: number;
  readonly lowerLength: number;
  readonly thickness: number;
  /**
   * Gait phase offset in radians. Alternating legs sit half a cycle apart;
   * an arm sits half a cycle from the leg on its own side, which is what
   * produces a contralateral swing.
   */
  readonly phaseOffset: number;
  /** How far the limb tip travels fore-and-aft, in collider radii. */
  readonly stride: number;
  /** Peak tip clearance during the swing, in collider radii. */
  readonly lift: number;
}

export interface CreatureRig {
  readonly archetype: string;
  /**
   * Multiplier on the collider radius when the rig is placed in the world.
   * Collision radii are much smaller than the bodies that carry them — the 2D
   * renderer already draws actors at roughly 5.7x their collider — and the
   * camera tilt then projects vertical extents at cos(pitch), so a rig scaled
   * one-to-one with its collider reads as a pebble.
   */
  readonly visualScale: number;
  /** Torso capsule. */
  readonly bodyRadius: number;
  readonly bodyLength: number;
  /** Height of the torso centre above the ground when standing. */
  readonly bodyHeight: number;
  /** Forward pitch of the torso, radians; positive leans the head down. */
  readonly bodyPitch: number;
  readonly headRadius: number;
  readonly headOffset: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** Vertical body travel across a stride, in collider radii. */
  readonly bob: number;
  readonly limbs: readonly LimbSpec[];
  /** Optional carapace plates, drawn with the armour material. */
  readonly plates?: readonly PlateSpec[];
}

export interface PlateSpec {
  readonly offset: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly pitch: number;
}

/**
 * Fraction of its own span an arm hangs at when resting. Kept below 1 so the
 * elbow always carries some bend and the swing never hits full extension.
 */
export const ARM_REST_SPAN_FRACTION = 0.82;

/**
 * How far below a limb's socket its tip rests. A leg reaches the ground; an
 * arm hangs. Getting this wrong is what leaves a creature skating above the
 * road, so renderer and tests both read it from here.
 */
export function restDropFor(rig: CreatureRig, limb: LimbSpec): number {
  if (limb.kind === 'leg') {
    return rig.bodyHeight + limb.socket.y;
  }
  return (limb.upperLength + limb.lowerLength) * ARM_REST_SPAN_FRACTION;
}

/** Mirrors a limb to the other side, so rigs only author one half. */
export function mirrorLimb(limb: LimbSpec, id: string): LimbSpec {
  return Object.freeze({
    ...limb,
    id,
    side: (limb.side === 1 ? -1 : 1) as LimbSide,
    socket: Object.freeze({ ...limb.socket, x: -limb.socket.x }),
    phaseOffset: limb.phaseOffset + Math.PI,
  });
}
