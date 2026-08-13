/**
 * The Warden, in 3D.
 *
 * Radial rather than bipedal: a bulk that sits on the ground, a ring of shell
 * plates around it, two arms reaching out to the targets the simulation
 * places, a core that only opens once the shell is gone, and control nodes
 * orbiting the whole thing.
 *
 * Every part reads its position straight from the snapshot — the simulation
 * decides where an arm reaches and whether a plate is still intact, and this
 * only decides how that looks. Parts that the run has destroyed are hidden,
 * not moved, so a severed arm stays severed.
 */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { GAMEPLAY_COLORS } from '../../config/graphics';
import type { Vec2 } from '../../core/geometry/vector';
import type { WardenSnapshot } from '../../game/boss/WardenModel';
import { SCENE_PALETTE } from './materials';

/** Bulk proportions, in world units. */
const BULK_RADIUS = 96;
const BULK_HEIGHT = 132;
const PLATE_RING_RADIUS = 118;
const ARM_THICKNESS = 15;
const NODE_LIFT = 92;

/** How much of the arrival the Warden spends rising out of the ground. */
const ARRIVAL_RISE_SECONDS = 1.6;

/** Scratch vectors for aiming arms; reused so a frame allocates nothing. */
const CYLINDER_AXIS = new Vector3(0, 1, 0);
const ARM_DIRECTION = new Vector3();

export class WardenMesh {
  public readonly group = new Group();

