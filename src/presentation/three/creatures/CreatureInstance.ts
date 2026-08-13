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
import { NEUTRAL_STANCE, type Stance } from './stance';

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
    stance: Stance = NEUTRAL_STANCE,
  ): void {
    const rig = this.rig;
    const root = this.root;

    root.position.set(position.x, 0, position.y);
    root.scale.setScalar(radius * rig.visualScale);
    if (facing.x !== 0 || facing.y !== 0) {
      root.rotation.y = Math.atan2(facing.x, facing.y);
    }

    // The stance damps the stride rather than replacing it, so a creature can
    // wind up an attack without its legs freezing mid-step.
    const damped: GaitSample =
      stance.gaitDamping === 1
        ? gait
        : {
            phase: gait.phase,
            moving: gait.moving,
            amplitude: gait.amplitude * stance.gaitDamping,
          };

    const crouch = rig.bodyHeight * stance.crouch;
    const bob = bodyBob(damped, rig.bob);
    const bodyLift = bob - crouch;

    this.parts.body.position.y = rig.bodyHeight + bodyLift;
    this.parts.body.rotation.x = rig.bodyPitch + stance.pitch;

    for (const limb of this.parts.limbs) {
      // A leg's socket rides with the body, so the ground it is reaching for
      // moves with it. Without this the bob would lift the feet off the road
      // instead of coming from the legs extending, and a crouch would drive
      // them through it.
      const isLeg = limb.spec.kind === 'leg';
      if (isLeg) {
        limb.upper.position.y =
          rig.bodyHeight + limb.spec.socket.y + bodyLift;
      }
      const restDrop = restDropFor(rig, limb.spec) + (isLeg ? bodyLift : 0);
      const pose = poseLimb(limb.spec, damped, restDrop);

      // Groups rotate about X with -Y as down, so a positive forward swing is
      // a negative rotation.
      limb.upper.rotation.x =
        -pose.upperAngle - (isLeg ? 0 : stance.armLift);
      limb.lower.rotation.x = -pose.bend;
    }
  }

  /** Hides the carapace once the loop has peeled it off. */
  public setArmored(armored: boolean): void {
    this.parts.plating.visible = armored;
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
