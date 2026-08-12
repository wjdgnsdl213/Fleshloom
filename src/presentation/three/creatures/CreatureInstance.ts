/**
 * One posed creature in the scene.
 *
 * Owns the built hierarchy and drives it from a gait sample each frame. Rigs
 * are authored in collider radii, so an instance is just scaled by the radius
 * the simulation gave the actor.
 */

import type { Group, Material } from 'three';
import type { Vec2 } from '../../../core/geometry/vector';
import { buildCreature, type CreatureParts } from './CreatureMesh';
import { restDropFor, type CreatureRig } from './RigTypes';
import { bodyBob, type GaitSample } from './gait';
import { poseLimb } from './pose';

export class CreatureInstance {
  public readonly root: Group;

  private readonly parts: CreatureParts;

  public constructor(
    public readonly rig: CreatureRig,
    flesh: Material,
    plating: Material,
  ) {
    this.parts = buildCreature(rig, flesh, plating);
    this.root = this.parts.root;
  }

  public update(
    position: Vec2,
    facing: Vec2,
    radius: number,
    gait: GaitSample,
  ): void {
    const rig = this.rig;
    const root = this.root;

    root.position.set(position.x, 0, position.y);
    root.scale.setScalar(radius * rig.visualScale);
    if (facing.x !== 0 || facing.y !== 0) {
      root.rotation.y = Math.atan2(facing.x, facing.y);
    }

    const bob = bodyBob(gait, rig.bob);
    this.parts.body.position.y = rig.bodyHeight + bob;

    for (const limb of this.parts.limbs) {
      // A leg's socket rides up with the bob, so the ground it is reaching for
      // is that much further away. Without this the bob would lift the feet
      // off the road instead of coming from the legs extending.
      const isLeg = limb.spec.kind === 'leg';
      if (isLeg) {
        limb.upper.position.y = rig.bodyHeight + limb.spec.socket.y + bob;
      }
      const restDrop = restDropFor(rig, limb.spec) + (isLeg ? bob : 0);
      const pose = poseLimb(limb.spec, gait, restDrop);

      // Groups rotate about X with -Y as down, so a positive forward swing is
      // a negative rotation.
      limb.upper.rotation.x = -pose.upperAngle;
      limb.lower.rotation.x = -pose.bend;
    }
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  public dispose(): void {
    for (const geometry of this.parts.geometries) {
      geometry.dispose();
    }
    this.root.removeFromParent();
  }
}
