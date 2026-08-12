/**
 * Simulation colliders for the quarantine district.
 *
 * Owner decision 2026-08-13 (see DECISIONS.md D-028): street structures stop
 * being walk-through. Every raised structure contributes one oriented-box
 * footprint that bodies collide with. Footprints are authored slightly
 * SMALLER than the visual silhouettes so brushing past a prop feels forgiving
 * and the central loop-making lane stays open.
 *
 * The living tether and capture polygon deliberately ignore these: debris is
 * low, the loop passes over it, and no locked capture rule changes.
 */

import { createObb, type Obb } from '../core/geometry/obb';
import {
  DISTRICT_BLOCKS,
  DISTRICT_PROPS,
  type DistrictPropKind,
} from './quarantineDistrict';

export interface PropFootprint {
  readonly length: number;
  readonly width: number;
  readonly rotation: number;
}

/**
 * Ground-contact footprints per prop kind at unit scale, multiplied by each
 * placement's `scale`. Sizes were derived from the authored contact-shadow
 * ellipses in the prop presentation (roughly 0.85x the visual footprint).
 */
export const PROP_FOOTPRINTS: Readonly<
  Record<DistrictPropKind, PropFootprint>
> = Object.freeze({
  'response-van': Object.freeze({ length: 236, width: 84, rotation: 0.04 }),
  'bio-barrier': Object.freeze({ length: 164, width: 40, rotation: 0 }),
  floodlight: Object.freeze({ length: 42, width: 42, rotation: 0 }),
  'collapsed-shelter': Object.freeze({ length: 222, width: 96, rotation: -0.06 }),
});

/** All static colliders bodies must respect, in authored order. */
export const QUARANTINE_COLLIDERS: readonly Obb[] = Object.freeze([
  ...DISTRICT_BLOCKS.map((block) =>
    createObb(block.position, block.length, block.width, block.rotation),
  ),
  ...DISTRICT_PROPS.map((prop) => {
    const footprint = PROP_FOOTPRINTS[prop.kind];
    return createObb(
      prop.position,
      footprint.length * prop.scale,
      footprint.width * prop.scale,
      footprint.rotation,
    );
  }),
]);
