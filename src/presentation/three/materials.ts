/**
 * Shared materials and palette for the 3D backend.
 *
 * Colours are lifted straight from GAMEPLAY_COLORS so the two backends stay
 * the same game rather than two different-looking builds. Materials are shared
 * across every instance that uses them and disposed once, through
 * `disposeSharedMaterials`.
 */

import {
  Color,
  MeshStandardMaterial,
  type Material,
} from 'three';
import { GAMEPLAY_COLORS } from '../../config/graphics';

/**
 * These are ALBEDOS, not final pixel values like the 2D palette. Measured
 * against the rig's key-plus-hemisphere setup the overall gain on an up-facing
 * surface is close to 1.0, so the ground sits near its authored 2D tone while
 * surfaces that read as lit tops in the 2D art (barrier caps, van roofs) are
 * raised — in 3D those faces earn their brightness from the light rather than
 * from being painted bright. Emissive and signal colours stay identical to the
 * 2D palette, since those are read as light rather than as surface.
 */
export const SCENE_PALETTE = Object.freeze({
  void: GAMEPLAY_COLORS.void,
  bone: GAMEPLAY_COLORS.bone,
  tendon: GAMEPLAY_COLORS.tendon,
  arterial: GAMEPLAY_COLORS.arterial,
  arterialBright: GAMEPLAY_COLORS.arterialBright,
  amber: GAMEPLAY_COLORS.amber,
  hostileCyan: GAMEPLAY_COLORS.hostileCyan,
  asphalt: 0x232a2f,
  concrete: 0x8f979c,
  concreteDark: 0x4a5155,
  steel: 0x40484d,
  puddle: 0x161d21,
});

const tracked: Material[] = [];

const track = <T extends Material>(material: T): T => {
  tracked.push(material);
  return material;
};

export const SHARED_MATERIALS = {
  ground: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.asphalt),
      roughness: 0.92,
      metalness: 0.04,
    }),
  ),
  // Deliberately near-dielectric. A high metalness puddle has nothing to
  // mirror without an environment map, so it renders as a black hole punched
  // in the road; the low roughness alone gives the key light a wet highlight.
  puddle: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.puddle),
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    }),
  ),
  concrete: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.concrete),
      roughness: 0.86,
      metalness: 0.05,
    }),
  ),
  concreteDark: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.concreteDark),
      roughness: 0.88,
      metalness: 0.05,
    }),
  ),
  steel: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.steel),
      roughness: 0.52,
      metalness: 0.68,
    }),
  ),
  lamp: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.amber),
      emissive: new Color(SCENE_PALETTE.amber),
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
  ),
  hunterFlesh: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.bone),
      roughness: 0.68,
      metalness: 0.06,
    }),
  ),
  hostileFlesh: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.tendon),
      roughness: 0.74,
      metalness: 0.04,
    }),
  ),
  armorPlate: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.bone),
      roughness: 0.46,
      metalness: 0.22,
    }),
  ),
  tether: track(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.arterial),
      emissive: new Color(SCENE_PALETTE.arterialBright),
      emissiveIntensity: 0.9,
      roughness: 0.5,
    }),
  ),
} as const;

export function disposeSharedMaterials(): void {
  for (const material of tracked) {
    material.dispose();
  }
  tracked.length = 0;
}