  private readonly bulk: Mesh;
  private readonly core: Mesh;
  private readonly arms: Mesh[] = [];
  private readonly plates: Mesh[] = [];
  private readonly nodes: Mesh[] = [];

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  private readonly bulkMaterial = this.own(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.tendon),
      roughness: 0.78,
      metalness: 0.08,
    }),
  );

  private readonly plateMaterial = this.own(
    new MeshStandardMaterial({
      color: new Color(SCENE_PALETTE.bone),
      roughness: 0.42,
      metalness: 0.26,
    }),
  );

  private readonly coreMaterial = this.own(
    new MeshStandardMaterial({
      color: new Color(GAMEPLAY_COLORS.arterial),
      emissive: new Color(GAMEPLAY_COLORS.arterialBright),
      emissiveIntensity: 1.4,
      roughness: 0.36,
    }),
  );

  private readonly nodeMaterial = this.own(
    new MeshStandardMaterial({
      color: new Color(GAMEPLAY_COLORS.hostileCyan),
      emissive: new Color(GAMEPLAY_COLORS.hostileCyan),
      emissiveIntensity: 1.1,
      roughness: 0.4,
    }),
  );

  public constructor() {
    this.group.visible = false;

    this.bulk = new Mesh(
      this.ownGeometry(new SphereGeometry(BULK_RADIUS, 20, 14)),
      this.bulkMaterial,
    );
    this.bulk.castShadow = true;
    this.bulk.receiveShadow = true;
    // Squashed into a dome: it squats on the road rather than floating.
    this.bulk.scale.set(1, BULK_HEIGHT / BULK_RADIUS / 2, 1);
    this.group.add(this.bulk);

    this.core = new Mesh(
      this.ownGeometry(new IcosahedronGeometry(1, 1)),
      this.coreMaterial,
    );
    this.core.castShadow = true;
    this.group.add(this.core);
  }

  public update(warden: WardenSnapshot | null, elapsed: number): void {
    if (warden === null || warden.stage === 'defeated') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // The arrival lifts the bulk out of the ground; every later stage has it
    // fully risen.
    const risen =
      warden.stage === 'arrival'
        ? Math.min(1, warden.encounterElapsed / ARRIVAL_RISE_SECONDS)
        : 1;

    this.group.position.set(warden.center.x, 0, warden.center.y);
    this.group.rotation.y = warden.phase * 0.35;
    this.bulk.position.y = BULK_HEIGHT / 2 - (1 - risen) * BULK_HEIGHT;

    this.syncArms(warden, risen);
    this.syncPlates(warden, risen);
    this.syncCore(warden, elapsed, risen);
    this.syncNodes(warden, elapsed, risen);
  }

  public dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
  }

  /**
   * Arms are drawn as cylinders spanning from the bulk to wherever the
   * simulation has put their target, so a reaching arm and a retracted one
   * differ only in that position.
   */
  private syncArms(warden: WardenSnapshot, risen: number): void {
    warden.armTargets.forEach((arm, index) => {
      const mesh = this.armAt(index);
      if (arm.severed || risen < 1) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      const local = this.toLocal(arm.position, warden.center);
      const reach = Math.hypot(local.x, local.z);
      // A target sitting on the centre carries no direction, so fall back to
      // the arm's own side rather than collapsing both arms onto one heading.
      const angle =
        reach > 1 ? Math.atan2(local.z, local.x) : (index === 0 ? 0 : Math.PI);
      // Arms start at the shoulder, on the dome's flank, and run outward from
      // there. Centring them on the Warden instead buries all but the tip.
      const shoulder = BULK_RADIUS * 0.72;
      const length = Math.max(96, reach - shoulder);
      const mid = shoulder + length / 2;

      mesh.position.set(
        Math.cos(angle) * mid,
        BULK_HEIGHT * 0.55,
        Math.sin(angle) * mid,
      );
      mesh.scale.set(1, length, 1);
      // The cylinder is authored along +Y; aim it down the arm. A quaternion
      // from one unit vector to another avoids having to reason about Euler
      // order, which is what put the arms inside the bulk the first time.
      ARM_DIRECTION.set(Math.cos(angle), 0, Math.sin(angle));
      mesh.quaternion.setFromUnitVectors(CYLINDER_AXIS, ARM_DIRECTION);
    });

    for (let spare = warden.armTargets.length; spare < this.arms.length; spare += 1) {
      const mesh = this.arms[spare];
      if (mesh !== undefined) {
        mesh.visible = false;
      }
    }
  }

  private syncPlates(warden: WardenSnapshot, risen: number): void {
    warden.shellPlates.forEach((plate, index) => {
      const mesh = this.plateAt(index);
      if (!plate.intact || risen < 1) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      // Laid out from the plate's own side and index rather than from its
      // world position: the snapshot already says where a plate belongs on
      // the shell, and positions that coincide with the centre would stack
      // every plate on one heading.
      const lane = plate.side === 'left' ? -1 : 1;
      const angle = lane * (Math.PI / 2) + plate.index * 0.62 * lane;
      mesh.position.set(
        Math.cos(angle) * PLATE_RING_RADIUS,
        BULK_HEIGHT * 0.5,
        Math.sin(angle) * PLATE_RING_RADIUS,
      );
      mesh.rotation.y = -angle;
      mesh.scale.setScalar(Math.max(0.5, plate.radius / 40));
    });

    for (
      let spare = warden.shellPlates.length;
      spare < this.plates.length;
      spare += 1
    ) {
      const mesh = this.plates[spare];
      if (mesh !== undefined) {
        mesh.visible = false;
      }
    }
  }

  private syncCore(
    warden: WardenSnapshot,
    elapsed: number,
    risen: number,
  ): void {
    const core = warden.core;
    // The core is only a target once the shell is off; before that it stays
    // buried in the bulk rather than glowing where nothing can reach it.
    this.core.visible = core.active && risen >= 1;
    if (!this.core.visible) {
      return;
    }

    const local = this.toLocal(core.position, warden.center);
    const pulse = 1 + Math.sin(elapsed * 4.2) * 0.08;
    // Sits proud of the dome. Placed at the bulk's own mid-height it is
    // simply inside it, and the one part the endgame is about renders as
    // nothing at all.
    this.core.position.set(local.x, BULK_HEIGHT + core.radius * 0.5, local.z);
    this.core.scale.setScalar(core.radius * pulse);
    this.core.rotation.set(elapsed * 0.7, elapsed * 1.1, 0);
    this.coreMaterial.emissiveIntensity = 1.4 + Math.sin(elapsed * 4.2) * 0.5;
  }

  private syncNodes(
    warden: WardenSnapshot,
    elapsed: number,
    risen: number,
  ): void {
    warden.controlNodes.forEach((node, index) => {
      const mesh = this.nodeAt(index);
      mesh.visible = node.active && risen >= 1;
      if (!mesh.visible) {
        return;
      }
      const local = this.toLocal(node.position, warden.center);
      mesh.position.set(
        local.x,
        NODE_LIFT + Math.sin(elapsed * 2.6 + index) * 8,
        local.z,
      );
      mesh.scale.setScalar(node.radius);
    });

    for (
      let spare = warden.controlNodes.length;
      spare < this.nodes.length;
      spare += 1
    ) {
      const mesh = this.nodes[spare];
      if (mesh !== undefined) {
        mesh.visible = false;
      }
    }
  }

  /**
   * Snapshot positions are world-space, but the parts hang off a group that
   * is already translated to the Warden's centre and spun by its phase, so
   * they have to come back into that frame.
   */
  private toLocal(point: Vec2, center: Vec2): { x: number; z: number } {
    const dx = point.x - center.x;
    const dz = point.y - center.y;
    const spin = -this.group.rotation.y;
    return {
      x: dx * Math.cos(spin) - dz * Math.sin(spin),
      z: dx * Math.sin(spin) + dz * Math.cos(spin),
    };
  }

  private armAt(index: number): Mesh {
    const existing = this.arms[index];
    if (existing !== undefined) {
      return existing;
    }
    const mesh = new Mesh(
      this.ownGeometry(new CylinderGeometry(ARM_THICKNESS, ARM_THICKNESS * 0.6, 1, 8)),
      this.bulkMaterial,
    );
    mesh.castShadow = true;
    this.arms.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  private plateAt(index: number): Mesh {
    const existing = this.plates[index];
    if (existing !== undefined) {
      return existing;
    }
    const mesh = new Mesh(
      this.ownGeometry(new BoxGeometry(26, 74, 58)),
      this.plateMaterial,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.plates.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  private nodeAt(index: number): Mesh {
    const existing = this.nodes[index];
    if (existing !== undefined) {
      return existing;
    }
    const mesh = new Mesh(
      this.ownGeometry(new IcosahedronGeometry(1, 0)),
      this.nodeMaterial,
    );
    mesh.castShadow = true;
    this.nodes.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  private ownGeometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private own(material: MeshStandardMaterial): MeshStandardMaterial {
    this.materials.push(material);
    return material;
  }
}
