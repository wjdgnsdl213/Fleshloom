/**
 * Builds the three.js object hierarchy for a rig.
 *
 * The chain is deliberately shallow — root, body, and one two-group chain per
 * limb — because that is all an analytic two-bone solve needs. Bones are
 * capsules sized to span exactly from their joint to the next, so a foot lands
 * on the ground plane rather than a capsule cap's worth below it.
 *
 * Legs hang from the ROOT, not from the pitched body: keeping the hips level
 * with the world means the ground distance the pose solver works from is the
 * true one, and feet plant instead of hovering. Arms hang from the body, so
 * they follow the torso lean.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { CreatureRig, LimbSpec } from './RigTypes';

export interface LimbParts {
  readonly spec: LimbSpec;
  /** Rotates about X to swing the whole limb from its socket. */
  readonly upper: Group;
  /** Rotates about X to bend the knee or elbow. */
  readonly lower: Group;
}

export interface CreatureParts {
  readonly root: Group;
  readonly body: Group;
  /** Carapace, hidden once the loop has peeled it off. */
  readonly plating: Group;
  readonly limbs: readonly LimbParts[];
  readonly geometries: readonly BufferGeometry[];
}

const CAPSULE_RINGS = 3;
const CAPSULE_SEGMENTS = 8;

/**
 * A bone capsule spanning exactly `length` from the joint downward, so the
 * hemispherical caps sit inside the span instead of overhanging it.
 */
const boneGeometry = (length: number, thickness: number): CapsuleGeometry =>
  new CapsuleGeometry(
    thickness,
    Math.max(0.02, length - thickness * 2),
    CAPSULE_RINGS,
    CAPSULE_SEGMENTS,
  );

export function buildCreature(
  rig: CreatureRig,
  flesh: Material,
  plating: Material,
): CreatureParts {
  const geometries: BufferGeometry[] = [];
  const own = <T extends BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const root = new Group();
  const body = new Group();
  body.position.y = rig.bodyHeight;
  body.rotation.x = rig.bodyPitch;
  root.add(body);

  const torso = new Mesh(
    own(
      new CapsuleGeometry(
        rig.bodyRadius,
        rig.bodyLength,
        CAPSULE_RINGS,
        CAPSULE_SEGMENTS + 2,
      ),
    ),
    flesh,
  );
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const head = new Mesh(
    own(new SphereGeometry(rig.headRadius, 12, 9)),
    flesh,
  );
  head.position.set(rig.headOffset.x, rig.headOffset.y, rig.headOffset.z);
  head.castShadow = true;
  body.add(head);

  const plateGroup = new Group();
  body.add(plateGroup);
  for (const plate of rig.plates ?? []) {
    const mesh = new Mesh(
      own(new BoxGeometry(plate.width, plate.height, plate.depth)),
      plating,
    );
    mesh.position.set(plate.offset.x, plate.offset.y, plate.offset.z);
    mesh.rotation.x = plate.pitch;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    plateGroup.add(mesh);
  }

  const limbs: LimbParts[] = [];
  for (const spec of rig.limbs) {
    const upper = new Group();
    if (spec.kind === 'leg') {
      upper.position.set(
        spec.socket.x,
        rig.bodyHeight + spec.socket.y,
        spec.socket.z,
      );
      root.add(upper);
    } else {
      upper.position.set(spec.socket.x, spec.socket.y, spec.socket.z);
      body.add(upper);
    }

    const upperMesh = new Mesh(
      own(boneGeometry(spec.upperLength, spec.thickness)),
      flesh,
    );
    upperMesh.position.y = -spec.upperLength / 2;
    upperMesh.castShadow = true;
    upper.add(upperMesh);

    const lower = new Group();
    lower.position.y = -spec.upperLength;
    upper.add(lower);

    const lowerMesh = new Mesh(
      own(boneGeometry(spec.lowerLength, spec.thickness * 0.82)),
      flesh,
    );
    lowerMesh.position.y = -spec.lowerLength / 2;
    lowerMesh.castShadow = true;
    lower.add(lowerMesh);

    limbs.push({ spec, upper, lower });
  }

  return { root, body, plating: plateGroup, limbs, geometries };
}
